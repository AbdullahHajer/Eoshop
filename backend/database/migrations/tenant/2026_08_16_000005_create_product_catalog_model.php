<?php

use App\Support\CatalogMoney;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public $withinTransaction = true;

    public function up(): void
    {
        $currency = $this->legacyCurrency();
        $media = $this->legacyMedia();

        Schema::create('catalog_settings', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->unsignedBigInteger('revision')->default(1);
            $table->char('currency_code', 3);
            $table->timestamps();
        });

        Schema::table('products', function (Blueprint $table): void {
            $table->string('status', 20)->default('draft');
            $table->unsignedBigInteger('base_price_minor')->default(0);
            $table->unsignedBigInteger('sale_price_minor')->nullable();
            $table->unsignedBigInteger('revision')->default(1);
            $table->timestampTz('published_at')->nullable();
            $table->timestampTz('archived_at')->nullable();
        });

        Schema::create('product_media', function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('product_id')->nullable();
            $table->string('source_type', 20);
            $table->string('disk', 64)->nullable();
            $table->text('path')->nullable();
            $table->text('external_url')->nullable();
            $table->string('mime_type', 64)->nullable();
            $table->unsignedBigInteger('byte_size')->nullable();
            $table->char('checksum_sha256', 64)->nullable();
            $table->char('uploaded_by_user_id', 26)->nullable();
            $table->uuid('upload_idempotency_key')->nullable();
            $table->unsignedSmallInteger('position')->default(0);
            $table->timestampTz('attached_at')->nullable();
            $table->timestampTz('cleanup_started_at')->nullable();
            $table->timestamps();

            $table->foreign('product_id')->references('id')->on('products')->restrictOnDelete();
        });

        $now = now();
        DB::table('catalog_settings')->insert([
            'id' => 1,
            'revision' => 1,
            'currency_code' => $currency,
            'created_at' => $now,
            'updated_at' => $now,
        ]);

        DB::statement(<<<'SQL'
            UPDATE products
            SET status = 'published',
                base_price_minor = round(price * 100)::bigint,
                revision = 1,
                sku = CASE
                    WHEN sku IS NULL OR btrim(sku) = '' THEN 'LEGACY-' || upper(id::text)
                    ELSE btrim(sku)
                END,
                published_at = COALESCE(updated_at, created_at, CURRENT_TIMESTAMP),
                archived_at = NULL
            SQL);

        foreach ($media as $item) {
            DB::table('product_media')->insert([
                'id' => (string) Str::uuid(),
                'product_id' => $item['product_id'],
                'source_type' => 'external',
                'external_url' => $item['url'],
                'position' => $item['position'],
                'attached_at' => $now,
                'created_at' => $now,
                'updated_at' => $now,
            ]);
        }

        DB::statement('ALTER TABLE catalog_settings ADD CONSTRAINT catalog_settings_singleton CHECK (id = 1)');
        DB::statement('ALTER TABLE catalog_settings ADD CONSTRAINT catalog_settings_revision_positive CHECK (revision > 0)');
        DB::statement("ALTER TABLE catalog_settings ADD CONSTRAINT catalog_settings_currency_supported CHECK (currency_code IN ('YER', 'SAR', 'USD'))");
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_status_valid CHECK (status IN ('draft', 'published', 'archived'))");
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_catalog_revision_positive CHECK (revision > 0)');
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_catalog_price_valid CHECK (base_price_minor >= 0 AND (sale_price_minor IS NULL OR (sale_price_minor > 0 AND sale_price_minor < base_price_minor)))');
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_published_contract CHECK (status <> 'published' OR (sku IS NOT NULL AND btrim(sku) <> '' AND published_at IS NOT NULL AND archived_at IS NULL))");
        DB::statement("ALTER TABLE products ADD CONSTRAINT products_archived_timestamp CHECK (status <> 'archived' OR archived_at IS NOT NULL)");
        DB::statement('ALTER TABLE products ADD CONSTRAINT products_effective_price_projection CHECK (price = ((COALESCE(sale_price_minor, base_price_minor)::numeric) / 100))');
        DB::statement("ALTER TABLE product_media ADD CONSTRAINT product_media_source_valid CHECK (source_type IN ('managed', 'external'))");
        DB::statement("ALTER TABLE product_media ADD CONSTRAINT product_media_exact_source CHECK ((source_type = 'managed' AND disk IS NOT NULL AND path IS NOT NULL AND external_url IS NULL AND mime_type IS NOT NULL AND byte_size IS NOT NULL AND checksum_sha256 IS NOT NULL AND uploaded_by_user_id IS NOT NULL AND upload_idempotency_key IS NOT NULL) OR (source_type = 'external' AND disk IS NULL AND path IS NULL AND external_url IS NOT NULL AND mime_type IS NULL AND byte_size IS NULL AND checksum_sha256 IS NULL AND uploaded_by_user_id IS NULL AND upload_idempotency_key IS NULL))");
        DB::statement("ALTER TABLE product_media ADD CONSTRAINT product_media_external_https CHECK (external_url IS NULL OR external_url ~ '^https://[^[:space:]]+$')");
        DB::statement("ALTER TABLE product_media ADD CONSTRAINT product_media_managed_path_safe CHECK (path IS NULL OR (path !~ '(^|/)\\.\\.(/|$)' AND path !~ '^[\\\\/]' AND path !~ '[\\\\]'))");
        DB::statement("ALTER TABLE product_media ADD CONSTRAINT product_media_cleanup_state_valid CHECK (cleanup_started_at IS NULL OR (source_type = 'managed' AND product_id IS NULL))");
        DB::statement('CREATE UNIQUE INDEX product_media_product_position_unique ON product_media (product_id, position) WHERE product_id IS NOT NULL');
        DB::statement('CREATE UNIQUE INDEX product_media_managed_path_unique ON product_media (disk, path) WHERE source_type = \'managed\'');
        DB::statement('CREATE UNIQUE INDEX product_media_upload_idempotency_unique ON product_media (uploaded_by_user_id, upload_idempotency_key) WHERE source_type = \'managed\'');
        DB::statement('CREATE INDEX product_media_unattached_cleanup ON product_media (created_at) WHERE product_id IS NULL');
    }

    public function down(): void
    {
        $authoritative = DB::table('products')->exists()
            || DB::table('product_media')->exists()
            || DB::table('catalog_settings')->where('revision', '>', 1)->exists();
        if ($authoritative) {
            throw new RuntimeException('Refusing to erase the authoritative product catalog, exact prices or media provenance.');
        }

        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_effective_price_projection');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_archived_timestamp');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_published_contract');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_catalog_price_valid');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_catalog_revision_positive');
        DB::statement('ALTER TABLE products DROP CONSTRAINT IF EXISTS products_status_valid');
        Schema::dropIfExists('product_media');
        Schema::table('products', function (Blueprint $table): void {
            $table->dropColumn([
                'status', 'base_price_minor', 'sale_price_minor', 'revision', 'published_at', 'archived_at',
            ]);
        });
        Schema::dropIfExists('catalog_settings');
    }

    private function legacyCurrency(): string
    {
        $record = DB::table('store_configs')->where('is_current', true)->first();
        if ($record === null) {
            return 'YER';
        }

        $config = json_decode((string) $record->config_json, true, 512, JSON_THROW_ON_ERROR);
        $candidate = is_array($config) ? ($config['currency'] ?? 'YER') : 'YER';
        if (! is_string($candidate)) {
            throw new RuntimeException('Legacy catalog currency must be a string.');
        }

        try {
            return CatalogMoney::normalizeCurrency($candidate);
        } catch (InvalidArgumentException $exception) {
            throw new RuntimeException('Cannot adopt an unknown legacy catalog currency.', previous: $exception);
        }
    }

    /** @return list<array{product_id: string, url: string, position: int}> */
    private function legacyMedia(): array
    {
        $result = [];
        foreach (DB::table('products')->orderBy('id')->get() as $product) {
            $urls = [];
            if (is_string($product->image_url) && trim($product->image_url) !== '') {
                $urls[] = trim($product->image_url);
            }
            if ($product->image_urls !== null) {
                $decoded = json_decode((string) $product->image_urls, true, 512, JSON_THROW_ON_ERROR);
                if (! is_array($decoded)) {
                    throw new RuntimeException('Legacy product image URLs must be an array.');
                }
                foreach ($decoded as $url) {
                    if (! is_string($url)) {
                        throw new RuntimeException('Legacy product image URL must be a string.');
                    }
                    $urls[] = trim($url);
                }
            }

            foreach (array_values(array_unique(array_filter($urls))) as $position => $url) {
                if (filter_var($url, FILTER_VALIDATE_URL) === false || ! str_starts_with(mb_strtolower($url), 'https://')) {
                    throw new RuntimeException('Cannot adopt a non-HTTPS legacy product image URL.');
                }
                $result[] = ['product_id' => (string) $product->id, 'url' => $url, 'position' => $position];
            }
        }

        return $result;
    }
};
