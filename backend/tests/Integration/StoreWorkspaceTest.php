<?php

namespace Tests\Integration;

use App\Enums\DomainKind;
use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\ProvisioningSchemaOrigin;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use App\Enums\SystemRole;
use App\Enums\TenantMembershipStatus;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\ProductCatalogService;
use App\Services\RoleAssignmentService;
use App\Services\StoreWorkspaceService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Database\QueryException;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class StoreWorkspaceTest extends TestCase
{
    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $schemas = [];

    /** @var list<string> */
    private array $userIds = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
    }

    protected function tearDown(): void
    {
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        DB::setDefaultConnection((string) config('tenancy.database.central_connection'));
        DB::purge('tenant');
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        foreach ($this->tenantIds as $tenantId) {
            $central->table('tenant_user')->where('tenant_id', $tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $tenantId)->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        foreach ($this->schemas as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }
        foreach ($this->userIds as $userId) {
            $central->table('role_user')->where('user_id', $userId)->delete();
            $central->table('admin_audit_logs')->where('actor_user_id', $userId)->delete();
            $central->table('users')->where('id', $userId)->delete();
        }

        parent::tearDown();
    }

    public function test_legacy_workspace_materializes_atomically_and_rejects_a_stale_revision(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('legacy-workspace');

        $initial = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.catalogRevision', 1)
            ->assertJsonPath('data.config.products.0.sku', 'LEGACY-SKU')
            ->json('data');

        $updatedProduct = [
            ...$this->product('SKU-1'),
            'id' => $initial['config']['products'][0]['id'],
            'revision' => $initial['config']['products'][0]['revision'],
        ];
        $payload = [
            'revision' => 1,
            'catalogRevision' => 1,
            'config' => $this->config('Server Store', [$updatedProduct]),
        ];
        $saved = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.catalogRevision', 2)
            ->assertJsonPath('data.config.storeName', 'Server Store')
            ->assertJsonPath('data.config.products.0.price', '12.50')
            ->json('data');

        $this->assertTrue(Str::isUuid($saved['config']['products'][0]['id']));
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertConflict()
            ->assertJsonPath('code', 'workspace_revision_conflict');

        $tenant->run(function (): void {
            $this->assertDatabaseHas('store_configs', [
                'revision' => 2,
                'products_materialized' => true,
                'is_current' => true,
            ], 'tenant');
            $this->assertSame(1, DB::table('products')->count());
            $config = json_decode((string) DB::table('store_configs')->where('is_current', true)->value('config_json'), true, 512, JSON_THROW_ON_ERROR);
            $this->assertArrayNotHasKey('products', $config);
        });

        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonPath('storeName', 'Server Store')
            ->assertJsonPath('products.0.sku', 'SKU-1');
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
        $this->assertFalse(tenancy()->initialized);
    }

    public function test_workspace_authorization_quota_and_media_validation_fail_closed(): void
    {
        [$tenant, $owner] = $this->readyTenant('workspace-boundaries');
        $outsider = $this->user('workspace-outsider@example.test');
        $staff = $this->user('workspace-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $owner,
        );

        $this->actingAs($outsider)->getJson("/api/merchant/stores/{$tenant->id}/workspace")->assertForbidden();
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($staff)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Staff write', []),
            ])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->flushSession();
        $tooMany = array_map(fn (int $index): array => $this->product("SKU-{$index}"), range(1, 11));
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Over quota', $tooMany),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'workspace_quota_exceeded');

        Auth::forgetGuards();
        $this->flushSession();
        $invalidMedia = $this->product('SAFE-SKU');
        $invalidMedia['imageUrl'] = 'data:image/png;base64,unsafe';
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 1,
                'config' => $this->config('Unsafe media', [$invalidMedia]),
            ])
            ->assertUnprocessable();

        DB::connection((string) config('tenancy.database.central_connection'))
            ->table('tenant_user')
            ->where('tenant_id', $tenant->id)
            ->where('user_id', $owner->id)
            ->update(['status' => TenantMembershipStatus::Suspended->value]);
        Auth::forgetGuards();
        $this->flushSession();
        $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/workspace")->assertForbidden();
    }

    public function test_public_composition_uses_one_repeatable_read_snapshot_during_a_concurrent_write(): void
    {
        [$tenant, $owner] = $this->readyTenant('workspace-snapshot');
        $productId = $tenant->run(static fn (): string => (string) DB::table('products')->value('id'));
        $payload = [
            'revision' => 1,
            'catalogRevision' => 1,
            'config' => $this->config('Old snapshot', [[
                ...$this->product('SNAPSHOT-1'),
                'id' => $productId,
                'revision' => 1,
            ]]),
        ];
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertOk();

        $writerConfig = $tenant->run(static fn (): array => config('database.connections.tenant'));
        config()->set('database.connections.workspace_writer', $writerConfig);
        $writer = DB::connection('workspace_writer');
        $writeCommitted = false;

        DB::listen(function (QueryExecuted $query) use ($writer, &$writeCommitted): void {
            $sql = mb_strtolower($query->sql);
            if ($writeCommitted || $query->connectionName !== 'tenant'
                || ! str_contains($sql, 'select * from "catalog_settings"')) {
                return;
            }

            $writeCommitted = true;
            $writer->transaction(function () use ($writer): void {
                $record = $writer->table('store_configs')->where('is_current', true)->firstOrFail();
                $config = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);
                $config['storeName'] = 'New snapshot';
                $writer->table('products')->update(['name' => 'New product']);
                $writer->table('store_configs')->where('id', $record->id)->update([
                    'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
                    'revision' => 3,
                    'updated_at' => now(),
                ]);
            });
        });

        try {
            $snapshot = app(StoreWorkspaceService::class)->readPublic($tenant->refresh());
            $this->assertTrue($writeCommitted);
            $this->assertSame('Old snapshot', $snapshot['config']['storeName']);
            $this->assertSame('Server product', $snapshot['config']['products'][0]['name']);

            $latest = app(StoreWorkspaceService::class)->readPublic($tenant->refresh());
            $this->assertSame('New snapshot', $latest['config']['storeName']);
            $this->assertSame('New product', $latest['config']['products'][0]['name']);
        } finally {
            DB::purge('workspace_writer');
        }
    }

    public function test_merchant_catalog_read_uses_one_repeatable_read_snapshot_during_a_concurrent_write(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-snapshot');
        $writerConfig = $tenant->run(static fn (): array => config('database.connections.tenant'));
        config()->set('database.connections.catalog_writer', $writerConfig);
        $writer = DB::connection('catalog_writer');
        $writeCommitted = false;

        DB::listen(function (QueryExecuted $query) use ($writer, &$writeCommitted): void {
            $sql = mb_strtolower($query->sql);
            if ($writeCommitted || $query->connectionName !== 'tenant'
                || ! str_contains($sql, 'select * from "catalog_settings"')) {
                return;
            }

            $writeCommitted = true;
            $writer->transaction(function () use ($writer): void {
                $writer->table('products')->update(['name' => 'New catalog product']);
                $writer->table('catalog_settings')->where('id', 1)->update([
                    'revision' => 2,
                    'updated_at' => now(),
                ]);
            });
        });

        try {
            $snapshot = app(ProductCatalogService::class)->read($tenant->refresh(), $owner);
            $this->assertTrue($writeCommitted);
            $this->assertSame(1, $snapshot['revision']);
            $this->assertSame('Server product', $snapshot['products'][0]['name']);

            $latest = app(ProductCatalogService::class)->read($tenant->refresh(), $owner);
            $this->assertSame(2, $latest['revision']);
            $this->assertSame('New catalog product', $latest['products'][0]['name']);
        } finally {
            DB::purge('catalog_writer');
        }
    }

    public function test_catalog_rejects_malformed_ids_and_existing_sku_owners_without_server_errors(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-contract');
        $catalog = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->json('data');

        $malformed = $catalog['products'][0];
        $malformed['id'] = 'legacy-client-id';
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$malformed],
                'archiveProductIds' => [],
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('products.0.id');

        $duplicate = $this->product('LEGACY-SKU');
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$duplicate],
                'archiveProductIds' => [],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_sku_conflict');
    }

    public function test_submission_rejects_product_limit_and_unmanaged_media_before_provisioning(): void
    {
        $merchant = $this->user('workspace-submit@example.test');
        $products = array_map(fn (int $index): array => $this->product("NEW-{$index}"), range(1, 11));

        $this->actingAs($merchant)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->postJson('/api/register-store', [
                'storeName' => 'Rejected before provisioning',
                'businessType' => 'retail',
                'themeStyle' => 'elegant',
                'handle' => 'rejected-workspace',
                'planKey' => 'starter',
                'config' => $this->config('Rejected before provisioning', $products),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('config.products');

        $this->assertDatabaseMissing('tenants', ['store_name' => 'Rejected before provisioning']);
    }

    public function test_product_staff_manages_catalog_lifecycle_prices_and_archival_without_store_permission(): void
    {
        [$tenant, $owner, $domain] = $this->readyTenant('catalog-lifecycle');
        $staff = $this->user('catalog-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $owner,
        );

        $catalog = $this->actingAs($staff)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->json('data');
        $product = $catalog['products'][0];
        $product['status'] = 'draft';
        $product['basePrice'] = '20.00';
        $product['salePrice'] = '15.00';

        $draft = $this->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$product],
                'archiveProductIds' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.products.0.status', 'draft')
            ->assertJsonPath('data.products.0.price', '15.00')
            ->json('data');

        $this->actingAs($staff)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
                'catalogRevision' => 2,
                'config' => $this->config('Forbidden store write', [$product]),
            ])
            ->assertForbidden();
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonCount(0, 'products');

        $published = $draft['products'][0];
        $published['status'] = 'published';
        $publishedCatalog = $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 2,
                'currencyCode' => 'YER',
                'products' => [$published],
                'archiveProductIds' => [],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 3)
            ->assertJsonPath('data.products.0.status', 'published')
            ->json('data');
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonPath('products.0.price', '15.00');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 2,
                'currencyCode' => 'YER',
                'products' => [$publishedCatalog['products'][0]],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_revision_conflict');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 3,
                'currencyCode' => 'SAR',
                'products' => [$publishedCatalog['products'][0]],
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_currency_locked');

        $this->withServerVariables(['HTTP_HOST' => '127.0.0.1', 'SERVER_NAME' => '127.0.0.1'])
            ->actingAs($staff)
            ->patchJson("http://127.0.0.1/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 3,
                'currencyCode' => 'YER',
                'products' => [],
                'archiveProductIds' => [$publishedCatalog['products'][0]['id']],
            ])
            ->assertOk()
            ->assertJsonPath('data.revision', 4)
            ->assertJsonPath('data.products.0.status', 'archived');
        $this->getJson("http://{$domain}/api/store/config")
            ->assertOk()
            ->assertJsonCount(0, 'products');

        $tenant->run(function (): void {
            try {
                DB::table('products')->update([
                    'sale_price_minor' => 2000,
                    'price' => '20.00',
                ]);
                $this->fail('The database accepted an invalid sale price.');
            } catch (QueryException) {
                $this->assertSame(1, DB::table('products')->where('sale_price_minor', 1500)->count());
            }
        });
    }

    public function test_direct_archive_transition_recovers_a_catalog_after_a_plan_downgrade(): void
    {
        [$tenant, $owner] = $this->readyTenant('catalog-downgrade');
        $catalog = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()->json('data');
        $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
            'catalogRevision' => $catalog['revision'],
            'currencyCode' => 'YER',
            'products' => [[
                'status' => 'published',
                'name' => 'Second live product',
                'basePrice' => '9.00',
                'salePrice' => null,
                'sku' => 'SECOND-LIVE-SKU',
            ]],
            'archiveProductIds' => [],
        ])->assertOk()->assertJsonPath('data.revision', 2);

        DB::table('plans')->where('key', 'starter')->update(['max_products' => 1]);
        try {
            $overLimit = $this->actingAs($owner)->getJson("/api/merchant/stores/{$tenant->id}/catalog")
                ->assertOk()->json('data');
            $toArchive = $overLimit['products'][0];
            $toArchive['status'] = 'archived';

            $this->actingAs($owner)->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => $overLimit['revision'],
                'currencyCode' => 'YER',
                'products' => [$toArchive],
                'archiveProductIds' => [],
            ])->assertOk()->assertJsonPath('data.revision', 3);

            $tenant->run(fn () => $this->assertSame(
                1,
                DB::table('products')->where('status', '!=', 'archived')->count(),
            ));
        } finally {
            DB::table('plans')->where('key', 'starter')->update(['max_products' => 10]);
        }
    }

    public function test_managed_catalog_media_is_idempotent_private_until_attached_and_public_only_for_published_product(): void
    {
        Storage::fake('local');
        [$tenant, $owner, $domain] = $this->readyTenant('catalog-media');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $key = (string) Str::uuid();

        $first = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('product.png', $png),
            ])
            ->assertCreated()
            ->assertJsonPath('data.mimeType', 'image/png')
            ->json('data');
        $second = $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('same.png', $png),
            ])
            ->assertCreated()
            ->json('data');
        $this->assertSame($first['id'], $second['id']);

        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', $key)
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('different.png', $png.'different'),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'media_idempotency_conflict');
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('not-image.txt', 'not an image'),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_media_invalid');
        config(['catalog.max_media_pixels' => 0]);
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->createWithContent('too-many-pixels.png', $png),
            ])
            ->assertConflict()
            ->assertJsonPath('code', 'catalog_media_invalid');
        config(['catalog.max_media_pixels' => 25_000_000]);
        $this->actingAs($owner)
            ->withHeader('Idempotency-Key', (string) Str::uuid())
            ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                'image' => UploadedFile::fake()->create('too-large.png', 5121, 'image/png'),
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('image');

        Auth::forgetGuards();
        $this->flushSession();
        $this->getJson($first['url'])->assertNotFound();

        $catalog = $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/catalog")
            ->assertOk()
            ->json('data');
        $product = $catalog['products'][0];
        $product['imageUrl'] = $first['url'];
        $product['imageUrls'] = [$first['url']];
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/catalog", [
                'catalogRevision' => 1,
                'currencyCode' => 'YER',
                'products' => [$product],
                'archiveProductIds' => [],
            ])
            ->assertOk();

        $this->actingAs($owner)->get($first['url'])->assertOk()->assertHeader('content-type', 'image/png');
        Auth::forgetGuards();
        $this->flushSession();
        $this->get("http://{$domain}{$first['url']}")->assertOk()->assertHeader('content-type', 'image/png');
        $this->get("http://127.0.0.1{$first['url']}")->assertNotFound();
    }

    public function test_media_tenant_ownership_and_suspended_store_cleanup_fail_closed(): void
    {
        Storage::fake('local');
        [$tenantA, $ownerA] = $this->readyTenant('media-owner-a');
        [$tenantB, $ownerB] = $this->readyTenant('media-owner-b');
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', true);
        $this->assertIsString($png);
        $upload = function (Tenant $tenant, User $owner, string $suffix) use ($png): array {
            return $this->actingAs($owner)
                ->withHeader('Idempotency-Key', (string) Str::uuid())
                ->post("/api/merchant/stores/{$tenant->id}/catalog/media", [
                    'image' => UploadedFile::fake()->createWithContent("{$suffix}.png", $png.$suffix),
                ])->assertCreated()->json('data');
        };
        $foreign = $upload($tenantA, $ownerA, 'foreign');
        $prunable = $upload($tenantA, $ownerA, 'prunable');
        $unsafe = $upload($tenantA, $ownerA, 'unsafe');
        $recoverable = $upload($tenantA, $ownerA, 'recoverable');

        Auth::forgetGuards();
        $this->flushSession();
        $catalogB = $this->actingAs($ownerB)->getJson("/api/merchant/stores/{$tenantB->id}/catalog")
            ->assertOk()->json('data');
        $productB = $catalogB['products'][0];
        $productB['imageUrl'] = $foreign['url'];
        $productB['imageUrls'] = [$foreign['url']];
        $this->actingAs($ownerB)->patchJson("/api/merchant/stores/{$tenantB->id}/catalog", [
            'catalogRevision' => $catalogB['revision'],
            'currencyCode' => 'YER',
            'products' => [$productB],
            'archiveProductIds' => [],
        ])->assertConflict()->assertJsonPath('code', 'catalog_media_tenant_mismatch');

        $paths = $tenantA->run(function () use ($prunable, $unsafe, $recoverable): array {
            $rows = DB::table('product_media')->whereIn('id', [
                $prunable['id'], $unsafe['id'], $recoverable['id'],
            ])->get()->keyBy('id');
            DB::table('product_media')->whereIn('id', [$prunable['id'], $unsafe['id']])->update([
                'created_at' => now()->subDays(2),
            ]);
            DB::table('product_media')->where('id', $unsafe['id'])->update(['disk' => 'unsafe-disk']);
            DB::table('product_media')->where('id', $recoverable['id'])->update(['cleanup_started_at' => now()]);

            try {
                DB::table('product_media')->where('id', $prunable['id'])->update(['path' => '../escape.png']);
                $this->fail('The database accepted an unsafe managed media path.');
            } catch (QueryException) {
                $this->assertSame($rows[$prunable['id']]->path, DB::table('product_media')
                    ->where('id', $prunable['id'])->value('path'));
            }

            return $rows->mapWithKeys(fn (object $row): array => [(string) $row->id => (string) $row->path])->all();
        });
        Storage::disk('local')->delete($paths[$recoverable['id']]);
        $tenantA->forceFill(['verification_status' => TenantVerificationStatus::Suspended->value])->save();

        $this->assertSame(0, Artisan::call('catalog:prune-media', ['--tenant' => [$tenantA->id]]));
        $tenantA->run(function () use ($prunable, $unsafe, $recoverable): void {
            $this->assertSame(0, DB::table('product_media')->whereIn('id', [
                $prunable['id'], $recoverable['id'],
            ])->count());
            $this->assertSame(1, DB::table('product_media')->where('id', $unsafe['id'])->count());
        });
        Storage::disk('local')->assertMissing($paths[$prunable['id']]);
    }

    public function test_workspace_migration_refuses_destructive_rollback_after_materialization(): void
    {
        [$tenant] = $this->readyTenant('workspace-rollback');

        $tenant->run(function (): void {
            DB::table('store_configs')->where('is_current', true)->update(['products_materialized' => true]);
            $migration = require database_path('migrations/tenant/2026_08_15_000004_harden_store_workspace.php');

            try {
                $migration->down();
                $this->fail('The workspace migration erased materialized server data.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to drop', $exception->getMessage());
            }

            $this->assertTrue(DB::getSchemaBuilder()->hasColumns('store_configs', [
                'revision', 'products_materialized', 'is_current',
            ]));
            $this->assertTrue(DB::getSchemaBuilder()->hasColumns('products', ['image_urls', 'position']));
        });
    }

    public function test_catalog_migration_adopts_legacy_exact_prices_currency_sku_and_media_without_losing_identity(): void
    {
        $tenant = Tenant::query()->create([
            'id' => 'wp41-legacy-adoption',
            'store_name' => 'Legacy catalog adoption',
            'owner_name' => 'Legacy Owner',
            'owner_email' => 'legacy-catalog@example.test',
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Pending->value,
            'provisioning_status' => ProvisioningState::NotStarted->value,
            'publication_status' => PublicationStatus::Unpublished->value,
            'theme_style' => 'elegant',
        ]);
        $this->tenantIds[] = $tenant->id;
        $tenant->database()->manager()->createDatabase($tenant);
        $schema = (string) $tenant->database()->getName();
        $this->schemas[] = $schema;
        $productId = (string) Str::uuid();

        $tenant->run(function () use ($productId): void {
            foreach ([
                '2026_01_01_000001_create_store_configs_table.php',
                '2026_01_01_000002_create_products_table.php',
                '2026_01_01_000003_create_orders_table.php',
                '2026_08_15_000004_harden_store_workspace.php',
            ] as $file) {
                (require database_path('migrations/tenant/'.$file))->up();
            }
            DB::table('store_configs')->insert([
                'id' => (string) Str::uuid(),
                'config_json' => json_encode(['currency' => 'SAR', 'products' => []], JSON_THROW_ON_ERROR),
                'revision' => 1,
                'products_materialized' => true,
                'is_current' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('products')->insert([
                'id' => $productId,
                'name' => 'Legacy exact product',
                'price' => '12.34',
                'image_url' => 'https://images.example.test/legacy.jpg',
                'image_urls' => json_encode([
                    'https://images.example.test/legacy.jpg',
                    'https://images.example.test/second.jpg',
                ], JSON_THROW_ON_ERROR),
                'stock_quantity' => 3,
                'manage_stock' => true,
                'low_stock_threshold' => 1,
                'position' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ]);

            $migration = require database_path('migrations/tenant/2026_08_16_000005_create_product_catalog_model.php');
            $migration->up();

            $adopted = DB::table('products')->where('id', $productId)->firstOrFail();
            $this->assertSame(1234, (int) $adopted->base_price_minor);
            $this->assertSame('published', $adopted->status);
            $this->assertStringStartsWith('LEGACY-', $adopted->sku);
            $this->assertSame('SAR', DB::table('catalog_settings')->where('id', 1)->value('currency_code'));
            $this->assertSame(2, DB::table('product_media')->where('product_id', $productId)->count());

            try {
                $migration->down();
                $this->fail('The catalog migration erased adopted authoritative data.');
            } catch (\RuntimeException $exception) {
                $this->assertStringContainsString('Refusing to erase', $exception->getMessage());
            }
            $this->assertSame(1, DB::table('products')->where('id', $productId)->count());
        });
    }

    /** @return array{Tenant, User, string} */
    private function readyTenant(string $label): array
    {
        $tenant = Tenant::query()->create([
            'id' => 'wp32-'.$label,
            'store_name' => 'Store '.$label,
            'owner_name' => 'Workspace Owner',
            'owner_email' => "owner-{$label}@example.test",
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Approved->value,
            'provisioning_status' => ProvisioningState::Active->value,
            'publication_status' => PublicationStatus::Published->value,
            'theme_style' => 'elegant',
            'active_at' => now(),
        ]);
        $this->tenantIds[] = $tenant->id;
        $domain = $label.'.example.test';
        $publishedDomain = $tenant->domains()->create(['domain' => $domain, 'kind' => DomainKind::PublicSubdomain]);
        $tenant->database()->manager()->createDatabase($tenant);
        $schema = (string) $tenant->database()->getName();
        $this->schemas[] = $schema;
        $this->assertSame(0, Artisan::call('tenants:migrate', [
            '--tenants' => [$tenant->id],
            '--force' => true,
            '--no-interaction' => true,
        ]));
        ProvisioningRun::query()->create([
            'tenant_id' => $tenant->id,
            'status' => ProvisioningState::Active,
            'run_number' => 1,
            'schema_name' => $schema,
            'schema_origin' => ProvisioningSchemaOrigin::PlatformCreated,
            'schema_created_at' => now(),
            'queued_at' => now(),
            'started_at' => now(),
            'completed_at' => now(),
        ]);
        $subscription = TenantSubscription::query()->create([
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => SubscriptionStatus::Active,
            'activation_source' => SubscriptionActivationSource::Wp23Adopted,
            'starts_at' => now('UTC')->subMinute(),
        ]);
        $reservation = DomainReservation::query()->create([
            'tenant_id' => $tenant->id,
            'domain' => $domain,
            'handle' => $label,
            'status' => DomainReservationStatus::Active,
            'origin' => DomainReservationOrigin::Wp22Internal,
            'reserved_at' => now(),
            'activated_at' => now(),
        ]);
        $publication = PublicationRequest::query()->create([
            'tenant_id' => $tenant->id,
            'domain_reservation_id' => $reservation->id,
            'tenant_subscription_id' => $subscription->id,
            'status' => PublicationRequestStatus::Published,
            'origin' => PublicationRequestOrigin::Wp23Adopted,
            'requested_at' => now(),
            'decided_at' => now(),
            'published_at' => now(),
        ]);
        $tenant->forceFill([
            'publication_request_id' => $publication->id,
            'published_domain_id' => $publishedDomain->id,
            'publication_subscription_id' => $subscription->id,
            'publication_requested_at' => now(),
            'published_at' => now(),
        ])->save();
        $tenant->run(function () use ($label): void {
            $productId = (string) Str::uuid();
            DB::table('store_configs')->insert([
                'id' => (string) Str::uuid(),
                'config_json' => json_encode(array_diff_key(
                    $this->config('Legacy '.$label, []),
                    ['products' => true, 'currency' => true],
                ), JSON_THROW_ON_ERROR),
                'revision' => 1,
                'products_materialized' => true,
                'is_current' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('products')->insert([
                'id' => $productId,
                'name' => 'Server product',
                'price' => '12.50',
                'base_price_minor' => 1250,
                'sale_price_minor' => null,
                'description' => 'Product description',
                'category' => 'General',
                'image_keyword' => 'product',
                'image_url' => 'https://images.example.test/product.jpg',
                'image_urls' => json_encode(['https://images.example.test/product.jpg'], JSON_THROW_ON_ERROR),
                'stock_quantity' => 10,
                'manage_stock' => true,
                'sku' => 'LEGACY-SKU',
                'low_stock_threshold' => 3,
                'position' => 0,
                'status' => 'published',
                'revision' => 1,
                'published_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
            DB::table('product_media')->insert([
                'id' => (string) Str::uuid(),
                'product_id' => $productId,
                'source_type' => 'external',
                'external_url' => 'https://images.example.test/product.jpg',
                'position' => 0,
                'attached_at' => now(),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
        $owner = $this->user("workspace-owner-{$label}@example.test");
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        return [$tenant->refresh(), $owner, $domain];
    }

    private function user(string $email): User
    {
        $user = User::query()->create([
            'name' => 'Workspace User',
            'email' => $email,
            'password' => 'workspace-password',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = $user->id;

        return $user;
    }

    /** @param list<array<string, mixed>> $products */
    private function config(string $name, array $products): array
    {
        return [
            'storeName' => $name,
            'slogan' => 'Server-owned workspace',
            'logoIcon' => 'S',
            'primaryColor' => '#112233',
            'secondaryColor' => '#334455',
            'themeStyle' => 'elegant',
            'bannerText' => 'Workspace banner',
            'products' => $products,
            'fontFamily' => 'Cairo',
            'phone' => '+967700000000',
            'currency' => 'YER',
        ];
    }

    /** @return array<string, mixed> */
    private function product(string $sku): array
    {
        return [
            'name' => 'Server product',
            'price' => '12.50',
            'basePrice' => '12.50',
            'salePrice' => null,
            'status' => 'published',
            'description' => 'Product description',
            'category' => 'General',
            'imageKeyword' => 'product',
            'imageUrl' => 'https://images.example.test/product.jpg',
            'imageUrls' => ['https://images.example.test/product-2.jpg'],
            'stockQuantity' => 10,
            'manageStock' => true,
            'sku' => $sku,
            'lowStockThreshold' => 3,
        ];
    }
}
