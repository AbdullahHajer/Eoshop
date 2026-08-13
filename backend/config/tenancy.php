<?php

declare(strict_types=1);

use App\Models\Domain;
use App\Models\Tenant;
use Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper;
use Stancl\Tenancy\Generators\UuidGenerator;
use Stancl\Tenancy\TenantDatabaseManagers\PostgreSQLSchemaManager;

return [
    'routes' => false,

    'tenant_model' => Tenant::class,
    'id_generator' => UuidGenerator::class,

    'domain_model' => Domain::class,

    'central_domains' => array_values(array_filter(array_map(
        static fn (string $domain): string => trim($domain),
        explode(',', env('CENTRAL_DOMAINS', 'localhost,127.0.0.1')),
    ))),

    'tenant_base_domain' => env('TENANT_BASE_DOMAIN', 'eoshop.local'),

    'bootstrappers' => [
        DatabaseTenancyBootstrapper::class,
    ],

    'database' => [
        'central_connection' => env('DB_CONNECTION', 'pgsql'),

        'template_tenant_connection' => null,

        'prefix' => env('TENANT_DB_PREFIX', 'tenant_'),
        'suffix' => '',

        'managers' => [
            'pgsql' => PostgreSQLSchemaManager::class,
        ],
    ],

    'cache' => [
        'tag_base' => 'tenant',
    ],

    'filesystem' => [
        'suffix_base' => 'tenant',
        'disks' => [
            'local',
            'public',
        ],
        'root_override' => [
            'local' => '%storage_path%/app/tenants/%tenant%',
            'public' => '%storage_path%/app/public/tenants/%tenant%',
        ],
    ],

    'migration_parameters' => [
        '--path' => [database_path('migrations/tenant')],
        '--realpath' => true,
    ],

    'seeder_parameters' => [
        '--class' => 'Database\Seeders\TenantDatabaseSeeder',
    ],
];
