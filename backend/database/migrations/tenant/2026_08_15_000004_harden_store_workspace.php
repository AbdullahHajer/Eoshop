<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('store_configs', function (Blueprint $table): void {
            $table->unsignedBigInteger('revision')->default(1);
            $table->boolean('products_materialized')->default(false);
            $table->boolean('is_current')->default(false);
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->json('image_urls')->nullable();
            $table->unsignedInteger('position')->default(0);
        });

        DB::statement(<<<'SQL'
            WITH ranked AS (
                SELECT id, row_number() OVER (ORDER BY updated_at DESC, created_at DESC, id DESC) AS row_number
                FROM store_configs
            )
            UPDATE store_configs
            SET is_current = (ranked.row_number = 1)
            FROM ranked
            WHERE store_configs.id = ranked.id
            SQL);
        DB::statement('CREATE UNIQUE INDEX store_configs_one_current ON store_configs (is_current) WHERE is_current = true');
        DB::statement('ALTER TABLE store_configs ADD CONSTRAINT store_configs_revision_positive CHECK (revision > 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_price_non_negative CHECK (price >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_stock_non_negative CHECK (stock_quantity >= 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_low_stock_non_negative CHECK (low_stock_threshold >= 0)');
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_image_urls_bounded CHECK (image_urls IS NULL OR (json_typeof(image_urls) = 'array' AND json_array_length(image_urls) <= 8))");
        DB::statement("CREATE UNIQUE INDEX products_sku_unique ON products (lower(sku)) WHERE sku IS NOT NULL AND btrim(sku) <> ''");
        DB::statement('ALTER TABLE products ALTER COLUMN stock_quantity SET DEFAULT 10');
    }

    public function down(): void
    {
        if (Schema::hasColumn('store_configs', 'products_materialized')
            && DB::table('store_configs')->where('products_materialized', true)->exists()) {
            throw new RuntimeException('Refusing to drop server-owned product materialization metadata. Export/backfill the products first.');
        }

        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_low_stock_non_negative');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_stock_non_negative');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_price_non_negative');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_image_urls_bounded');
        DB::statement('DROP INDEX IF EXISTS products_sku_unique');
        DB::statement('ALTER TABLE products ALTER COLUMN stock_quantity SET DEFAULT 0');
        DB::statement('ALTER TABLE store_configs DROP CONSTRAINT IF EXISTS store_configs_revision_positive');
        DB::statement('DROP INDEX IF EXISTS store_configs_one_current');

        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn(['image_urls', 'position']);
        });

        Schema::table('store_configs', function (Blueprint $table): void {
            $table->dropColumn(['revision', 'products_materialized', 'is_current']);
        });
    }
};
