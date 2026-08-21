<?php

namespace Tests\Integration;

use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\PermissionKey;
use App\Enums\ProvisioningState;
use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\RoleScope;
use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use App\Enums\SystemRole;
use App\Enums\TenantVerificationStatus;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\DomainReservation;
use App\Models\Permission;
use App\Models\PublicationRequest;
use App\Models\Role;
use App\Models\Tenant;
use App\Models\TenantSubscription;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Carbon\CarbonImmutable;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class PlatformAdministrationConsoleTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        DB::connection((string) config('tenancy.database.central_connection'))
            ->statement('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');
        $this->seed(IdentitySeeder::class);
    }

    public function test_console_read_models_enforce_independent_store_and_audit_permissions(): void
    {
        $merchant = $this->user('console-merchant@example.test');
        $storeViewer = $this->userWithPermissions('store-viewer', [PermissionKey::PlatformStoresView]);
        $auditViewer = $this->userWithPermissions('audit-viewer', [PermissionKey::PlatformAuditView]);
        $reviewer = $this->userWithSystemRole('console-reviewer@example.test', SystemRole::PlatformReviewer);

        $this->getJson('/api/admin/overview')->assertUnauthorized();
        $this->actingAs($merchant)->getJson('/api/admin/overview')->assertForbidden();
        $this->actingAs($merchant)->getJson('/api/admin/audit-logs')->assertForbidden();

        $this->actingAs($storeViewer)->getJson('/api/admin/overview')->assertOk();
        $this->actingAs($storeViewer)->getJson('/api/admin/stores')->assertOk();
        $this->actingAs($storeViewer)->getJson('/api/admin/audit-logs')->assertForbidden();

        $this->actingAs($auditViewer)->getJson('/api/admin/overview')->assertForbidden();
        $this->actingAs($auditViewer)->getJson('/api/admin/stores')->assertForbidden();
        $this->actingAs($auditViewer)->getJson('/api/admin/audit-logs')->assertOk();

        $this->assertFalse($reviewer->platformRoles()->where('roles.key', SystemRole::PlatformSuperAdmin->value)->exists());
        $this->actingAs($reviewer)->getJson('/api/admin/overview')->assertOk();
    }

    public function test_overview_and_attention_filters_share_authoritative_predicates(): void
    {
        $viewer = $this->userWithPermissions('overview-viewer', [PermissionKey::PlatformStoresView]);
        $pending = $this->tenant('overview-pending');
        $failed = $this->tenant(
            'overview-failed',
            TenantVerificationStatus::Approved,
            ProvisioningState::Failed,
        );
        $publication = $this->tenant(
            'overview-publication',
            TenantVerificationStatus::Approved,
            ProvisioningState::Active,
            PublicationStatus::Requested,
        );
        $this->attachPendingSubscription($publication);
        $published = $this->tenant(
            'overview-published',
            TenantVerificationStatus::Approved,
            ProvisioningState::Active,
            PublicationStatus::Published,
        );

        $overview = $this->actingAs($viewer)->getJson('/api/admin/overview')
            ->assertOk()
            ->assertJsonPath('data.stores.total', 4)
            ->assertJsonPath('data.stores.verification.pending', 1)
            ->assertJsonPath('data.stores.verification.approved', 3)
            ->assertJsonPath('data.stores.provisioning.failed', 1)
            ->assertJsonPath('data.stores.publication.published', 1)
            ->assertJsonPath('data.attention.review', 1)
            ->assertJsonPath('data.attention.provisioning', 1)
            ->assertJsonPath('data.attention.subscription', 1)
            ->assertJsonPath('data.attention.publication', 1);
        $this->assertSame(0, CarbonImmutable::parse((string) $overview->json('data.generatedAt'))->getOffset());

        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=review')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $pending->id);
        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=provisioning')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $failed->id);
        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=subscription')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $publication->id);
        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=publication&verification=approved')
            ->assertOk()->assertJsonPath('meta.total', 1)->assertJsonPath('data.0.id', $publication->id)
            ->assertJsonMissing(['id' => $published->id]);
    }

    public function test_subscription_attention_keeps_the_publication_subscription_correlation(): void
    {
        $viewer = $this->userWithPermissions('subscription-correlation-viewer', [PermissionKey::PlatformStoresView]);
        $cancelled = $this->tenant(
            'subscription-cancelled',
            TenantVerificationStatus::Approved,
            ProvisioningState::Active,
        );
        $this->attachSubscription($cancelled, SubscriptionStatus::Cancelled);

        $expiredActive = $this->tenant(
            'subscription-active-ended',
            TenantVerificationStatus::Approved,
            ProvisioningState::Active,
        );
        $this->attachSubscription(
            $expiredActive,
            SubscriptionStatus::Active,
            CarbonImmutable::now('UTC')->subDay(),
        );

        $this->actingAs($viewer)->getJson('/api/admin/overview')
            ->assertOk()
            ->assertJsonPath('data.attention.subscription', 1);
        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=subscription')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.id', $expiredActive->id)
            ->assertJsonMissing(['id' => $cancelled->id]);
    }

    public function test_store_search_filters_pagination_and_invalid_queries_are_server_owned(): void
    {
        $viewer = $this->userWithPermissions('query-viewer', [PermissionKey::PlatformStoresView]);
        foreach (range(1, 11) as $index) {
            $tenant = $this->tenant('query-'.str_pad((string) $index, 2, '0', STR_PAD_LEFT));
            if ($index === 7) {
                $tenant->update([
                    'store_name' => 'متجر البن اليمني',
                    'owner_name' => 'مالك صنعاء',
                    'owner_email' => 'coffee-owner@example.test',
                    'verification_status' => TenantVerificationStatus::Rejected->value,
                ]);
            }
        }

        $this->actingAs($viewer)->getJson('/api/admin/stores?perPage=10&page=1')
            ->assertOk()
            ->assertJsonCount(10, 'data')
            ->assertJsonPath('meta.total', 11)
            ->assertJsonPath('meta.per_page', 10)
            ->assertJsonPath('meta.last_page', 2);
        $this->actingAs($viewer)->getJson('/api/admin/stores?search=coffee-owner&verification=rejected')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.storeName', 'متجر البن اليمني');

        $this->actingAs($viewer)->getJson('/api/admin/stores?search=x')->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/stores?attention=unknown')->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/stores?perPage=9')->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/stores?verification=invented')->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/stores?attentoin=review')->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/stores?search=%25%25')
            ->assertOk()->assertJsonPath('meta.total', 0);
    }

    public function test_audit_list_is_searchable_allowlisted_and_read_only(): void
    {
        $viewer = $this->userWithPermissions('audit-projection-viewer', [PermissionKey::PlatformAuditView]);
        $actor = $this->user('audit-actor@example.test');
        AdminAuditLog::query()->create([
            'actor_user_id' => $actor->id,
            'tenant_id' => 'audit-tenant',
            'action' => 'platform.store.metadata.changed',
            'subject_type' => Tenant::class,
            'subject_id' => 'audit-tenant',
            'old_values' => ['owner_email' => 'old@example.test', 'workspace_config' => ['secret' => 'hidden']],
            'new_values' => ['owner_email' => 'new@example.test', 'workspace_config' => ['secret' => 'still-hidden']],
            'ip_address' => '127.0.0.1',
            'user_agent' => 'private-browser-diagnostics',
            'request_id' => 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            'occurred_at' => CarbonImmutable::now('UTC'),
        ]);

        $this->actingAs($viewer)->getJson('/api/admin/audit-logs?search=aaaaaaaa')
            ->assertOk()
            ->assertJsonPath('meta.total', 1)
            ->assertJsonPath('data.0.action', 'platform.store.metadata.changed')
            ->assertJsonPath('data.0.changedFields', ['owner_email', 'workspace_config'])
            ->assertJsonMissingPath('data.0.oldValues')
            ->assertJsonMissingPath('data.0.newValues')
            ->assertJsonMissingPath('data.0.userAgent');

        $this->actingAs($viewer)->getJson('/api/admin/audit-logs?search=secret')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($viewer)->getJson('/api/admin/audit-logs?action=invalid action')
            ->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/audit-logs?actoin=platform.store.metadata.changed')
            ->assertUnprocessable();
        $this->actingAs($viewer)->getJson('/api/admin/audit-logs?search=__')
            ->assertOk()->assertJsonPath('meta.total', 0);
        $this->actingAs($viewer)->deleteJson('/api/admin/audit-logs/1')->assertNotFound();
    }

    private function user(string $email): User
    {
        return User::query()->create([
            'name' => 'Platform Console User',
            'email' => $email,
            'status' => UserStatus::Active,
        ]);
    }

    /** @param list<PermissionKey> $permissions */
    private function userWithPermissions(string $key, array $permissions): User
    {
        $user = $this->user("{$key}@example.test");
        $role = Role::query()->create([
            'key' => $key,
            'name' => $key,
            'scope' => RoleScope::Platform,
            'system' => false,
        ]);
        $permissionIds = Permission::query()->whereIn('key', array_map(
            static fn (PermissionKey $permission): string => $permission->value,
            $permissions,
        ))->pluck('id');
        foreach ($permissionIds as $permissionId) {
            $role->permissions()->attach($permissionId, ['scope' => RoleScope::Platform->value]);
        }
        app(RoleAssignmentService::class)->assignPlatformRole($user, $role, $user);

        return $user;
    }

    private function userWithSystemRole(string $email, SystemRole $role): User
    {
        $user = $this->user($email);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->firstOrFail(),
            $user,
        );

        return $user;
    }

    private function tenant(
        string $id,
        TenantVerificationStatus $verification = TenantVerificationStatus::Pending,
        ProvisioningState $provisioning = ProvisioningState::NotStarted,
        PublicationStatus $publication = PublicationStatus::Requested,
    ): Tenant {
        return Tenant::query()->create([
            'id' => $id,
            'store_name' => "Store {$id}",
            'owner_name' => "Owner {$id}",
            'owner_email' => "{$id}@example.test",
            'business_type' => 'retail',
            'verification_status' => $verification->value,
            'provisioning_status' => $provisioning->value,
            'publication_status' => $publication->value,
            'theme_style' => 'elegant',
        ]);
    }

    private function attachPendingSubscription(Tenant $tenant): void
    {
        $this->attachSubscription($tenant, SubscriptionStatus::PendingActivation);
    }

    private function attachSubscription(
        Tenant $tenant,
        SubscriptionStatus $status,
        ?CarbonImmutable $endsAt = null,
    ): void {
        $now = CarbonImmutable::now('UTC');
        $reservation = DomainReservation::query()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'domain' => $tenant->id.'.example.test',
            'handle' => $tenant->id,
            'status' => DomainReservationStatus::Reserved,
            'origin' => DomainReservationOrigin::UserSelected,
            'reserved_at' => $now,
        ]);
        $subscription = TenantSubscription::query()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'plan_key' => 'starter',
            'status' => $status,
            'activation_source' => $status === SubscriptionStatus::PendingActivation
                ? SubscriptionActivationSource::ManualPending
                : SubscriptionActivationSource::ManualAdmin,
            'starts_at' => $status === SubscriptionStatus::PendingActivation ? null : $now->subDays(2),
            'ends_at' => $endsAt,
            'cancelled_at' => $status === SubscriptionStatus::Cancelled ? $now : null,
        ]);
        $publication = PublicationRequest::query()->create([
            'id' => (string) Str::uuid(),
            'tenant_id' => $tenant->id,
            'domain_reservation_id' => $reservation->id,
            'tenant_subscription_id' => $subscription->id,
            'status' => PublicationRequestStatus::Requested,
            'origin' => PublicationRequestOrigin::UserSelected,
            'requested_at' => $now,
        ]);
        $tenant->update(['publication_request_id' => $publication->id]);
    }
}
