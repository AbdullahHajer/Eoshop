<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->unsignedBigInteger('session_generation')->default(1);
        });

        DB::statement('ALTER TABLE users ADD CONSTRAINT users_session_generation_positive CHECK (session_generation >= 1)');

        DB::table('sessions')->whereNotNull('user_id')->delete();
        DB::table('users')->update(['remember_token' => null]);
    }

    public function down(): void
    {
        DB::table('sessions')->whereNotNull('user_id')->delete();
        DB::table('users')->update(['remember_token' => null]);
        DB::statement('ALTER TABLE users DROP CONSTRAINT users_session_generation_positive');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn('session_generation');
        });
    }
};
