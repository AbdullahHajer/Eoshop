<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        DB::statement("ALTER TABLE tenants ADD CONSTRAINT tenants_verification_status_valid CHECK (verification_status IN ('pending', 'approved', 'rejected', 'suspended'))");

        Schema::table('tenants', function (Blueprint $table): void {
            $table->index(['verification_status', 'created_at'], 'tenants_verification_created_index');
        });
    }

    public function down(): void
    {
        Schema::table('tenants', function (Blueprint $table): void {
            $table->dropIndex('tenants_verification_created_index');
        });

        DB::statement('ALTER TABLE tenants DROP CONSTRAINT IF EXISTS tenants_verification_status_valid');
    }
};
