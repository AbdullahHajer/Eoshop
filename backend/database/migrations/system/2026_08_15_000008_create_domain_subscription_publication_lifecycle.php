<?php

use App\Enums\DomainKind;
use App\Enums\DomainReservationOrigin;
use App\Enums\DomainReservationStatus;
use App\Enums\PlanActivationMode;
use App\Enums\PublicationRequestOrigin;
use App\Enums\PublicationRequestStatus;
use App\Enums\PublicationStatus;
use App\Enums\SubscriptionActivationSource;
use App\Enums\SubscriptionStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table): void {
            $table->string('key', 50)->primary();
            $table->string('name', 100);
            $table->unsignedBigInteger('price_minor')->nullable();
            $table->char('currency', 3)->default('SAR');
            $table->string('billing_interval', 20)->default('monthly');
            $table->string('activation_mode', 20);
            $table->unsignedSmallInteger('max_stores');
            $table->unsignedInteger('max_products')->nullable();
            $table->json('features');
            $table->boolean('is_active')->default(true);
            $table->timestampsTz();
        });
        DB::statement("ALTER TABLE plans ADD CONSTRAINT plans_activation_mode_valid CHECK (activation_mode IN ('automatic', 'manual'))");
        DB::statement("ALTER TABLE plans ADD CONSTRAINT plans_billing_interval_valid CHECK (billing_interval IN ('monthly'))");
        DB::statement('ALTER TABLE plans ADD CONSTRAINT plans_limits_valid CHECK (max_stores > 0 AND (max_products IS NULL OR max_products > 0))');

        $now = now();
        DB::table('plans')->insert([
            [
                'key' => 'starter',
                'name' => 'الباقة المبتدئة',
                'price_minor' => 0,
                'currency' => 'SAR',
                'billing_interval' => 'monthly',
                'activation_mode' => PlanActivationMode::Automatic->value,
                'max_stores' => 1,
                'max_products' => 10,
                'features' => json_encode(['platform_subdomain', 'basic_theme'], JSON_THROW_ON_ERROR),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'pro',
                'name' => 'الباقة الاحترافية',
                'price_minor' => 9900,
                'currency' => 'SAR',
                'billing_interval' => 'monthly',
                'activation_mode' => PlanActivationMode::Manual->value,
                'max_stores' => 3,
                'max_products' => null,
                'features' => json_encode(['platform_subdomain', 'unlimited_products', 'priority_review'], JSON_THROW_ON_ERROR),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'key' => 'business',
                'name' => 'باقة الأعمال',
                'price_minor' => 24900,
                'currency' => 'SAR',
                'billing_interval' => 'monthly',
                'activation_mode' => PlanActivationMode::Manual->value,
                'max_stores' => 10,
                'max_products' => null,
                'features' => json_encode(['platform_subdomain', 'unlimited_products', 'priority_review', 'multi_store'], JSON_THROW_ON_ERROR),
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);

        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('publication_status')->default(PublicationStatus::Requested->value)->after('provisioning_status');
            $table->timestampTz('publication_requested_at')->nullable()->after('publication_status');
            $table->timestampTz('published_at')->nullable()->after('publication_requested_at');
            $table->uuid('publication_request_id')->nullable()->after('published_at');
            $table->unsignedBigInteger('published_domain_id')->nullable()->after('publication_request_id');
            $table->uuid('publication_subscription_id')->nullable()->after('published_domain_id');
            $table->index(['publication_status', 'updated_at'], 'tenants_publication_updated_index');
        });
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_publication_status_valid CHECK (publication_status IN ('requested', 'published', 'unpublished', 'rejected'))");

        Schema::table('domains', function (Blueprint $table): void {
            $table->string('kind', 30)->default(DomainKind::Internal->value)->after('domain');
            $table->index(['tenant_id', 'kind'], 'domains_tenant_kind_index');
        });
        DB::statement("ALTER TABLE domains ADD CONSTRAINT domains_kind_valid CHECK (kind IN ('internal', 'public_subdomain'))");

        Schema::create('domain_reservations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->string('domain', 253);
            // User-selected handles are limited to 3–50 characters by the
            // application contract. The wider database field preserves valid
            // WP 2.1/2.2 legacy labels, which allowed the DNS limit of 63.
            $table->string('handle', 63);
            $table->string('status', 20);
            $table->string('origin', 30);
            $table->char('reserved_by_user_id', 26)->nullable();
            $table->timestampTz('reserved_at');
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('released_at')->nullable();
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->index(['tenant_id', 'created_at'], 'domain_reservations_tenant_created_index');
            $table->index(['status', 'updated_at'], 'domain_reservations_status_updated_index');
            $table->unique(['id', 'tenant_id'], 'domain_reservations_id_tenant_unique');
        });
        DB::statement("ALTER TABLE domain_reservations ADD CONSTRAINT domain_reservations_status_valid CHECK (status IN ('reserved', 'active', 'released'))");
        DB::statement("ALTER TABLE domain_reservations ADD CONSTRAINT domain_reservations_origin_valid CHECK (origin IN ('user_selected', 'wp22_internal'))");
        DB::statement("ALTER TABLE domain_reservations ADD CONSTRAINT domain_reservations_handle_valid CHECK (handle ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')");
        DB::statement("ALTER TABLE domain_reservations ADD CONSTRAINT domain_reservations_domain_valid CHECK (domain = lower(domain) AND domain = btrim(domain) AND char_length(domain) BETWEEN 3 AND 253 AND domain ~ '^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\\.)+[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$')");
        DB::statement("CREATE UNIQUE INDEX domain_reservations_current_domain_unique ON domain_reservations (domain) WHERE status IN ('reserved', 'active')");
        DB::statement("CREATE UNIQUE INDEX domain_reservations_current_tenant_unique ON domain_reservations (tenant_id) WHERE status IN ('reserved', 'active')");

        Schema::create('tenant_subscriptions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->string('plan_key', 50);
            $table->string('status', 30);
            $table->string('activation_source', 30);
            $table->char('requested_by_user_id', 26)->nullable();
            $table->char('activated_by_user_id', 26)->nullable();
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->timestampTz('cancelled_at')->nullable();
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('plan_key')->references('key')->on('plans')->restrictOnDelete();
            $table->index(['status', 'ends_at'], 'tenant_subscriptions_status_end_index');
            $table->index(['tenant_id', 'created_at'], 'tenant_subscriptions_tenant_created_index');
            $table->unique(['id', 'tenant_id'], 'tenant_subscriptions_id_tenant_unique');
        });
        DB::statement("ALTER TABLE tenant_subscriptions ADD CONSTRAINT tenant_subscriptions_status_valid CHECK (status IN ('pending_activation', 'active', 'cancelled', 'expired'))");
        DB::statement("ALTER TABLE tenant_subscriptions ADD CONSTRAINT tenant_subscriptions_source_valid CHECK (activation_source IN ('automatic_free', 'manual_pending', 'manual_admin', 'wp23_adopted'))");
        DB::statement('ALTER TABLE tenant_subscriptions ADD CONSTRAINT tenant_subscriptions_period_valid CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)');
        DB::statement("CREATE UNIQUE INDEX tenant_subscriptions_current_tenant_unique ON tenant_subscriptions (tenant_id) WHERE status IN ('pending_activation', 'active')");

        Schema::create('publication_requests', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->uuid('domain_reservation_id');
            $table->uuid('tenant_subscription_id');
            $table->string('status', 20);
            $table->string('origin', 30);
            $table->char('requested_by_user_id', 26)->nullable();
            $table->char('decided_by_user_id', 26)->nullable();
            $table->string('decision_reason', 1000)->nullable();
            $table->timestampTz('requested_at');
            $table->timestampTz('decided_at')->nullable();
            $table->timestampTz('published_at')->nullable();
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign(
                ['domain_reservation_id', 'tenant_id'],
                'publication_requests_reservation_tenant_foreign',
            )->references(['id', 'tenant_id'])->on('domain_reservations')->restrictOnDelete();
            $table->foreign(
                ['tenant_subscription_id', 'tenant_id'],
                'publication_requests_subscription_tenant_foreign',
            )->references(['id', 'tenant_id'])->on('tenant_subscriptions')->restrictOnDelete();
            $table->index(['tenant_id', 'created_at'], 'publication_requests_tenant_created_index');
            $table->unique(['id', 'tenant_id'], 'publication_requests_id_tenant_unique');
        });
        DB::statement("ALTER TABLE publication_requests ADD CONSTRAINT publication_requests_status_valid CHECK (status IN ('requested', 'published', 'rejected', 'cancelled'))");
        DB::statement("ALTER TABLE publication_requests ADD CONSTRAINT publication_requests_origin_valid CHECK (origin IN ('user_selected', 'wp23_adopted'))");
        DB::statement("CREATE UNIQUE INDEX publication_requests_one_open_per_tenant ON publication_requests (tenant_id) WHERE status = 'requested'");

        Schema::table('tenants', function (Blueprint $table): void {
            $table->foreign('publication_request_id')->references('id')->on('publication_requests')->nullOnDelete();
            $table->foreign('published_domain_id')->references('id')->on('domains')->nullOnDelete();
            $table->foreign('publication_subscription_id')->references('id')->on('tenant_subscriptions')->nullOnDelete();
        });

        $missingDomainTenantIds = DB::table('tenants')
            ->whereNotExists(fn ($query) => $query->selectRaw('1')->from('domains')->whereColumn('domains.tenant_id', 'tenants.id'))
            ->pluck('id');
        if ($missingDomainTenantIds->isNotEmpty()) {
            throw new RuntimeException('WP 2.3 adoption requires every existing tenant to have an internal domain. Missing tenant IDs: '.$missingDomainTenantIds->implode(', '));
        }

        DB::table('tenants')->orderBy('id')->each(function (object $tenant) use ($now): void {
            $published = $tenant->verification_status === 'approved'
                && $tenant->provisioning_status === 'active';
            $rejected = $tenant->verification_status === 'rejected';
            $requestStatus = $published
                ? PublicationRequestStatus::Published
                : ($rejected ? PublicationRequestStatus::Rejected : PublicationRequestStatus::Requested);
            $tenantPublicationStatus = $published
                ? PublicationStatus::Published
                : ($rejected ? PublicationStatus::Rejected : PublicationStatus::Requested);
            $subscriptionId = (string) Str::uuid();
            DB::table('tenant_subscriptions')->insert([
                'id' => $subscriptionId,
                'tenant_id' => $tenant->id,
                'plan_key' => 'starter',
                'status' => SubscriptionStatus::Active->value,
                'activation_source' => SubscriptionActivationSource::Wp23Adopted->value,
                'requested_by_user_id' => null,
                'activated_by_user_id' => null,
                'starts_at' => $tenant->created_at ?? $now,
                'ends_at' => null,
                'cancelled_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $domain = DB::table('domains')->where('tenant_id', $tenant->id)->orderBy('id')->first();
            $reservationId = (string) Str::uuid();
            DB::table('domain_reservations')->insert([
                'id' => $reservationId,
                'tenant_id' => $tenant->id,
                'domain' => $domain->domain,
                'handle' => Str::before((string) $domain->domain, '.'),
                'status' => DomainReservationStatus::Active->value,
                'origin' => DomainReservationOrigin::Wp22Internal->value,
                'reserved_by_user_id' => null,
                'reserved_at' => $tenant->created_at ?? $now,
                'activated_at' => $published ? ($tenant->active_at ?? $now) : $now,
                'released_at' => null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);

            $publicationRequestId = (string) Str::uuid();
            DB::table('publication_requests')->insert([
                'id' => $publicationRequestId,
                'tenant_id' => $tenant->id,
                'domain_reservation_id' => $reservationId,
                'tenant_subscription_id' => $subscriptionId,
                'status' => $requestStatus->value,
                'origin' => PublicationRequestOrigin::Wp23Adopted->value,
                'requested_by_user_id' => null,
                'decided_by_user_id' => null,
                'decision_reason' => null,
                'requested_at' => $tenant->created_at ?? $now,
                'decided_at' => ($published || $rejected) ? ($tenant->updated_at ?? $now) : null,
                'published_at' => $published ? ($tenant->active_at ?? $now) : null,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('tenants')->where('id', $tenant->id)->update([
                'publication_status' => $tenantPublicationStatus->value,
                'publication_requested_at' => $tenant->created_at ?? $now,
                'published_at' => $published ? ($tenant->active_at ?? $now) : null,
                'publication_request_id' => $publicationRequestId,
                'published_domain_id' => $published ? $domain->id : null,
                'publication_subscription_id' => $published ? $subscriptionId : null,
            ]);
        });
    }

    public function down(): void
    {
        $hasUserData = Schema::hasTable('domain_reservations')
            && DB::table('domain_reservations')->where('origin', DomainReservationOrigin::UserSelected->value)->exists();
        $hasPublicDomains = Schema::hasColumn('domains', 'kind')
            && DB::table('domains')->where('kind', DomainKind::PublicSubdomain->value)->exists();
        $hasNonAdoptedSubscriptions = Schema::hasTable('tenant_subscriptions')
            && DB::table('tenant_subscriptions')->where('activation_source', '!=', SubscriptionActivationSource::Wp23Adopted->value)->exists();
        $hasPublicationChanges = Schema::hasTable('publication_requests')
            && DB::table('publication_requests')->where(function ($query): void {
                $query->where('origin', '!=', PublicationRequestOrigin::Wp23Adopted->value)
                    ->orWhereColumn('updated_at', '>', 'created_at');
            })->exists();

        if ($hasUserData || $hasPublicDomains || $hasNonAdoptedSubscriptions || $hasPublicationChanges) {
            throw new RuntimeException('WP 2.3 cannot be rolled back while user reservations, public domains, or non-adopted subscription history exist.');
        }

        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropForeign(['publication_request_id']);
            $table->dropForeign(['published_domain_id']);
            $table->dropForeign(['publication_subscription_id']);
        });
        Schema::dropIfExists('publication_requests');
        Schema::dropIfExists('tenant_subscriptions');
        Schema::dropIfExists('domain_reservations');
        Schema::dropIfExists('plans');

        DB::statement('ALTER TABLE domains DROP CONSTRAINT IF EXISTS domains_kind_valid');
        Schema::table('domains', function (Blueprint $table): void {
            $table->dropIndex('domains_tenant_kind_index');
            $table->dropColumn('kind');
        });

        DB::statement('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_publication_status_valid');
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropIndex('tenants_publication_updated_index');
            $table->dropColumn([
                'publication_status',
                'publication_requested_at',
                'published_at',
                'publication_request_id',
                'published_domain_id',
                'publication_subscription_id',
            ]);
        });
    }
};
