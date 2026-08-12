param(
    [string]$ProjectName = 'eoshop-ci',
    [int]$Port = 18080
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stackStarted = $false

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose -p $ProjectName @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Assert-HttpResponse {
    param(
        [System.Net.Http.HttpClient]$Client,
        [string]$Path,
        [int]$ExpectedStatus,
        [string]$ExpectedContentType,
        [string]$ExpectedBodyFragment = ''
    )

    $response = $Client.GetAsync($Path).GetAwaiter().GetResult()
    $body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $actualStatus = [int]$response.StatusCode
    $actualContentType = $response.Content.Headers.ContentType.MediaType

    if ($actualStatus -ne $ExpectedStatus) {
        throw "Expected HTTP $ExpectedStatus for $Path, received $actualStatus."
    }

    if ($actualContentType -ne $ExpectedContentType) {
        throw "Expected content type $ExpectedContentType for $Path, received $actualContentType."
    }

    if ($ExpectedBodyFragment -and -not $body.Contains($ExpectedBodyFragment)) {
        throw "Response body for $Path did not contain the expected marker."
    }
}

Push-Location $repositoryRoot

try {
    $env:POSTGRES_DB = 'eoshop_ci'
    $env:POSTGRES_USER = 'eoshop_ci'
    $env:POSTGRES_PASSWORD = 'ci-only-not-a-production-secret'
    $env:APP_PORT = $Port.ToString()
    if (-not $env:BACKEND_IMAGE) { $env:BACKEND_IMAGE = 'eoshop/backend:ci' }
    if (-not $env:WEB_IMAGE) { $env:WEB_IMAGE = 'eoshop/web:ci' }

    Invoke-Compose config --quiet
    # Mark the project for cleanup before starting so partially-created stacks
    # are removed as well when `up --wait` fails.
    $stackStarted = $true
    Invoke-Compose up -d --no-build --wait --wait-timeout 240

    Invoke-Compose exec -T backend php artisan migrate --path=database/migrations/system --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:status --path=database/migrations/system --no-interaction

    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.Timeout = [TimeSpan]::FromSeconds(30)

    try {
        Assert-HttpResponse $client '/' 200 'text/html' 'id="root"'
        Assert-HttpResponse $client '/up' 200 'text/html'
        Assert-HttpResponse $client '/api/does-not-exist' 404 'application/json'
    }
    finally {
        $client.Dispose()
    }

    Write-Output 'Container integration gate passed.'
}
finally {
    if ($stackStarted) {
        & docker compose -p $ProjectName down --volumes --remove-orphans
    }
    Pop-Location
}
