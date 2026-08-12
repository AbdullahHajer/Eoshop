<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tenants', function (Blueprint $table) {
            $table->string('id')->primary();
            $table->string('store_name');
            $table->string('owner_name');
            $table->string('owner_email');
            $table->string('owner_phone')->nullable();
            $table->string('business_type');
            $table->string('verification_status')->default('pending'); // approved, pending, rejected, suspended
            $table->text('rejection_reason')->nullable();
            $table->string('theme_style')->default('elegant');
            $table->json('data')->nullable(); // Stancl tenancy JSON data payload
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tenants');
    }
};
