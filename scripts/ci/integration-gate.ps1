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
        '--env', 'SESSION_DRIVER=database',
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
    }
    finally {
        $client.Dispose()
        $handler.Dispose()
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
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:rollback --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$identityMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate --path=$authMigration --force --no-interaction
    Invoke-Compose exec -T backend php artisan db:seed --class=Database\Seeders\IdentitySeeder --force --no-interaction
    Invoke-Compose exec -T backend php artisan migrate:status --path=database/migrations/system --no-interaction

    Add-Type -AssemblyName System.Net.Http
    $client = [System.Net.Http.HttpClient]::new()
    $client.BaseAddress = [Uri]"http://127.0.0.1:$Port"
    $client.Timeout = [TimeSpan]::FromSeconds(30)

    try {
        Assert-HttpResponse $client '/' 200 'text/html' 'id="root"'
        Assert-HttpResponse $client '/up' 200 'text/html'
        Assert-HttpResponse $client '/api/does-not-exist' 404 'application/json'
        Assert-HttpResponse $client '/api/auth/session' 200 'application/json' '"data":null'
        Assert-AuthenticationBoundary -Port $Port
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
