<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        Schema::create('marketing_campaign_registry', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->timestampsTz();
        });
        DB::table('marketing_campaign_registry')->insert([
            'id' => 1,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        Schema::create('marketing_campaigns', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('name', 120);
            $table->string('objective', 16);
            $table->string('state', 16)->default('draft');
            $table->timestampTz('starts_at')->nullable();
            $table->timestampTz('ends_at')->nullable();
            $table->string('target_type', 16);
            $table->string('target_value', 255)->nullable();
            $table->string('coupon_code', 50)->nullable();
            $table->unsignedBigInteger('revision')->default(1);
            $table->char('created_by_ulid', 26);
            $table->char('updated_by_ulid', 26);
            $table->timestampTz('activated_at')->nullable();
            $table->timestampTz('paused_at')->nullable();
            $table->timestampTz('ended_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
            $table->timestampsTz();
            $table->index('state');
            $table->index('ends_at');
            $table->index('created_at');
        });

        Schema::create('marketing_channel_links', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('marketing_campaigns')->restrictOnDelete();
            $table->string('channel', 24);
            $table->char('token_hash', 64)->unique();
            $table->text('token_ciphertext');
            $table->string('token_key_id', 32);
            $table->string('utm_source', 32);
            $table->string('utm_medium', 32);
            $table->string('utm_campaign', 64);
            $table->string('utm_content', 64);
            $table->char('created_by_ulid', 26);
            $table->timestampsTz();
            $table->index(['campaign_id', 'created_at']);
        });

        Schema::create('marketing_campaign_operations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('operation_kind', 32);
            $table->uuid('scope_id');
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->string('resource_type', 24)->nullable();
            $table->uuid('resource_id')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampsTz();
            $table->unique(
                ['operation_kind', 'scope_id', 'idempotency_key'],
                'marketing_campaign_operations_idempotency_unique',
            );
        });

        Schema::create('marketing_campaign_events', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->foreignUuid('campaign_id')->constrained('marketing_campaigns')->restrictOnDelete();
            $table->string('event_type', 24);
            $table->string('from_state', 16)->nullable();
            $table->string('to_state', 16);
            $table->unsignedBigInteger('campaign_revision');
            $table->char('actor_user_ulid', 26);
            $table->string('reason_code', 64)->nullable();
            $table->jsonb('metadata')->default('{}');
            $table->timestampTz('occurred_at');
            $table->index(['campaign_id', 'occurred_at']);
        });

        $this->addChecks();
        $this->protectEvents();
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $tables = [
                'marketing_campaign_registry',
                'marketing_campaigns',
                'marketing_channel_links',
                'marketing_campaign_operations',
                'marketing_campaign_events',
            ];
            $existingTables = [];
            foreach ($tables as $table) {
                if (Schema::hasTable($table)) {
                    $existingTables[] = $table;
                }
            }
            foreach ($existingTables as $table) {
                DB::statement(sprintf('LOCK TABLE "%s" IN ACCESS EXCLUSIVE MODE', $table));
            }
            foreach (['marketing_campaign_events', 'marketing_channel_links', 'marketing_campaign_operations', 'marketing_campaigns'] as $table) {
                if (in_array($table, $existingTables, true) && DB::table($table)->exists()) {
                    throw new RuntimeException('Refusing to erase retained marketing campaign history.');
                }
            }

            DB::unprepared('DROP FUNCTION IF EXISTS marketing_campaign_prevent_event_mutation() CASCADE');
            DB::unprepared('DROP FUNCTION IF EXISTS marketing_campaign_prevent_retained_delete() CASCADE');
            Schema::dropIfExists('marketing_campaign_events');
            Schema::dropIfExists('marketing_campaign_operations');
            Schema::dropIfExists('marketing_channel_links');
            Schema::dropIfExists('marketing_campaigns');
            Schema::dropIfExists('marketing_campaign_registry');
        });
    }

    private function addChecks(): void
    {
        DB::statement('ALTER TABLE marketing_campaign_registry ADD CONSTRAINT marketing_campaign_registry_singleton CHECK (id = 1)');
        DB::statement("ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_objective_valid CHECK (objective IN ('sales','traffic'))");
        DB::statement("ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_state_valid CHECK (state IN ('draft','active','paused','ended','archived'))");
        DB::statement("ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_target_valid CHECK ((target_type = 'store' AND target_value IS NULL) OR (target_type IN ('category','product') AND target_value IS NOT NULL AND length(target_value) > 0))");
        DB::statement('ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_schedule_valid CHECK (starts_at IS NULL OR ends_at IS NULL OR starts_at < ends_at)');
        DB::statement('ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_revision_positive CHECK (revision > 0)');
        DB::statement("ALTER TABLE marketing_campaigns ADD CONSTRAINT marketing_campaigns_coupon_canonical CHECK (coupon_code IS NULL OR (coupon_code = upper(coupon_code) AND coupon_code ~ '^[A-Z0-9_-]+$'))");
        DB::statement("ALTER TABLE marketing_channel_links ADD CONSTRAINT marketing_channel_links_channel_valid CHECK (channel IN ('instagram','facebook','whatsapp','google','email','other'))");
        DB::statement("ALTER TABLE marketing_channel_links ADD CONSTRAINT marketing_channel_links_hash_valid CHECK (token_hash ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE marketing_campaign_operations ADD CONSTRAINT marketing_campaign_operations_kind_valid CHECK (operation_kind IN ('campaign.create','channel_link.create'))");
        DB::statement("ALTER TABLE marketing_campaign_operations ADD CONSTRAINT marketing_campaign_operations_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE marketing_campaign_operations ADD CONSTRAINT marketing_campaign_operations_result_valid CHECK ((resource_type IS NULL AND resource_id IS NULL AND completed_at IS NULL) OR (resource_type IN ('campaign','channel_link') AND resource_id IS NOT NULL AND completed_at IS NOT NULL))");
        DB::statement("ALTER TABLE marketing_campaign_events ADD CONSTRAINT marketing_campaign_events_type_valid CHECK (event_type IN ('created','updated','activated','paused','resumed','ended','archived'))");
        DB::statement("ALTER TABLE marketing_campaign_events ADD CONSTRAINT marketing_campaign_events_states_valid CHECK ((from_state IS NULL OR from_state IN ('draft','scheduled','active','paused','ended','archived')) AND to_state IN ('draft','scheduled','active','paused','ended','archived'))");
        DB::statement('ALTER TABLE marketing_campaign_events ADD CONSTRAINT marketing_campaign_events_revision_positive CHECK (campaign_revision > 0)');
    }

    private function protectEvents(): void
    {
        DB::unprepared(<<<'SQL'
            CREATE FUNCTION marketing_campaign_prevent_event_mutation() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'marketing campaign events are append-only';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER marketing_campaign_events_append_only
            BEFORE UPDATE OR DELETE ON marketing_campaign_events
            FOR EACH ROW EXECUTE FUNCTION marketing_campaign_prevent_event_mutation();

            CREATE FUNCTION marketing_campaign_prevent_retained_delete() RETURNS trigger AS $$
            BEGIN
                RAISE EXCEPTION 'marketing campaign records are retained in V1';
            END;
            $$ LANGUAGE plpgsql;

            CREATE TRIGGER marketing_campaigns_retained
            BEFORE DELETE ON marketing_campaigns
            FOR EACH ROW EXECUTE FUNCTION marketing_campaign_prevent_retained_delete();

            CREATE TRIGGER marketing_channel_links_retained
            BEFORE DELETE ON marketing_channel_links
            FOR EACH ROW EXECUTE FUNCTION marketing_campaign_prevent_retained_delete();

            CREATE TRIGGER marketing_campaign_operations_retained
            BEFORE DELETE ON marketing_campaign_operations
            FOR EACH ROW EXECUTE FUNCTION marketing_campaign_prevent_retained_delete();
            SQL);
    }
};
