<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Normalize the legacy repeatedly encoded JSON feature shape found in
        // long-lived Pilot catalogs. Fresh JSON arrays remain untouched.
        $legacyPlans = DB::table('plans')
            ->select(['key'])
            ->selectRaw("features #>> '{}' AS feature_text")
            ->whereRaw("json_typeof(features) = 'string'")
            ->get();
        foreach ($legacyPlans as $plan) {
            $features = $plan->feature_text;
            for ($layer = 0; $layer < 4 && is_string($features); $layer++) {
                $features = json_decode($features, true, 512, JSON_THROW_ON_ERROR);
            }

            if (! is_array($features) || ! array_is_list($features) || array_any($features, fn (mixed $feature): bool => ! is_string($feature))) {
                throw new RuntimeException("Plan [{$plan->key}] has an unsupported legacy feature payload.");
            }

            DB::update('UPDATE plans SET features = CAST(? AS json) WHERE key = ?', [
                json_encode($features, JSON_THROW_ON_ERROR),
                $plan->key,
            ]);
        }

        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedBigInteger('profile_revision')->default(1);
        });
        DB::statement('ALTER TABLE users ADD CONSTRAINT users_profile_revision_positive CHECK (profile_revision >= 1)');

        Schema::table('store_drafts', function (Blueprint $table): void {
            $table->string('onboarding_stage', 16)->nullable();
            $table->string('onboarding_stage_baseline', 16)->nullable();
        });

        DB::statement(<<<'SQL'
UPDATE store_drafts
SET onboarding_stage = CASE
        WHEN tenant_id IS NOT NULL OR status IN ('submitted', 'correction_required') THEN 'review'
        WHEN plan_key IS NOT NULL
          AND handle IS NOT NULL
          AND handle ~ '^[a-z0-9]([a-z0-9-]{1,48}[a-z0-9])$'
          AND EXISTS (SELECT 1 FROM plans WHERE plans.key = store_drafts.plan_key AND plans.is_active = TRUE)
          THEN 'review'
        ELSE 'design'
    END
SQL);
        DB::statement('UPDATE store_drafts SET onboarding_stage_baseline = onboarding_stage');
        DB::statement("ALTER TABLE store_drafts ALTER COLUMN onboarding_stage SET DEFAULT 'business'");
        DB::statement("ALTER TABLE store_drafts ALTER COLUMN onboarding_stage_baseline SET DEFAULT 'business'");
        DB::statement('ALTER TABLE store_drafts ALTER COLUMN onboarding_stage SET NOT NULL');
        DB::statement('ALTER TABLE store_drafts ALTER COLUMN onboarding_stage_baseline SET NOT NULL');
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_onboarding_stage_valid CHECK (onboarding_stage IN ('business', 'design', 'review'))");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_onboarding_baseline_valid CHECK (onboarding_stage_baseline IN ('business', 'design', 'review'))");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_onboarding_monotonic CHECK ((CASE onboarding_stage_baseline WHEN 'business' THEN 1 WHEN 'design' THEN 2 ELSE 3 END) <= (CASE onboarding_stage WHEN 'business' THEN 1 WHEN 'design' THEN 2 ELSE 3 END))");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_review_shape CHECK (onboarding_stage <> 'review' OR (handle IS NOT NULL AND plan_key IS NOT NULL))");
        DB::statement("ALTER TABLE store_drafts ADD CONSTRAINT store_drafts_linked_review CHECK (tenant_id IS NULL OR onboarding_stage = 'review')");
    }

    public function down(): void
    {
        if (DB::table('users')->where('profile_revision', '<>', 1)->exists()) {
            throw new RuntimeException('Account profiles advanced after WP 5.13 and cannot be rolled back safely.');
        }
        if (DB::table('store_drafts')->whereColumn('onboarding_stage', '<>', 'onboarding_stage_baseline')->exists()) {
            throw new RuntimeException('Store onboarding advanced after WP 5.13 and cannot be rolled back safely.');
        }

        DB::statement('ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_linked_review');
        DB::statement('ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_review_shape');
        DB::statement('ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_onboarding_monotonic');
        DB::statement('ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_onboarding_baseline_valid');
        DB::statement('ALTER TABLE store_drafts DROP CONSTRAINT store_drafts_onboarding_stage_valid');
        Schema::table('store_drafts', function (Blueprint $table): void {
            $table->dropColumn(['onboarding_stage', 'onboarding_stage_baseline']);
        });

        DB::statement('ALTER TABLE users DROP CONSTRAINT users_profile_revision_positive');
        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('profile_revision');
        });
    }
};
