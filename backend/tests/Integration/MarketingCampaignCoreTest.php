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
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Exceptions\MarketingCampaignConflict;
use App\Models\DomainReservation;
use App\Models\ProvisioningRun;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\InventoryLedgerService;
use App\Services\Marketing\MarketingCampaignLinkService;
use App\Services\Marketing\MarketingCampaignResolver;
use App\Services\Marketing\MarketingCampaignService;
use App\Services\RoleAssignmentService;
use Carbon\CarbonImmutable;
use Database\Seeders\IdentitySeeder;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use RuntimeException;
use Tests\TestCase;
use Throwable;

#[Group('database')]
class MarketingCampaignCoreTest extends TestCase
{
    /** @var list<string> */
    private array $tenantIds = [];

    /** @var list<string> */
    private array $schemas = [];

    /** @var list<string> */
    private array $userIds = [];

    /** @var array<string, mixed> */
    private array $originalConfig = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        $this->originalConfig = (array) config('marketing_campaigns');
        config([
            'marketing_campaigns.link_token.current_key_id' => 'test-current',
            'marketing_campaigns.link_token.current_key' => 'base64:'.base64_encode(str_repeat('t', 32)),
            'marketing_campaigns.link_token.previous_key_id' => null,
            'marketing_campaigns.link_token.previous_key' => null,
        ]);
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        config(['marketing_campaigns' => $this->originalConfig]);
        if (tenancy()->initialized) {
            tenancy()->end();
        }
        $centralName = (string) config('tenancy.database.central_connection');
        DB::setDefaultConnection($centralName);
        DB::purge('tenant');
        $central = DB::connection($centralName);
        foreach ($this->tenantIds as $tenantId) {
            $central->table('tenant_user')->where('tenant_id', $tenantId)->delete();
            $central->table('admin_audit_logs')->where('tenant_id', $tenantId)->delete();
            $central->table('tenants')->where('id', $tenantId)->delete();
        }
        foreach (array_unique($this->schemas) as $schema) {
            $central->statement('DROP SCHEMA IF EXISTS "'.$schema.'" CASCADE');
        }
        if ($this->userIds !== []) {
            $central->table('role_user')->whereIn('user_id', $this->userIds)->delete();
            $central->table('admin_audit_logs')->whereIn('actor_user_id', $this->userIds)->delete();
            $central->table('users')->whereIn('id', $this->userIds)->delete();
        }

