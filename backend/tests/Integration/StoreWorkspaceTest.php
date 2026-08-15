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
use App\Services\RoleAssignmentService;
use App\Services\StoreWorkspaceService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\Events\QueryExecuted;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
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

        $this->actingAs($owner)
            ->getJson("/api/merchant/stores/{$tenant->id}/workspace")
            ->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.config.products.0.id', 'legacy-product');

        $payload = ['revision' => 1, 'config' => $this->config('Server Store', [$this->product('SKU-1')])];
        $saved = $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", $payload)
            ->assertOk()
            ->assertJsonPath('data.revision', 2)
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
                'config' => $this->config('Staff write', []),
            ])
            ->assertForbidden();

        Auth::forgetGuards();
        $this->flushSession();
        $tooMany = array_map(fn (int $index): array => $this->product("SKU-{$index}"), range(1, 11));
        $this->actingAs($owner)
            ->patchJson("/api/merchant/stores/{$tenant->id}/workspace", [
                'revision' => 1,
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
        $payload = ['revision' => 1, 'config' => $this->config('Old snapshot', [$this->product('SNAPSHOT-1')])];
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
                || ! str_contains($sql, 'select * from "store_configs"')) {
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
            DB::table('store_configs')->insert([
                'id' => (string) Str::uuid(),
                'config_json' => json_encode($this->config('Legacy '.$label, [[
                    ...$this->product('LEGACY-SKU'),
                    'id' => 'legacy-product',
                ]]), JSON_THROW_ON_ERROR),
                'revision' => 1,
                'products_materialized' => false,
                'is_current' => true,
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
