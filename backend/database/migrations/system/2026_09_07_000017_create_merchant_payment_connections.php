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
        Schema::create('merchant_payment_connections', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->string('provider', 32);
            $table->string('environment', 16);
            $table->string('state', 32);
            $table->unsignedBigInteger('revision');
            $table->unsignedBigInteger('credential_revision');
            $table->unsignedBigInteger('verified_credential_revision')->nullable();
            $table->text('credential_ciphertext');
            $table->string('credential_key_version', 64);
            $table->char('credential_fingerprint', 64);
            $table->string('fingerprint_key_version', 64);
            $table->string('last_verification_code', 64)->nullable();
            $table->timestampTz('last_verification_attempt_at')->nullable();
            $table->timestampTz('last_verified_at')->nullable();
            $table->timestampTz('disabled_at')->nullable();
            $table->char('created_by_user_id', 26);
            $table->char('updated_by_user_id', 26);
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('created_by_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->foreign('updated_by_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->unique(['tenant_id', 'provider'], 'merchant_payment_connections_tenant_provider_unique');
            $table->index(['state', 'updated_at'], 'merchant_payment_connections_state_index');
        });

        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_provider_valid CHECK (provider = 'basgate')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_environment_valid CHECK (environment IN ('sandbox', 'production'))");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_state_valid CHECK (state IN ('draft', 'verification_pending', 'active', 'verification_failed', 'disabled'))");
        DB::statement('ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_revision_positive CHECK (revision > 0 AND credential_revision > 0)');
        DB::statement('ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_verified_revision_valid CHECK (verified_credential_revision IS NULL OR (verified_credential_revision > 0 AND verified_credential_revision <= credential_revision))');
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_ciphertext_present CHECK (credential_ciphertext <> '')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_key_version_valid CHECK (credential_key_version ~ '^[A-Za-z0-9._-]{1,64}$')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_fingerprint_valid CHECK (credential_fingerprint ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_fingerprint_key_version_valid CHECK (fingerprint_key_version ~ '^[A-Za-z0-9._-]{1,64}$')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_verification_code_valid CHECK (last_verification_code IS NULL OR last_verification_code ~ '^[a-z0-9._-]{1,64}$')");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_active_verified CHECK (state <> 'active' OR (verified_credential_revision = credential_revision AND last_verified_at IS NOT NULL))");
        DB::statement("ALTER TABLE merchant_payment_connections ADD CONSTRAINT merchant_payment_connections_disabled_timestamp_valid CHECK ((state = 'disabled' AND disabled_at IS NOT NULL) OR (state <> 'disabled' AND disabled_at IS NULL))");

        Schema::create('payment_connection_operations', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->char('actor_user_id', 26);
            $table->string('provider', 32);
            $table->string('kind', 32);
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->string('fingerprint_key_version', 64);
            $table->uuid('request_id')->nullable();
            $table->timestampTz('created_at');

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->restrictOnDelete();
            $table->foreign('actor_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->unique(
                ['tenant_id', 'actor_user_id', 'provider', 'kind', 'idempotency_key'],
                'payment_connection_operations_idempotency_unique',
            );
            $table->index(['tenant_id', 'created_at'], 'payment_connection_operations_tenant_index');
        });

        DB::statement("ALTER TABLE payment_connection_operations ADD CONSTRAINT payment_connection_operations_provider_valid CHECK (provider = 'basgate')");
        DB::statement("ALTER TABLE payment_connection_operations ADD CONSTRAINT payment_connection_operations_kind_valid CHECK (kind = 'configure')");
        DB::statement("ALTER TABLE payment_connection_operations ADD CONSTRAINT payment_connection_operations_fingerprint_valid CHECK (request_fingerprint ~ '^[0-9a-f]{64}$')");
        DB::statement("ALTER TABLE payment_connection_operations ADD CONSTRAINT payment_connection_operations_fingerprint_key_version_valid CHECK (fingerprint_key_version ~ '^[A-Za-z0-9._-]{1,64}$')");

        Schema::create('payment_connection_operation_results', function (Blueprint $table): void {
            $table->uuid('operation_id')->primary();
            $table->json('response_json');
            $table->timestampTz('created_at');

            $table->foreign('operation_id')
                ->references('id')
                ->on('payment_connection_operations')
                ->restrictOnDelete();
        });

        DB::statement("ALTER TABLE payment_connection_operation_results ADD CONSTRAINT payment_connection_operation_results_object CHECK (jsonb_typeof(response_json::jsonb) = 'object')");
    }

    public function down(): void
    {
        $existingTables = array_values(array_filter([
            'payment_connection_operations',
            'merchant_payment_connections',
            'payment_connection_operation_results',
        ], static fn (string $table): bool => Schema::hasTable($table)));
        if ($existingTables !== []) {
            DB::statement('LOCK TABLE '.implode(', ', $existingTables).' IN ACCESS EXCLUSIVE MODE');
        }

        foreach ([
            'payment_connection_operation_results',
            'payment_connection_operations',
            'merchant_payment_connections',
        ] as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                throw new RuntimeException('Refusing to erase merchant payment connection credentials or operation provenance.');
            }
        }

        Schema::dropIfExists('payment_connection_operation_results');
        Schema::dropIfExists('payment_connection_operations');
        Schema::dropIfExists('merchant_payment_connections');
    }
};
