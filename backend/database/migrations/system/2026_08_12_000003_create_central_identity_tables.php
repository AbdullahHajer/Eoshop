<?php

use App\Enums\RoleScope;
use App\Enums\TenantMembershipStatus;
use App\Enums\UserStatus;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('users', function (Blueprint $table) {
            $table->ulid('id')->primary();
            $table->string('name');
            $table->string('email')->unique();
            $table->string('phone')->nullable();
            $table->string('password')->nullable();
            $table->enum('status', array_column(UserStatus::cases(), 'value'))->default(UserStatus::Pending->value);
            $table->timestampTz('email_verified_at')->nullable();
            $table->timestampTz('last_login_at')->nullable();
            $table->rememberToken();
            $table->timestampsTz();
            $table->softDeletesTz();

            $table->index('status');
        });

        DB::statement('ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = LOWER(email))');

        Schema::create('roles', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->enum('scope', array_column(RoleScope::cases(), 'value'));
            $table->text('description')->nullable();
            $table->boolean('system')->default(true);
            $table->timestampsTz();

            $table->index('scope');
            $table->unique(['id', 'scope']);
        });

        Schema::create('permissions', function (Blueprint $table) {
            $table->id();
            $table->string('key')->unique();
            $table->string('name');
            $table->enum('scope', array_column(RoleScope::cases(), 'value'));
            $table->text('description')->nullable();
            $table->timestampsTz();

            $table->index('scope');
            $table->unique(['id', 'scope']);
        });

        DB::statement("ALTER TABLE permissions ADD CONSTRAINT permissions_key_scope CHECK ((scope = 'platform' AND key LIKE 'platform.%') OR (scope = 'tenant' AND key LIKE 'tenant.%'))");

        Schema::create('permission_role', function (Blueprint $table) {
            $table->unsignedBigInteger('permission_id');
            $table->unsignedBigInteger('role_id');
            $table->enum('scope', array_column(RoleScope::cases(), 'value'));

            $table->primary(['permission_id', 'role_id']);
            $table->foreign(['permission_id', 'scope'])->references(['id', 'scope'])->on('permissions')->cascadeOnDelete();
            $table->foreign(['role_id', 'scope'])->references(['id', 'scope'])->on('roles')->cascadeOnDelete();
        });

        Schema::create('role_user', function (Blueprint $table) {
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('role_id');
            $table->enum('role_scope', array_column(RoleScope::cases(), 'value'))->default(RoleScope::Platform->value);
            $table->foreignUlid('assigned_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampsTz();

            $table->primary(['user_id', 'role_id']);
            $table->foreign(['role_id', 'role_scope'])->references(['id', 'scope'])->on('roles')->restrictOnDelete();
        });

        DB::statement("ALTER TABLE role_user ADD CONSTRAINT role_user_platform_scope CHECK (role_scope = 'platform')");

        Schema::create('tenant_user', function (Blueprint $table) {
            $table->string('tenant_id');
            $table->foreignUlid('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('role_id');
            $table->enum('role_scope', array_column(RoleScope::cases(), 'value'))->default(RoleScope::Tenant->value);
            $table->enum('status', array_column(TenantMembershipStatus::cases(), 'value'))
                ->default(TenantMembershipStatus::Invited->value);
            $table->foreignUlid('invited_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('joined_at')->nullable();
            $table->timestampsTz();

            $table->foreign('tenant_id')->references('id')->on('tenants')->cascadeOnUpdate()->cascadeOnDelete();
            $table->foreign(['role_id', 'role_scope'])->references(['id', 'scope'])->on('roles')->restrictOnDelete();
            $table->primary(['tenant_id', 'user_id']);
            $table->index(['user_id', 'status']);
            $table->index('role_id');
        });

        DB::statement("ALTER TABLE tenant_user ADD CONSTRAINT tenant_user_tenant_scope CHECK (role_scope = 'tenant')");

        Schema::create('admin_audit_logs', function (Blueprint $table) {
            $table->id();
            $table->char('actor_user_id', 26)->nullable();
            $table->string('tenant_id')->nullable();
            $table->string('action');
            $table->string('subject_type');
            $table->string('subject_id');
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent', 1024)->nullable();
            $table->uuid('request_id')->nullable();
            $table->timestampTz('occurred_at')->useCurrent();

            $table->index(['actor_user_id', 'occurred_at']);
            $table->index(['action', 'occurred_at']);
            $table->index(['subject_type', 'subject_id']);
            $table->index(['tenant_id', 'occurred_at']);
            $table->index('request_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('admin_audit_logs');
        Schema::dropIfExists('tenant_user');
        Schema::dropIfExists('role_user');
        Schema::dropIfExists('permission_role');
        Schema::dropIfExists('permissions');
        Schema::dropIfExists('roles');
        Schema::dropIfExists('users');
    }
};
