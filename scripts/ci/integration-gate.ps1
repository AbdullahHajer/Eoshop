param(
    [string]$ProjectName = 'eoshop-ci',
    [int]$Port = 18080
)

$ErrorActionPreference = 'Stop'
$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$stackStarted = $false

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }
}

function Get-ComposeOutput {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)

    $output = & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw "docker compose failed: $($Arguments -join ' ')"
    }

    return ($output -join "`n")
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

function Invoke-IdentityDatabaseTests {
    $networkName = "${ProjectName}_app"
    $dockerArguments = @(
        'run', '--rm',
        '--network', $networkName,
        '--env', 'DB_CONNECTION=pgsql',
        '--env', 'DB_HOST=db',
        '--env', 'DB_PORT=5432',
        '--env', "DB_DATABASE=$($env:POSTGRES_DB)",
        '--env', "DB_USERNAME=$($env:POSTGRES_USER)",
        '--env', "DB_PASSWORD=$($env:POSTGRES_PASSWORD)",
        '--env', 'CACHE_STORE=database',
        '--env', 'DB_CACHE_CONNECTION=pgsql',
        '--env', 'DB_CACHE_LOCK_CONNECTION=pgsql',
        '--env', 'DB_QUEUE_CONNECTION=pgsql',
        '--env', 'SESSION_DRIVER=database',
        '--env', 'SESSION_CONNECTION=pgsql',
        'eoshop/backend-quality:ci',
        'composer', 'test:database'
    )

    & docker @dockerArguments
    if ($LASTEXITCODE -ne 0) {
        throw 'Central identity database tests failed.'
    }
}

function Assert-AuthenticationBoundary {
    param([int]$Port)

    $jsonContentType = [System.Net.Http.Headers.MediaTypeHeaderValue]::new('application/json')

    $untrustedClient = [System.Net.Http.HttpClient]::new()
    $untrustedClient.BaseAddress = [Uri]"http://127.0.0.1:$Port"

    try {
        $body = [System.Net.Http.StringContent]::new('{"email":"nobody@example.com","password":"invalid-password"}')
        $body.Headers.ContentType = $jsonContentType
        $response = $untrustedClient.PostAsync('/api/auth/login', $body).GetAwaiter().GetResult()

        if ([int]$response.StatusCode -ne 419) {
            throw "Expected CSRF rejection HTTP 419 without a session token, received $([int]$response.StatusCode)."
        }
    }
    finally {
        $untrustedClient.Dispose()
    }

    $handler = [System.Net.Http.HttpClientHandler]::new()
    $handler.CookieContainer = [System.Net.CookieContainer]::new()
    $client = [System.Net.Http.HttpClient]::new($handler)
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"

    try {
        $csrfResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        $csrfPayload = $csrfResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult() | ConvertFrom-Json

        if ([int]$csrfResponse.StatusCode -ne 200 -or -not $csrfPayload.csrf_token) {
            throw 'Failed to establish the authentication CSRF session.'
        }

        $anonymousCookie = @($handler.CookieContainer.GetCookies($client.BaseAddress))[0]

        if (-not $anonymousCookie) {
            throw 'CSRF bootstrap did not issue the opaque session cookie.'
        }

        $client.DefaultRequestHeaders.Add('X-CSRF-TOKEN', [string]$csrfPayload.csrf_token)
        $protectedBody = [System.Net.Http.StringContent]::new('{"description":"protected generator"}')
        $protectedBody.Headers.ContentType = $jsonContentType
        $protectedResponse = $client.PostAsync('/api/generate-store-ideas', $protectedBody).GetAwaiter().GetResult()
        if ([int]$protectedResponse.StatusCode -ne 401) {
            throw "Expected authenticated-only generator HTTP 401 for an anonymous CSRF session, received $([int]$protectedResponse.StatusCode)."
        }

        $body = [System.Net.Http.StringContent]::new('{"email":"nobody@example.com","password":"invalid-password"}')
        $body.Headers.ContentType = $jsonContentType
        $response = $client.PostAsync('/api/auth/login', $body).GetAwaiter().GetResult()

        if ([int]$response.StatusCode -ne 422) {
            throw "Expected authenticated CSRF boundary to reach credential validation HTTP 422, received $([int]$response.StatusCode)."
        }

        $registrationJson = '{"name":"WP 1.2 Live Gate","email":"wp12-live-gate@example.test","phone":"+967700000000","password":"not-a-secret","password_confirmation":"not-a-secret"}'
        $registrationBody = [System.Net.Http.StringContent]::new($registrationJson)
        $registrationBody.Headers.ContentType = $jsonContentType
        $registrationResponse = $client.PostAsync('/api/auth/register', $registrationBody).GetAwaiter().GetResult()

        if ([int]$registrationResponse.StatusCode -ne 201) {
            throw "Expected live registration HTTP 201, received $([int]$registrationResponse.StatusCode)."
        }

        $authenticatedCookie = $handler.CookieContainer.GetCookies($client.BaseAddress)[$anonymousCookie.Name]
        if (-not $authenticatedCookie -or $authenticatedCookie.Value -eq $anonymousCookie.Value) {
            throw 'Registration did not rotate the browser session identifier.'
        }

        $sessionResponse = $client.GetAsync('/api/auth/session').GetAwaiter().GetResult()
        $sessionPayload = $sessionResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$sessionResponse.StatusCode -ne 200 -or -not $sessionPayload.Contains('wp12-live-gate@example.test')) {
            throw 'The rotated live session did not restore the registered identity.'
        }

        $adminResponse = $client.GetAsync('/api/admin/stores').GetAwaiter().GetResult()
        if ([int]$adminResponse.StatusCode -ne 403) {
            throw "Expected authenticated merchant HTTP 403 at the platform boundary, received $([int]$adminResponse.StatusCode)."
        }
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
    }
}

