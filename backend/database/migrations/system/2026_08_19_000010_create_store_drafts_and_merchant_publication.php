<?php

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\StoreDraftStatus;
use App\Enums\SystemRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Ramsey\Uuid\Uuid;

return new class extends Migration
{
    public function up(): void
    {
        $adoption = DB::table('store_submissions')
            ->join('tenants', 'tenants.id', '=', 'store_submissions.tenant_id')
            ->select([
                'store_submissions.id',
                'store_submissions.tenant_id',
                'store_submissions.submitted_by_user_id',
                'store_submissions.payload_snapshot',
                'store_submissions.submitted_at',
                'tenants.verification_status',
            ])
            ->orderBy('store_submissions.id')
            ->get()
            ->map(function (object $row): array {
                $payload = is_array($row->payload_snapshot)
                    ? $row->payload_snapshot
                    : json_decode((string) $row->payload_snapshot, true);
                if (! is_array($payload)
                    || ! is_array($payload['config'] ?? null)
                    || ! is_string($payload['storeName'] ?? null)
                    || ! is_string($payload['businessType'] ?? null)
                    || ! is_string($payload['themeStyle'] ?? null)
                    || ! is_string($payload['handle'] ?? null)
                    || ! is_string($payload['planKey'] ?? null)
                ) {
                    throw new RuntimeException('WP 5.5 adoption requires a complete original store-submission payload for tenant '.$row->tenant_id.'.');
                }

                return [
                    'submission_id' => (int) $row->id,
                    'draft_id' => Uuid::uuid5(Uuid::NAMESPACE_URL, 'eoshop:store-draft:'.$row->tenant_id)->toString(),
                    'tenant_id' => (string) $row->tenant_id,
                    'owner_user_id' => (string) $row->submitted_by_user_id,
                    'status' => $row->verification_status === 'rejected'
                        ? StoreDraftStatus::CorrectionRequired->value
                        : StoreDraftStatus::Submitted->value,
                    'store_name' => trim($payload['storeName']),
                    'business_type' => trim($payload['businessType']),
                    'theme_style' => $payload['themeStyle'],
                    'handle' => $payload['handle'],
                    'plan_key' => $payload['planKey'],
                    'config' => $payload['config'],
                    'submitted_at' => $row->submitted_at,
                ];
            });

        Schema::create('store_drafts', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->char('owner_user_id', 26);
            $table->string('tenant_id')->nullable();
            $table->string('status', 30);
            $table->unsignedBigInteger('revision');
            $table->string('store_name');
            $table->string('business_type', 100);
            $table->string('theme_style', 20);
            $table->string('handle', 50)->nullable();
            $table->string('plan_key', 50)->nullable();
            $table->json('config');
            $table->timestampTz('saved_at');
            $table->timestampTz('submitted_at')->nullable();
            $table->timestampsTz();

            $table->foreign('owner_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('plan_key')->references('key')->on('plans')->restrictOnDelete();
            $table->unique('tenant_id', 'store_drafts_tenant_unique');
            $table->unique(['id', 'tenant_id'], 'store_drafts_id_tenant_unique');
            $table->index(['owner_user_id', 'updated_at'], 'store_drafts_owner_updated_index');
        });
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_status_valid CHECK (status IN ('draft', 'submitted', 'correction_required'))");
        DB::statement('ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_revision_positive CHECK (revision > 0)');
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_theme_valid CHECK (theme_style IN ('elegant', 'tech'))");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_config_object CHECK (jsonb_typeof(config::jsonb) = 'object')");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_state_shape CHECK ((status = 'draft' AND tenant_id IS NULL AND submitted_at IS NULL) OR (status IN ('submitted', 'correction_required') AND tenant_id IS NOT NULL AND submitted_at IS NOT NULL AND handle IS NOT NULL AND plan_key IS NOT NULL))");
        DB::statement("CREATE UNIQUE INDEX store_drafts_one_unbound_per_owner ON store_drafts (owner_user_id) WHERE status = 'draft' AND tenant_id IS NULL");

        Schema::table('store_submissions', function (Blueprint $table): void {
            $table->uuid('store_draft_id')->nullable()->after('tenant_id');
            $table->unsignedBigInteger('revision')->default(1)->after('request_fingerprint');
            $table->timestampTz('revised_at')->nullable()->after('submitted_at');
        });
        DB::statement('ALTER TABLE store_submissions ADD CONSTRAINT store_submissions_revision_positive CHECK (revision > 0)');

        $now = now();
        foreach ($adoption as $row) {
            DB::table('store_drafts')->insert([
                'id' => $row['draft_id'],
                'owner_user_id' => $row['owner_user_id'],
                'tenant_id' => $row['tenant_id'],
                'status' => $row['status'],
                'revision' => 1,
                'store_name' => $row['store_name'],
                'business_type' => $row['business_type'],
                'theme_style' => $row['theme_style'],
                'handle' => $row['handle'],
                'plan_key' => $row['plan_key'],
                'config' => json_encode($row['config'], JSON_THROW_ON_ERROR),
                'saved_at' => $row['submitted_at'],
                'submitted_at' => $row['submitted_at'],
                'created_at' => $now,
                'updated_at' => $now,
            ]);
            DB::table('store_submissions')->where('id', $row['submission_id'])->update([
                'store_draft_id' => $row['draft_id'],
            ]);
        }

        DB::statement('ALTER TABLE store_submissions ALTER COLUMN store_draft_id SET NOT NULL');
        Schema::table('store_submissions', function (Blueprint $table): void {
            $table->foreign(
                ['store_draft_id', 'tenant_id'],
                'store_submissions_draft_tenant_foreign',
            )->references(['id', 'tenant_id'])->on('store_drafts')->restrictOnDelete();
            $table->unique('store_draft_id', 'store_submissions_draft_unique');
        });

        Schema::create('store_resubmissions', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->uuid('store_draft_id');
            $table->char('submitted_by_user_id', 26);
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->unsignedBigInteger('source_draft_revision');
            $table->unsignedBigInteger('result_draft_revision');
            $table->timestampTz('submitted_at');

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('submitted_by_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign(
                ['store_draft_id', 'tenant_id'],
                'store_resubmissions_draft_tenant_foreign',
            )->references(['id', 'tenant_id'])->on('store_drafts')->restrictOnDelete();
            $table->unique(['submitted_by_user_id', 'idempotency_key'], 'store_resubmissions_actor_idempotency_unique');
            $table->unique(['tenant_id', 'result_draft_revision'], 'store_resubmissions_tenant_revision_unique');
        });
        DB::statement('ALTER TABLE store_resubmissions ADD CONSTRAINT store_resubmissions_revision_order CHECK (source_draft_revision > 0 AND result_draft_revision = source_draft_revision + 1)');

        DB::table('permissions')->updateOrInsert(
            ['key' => PermissionKey::TenantPublicationManage->value],
            [
                'name' => PermissionKey::TenantPublicationManage->displayName(),
                'scope' => RoleScope::Tenant->value,
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );
        $permissionId = DB::table('permissions')->where('key', PermissionKey::TenantPublicationManage->value)->value('id');
        $ownerRoleId = DB::table('roles')->where('key', SystemRole::MerchantOwner->value)->value('id');
        if ($permissionId === null) {
            throw new RuntimeException('WP 5.5 could not create the merchant publication permission.');
        }
        if ($ownerRoleId !== null) {
            DB::table('permission_role')->insertOrIgnore([
                'permission_id' => $permissionId,
                'role_id' => $ownerRoleId,
                'scope' => RoleScope::Tenant->value,
            ]);
        }
    }

    public function down(): void
    {
        if ((Schema::hasTable('store_drafts') && DB::table('store_drafts')->exists())
            || (Schema::hasTable('store_resubmissions') && DB::table('store_resubmissions')->exists())
        ) {
            throw new RuntimeException('WP 5.5 cannot be rolled back while durable draft or resubmission records exist.');
        }

        $permissionIds = DB::table('permissions')
            ->where('key', PermissionKey::TenantPublicationManage->value)
            ->pluck('id');
        $ownerRoleIds = DB::table('roles')->where('key', SystemRole::MerchantOwner->value)->pluck('id');
        DB::table('permission_role')
            ->whereIn('permission_id', $permissionIds)
            ->whereIn('role_id', $ownerRoleIds)
            ->delete();
        if (DB::table('permission_role')->whereIn('permission_id', $permissionIds)->exists()) {
            throw new RuntimeException('WP 5.5 publication permission is assigned outside the system merchant-owner role.');
        }
        DB::table('permissions')->whereIn('id', $permissionIds)->delete();

        Schema::dropIfExists('store_resubmissions');
        Schema::table('store_submissions', function (Blueprint $table): void {
            $table->dropForeign('store_submissions_draft_tenant_foreign');
            $table->dropUnique('store_submissions_draft_unique');
        });
        DB::statement('ALTER TABLE store_submissions DROP CONSTRAINT IF EXISTS store_submissions_revision_positive');
        Schema::table('store_submissions', function (Blueprint $table): void {
            $table->dropColumn(['store_draft_id', 'revision', 'revised_at']);
        });
        Schema::dropIfExists('store_drafts');
    }
};
