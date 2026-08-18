param(
    [string]$AdminEmail = 'qa.admin@eoshop.local',
    [string]$AdminName = 'Pilot QA Administrator',
    [string]$ProjectName = 'eoshop-pilot',
    [string]$TenantBaseDomain = 'lvh.me',
    [int]$Port = 8010,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$rootEnvironment = Join-Path $repositoryRoot '.env'
$backendEnvironment = Join-Path $repositoryRoot 'backend\.env'
$locationPushed = $false
$managedEnvironmentNames = @('APP_PORT', 'TENANT_BASE_DOMAIN', 'CENTRAL_DOMAINS', 'VITE_TENANT_BASE_DOMAIN', 'VITE_CENTRAL_DOMAINS')
$previousEnvironment = @{}
foreach ($environmentName in $managedEnvironmentNames) {
    $currentValue = Get-Item -LiteralPath "Env:$environmentName" -ErrorAction SilentlyContinue
    $previousEnvironment[$environmentName] = @{
        Exists = $null -ne $currentValue
        Value = if ($null -ne $currentValue) { $currentValue.Value } else { $null }
    }
}

function Get-EnvironmentValue {
    param(
        [string]$Path,
        [string]$Name
    )

    $line = Get-Content -LiteralPath $Path | Where-Object { $_ -match "^$([regex]::Escape($Name))=" } | Select-Object -Last 1
    if ($null -eq $line) {
        return ''
    }

    return (($line -split '=', 2)[1]).Trim().Trim('"').Trim("'")
}

function Ensure-ApplicationKey {
    param([string]$Path)

    $current = Get-EnvironmentValue -Path $Path -Name 'APP_KEY'
    if (-not [string]::IsNullOrWhiteSpace($current)) {
        return
    }

    $bytes = New-Object byte[] 32
    $generator = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    try {
        $generator.GetBytes($bytes)
    } finally {
        $generator.Dispose()
    }

    $applicationKey = 'base64:' + [Convert]::ToBase64String($bytes)
    $content = [System.IO.File]::ReadAllText($Path)
    $updated = [regex]::Replace($content, '(?m)^APP_KEY=.*$', "APP_KEY=$applicationKey")
    if ($updated -eq $content) {
        throw 'backend/.env does not contain an APP_KEY entry.'
    }

    [System.IO.File]::WriteAllText($Path, $updated, (New-Object System.Text.UTF8Encoding($false)))
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose -p $ProjectName @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Wait-ForPilotHealth {
    param([string]$Url)

    for ($attempt = 1; $attempt -le 30; $attempt += 1) {
        try {
            $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 5
            if ([int]$response.StatusCode -eq 200) {
                return
            }
        } catch {
            if ($attempt -eq 30) {
                throw "Pilot health endpoint did not become ready at $Url."
            }
        }

        Start-Sleep -Seconds 2
    }
}

function Assert-PilotHostBoundary {
    param([string]$Url)

    Add-Type -AssemblyName System.Net.Http
    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.UseProxy = $false
    $client = [System.Net.Http.HttpClient]::new($handler)
    try {
        $response = $client.GetAsync($Url).GetAwaiter().GetResult()
        if ([int]$response.StatusCode -ne 404) {
            throw "Expected the unresolved Pilot tenant Host boundary to return HTTP 404, received $([int]$response.StatusCode)."
        }
    } finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

if (-not (Test-Path -LiteralPath $rootEnvironment)) {
    throw 'Missing root .env. Copy .env.example to .env and set a local PostgreSQL password.'
}

if (-not (Test-Path -LiteralPath $backendEnvironment)) {
    throw 'Missing backend/.env. Copy backend/.env.example to backend/.env, set APP_KEY and use the same PostgreSQL password.'
}

try {
    if ([string]::IsNullOrWhiteSpace($env:QA_ADMIN_PASSWORD)) {
        $securePassword = Read-Host 'Pilot QA administrator password (12–128 characters with letters and numbers)' -AsSecureString
        $passwordPointer = [IntPtr]::Zero
        try {
            $passwordPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
            $env:QA_ADMIN_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPointer)
        } finally {
            if ($passwordPointer -ne [IntPtr]::Zero) {
                [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPointer)
            }
        }
    }
    if ([string]::IsNullOrWhiteSpace($env:QA_ADMIN_PASSWORD) -or $env:QA_ADMIN_PASSWORD.Length -lt 12) {
        throw 'The Pilot QA administrator password must contain 12–128 characters with letters and numbers.'
    }

    $rootDatabasePassword = Get-EnvironmentValue -Path $rootEnvironment -Name 'POSTGRES_PASSWORD'
    $backendDatabasePassword = Get-EnvironmentValue -Path $backendEnvironment -Name 'DB_PASSWORD'
    if ([string]::IsNullOrWhiteSpace($rootDatabasePassword) -or $rootDatabasePassword -match 'replace-with') {
        throw 'Set a non-placeholder POSTGRES_PASSWORD in the ignored root .env file.'
    }
    if ($rootDatabasePassword -ne $backendDatabasePassword) {
        throw 'POSTGRES_PASSWORD and backend DB_PASSWORD must match. Their values were not displayed.'
    }
    if ((Get-EnvironmentValue -Path $backendEnvironment -Name 'APP_ENV') -eq 'production') {
        throw 'The local Pilot refuses backend APP_ENV=production.'
    }

    Ensure-ApplicationKey -Path $backendEnvironment

    $probeHost = "eoshop-pilot-probe.$TenantBaseDomain"
    $probeAddresses = @([System.Net.Dns]::GetHostAddresses($probeHost))
    if ($probeAddresses.Count -eq 0 -or ($probeAddresses | Where-Object { -not [System.Net.IPAddress]::IsLoopback($_) })) {
        throw "Every resolved address for $probeHost must be a loopback address before the browser Pilot starts."
    }

    $env:APP_PORT = [string]$Port
    $env:TENANT_BASE_DOMAIN = $TenantBaseDomain
    $env:CENTRAL_DOMAINS = "localhost,127.0.0.1,$TenantBaseDomain"
    $env:VITE_TENANT_BASE_DOMAIN = $TenantBaseDomain
    $env:VITE_CENTRAL_DOMAINS = $env:CENTRAL_DOMAINS

    Push-Location $repositoryRoot
    $locationPushed = $true
    $upArguments = @('up', '-d')
    if (-not $SkipBuild) {
        $upArguments += '--build'
    }
    $upArguments += @('db', 'backend', 'web')
    Invoke-Compose -Arguments $upArguments

    Invoke-Compose -Arguments @('exec', '-T', 'backend', 'php', 'artisan', 'migrate', '--path=database/migrations/system', '--force', '--no-interaction')
    Invoke-Compose -Arguments @('exec', '-T', 'backend', 'php', 'artisan', 'db:seed', '--force')
    Invoke-Compose -Arguments @('exec', '-T', 'backend', 'php', 'artisan', 'qa:migrate-active-tenants')
    Invoke-Compose -Arguments @(
        'exec', '-T', '-e', 'QA_ADMIN_PASSWORD',
        'backend', 'php', 'artisan', 'qa:provision-admin',
        "--email=$AdminEmail", "--name=$AdminName"
    )
    Invoke-Compose -Arguments @('up', '-d', 'worker', 'scheduler')

    $healthUrl = "http://127.0.0.1:$Port/up"
    Wait-ForPilotHealth $healthUrl
    Assert-PilotHostBoundary "http://$probeHost`:$Port/api/auth/csrf"

    $runningServices = @(& docker compose -p $ProjectName ps --status running --services)
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to inspect running Compose services.'
    }

    foreach ($requiredService in @('db', 'backend', 'worker', 'scheduler', 'web')) {
        if ($runningServices -notcontains $requiredService) {
            throw "Required Pilot service is not running: $requiredService"
        }
    }

    Write-Host ''
    Write-Host 'Eoshop Pilot is ready.' -ForegroundColor Green
    Write-Host "Application: http://127.0.0.1:$Port/"
    Write-Host "Administration: http://127.0.0.1:$Port/admin"
    Write-Host "Published stores: http://<handle>.$TenantBaseDomain`:$Port/"
    Write-Host "QA administrator: $($AdminEmail.Trim().ToLowerInvariant())"
    Write-Host 'The password remains only in QA_ADMIN_PASSWORD and was not displayed.'
    Write-Host 'Use a newly registered merchant account for the merchant journey.'
} finally {
    if ($locationPushed) {
        Pop-Location
    }
    Remove-Item Env:QA_ADMIN_PASSWORD -ErrorAction SilentlyContinue
    foreach ($environmentName in $managedEnvironmentNames) {
        if ($previousEnvironment[$environmentName].Exists) {
            Set-Item -LiteralPath "Env:$environmentName" -Value $previousEnvironment[$environmentName].Value
        } else {
            Remove-Item -LiteralPath "Env:$environmentName" -ErrorAction SilentlyContinue
        }
    }
}