function Assert-TenancyBoundary {
    param([int]$Port)

    $tenantId = 'wp21-live'
    $tenantDomain = 'wp21-live.example.test'
    $hashAlgorithm = [System.Security.Cryptography.SHA256]::Create()
    try {
        $hashBytes = $hashAlgorithm.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($tenantId))
    }
    finally {
        $hashAlgorithm.Dispose()
    }
    $hash = -join ($hashBytes | ForEach-Object { $_.ToString('x2') })
    $schema = "tenant_wp21_live_$($hash.Substring(0, 16))"

    $tenantSql = @"
INSERT INTO tenants (id, store_name, owner_name, owner_email, business_type, verification_status, theme_style, created_at, updated_at)
VALUES ('$tenantId', 'WP 2.1 Live Store', 'Live Owner', 'live-owner@example.test', 'retail', 'approved', 'elegant', now(), now());
INSERT INTO domains (domain, tenant_id, created_at, updated_at)
VALUES ('$tenantDomain', '$tenantId', now(), now());
CREATE SCHEMA "$schema";
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql',
        '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER,
        '-d', $env:POSTGRES_DB,
        '-c', $tenantSql
    )
    Invoke-Compose exec -T backend php artisan tenants:migrate --tenants=$tenantId --force --no-interaction

    $configSql = @"
