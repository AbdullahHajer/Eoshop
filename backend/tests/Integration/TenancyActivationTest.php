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
use App\Http\Middleware\InitializeTenancyByDomain;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\RoleAssignmentService;
use App\Support\TenantRuntimeReadiness;
use App\Support\TenantSchemaName;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;

#[Group('database')]
class TenancyActivationTest extends TestCase
{
    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $schemas = [];

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
            $central->table('domains')->where('tenant_id', $tenantId)->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        foreach (array_unique($this->schemas) as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }

        parent::tearDown();
    }

    public function test_canonical_domain_and_deterministic_schema_contracts(): void
    {
        $tenant = $this->createTenant('Canonical Store', TenantVerificationStatus::Approved);

        $domain = $tenant->domains()->create(['domain' => ' SHOP.Example.TEST. ']);

        $this->assertSame('shop.example.test', $domain->domain);
        $this->assertSame(TenantSchemaName::for($tenant->id), $tenant->database()->getName());
        $this->assertLessThanOrEqual(63, strlen((string) $tenant->database()->getName()));

        $this->expectException(InvalidArgumentException::class);
        $tenant->domains()->create(['domain' => 'https://shop.example.test/path']);
    }

    public function test_database_rejects_non_canonical_domains_and_duplicate_hosts(): void
    {
        $first = $this->createTenant('First Domain Store', TenantVerificationStatus::Approved);
        $second = $this->createTenant('Second Domain Store', TenantVerificationStatus::Approved);
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        foreach (['SHOP.EXAMPLE.TEST', 'shop.example.test.', 'shop:8000', 'single-label', '127.0.0.2'] as $invalid) {
            try {
                $central->table('domains')->insert([
                    'domain' => $invalid,
                    'tenant_id' => $first->id,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $this->fail("Database accepted invalid tenant domain [{$invalid}].");
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        }

        $first->domains()->create(['domain' => 'unique.example.test']);

        $this->expectException(QueryException::class);
        $central->table('domains')->insert([
            'domain' => 'unique.example.test',
            'tenant_id' => $second->id,
            'created_at' => now(),
            'updated_at' => now(),
        ]);
    }

    public function test_tenant_creation_and_deletion_have_no_schema_side_effects(): void
    {
        $tenant = $this->createTenant('Lifecycle Store', TenantVerificationStatus::Approved);
        $schema = (string) $tenant->database()->getName();

        $this->assertFalse($tenant->database()->manager()->databaseExists($schema));
        $tenant->delete();
        $this->tenantIds = array_values(array_diff($this->tenantIds, [$tenant->id]));
        $this->assertFalse($tenant->database()->manager()->databaseExists($schema));
    }

    public function test_tenant_migrations_target_only_existing_selected_schema(): void
    {
        $first = $this->createReadyTenant('Migration A', 'a.example.test');
        $second = $this->createReadyTenant('Migration B', 'b.example.test', migrate: false);

        $this->assertSame(0, Artisan::call('tenants:migrate', [
            '--tenants' => [$first->id],
            '--force' => true,
            '--no-interaction' => true,
        ]));

        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $this->assertTrue($this->tableExists($central, (string) $first->database()->getName(), 'store_configs'));
        $this->assertFalse($this->tableExists($central, (string) $second->database()->getName(), 'store_configs'));
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
        $this->assertFalse(tenancy()->initialized);
    }

    public function test_hosts_are_isolated_and_context_returns_to_central_after_requests(): void
    {
        $first = $this->createReadyTenant('Host A', 'a-store.example.test');
        $second = $this->createReadyTenant('Host B', 'b-store.example.test');
        $this->insertConfig($first, 'store-a');
        $this->insertConfig($second, 'store-b');
        $this->assertTrue(TenantRuntimeReadiness::check($first->refresh(), 'a-store.example.test'), $this->readinessSnapshot($first));
        $this->assertTrue(TenantRuntimeReadiness::check($second->refresh(), 'b-store.example.test'), $this->readinessSnapshot($second));

        $this->getJson($this->urlOnHost('a-store.example.test', '/api/store/config'))
            ->assertOk()
            ->assertJsonPath('marker', 'store-a');

        $this->assertCentralContext();

        $this->getJson($this->urlOnHost('b-store.example.test', '/api/store/config'))
            ->assertOk()
            ->assertJsonPath('marker', 'store-b');

        $this->assertCentralContext();
    }

    public function test_host_boundaries_and_readiness_fail_closed(): void
    {
        $ready = $this->createReadyTenant('Ready Host', 'ready.example.test');
        $pending = $this->createReadyTenant('Pending Host', 'pending.example.test', TenantVerificationStatus::Pending);
        $missing = $this->createTenant('Missing Schema', TenantVerificationStatus::Approved);
        $missing->domains()->create(['domain' => 'missing.example.test']);

        $this->getJson($this->urlOnHost('127.0.0.1', '/api/store/config'))->assertNotFound();
        $this->getJson($this->urlOnHost('unknown.example.test', '/api/store/config'))->assertNotFound();
        $this->getJson($this->urlOnHost((string) $pending->domains()->firstOrFail()->domain, '/api/store/config'))->assertNotFound();
        $this->getJson($this->urlOnHost('missing.example.test', '/api/store/config'))->assertNotFound();

        $this->getJson($this->urlOnHost((string) $ready->domains()->firstOrFail()->domain, '/api/admin/stores'))->assertNotFound();
        $this->postJson($this->urlOnHost((string) $ready->domains()->firstOrFail()->domain, '/api/register-store'))->assertNotFound();
        $this->getJson($this->urlOnHost('unknown.example.test', '/api/auth/csrf'))->assertNotFound();

        $this->assertCentralContext();
    }

    public function test_context_returns_to_central_when_the_tenant_pipeline_throws(): void
    {
        $tenant = $this->createReadyTenant('Exception Host', 'exception.example.test');
        $request = Request::create($this->urlOnHost(
            (string) $tenant->domains()->firstOrFail()->domain,
            '/api/store/config',
        ));

        try {
            app(InitializeTenancyByDomain::class)->handle(
                $request,
                static fn (): never => throw new RuntimeException('tenant pipeline failed'),
            );
            $this->fail('The tenant pipeline exception was not propagated.');
        } catch (RuntimeException $exception) {
            $this->assertSame('tenant pipeline failed', $exception->getMessage());
        }

        $this->assertCentralContext();
    }

    public function test_custom_domain_login_and_store_config_update_use_central_identity_and_session_tables(): void
    {
        $this->seed(IdentitySeeder::class);
        $tenant = $this->createReadyTenant('Authenticated Host', 'auth.example.test');
        $owner = User::query()->create([
            'name' => 'Tenant Owner',
            'email' => 'tenant-owner@example.test',
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
            TenantMembershipStatus::Active,
        );

        $host = (string) $tenant->domains()->firstOrFail()->domain;
        $this->getJson($this->urlOnHost($host, '/api/auth/csrf'))->assertOk();
        $this->postJson($this->urlOnHost($host, '/api/auth/login'), [
            'email' => $owner->email,
            'password' => 'secure-pass-123',
        ])->assertOk();

        $this->postJson($this->urlOnHost($host, '/api/store/config'), [
            'config' => ['marker' => 'owner-write'],
        ])->assertOk();

        $this->assertDatabaseHas('sessions', ['user_id' => $owner->id], (string) config('tenancy.database.central_connection'));
        $this->assertDatabaseHas('cache', [], (string) config('tenancy.database.central_connection'));
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $schema = (string) $tenant->database()->getName();
        $this->assertFalse($this->tableExists($central, $schema, 'sessions'));
        $this->assertFalse($this->tableExists($central, $schema, 'cache'));
        $this->assertCentralContext();

        $central->table('sessions')->where('user_id', $owner->id)->delete();
        $central->table('tenant_user')->where('user_id', $owner->id)->delete();
        $central->table('admin_audit_logs')->where('actor_user_id', $owner->id)->delete();
        $central->table('users')->where('id', $owner->id)->delete();
    }

    private function createTenant(string $name, TenantVerificationStatus $status): Tenant
    {
        $id = 'wp21-'.strtolower(str_replace(' ', '-', $name)).'-'.count($this->tenantIds);
        $tenant = Tenant::query()->create([
            'id' => $id,
            'store_name' => $name,
            'owner_name' => 'WP 2.1 Owner',
            'owner_email' => $id.'@example.test',
            'business_type' => 'retail',
            'verification_status' => $status->value,
        ]);
        $this->tenantIds[] = $tenant->id;

        return $tenant;
    }

    private function createReadyTenant(
        string $name,
        string $domain,
        TenantVerificationStatus $status = TenantVerificationStatus::Approved,
        bool $migrate = true,
    ): Tenant {
        $tenant = $this->createTenant($name, $status);
        $publishedDomain = $tenant->domains()->create(['domain' => $domain, 'kind' => DomainKind::PublicSubdomain]);
        $schema = (string) $tenant->database()->getName();
        $tenant->database()->manager()->createDatabase($tenant);
        $this->schemas[] = $schema;

        if ($migrate) {
            $this->assertSame(0, Artisan::call('tenants:migrate', [
                '--tenants' => [$tenant->id],
                '--force' => true,
                '--no-interaction' => true,
            ]));

            ProvisioningRun::query()->create([
                'id' => (string) Str::uuid(),
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
            $tenant->forceFill([
                'provisioning_status' => ProvisioningState::Active->value,
                'active_at' => now(),
            ])->save();
        }

        $subscription = TenantSubscription::query()->create([
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => SubscriptionStatus::Active,
            'activation_source' => SubscriptionActivationSource::Wp23Adopted,
            'starts_at' => now('UTC')->subMinute(),
        ]);
        $domainHandle = Str::before($domain, '.');
        if (strlen($domainHandle) < 3) {
            $domainHandle = 'legacy-'.substr(hash('sha256', $domain), 0, 12);
        }
        $reservation = DomainReservation::query()->create([
            'tenant_id' => $tenant->id,
            'domain' => $domain,
            'handle' => $domainHandle,
            'status' => DomainReservationStatus::Active,
            'origin' => DomainReservationOrigin::Wp22Internal,
            'reserved_at' => now(),
            'activated_at' => now(),
        ]);
        $publication = PublicationRequest::query()->create([
            'tenant_id' => $tenant->id,
            'domain_reservation_id' => $reservation->id,
            'tenant_subscription_id' => $subscription->id,
            'status' => $migrate ? PublicationRequestStatus::Published : PublicationRequestStatus::Requested,
            'origin' => PublicationRequestOrigin::Wp23Adopted,
            'requested_at' => now(),
            'decided_at' => $migrate ? now() : null,
            'published_at' => $migrate ? now() : null,
        ]);
        $tenant->forceFill([
            'publication_status' => $migrate ? PublicationStatus::Published->value : PublicationStatus::Requested->value,
            'publication_requested_at' => now(),
            'published_at' => $migrate ? now() : null,
            'publication_request_id' => $publication->id,
            'published_domain_id' => $migrate ? $publishedDomain->id : null,
            'publication_subscription_id' => $migrate ? $subscription->id : null,
        ])->save();

        return $tenant;
    }

    private function insertConfig(Tenant $tenant, string $marker): void
    {
        $tenant->run(static function () use ($marker): void {
            DB::table('store_configs')->insert([
                'id' => (string) Str::uuid(),
                'config_json' => json_encode(['marker' => $marker], JSON_THROW_ON_ERROR),
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        });
    }

    private function tableExists($connection, string $schema, string $table): bool
    {
        return (bool) $connection->selectOne(
            'SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = ? AND table_name = ?) AS present',
            [$schema, $table],
        )->present;
    }

    private function assertCentralContext(): void
    {
        $this->assertFalse(tenancy()->initialized);
        $this->assertSame((string) config('tenancy.database.central_connection'), DB::getDefaultConnection());
    }

    private function urlOnHost(string $host, string $path): string
    {
        return 'http://'.$host.$path;
    }

    private function readinessSnapshot(Tenant $tenant): string
    {
        $tenant->load([
            'latestProvisioningRun',
            'currentPublicationRequest.reservation',
            'publishedDomain',
            'publicationSubscription',
        ]);

        return json_encode([
            'tenant' => $tenant->only([
                'verification_status', 'provisioning_status', 'publication_status',
                'publication_request_id', 'published_domain_id', 'publication_subscription_id',
            ]),
            'run' => $tenant->latestProvisioningRun?->toArray(),
            'publication' => $tenant->currentPublicationRequest?->toArray(),
            'reservation' => $tenant->currentPublicationRequest?->reservation?->toArray(),
            'domain' => $tenant->publishedDomain?->toArray(),
            'subscription' => $tenant->publicationSubscription?->toArray(),
            'schema' => $tenant->database()->getName(),
            'schemaExists' => $tenant->database()->manager()->databaseExists((string) $tenant->database()->getName()),
        ], JSON_THROW_ON_ERROR);
    }
}