        parent::tearDown();
    }

    public function test_schema_permissions_and_two_tenant_isolation(): void
    {
        [$first, $owner] = $this->readyTenant('campaign-isolation-a');
        [$second, $secondOwner] = $this->readyTenant('campaign-isolation-b');
        $staff = $this->user('campaign-staff@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $first,
            $staff,
            Role::query()->where('key', SystemRole::MerchantStaff->value)->firstOrFail(),
            $owner,
        );
        $service = app(MarketingCampaignService::class);
        $campaign = $service->create($first, $owner, $this->campaignPayload(), (string) Str::uuid());

        $first->run(function (): void {
            foreach (['marketing_campaign_registry', 'marketing_campaigns', 'marketing_channel_links', 'marketing_campaign_operations', 'marketing_campaign_events'] as $table) {
                $this->assertTrue(DB::getSchemaBuilder()->hasTable($table), $table);
            }
        });

        try {
            $service->list($first, $staff);
            $this->fail('Merchant staff must not manage campaigns.');
        } catch (AuthorizationException) {
            $this->addToAssertionCount(1);
        }
        try {
            $service->read($second, $secondOwner, $campaign['id']);
            $this->fail('A campaign UUID from another tenant must be indistinguishable from missing.');
        } catch (MarketingCampaignConflict $exception) {
            $this->assertSame('campaign_not_found', $exception->errorCode);
        }
        $second->run(fn () => $this->assertSame(0, DB::table('marketing_campaigns')->count()));
    }

    public function test_idempotency_revision_lifecycle_and_append_only_events(): void
    {
        [$tenant, $owner] = $this->readyTenant('campaign-lifecycle');
        $service = app(MarketingCampaignService::class);
        $key = (string) Str::uuid();
        $created = $service->create($tenant, $owner, $this->campaignPayload(), $key);
        $replayed = $service->create($tenant, $owner, $this->campaignPayload(), $key);
        $this->assertSame($created['id'], $replayed['id']);
        $this->assertFalse($created['replayed']);
        $this->assertTrue($replayed['replayed']);

        try {
            $service->create($tenant, $owner, [...$this->campaignPayload(), 'name' => 'Different'], $key);
            $this->fail('An idempotency key cannot bind different content.');
        } catch (MarketingCampaignConflict $exception) {
            $this->assertSame('campaign_idempotency_conflict', $exception->errorCode);
        }

        $noOp = $service->update($tenant, $owner, $created['id'], 1, ['name' => $created['name']]);
        $this->assertSame(1, $noOp['revision']);
        $updated = $service->update($tenant, $owner, $created['id'], 1, ['name' => 'Campaign updated']);
        $this->assertSame(2, $updated['revision']);
        try {
            $service->update($tenant, $owner, $created['id'], 1, ['name' => 'Stale']);
            $this->fail('A stale revision must not write.');
        } catch (MarketingCampaignConflict $exception) {
            $this->assertSame('campaign_revision_conflict', $exception->errorCode);
        }

        $active = $service->activate($tenant, $owner, $created['id'], 2);
        $paused = $service->pause($tenant, $owner, $created['id'], 3);
        $resumed = $service->resume($tenant, $owner, $created['id'], 4);
        $ended = $service->end($tenant, $owner, $created['id'], 5);
        $archived = $service->archive($tenant, $owner, $created['id'], 6);
        $this->assertSame(['active', 'paused', 'active', 'ended', 'archived'], [
            $active['state'], $paused['state'], $resumed['state'], $ended['state'], $archived['state'],
        ]);
        $this->assertSame(7, $archived['revision']);

        $tenant->run(function () use ($created): void {
            $events = DB::table('marketing_campaign_events')->where('campaign_id', $created['id'])
                ->orderBy('campaign_revision')->pluck('event_type')->all();
            $this->assertSame(['created', 'updated', 'activated', 'paused', 'resumed', 'ended', 'archived'], $events);
            try {
                DB::table('marketing_campaign_events')->where('campaign_id', $created['id'])->update(['event_type' => 'updated']);
                $this->fail('Campaign events must be immutable at the database boundary.');
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        });
    }

    public function test_effective_state_is_time_derived_without_get_writes(): void
    {
        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-10T00:00:00Z'));
        [$tenant, $owner] = $this->readyTenant('campaign-schedule');
        $service = app(MarketingCampaignService::class);
        $campaign = $service->create($tenant, $owner, [
            ...$this->campaignPayload(),
            'startsAt' => '2026-09-11T00:00:00Z',
            'endsAt' => '2026-09-12T00:00:00Z',
        ], (string) Str::uuid());
        $campaign = $service->activate($tenant, $owner, $campaign['id'], 1);
        $this->assertSame('scheduled', $campaign['effectiveState']);
        $before = $tenant->run(fn () => DB::table('marketing_campaigns')->where('id', $campaign['id'])->first());

        CarbonImmutable::setTestNow(CarbonImmutable::parse('2026-09-13T00:00:00Z'));
        $read = $service->read($tenant, $owner, $campaign['id']);
        $after = $tenant->run(fn () => DB::table('marketing_campaigns')->where('id', $campaign['id'])->first());
        $this->assertSame('active', $read['state']);
        $this->assertSame('ended', $read['effectiveState']);
        $this->assertSame($before->revision, $after->revision);
        $this->assertSame((string) $before->updated_at, (string) $after->updated_at);
        $this->assertSame('archived', $service->archive($tenant, $owner, $campaign['id'], 2)['state']);
    }

    public function test_category_coupon_health_and_safe_resolver_fallback(): void
    {
        [$tenant, $owner, $host] = $this->readyTenant('campaign-health');
        $service = app(MarketingCampaignService::class);
        $links = app(MarketingCampaignLinkService::class);
        $resolver = app(MarketingCampaignResolver::class);
        $campaign = $service->create($tenant, $owner, [
            ...$this->campaignPayload(),
            'target' => ['type' => 'category', 'value' => "  GENERAL\t"],
            'couponCode' => 'save10',
        ], (string) Str::uuid());
        $this->assertSame('general', $campaign['target']['value']);
        $campaign = $service->activate($tenant, $owner, $campaign['id'], 1);
        $link = $links->create($tenant, $owner, $campaign['id'], 'instagram', (string) Str::uuid());
        $token = basename((string) parse_url($link['url'], PHP_URL_PATH));

        $resolved = $resolver->resolve($tenant->refresh(), $host, $token);
        $this->assertSame(302, $resolved['status']);
        $this->assertTrue($resolved['eligible']);
        $this->assertStringStartsWith('/products?category=general&', (string) $resolved['location']);
        $this->assertStringContainsString('utm_source=instagram', (string) $resolved['location']);
        $this->assertStringContainsString('coupon=SAVE10', (string) $resolved['location']);
        $this->assertSame(404, $resolver->resolve($tenant->refresh(), $host, str_repeat('A', 43))['status']);

        $tenant->run(function (): void {
            $row = DB::table('store_configs')->where('is_current', true)->firstOrFail();
            $config = json_decode((string) $row->config_json, true, 512, JSON_THROW_ON_ERROR);
            $config['customCoupons'][0]['active'] = false;
            DB::table('store_configs')->where('id', $row->id)->update([
                'config_json' => json_encode($config, JSON_THROW_ON_ERROR),
            ]);
        });
        $degraded = $service->read($tenant, $owner, $campaign['id']);
        $this->assertSame('degraded', $degraded['healthStatus']);
        $this->assertContains('coupon_invalid', $degraded['healthReasons']);
        $this->assertSame('/', $resolver->resolve($tenant->refresh(), $host, $token)['location']);

        $tenant->run(fn () => DB::table('products')->where('category', 'General')->update(['status' => 'draft']));
        $degraded = $service->read($tenant, $owner, $campaign['id']);
        $this->assertContains('target_unavailable', $degraded['healthReasons']);
        $fallback = $resolver->resolve($tenant->refresh(), $host, $token);
        $this->assertSame('/', $fallback['location']);
        $this->assertStringNotContainsString('utm_', (string) $fallback['location']);
        $this->assertNull($fallback['linkId']);
        $this->assertNull($fallback['campaignId']);
        $this->assertFalse($fallback['eligible']);
    }

    public function test_product_target_must_reference_a_published_product(): void
    {
        [$tenant, $owner, , $productId] = $this->readyTenant('campaign-product-target');
        $service = app(MarketingCampaignService::class);
        $campaign = $service->create($tenant, $owner, [
            ...$this->campaignPayload(),
            'target' => ['type' => 'product', 'value' => strtoupper($productId)],
        ], (string) Str::uuid());
        $this->assertSame(strtolower($productId), $campaign['target']['value']);

        $tenant->run(fn () => DB::table('products')->where('id', $productId)->update(['status' => 'draft']));
        try {
            $service->create($tenant, $owner, [
                ...$this->campaignPayload(),
                'target' => ['type' => 'product', 'value' => $productId],
            ], (string) Str::uuid());
            $this->fail('An unpublished product must not become a new campaign target.');
        } catch (MarketingCampaignConflict $exception) {
            $this->assertSame('campaign_target_unavailable', $exception->errorCode);
        }
    }

    public function test_resolver_fails_safe_for_missing_or_broken_tenant_campaign_storage(): void
    {
        [$tenant, $owner, $host] = $this->readyTenant('campaign-resolver-storage');
        $campaigns = app(MarketingCampaignService::class);
        $campaign = $campaigns->create($tenant, $owner, $this->campaignPayload(), (string) Str::uuid());
        $campaign = $campaigns->activate($tenant, $owner, $campaign['id'], 1);
        $link = app(MarketingCampaignLinkService::class)->create(
            $tenant, $owner, $campaign['id'], 'google', (string) Str::uuid(),
        );
        $token = basename((string) parse_url($link['url'], PHP_URL_PATH));
        $resolver = app(MarketingCampaignResolver::class);

        $tenant->run(fn () => DB::statement(
            'ALTER TABLE marketing_channel_links RENAME COLUMN token_hash TO unavailable_token_hash',
        ));
        try {
            $broken = $resolver->resolve($tenant->refresh(), $host, $token);
            $this->assertSafeCampaignFallback($broken);
        } finally {
            $tenant->run(fn () => DB::statement(
                'ALTER TABLE marketing_channel_links RENAME COLUMN unavailable_token_hash TO token_hash',
            ));
        }

        $tenant->run(fn () => DB::statement('DROP TABLE marketing_campaign_registry'));
        $missing = $resolver->resolve($tenant->refresh(), $host, $token);
        $this->assertSafeCampaignFallback($missing);
        $this->assertSame(404, $resolver->resolve($tenant->refresh(), 'wrong.example.test', $token)['status']);
        $this->assertSame(404, $resolver->resolve($tenant->refresh(), $host, 'not-a-valid-token')['status']);
    }

    public function test_link_replay_digest_ciphertext_and_key_rotation(): void
    {
        [$tenant, $owner] = $this->readyTenant('campaign-token');
        $oldKey = 'base64:'.base64_encode(str_repeat('o', 32));
        $newKey = 'base64:'.base64_encode(str_repeat('n', 32));
        config([
            'marketing_campaigns.link_token.current_key_id' => 'old',
            'marketing_campaigns.link_token.current_key' => $oldKey,
            'marketing_campaigns.link_token.previous_key_id' => null,
            'marketing_campaigns.link_token.previous_key' => null,
        ]);
        $campaign = app(MarketingCampaignService::class)->create(
            $tenant, $owner, $this->campaignPayload(), (string) Str::uuid(),
        );
        $key = (string) Str::uuid();
        $service = app(MarketingCampaignLinkService::class);
        $created = $service->create($tenant, $owner, $campaign['id'], 'email', $key);
        $replayed = $service->create($tenant, $owner, $campaign['id'], 'email', $key);
        $this->assertSame($created['id'], $replayed['id']);
        $this->assertTrue($replayed['replayed']);
        $token = basename((string) parse_url($created['url'], PHP_URL_PATH));
        $before = $tenant->run(fn () => DB::table('marketing_channel_links')->where('id', $created['id'])->firstOrFail());
        $this->assertSame(hash('sha256', $token), $before->token_hash);
        $this->assertStringNotContainsString($token, (string) $before->token_ciphertext);
        $tenant->run(function () use ($token): void {
            $operations = DB::table('marketing_campaign_operations')->get();
            $this->assertFalse($operations->contains(fn (object $row): bool => str_contains(json_encode($row, JSON_THROW_ON_ERROR), $token)));
        });

        config([
            'marketing_campaigns.link_token.current_key_id' => 'new',
            'marketing_campaigns.link_token.current_key' => $newKey,
            'marketing_campaigns.link_token.previous_key_id' => 'old',
            'marketing_campaigns.link_token.previous_key' => $oldKey,
        ]);
        $this->assertSame(1, $service->reencryptPreviousTokens($tenant, $owner));
        $after = $tenant->run(fn () => DB::table('marketing_channel_links')->where('id', $created['id'])->firstOrFail());
        $this->assertSame('new', $after->token_key_id);
        $this->assertSame($before->token_hash, $after->token_hash);
        $this->assertNotSame($before->token_ciphertext, $after->token_ciphertext);
        $this->assertSame($created['url'], $service->list($tenant, $owner, $campaign['id'])[0]['url']);
        $tenant->run(function () use ($created): void {
            try {
                DB::table('marketing_channel_links')->where('id', $created['id'])->delete();
                $this->fail('V1 campaign links must be retained at the database boundary.');
            } catch (QueryException) {
                $this->addToAssertionCount(1);
            }
        });
    }

    public function test_link_encryption_key_is_independent_and_fails_closed(): void
    {
        [$tenant, $owner] = $this->readyTenant('campaign-key-required');
        $campaign = app(MarketingCampaignService::class)->create(
            $tenant, $owner, $this->campaignPayload(), (string) Str::uuid(),
        );
        $links = app(MarketingCampaignLinkService::class);

        foreach ([null, 'base64:not-valid-key-material'] as $key) {
            config([
                'marketing_campaigns.link_token.current_key_id' => 'required-test-key',
                'marketing_campaigns.link_token.current_key' => $key,
            ]);
            try {
                $links->create($tenant, $owner, $campaign['id'], 'other', (string) Str::uuid());
                $this->fail('Link creation must fail closed without an independent valid marketing key.');
            } catch (RuntimeException $exception) {
                $this->assertStringContainsString('marketing link token key', strtolower($exception->getMessage()));
            }
        }

        $tenant->run(function (): void {
            $this->assertSame(0, DB::table('marketing_channel_links')->count());
            $this->assertSame(0, DB::table('marketing_campaign_operations')
                ->where('operation_kind', 'channel_link.create')->count());
        });
    }

    public function test_down_waits_for_concurrent_writes_then_refuses_retained_history(): void
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for migration locking.');
        }
        [$tenant, $owner] = $this->readyTenant('campaign-rollback-lock');
        $schema = (string) $tenant->database()->getName();
        $centralName = (string) config('tenancy.database.central_connection');
        $connection = (array) config("database.connections.{$centralName}");
        $connection['search_path'] = $schema;
        $readerName = 'campaign_rollback_reader';
        $writerName = 'campaign_rollback_writer';
        config([
            "database.connections.{$readerName}" => $connection,
            "database.connections.{$writerName}" => $connection,
        ]);
        $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
        if ($sockets === false) {
            $this->fail('Unable to create the migration locking socket.');
        }
        [$parentSocket, $childSocket] = $sockets;
        $pid = pcntl_fork();
        if ($pid === -1) {
            $this->fail('Unable to fork the migration locking worker.');
        }
        if ($pid === 0) {
            fclose($parentSocket);
            DB::purge('tenant');
            DB::purge($centralName);
            DB::setDefaultConnection($readerName);
            fwrite($childSocket, 'ready');
            fread($childSocket, 1);
            try {
                $migration = require database_path('migrations/tenant/2026_09_07_000011_create_marketing_campaign_core.php');
                $migration->down();
                $result = 'dropped';
            } catch (RuntimeException $exception) {
                $result = str_contains($exception->getMessage(), 'Refusing to erase retained')
                    ? 'refused'
                    : 'error:'.$exception->getMessage();
            } catch (Throwable $exception) {
                $result = 'error:'.$exception::class.':'.$exception->getMessage();
            }
            fwrite($childSocket, $result);
            fclose($childSocket);
            exit(0);
        }

        fclose($childSocket);
        $this->assertSame('ready', fread($parentSocket, 5));
        $writer = DB::connection($writerName);
        $writer->beginTransaction();
        $campaignId = (string) Str::uuid();
        $now = now('UTC');
        $writer->table('marketing_campaigns')->insert([
            'id' => $campaignId,
            'name' => 'Concurrent retained campaign',
            'objective' => 'traffic',
            'state' => 'draft',
            'target_type' => 'store',
            'target_value' => null,
            'revision' => 1,
            'created_by_ulid' => (string) $owner->getKey(),
            'updated_by_ulid' => (string) $owner->getKey(),
            'created_at' => $now,
            'updated_at' => $now,
        ]);
        fwrite($parentSocket, '1');
        usleep(250_000);
        $writer->commit();
        $result = (string) stream_get_contents($parentSocket);
        fclose($parentSocket);
        pcntl_waitpid($pid, $status);
        $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
        $this->assertSame('refused', $result, $result);
        $this->assertSame(1, DB::connection($writerName)->table('marketing_campaigns')
            ->where('id', $campaignId)->count());
        DB::purge($readerName);
        DB::purge($writerName);
        config([
            "database.connections.{$readerName}" => null,
            "database.connections.{$writerName}" => null,
        ]);
    }

    public function test_empty_core_rollback_preserves_commerce_tables_and_fails_management_safely(): void
    {
        [$tenant, $owner] = $this->readyTenant('campaign-empty-rollback');
        $migration = require database_path('migrations/tenant/2026_09_07_000011_create_marketing_campaign_core.php');
        $tenant->run(function () use ($migration): void {
            $migration->down();
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('store_configs'));
            $this->assertTrue(DB::getSchemaBuilder()->hasTable('products'));
            $this->assertFalse(DB::getSchemaBuilder()->hasTable('marketing_campaigns'));
        });

        try {
            app(MarketingCampaignService::class)->list($tenant, $owner);
            $this->fail('Campaign management must fail with a typed error when its schema is absent.');
        } catch (MarketingCampaignConflict $exception) {
            $this->assertSame('marketing_campaigns_not_ready', $exception->errorCode);
        }
    }

    public function test_concurrent_campaign_and_link_limits_have_one_winner(): void
    {
        [$tenant, $owner] = $this->readyTenant('campaign-concurrency');
        $secondManager = $this->user('campaign-concurrency-manager@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $secondManager,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );
        $this->assertSame(20, config('marketing_campaigns.max_campaigns'));
        $this->assertSame(8, config('marketing_campaigns.max_links_per_campaign'));
        config(['marketing_campaigns.max_campaigns' => 1]);
        $outcomes = $this->runConcurrent([
            fn (): string => $this->createCampaignOutcome($tenant->id, $owner->id, 'Concurrent A'),
            fn (): string => $this->createCampaignOutcome($tenant->id, $secondManager->id, 'Concurrent B'),
        ]);
        sort($outcomes);
        $this->assertSame(['campaign_quota_exceeded', 'ok'], $outcomes);
        $campaign = app(MarketingCampaignService::class)->list($tenant, $owner)[0];

        config(['marketing_campaigns.max_links_per_campaign' => 1]);
        $linkOutcomes = $this->runConcurrent([
            fn (): string => $this->createLinkOutcome($tenant->id, $owner->id, $campaign['id'], 'facebook'),
            fn (): string => $this->createLinkOutcome($tenant->id, $secondManager->id, $campaign['id'], 'whatsapp'),
        ]);
        sort($linkOutcomes);
        $this->assertSame(['campaign_link_quota_exceeded', 'ok'], $linkOutcomes);
        $tenant->run(function (): void {
            $this->assertSame(1, DB::table('marketing_campaigns')->count());
            $this->assertSame(1, DB::table('marketing_channel_links')->count());
        });
    }

    /** @return array{Tenant, User, string, string} */
    private function readyTenant(string $label): array
    {
        $tenant = Tenant::query()->create([
            'id' => 'wp530a-'.$label,
            'store_name' => 'Store '.$label,
            'owner_name' => 'Campaign Owner',
            'owner_email' => $label.'@example.test',
            'business_type' => 'retail',
            'verification_status' => TenantVerificationStatus::Approved->value,
            'provisioning_status' => ProvisioningState::Active->value,
            'publication_status' => PublicationStatus::Published->value,
            'theme_style' => 'elegant',
            'active_at' => now(),
        ]);
        $this->tenantIds[] = (string) $tenant->getKey();
        $host = $label.'.example.test';
        $publishedDomain = $tenant->domains()->create(['domain' => $host, 'kind' => DomainKind::PublicSubdomain]);
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
            'domain' => $host,
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
        $productId = $tenant->run(function () use ($tenant): string {
            return DB::transaction(function () use ($tenant): string {
                DB::table('store_configs')->insert([
                    'id' => (string) Str::uuid(),
                    'config_json' => json_encode([
                        'enableCoupons' => true,
                        'customCoupons' => [['code' => 'SAVE10', 'discountPercent' => 10, 'active' => true]],
                    ], JSON_THROW_ON_ERROR),
                    'revision' => 1,
                    'products_materialized' => true,
                    'is_current' => true,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                $id = (string) Str::uuid();
                DB::table('products')->insert([
                    'id' => $id,
                    'name' => 'Campaign product',
                    'price' => '12.50',
                    'base_price_minor' => 1250,
                    'sale_price_minor' => null,
                    'description' => null,
                    'category' => 'General',
                    'image_keyword' => null,
                    'image_url' => null,
                    'image_urls' => null,
                    'stock_quantity' => 0,
                    'reserved_quantity' => 0,
                    'manage_stock' => true,
                    'sku' => 'CAMPAIGN-'.strtoupper(substr($id, 0, 8)),
                    'low_stock_threshold' => 2,
                    'position' => 0,
                    'status' => 'published',
                    'revision' => 1,
                    'inventory_revision' => 1,
                    'published_at' => now(),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
                app(InventoryLedgerService::class)->recordOpening($tenant, $id, 10);

                return $id;
            });
        });
        $owner = $this->user('owner-'.$label.'@example.test');
        app(RoleAssignmentService::class)->assignTenantRole(
            $tenant,
            $owner,
            Role::query()->where('key', SystemRole::MerchantOwner->value)->firstOrFail(),
            $owner,
        );

        return [$tenant->refresh(), $owner, $host, $productId];
    }

    private function user(string $email): User
    {
        $user = User::query()->create([
            'name' => 'Campaign User',
            'email' => $email,
            'password' => 'campaign-password-123',
            'status' => UserStatus::Active,
        ]);
        $this->userIds[] = (string) $user->getKey();

        return $user;
    }

    /** @param array{status: int, location: ?string, linkId: ?string, campaignId: ?string, eligible: bool} $decision */
    private function assertSafeCampaignFallback(array $decision): void
    {
        $this->assertSame(302, $decision['status']);
        $this->assertSame('/', $decision['location']);
        $this->assertNull($decision['linkId']);
        $this->assertNull($decision['campaignId']);
        $this->assertFalse($decision['eligible']);
    }

    /** @return array<string, mixed> */
    private function campaignPayload(): array
    {
        return [
            'name' => 'Campaign baseline',
            'objective' => 'sales',
            'startsAt' => null,
            'endsAt' => null,
            'target' => ['type' => 'store', 'value' => null],
            'couponCode' => null,
        ];
    }

    private function createCampaignOutcome(string $tenantId, string $userId, string $name): string
    {
        try {
            app(MarketingCampaignService::class)->create(
                Tenant::query()->findOrFail($tenantId),
                User::query()->findOrFail($userId),
                [...$this->campaignPayload(), 'name' => $name],
                (string) Str::uuid(),
            );

            return 'ok';
        } catch (MarketingCampaignConflict $exception) {
            return $exception->errorCode;
        }
    }

    private function createLinkOutcome(string $tenantId, string $userId, string $campaignId, string $channel): string
    {
        try {
            app(MarketingCampaignLinkService::class)->create(
                Tenant::query()->findOrFail($tenantId),
                User::query()->findOrFail($userId),
                $campaignId,
                $channel,
                (string) Str::uuid(),
            );

            return 'ok';
        } catch (MarketingCampaignConflict $exception) {
            return $exception->errorCode;
        }
    }

    /**
     * @param  list<callable(): string>  $operations
     * @return list<string>
     */
    private function runConcurrent(array $operations): array
    {
        if (! function_exists('pcntl_fork') || ! function_exists('stream_socket_pair')) {
            $this->fail('The database gate requires pcntl and socket pairs for campaign concurrency.');
        }
        $workers = [];
        foreach ($operations as $operation) {
            $sockets = stream_socket_pair(STREAM_PF_UNIX, STREAM_SOCK_STREAM, STREAM_IPPROTO_IP);
            if ($sockets === false) {
                $this->fail('Unable to create a campaign concurrency socket.');
            }
            [$parentSocket, $childSocket] = $sockets;
            $pid = pcntl_fork();
            if ($pid === -1) {
                $this->fail('Unable to fork a campaign concurrency worker.');
            }
            if ($pid === 0) {
                fclose($parentSocket);
                fread($childSocket, 1);
                try {
                    if (tenancy()->initialized) {
                        tenancy()->end();
                    }
                    $central = (string) config('tenancy.database.central_connection');
                    DB::purge('tenant');
                    DB::purge($central);
                    DB::setDefaultConnection($central);
                    $result = $operation();
                } catch (Throwable $exception) {
                    $result = 'error:'.$exception::class.':'.$exception->getMessage();
                }
                fwrite($childSocket, $result);
                fclose($childSocket);
                exit(0);
            }
            fclose($childSocket);
            $workers[] = ['pid' => $pid, 'socket' => $parentSocket];
        }
        foreach ($workers as $worker) {
            fwrite($worker['socket'], '1');
        }
        $results = [];
        foreach ($workers as $worker) {
            $result = (string) stream_get_contents($worker['socket']);
            fclose($worker['socket']);
            pcntl_waitpid($worker['pid'], $status);
            $this->assertTrue(pcntl_wifexited($status) && pcntl_wexitstatus($status) === 0);
            $this->assertFalse(str_starts_with($result, 'error:'), $result);
            $results[] = $result;
        }
        DB::purge((string) config('tenancy.database.central_connection'));

        return $results;
    }
}
