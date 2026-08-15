<?php

use App\Enums\ProvisioningSchemaOrigin;
use App\Enums\ProvisioningState;
use App\Enums\ProvisioningStep;
use App\Enums\ProvisioningStepStatus;
use App\Support\TenantSchemaName;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->string('provisioning_status')->default(ProvisioningState::NotStarted->value)->after('verification_status');
            $table->timestampTz('active_at')->nullable()->after('provisioning_status');
            $table->index(['verification_status', 'provisioning_status'], 'tenants_verification_provisioning_index');
        });

        DB::statement(sprintf(
            'ALTER TABLE tenants ADD CONSTRAINT tenants_provisioning_status_valid CHECK (provisioning_status IN (%s))',
            collect(ProvisioningState::cases())->map(static fn (ProvisioningState $state): string => DB::getPdo()->quote($state->value))->implode(', '),
        ));

        Schema::create('store_submissions', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('tenant_id')->unique();
            $table->char('submitted_by_user_id', 26);
            $table->uuid('idempotency_key');
            $table->char('request_fingerprint', 64);
            $table->json('payload_snapshot');
            $table->uuid('initial_config_id');
            $table->timestampTz('submitted_at');

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign('submitted_by_user_id')->references('id')->on('users')->restrictOnDelete();
            $table->unique(['submitted_by_user_id', 'idempotency_key'], 'store_submissions_submitter_idempotency_unique');
        });

        Schema::create('provisioning_runs', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->string('tenant_id');
            $table->string('status');
            $table->unsignedSmallInteger('run_number');
            $table->char('requested_by_user_id', 26)->nullable();
            $table->uuid('request_id')->nullable();
            $table->string('schema_name', 63);
            $table->string('schema_origin')->nullable();
            $table->timestampTz('schema_created_at')->nullable();
            $table->string('current_step')->nullable();
            $table->string('last_completed_step')->nullable();
            $table->string('last_error_code', 100)->nullable();
            $table->string('last_error_message', 1000)->nullable();
            $table->timestampTz('queued_at');
            $table->timestampTz('started_at')->nullable();
            $table->timestampTz('completed_at')->nullable();
            $table->timestampTz('failed_at')->nullable();
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->unique(['tenant_id', 'run_number'], 'provisioning_runs_tenant_number_unique');
            $table->index(['tenant_id', 'created_at'], 'provisioning_runs_tenant_created_index');
            $table->index(['status', 'updated_at'], 'provisioning_runs_status_updated_index');
        });

        DB::statement(sprintf(
            'ALTER TABLE provisioning_runs ADD CONSTRAINT provisioning_runs_status_valid CHECK (status IN (%s))',
            collect(ProvisioningState::cases())
                ->reject(static fn (ProvisioningState $state): bool => $state === ProvisioningState::NotStarted)
                ->map(static fn (ProvisioningState $state): string => DB::getPdo()->quote($state->value))
                ->implode(', '),
        ));
        DB::statement("CREATE UNIQUE INDEX provisioning_runs_one_open_per_tenant ON provisioning_runs (tenant_id) WHERE status IN ('queued', 'provisioning', 'retrying')");
        DB::statement(sprintf(
            'ALTER TABLE provisioning_runs ADD CONSTRAINT provisioning_runs_schema_origin_valid CHECK (schema_origin IS NULL OR schema_origin IN (%s))',
            collect(ProvisioningSchemaOrigin::cases())->map(static fn (ProvisioningSchemaOrigin $origin): string => DB::getPdo()->quote($origin->value))->implode(', '),
        ));

        Schema::create('provisioning_steps', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->uuid('run_id');
            $table->unsignedSmallInteger('delivery_attempt');
            $table->string('step');
            $table->string('status');
            $table->string('error_code', 100)->nullable();
            $table->string('error_message', 1000)->nullable();
            $table->timestampTz('started_at');
            $table->timestampTz('finished_at')->nullable();

            $table->foreign('run_id')->references('id')->on('provisioning_runs')->cascadeOnDelete();
            $table->unique(['run_id', 'delivery_attempt', 'step'], 'provisioning_steps_delivery_step_unique');
            $table->index(['run_id', 'started_at'], 'provisioning_steps_run_started_index');
        });

        DB::statement(sprintf(
            'ALTER TABLE provisioning_steps ADD CONSTRAINT provisioning_steps_step_valid CHECK (step IN (%s))',
            collect(ProvisioningStep::cases())->map(static fn (ProvisioningStep $step): string => DB::getPdo()->quote($step->value))->implode(', '),
        ));
        DB::statement(sprintf(
            'ALTER TABLE provisioning_steps ADD CONSTRAINT provisioning_steps_status_valid CHECK (status IN (%s))',
            collect(ProvisioningStepStatus::cases())->map(static fn (ProvisioningStepStatus $status): string => DB::getPdo()->quote($status->value))->implode(', '),
        ));

        Schema::create('jobs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('queue')->index();
            $table->longText('payload');
            $table->unsignedTinyInteger('attempts');
            $table->unsignedInteger('reserved_at')->nullable();
            $table->unsignedInteger('available_at');
            $table->unsignedInteger('created_at');
        });

        Schema::create('failed_jobs', function (Blueprint $table): void {
            $table->bigIncrements('id');
            $table->string('uuid')->unique();
            $table->text('connection');
            $table->text('queue');
            $table->longText('payload');
            $table->longText('exception');
            $table->timestampTz('failed_at')->useCurrent();
        });

        $now = now();
        DB::table('tenants')
            ->where('verification_status', 'approved')
            ->orderBy('id')
            ->each(function (object $tenant) use ($now): void {
                $schema = TenantSchemaName::for((string) $tenant->id);
                $exists = (bool) (DB::selectOne(
                    'SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = ?) AS present',
                    [$schema],
                )->present ?? false);

                if (! $exists) {
                    return;
                }

                $requiredTables = DB::table('information_schema.tables')
                    ->where('table_schema', $schema)
                    ->whereIn('table_name', ['migrations', 'store_configs'])
                    ->distinct()
                    ->count('table_name');
                if ($requiredTables !== 2) {
                    return;
                }
                $configured = (bool) (DB::selectOne(
                    'SELECT EXISTS (SELECT 1 FROM "'.$schema.'".store_configs) AS present',
                )->present ?? false);
                if (! $configured) {
                    return;
                }

                DB::table('provisioning_runs')->insert([
                    'id' => (string) Str::uuid(),
                    'tenant_id' => $tenant->id,
                    'status' => ProvisioningState::Active->value,
                    'run_number' => 1,
                    'requested_by_user_id' => null,
                    'request_id' => null,
                    'schema_name' => $schema,
                    'schema_origin' => ProvisioningSchemaOrigin::Wp21Adopted->value,
                    'schema_created_at' => $now,
                    'current_step' => null,
                    'last_completed_step' => ProvisioningStep::Activation->value,
                    'last_error_code' => null,
                    'last_error_message' => null,
                    'queued_at' => $now,
                    'started_at' => $now,
                    'completed_at' => $now,
                    'failed_at' => null,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]);
                DB::table('tenants')->where('id', $tenant->id)->update([
                    'provisioning_status' => ProvisioningState::Active->value,
                    'active_at' => $now,
                ]);
            });
    }

    public function down(): void
    {
        foreach (['store_submissions', 'provisioning_runs', 'provisioning_steps', 'jobs', 'failed_jobs'] as $table) {
            if (Schema::hasTable($table) && DB::table($table)->exists()) {
                throw new RuntimeException('WP 2.2 cannot be rolled back while provisioning records or queue data exist.');
            }
        }

        Schema::dropIfExists('failed_jobs');
        Schema::dropIfExists('jobs');
        Schema::dropIfExists('provisioning_steps');
        Schema::dropIfExists('provisioning_runs');
        Schema::dropIfExists('store_submissions');

        DB::statement('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_provisioning_status_valid');
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropIndex('tenants_verification_provisioning_index');
            $table->dropColumn(['provisioning_status', 'active_at']);
        });
    }
};
