<?php

declare(strict_types=1);

use Stancl\Tenancy\Database\Models\Domain;
use Stancl\Tenancy\Database\Models\Tenant;

return [
    'tenant_model' => App\Models\Tenant::class,
    'id_generator' => Stancl\Tenancy\Generators\UuidGenerator::class,

    'domain_model' => App\Models\Domain::class,

    'central_domains' => explode(',', env('CENTRAL_DOMAINS', 'localhost,127.0.0.1')),

    'bootstrappers' => [
        Stancl\Tenancy\Bootstrappers\DatabaseTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\FilesystemTenancyBootstrapper::class,
        Stancl\Tenancy\Bootstrappers\QueueTenancyBootstrapper::class,
    ],

    'database' => [
        'central_connection' => env('DB_CONNECTION', 'pgsql'),

        'template_tenant_connection' => null,

        'prefix' => env('TENANT_DB_PREFIX', 'tenant_'),
        'suffix' => '',

        'managers' => [
            'pgsql' => Stancl\Tenancy\TenantDatabaseManagers\PostgreSQLSchemaManager::class,
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