SET search_path TO "$schema";
INSERT INTO store_configs (id, config_json, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000021',
    json_build_object('marker', 'wp21-live'),
    now(),
    now()
);
"@
    Invoke-Compose -Arguments @(
        'exec', '-T', 'db', 'psql',
        '-v', 'ON_ERROR_STOP=1',
        '-U', $env:POSTGRES_USER,
        '-d', $env:POSTGRES_DB,
        '-c', $configSql
    )

    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.DefaultRequestHeaders.Host = $tenantDomain

    try {
        $configResponse = $client.GetAsync('/api/store/config').GetAwaiter().GetResult()
        $configBody = $configResponse.Content.ReadAsStringAsync().GetAwaiter().GetResult()
        if ([int]$configResponse.StatusCode -ne 200 -or -not $configBody.Contains('wp21-live')) {
            throw "Tenant Host did not resolve its isolated store configuration. Status: $([int]$configResponse.StatusCode)."
        }

        $adminResponse = $client.GetAsync('/api/admin/stores').GetAwaiter().GetResult()
        if ([int]$adminResponse.StatusCode -ne 404) {
            throw "Expected platform administration HTTP 404 on a tenant Host, received $([int]$adminResponse.StatusCode)."
        }

        $client.DefaultRequestHeaders.Host = 'unknown.example.test'
        $unknownResponse = $client.GetAsync('/api/auth/csrf').GetAwaiter().GetResult()
        if ([int]$unknownResponse.StatusCode -ne 404) {
            throw "Expected unknown Host authentication HTTP 404, received $([int]$unknownResponse.StatusCode)."
        }
    }
    finally {
        $client.Dispose()
    }
}

Push-Location $repositoryRoot

try {
    $env:POSTGRES_DB = 'eoshop_ci'
    $env:POSTGRES_USER = 'eoshop_ci'
    $env:POSTGRES_PASSWORD = 'ci-only-not-a-production-secret'
    $env:APP_KEY = 'base64:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='
    $env:APP_PORT = $Port.ToString()
    if (-not $env:BACKEND_IMAGE) { $env:BACKEND_IMAGE = 'eoshop/backend:ci' }
    if (-not $env:WEB_IMAGE) { $env:WEB_IMAGE = 'eoshop/web:ci' }

    Invoke-Compose config --quiet
    # Mark the project for cleanup before starting so partially-created stacks
    # are removed as well when `up --wait` fails.
    $stackStarted = $true
    Invoke-Compose up -d --no-build --wait --wait-timeout 240

    Invoke-Compose exec -T backend php artisan migrate --path=database/migrations/system --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    Invoke-IdentityDatabaseTests

    $authMigration = 'database/migrations/system/2026_08_12_000004_create_authentication_state_tables.php'
    $identityMigration = 'database/migrations/system/2026_08_12_000003_create_central_identity_tables.php'
    $authorizationMigration = 'database/migrations/system/2026_08_13_000005_harden_tenant_verification_status.php'
    $tenancyMigration = 'database/migrations/system/2026_08_14_000006_enforce_canonical_tenant_domains.php'
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$tenancyMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$authorizationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$authorizationMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$tenancyMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:status --path=database/migrations/system --no-interaction
    Invoke-Compose exec -T backend php artisan route:cache --no-interaction
    $tenantRoutes = Get-ComposeOutput exec -T backend php artisan route:list --path=api/store/config --json --no-interaction | ConvertFrom-Json
    if (@($tenantRoutes).Count -ne 2) {
        throw "Expected exactly two cached tenant store-config routes, received $(@($tenantRoutes).Count)."
    }
    Invoke-Compose exec -T backend php artisan route:clear --no-interaction

    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.Timeout = [TimeSpan]::FromSeconds(30)

    try {
        Assert-HttpResponse $client '/' 200 'text/html' 'id="root"'
        Assert-HttpResponse $client '/up' 200 'text/html'
        Assert-HttpResponse $client '/api/does-not-exist' 404 'application/json'
        Assert-HttpResponse $client '/api/auth/session' 200 'application/json' '"data":null'
        Assert-HttpResponse $client '/api/admin/stores' 401 'application/json'
        Assert-AuthenticationBoundary -Port $Port
        Assert-TenancyBoundary -Port $Port
    }
    finally {
        $client.Dispose()
    }

    Write-Output 'Container integration gate passed.'
}
finally {
    if ($stackStarted) {
        & docker compose -p $ProjectName -f docker-compose.yml -f docker-compose.ci.yml down --volumes --remove-orphans
    }
    Pop-Location
}
