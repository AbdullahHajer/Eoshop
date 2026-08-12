$ErrorActionPreference = 'Stop'

$repositoryRoot = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
Push-Location $repositoryRoot

try {
    if (-not $env:DOCKER_CONFIG) {
        $env:DOCKER_CONFIG = Join-Path $repositoryRoot '.docker-local'
        New-Item -ItemType Directory -Force -Path $env:DOCKER_CONFIG | Out-Null
    }

    # Keep this gate self-contained on Windows runners where the sandbox and the
    # invoking account can have different SIDs. Do not mutate global Git config.
    $trackedFiles = @(& git -c "safe.directory=$repositoryRoot" ls-files)
    if ($LASTEXITCODE -ne 0) {
        throw 'Unable to enumerate tracked files.'
    }

    $forbiddenTrackedPatterns = @(
        '(^|/)\.env$',
        '(^|/)node_modules/',
        '(^|/)dist/',
        '^backend/vendor/',
        '^backend/storage/logs/[^.]',
        '^backend/storage/framework/(sessions|views)/[^.]',
        '^backend/bootstrap/cache/.*\.php$'
    )

    foreach ($pattern in $forbiddenTrackedPatterns) {
        $matches = @($trackedFiles | Where-Object { $_ -match $pattern })
        if ($matches.Count -gt 0) {
            throw "Forbidden tracked files matched '$pattern': $($matches -join ', ')"
        }
    }

    if (Test-Path 'server.ts') {
        throw 'server.ts must not return as a second application server.'
    }

    $package = Get-Content -Raw 'package.json' | ConvertFrom-Json
    $directDependencies = @($package.dependencies.PSObject.Properties.Name) +
        @($package.devDependencies.PSObject.Properties.Name)
    $forbiddenDependencies = @('express', 'dotenv', '@google/genai', 'tsx', '@types/express')
    $dependencyMatches = @($forbiddenDependencies | Where-Object { $directDependencies -contains $_ })

    if ($dependencyMatches.Count -gt 0) {
        throw "Forbidden direct dependencies found: $($dependencyMatches -join ', ')"
    }

    Get-Content -Raw 'backend/composer.json' | ConvertFrom-Json | Out-Null

    $env:POSTGRES_PASSWORD = 'ci-only-not-a-production-secret'
    $env:APP_PORT = '18080'
    $env:BACKEND_IMAGE = 'eoshop/backend:ci'
    $env:WEB_IMAGE = 'eoshop/web:ci'

    docker compose config --quiet
    if ($LASTEXITCODE -ne 0) {
        throw 'Docker Compose configuration is invalid.'
    }

    Write-Output 'Repository gate passed.'
}
finally {
    Pop-Location
}
