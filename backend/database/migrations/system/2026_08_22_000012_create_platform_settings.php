<?php

use App\Enums\PermissionKey;
use App\Enums\RoleScope;
use App\Enums\SystemRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /** @var array<string, mixed> */
    private const DEFAULT_SETTINGS = [
        'id' => 1,
        'revision' => 1,
        'platform_name' => 'مبتكر',
        'tagline' => 'منصة المتاجر الرقمية',
        'logo_url' => null,
        'primary_color' => '#0284C7',
        'landing_headline' => 'أنشئ متجرك الإلكتروني بذكاء وسرعة',
        'landing_description' => 'صمم هوية متجرك واختر قالبًا قابلًا للتخصيص، ثم أرسل طلبك للمراجعة والتجهيز قبل النشر.',
        'announcement_enabled' => false,
        'announcement_text' => null,
        'support_email' => null,
        'support_phone' => null,
        'support_whatsapp' => null,
        'show_how_it_works' => true,
        'show_pricing' => true,
        'storefront_attribution_enabled' => true,
        'storefront_attribution_text' => 'متجر إلكتروني مدعوم من منصة مبتكر.',
        'updated_by_user_id' => null,
    ];

    /** @var list<array{item_key: string, label: string, is_visible: bool, position: int}> */
    private const DEFAULT_NAVIGATION = [
        ['item_key' => 'templates', 'label' => 'القوالب', 'is_visible' => true, 'position' => 1],
        ['item_key' => 'how_it_works', 'label' => 'كيف تعمل المنصة؟', 'is_visible' => true, 'position' => 2],
        ['item_key' => 'pricing', 'label' => 'الباقات والأسعار', 'is_visible' => true, 'position' => 3],
    ];

    public function up(): void
    {
        Schema::create('platform_settings', function (Blueprint $table): void {
            $table->unsignedSmallInteger('id')->primary();
            $table->unsignedBigInteger('revision')->default(1);
            $table->string('platform_name', 80);
            $table->string('tagline', 160)->nullable();
            $table->string('logo_url', 2048)->nullable();
            $table->char('primary_color', 7);
            $table->string('landing_headline', 160);
            $table->string('landing_description', 500);
            $table->boolean('announcement_enabled')->default(false);
            $table->string('announcement_text', 240)->nullable();
            $table->string('support_email', 254)->nullable();
            $table->string('support_phone', 16)->nullable();
            $table->string('support_whatsapp', 16)->nullable();
            $table->boolean('show_how_it_works')->default(true);
            $table->boolean('show_pricing')->default(true);
            $table->boolean('storefront_attribution_enabled')->default(true);
            $table->string('storefront_attribution_text', 180)->nullable();
            $table->foreignUlid('updated_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestampTz('created_at');
            $table->timestampTz('updated_at');
        });

        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_singleton CHECK (id = 1)');
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_revision_positive CHECK (revision >= 1)');
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_name_trimmed CHECK (platform_name = BTRIM(platform_name) AND CHAR_LENGTH(platform_name) BETWEEN 2 AND 80)');
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_tagline_trimmed CHECK (tagline IS NULL OR (tagline = BTRIM(tagline) AND CHAR_LENGTH(tagline) BETWEEN 2 AND 160))');
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_primary_color CHECK (primary_color ~ '^#[0-9A-F]{6}$')");
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_headline_trimmed CHECK (landing_headline = BTRIM(landing_headline) AND CHAR_LENGTH(landing_headline) BETWEEN 10 AND 160)');
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_description_trimmed CHECK (landing_description = BTRIM(landing_description) AND CHAR_LENGTH(landing_description) BETWEEN 20 AND 500)');
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_announcement CHECK ((announcement_text IS NULL OR (announcement_text = BTRIM(announcement_text) AND CHAR_LENGTH(announcement_text) BETWEEN 2 AND 240)) AND (NOT announcement_enabled OR announcement_text IS NOT NULL))');
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_support_email CHECK (support_email IS NULL OR (support_email = LOWER(BTRIM(support_email)) AND CHAR_LENGTH(support_email) <= 254 AND support_email ~ '^[^[:space:]@]+@[^[:space:]@]+\\.[^[:space:]@]+$'))");
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_support_phone CHECK (support_phone IS NULL OR support_phone ~ '^\\+[0-9]{8,15}$')");
        DB::statement("ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_support_whatsapp CHECK (support_whatsapp IS NULL OR support_whatsapp ~ '^\\+[0-9]{8,15}$')");
        DB::statement('ALTER TABLE platform_settings ADD CONSTRAINT platform_settings_attribution CHECK ((storefront_attribution_text IS NULL OR (storefront_attribution_text = BTRIM(storefront_attribution_text) AND CHAR_LENGTH(storefront_attribution_text) BETWEEN 2 AND 180)) AND (NOT storefront_attribution_enabled OR storefront_attribution_text IS NOT NULL))');

        Schema::create('platform_navigation_items', function (Blueprint $table): void {
            $table->unsignedSmallInteger('platform_setting_id');
            $table->string('item_key', 32);
            $table->string('label', 40);
            $table->boolean('is_visible');
            $table->unsignedSmallInteger('position');

            $table->primary(['platform_setting_id', 'item_key']);
            $table->unique(['platform_setting_id', 'position']);
            $table->foreign('platform_setting_id')->references('id')->on('platform_settings')->cascadeOnDelete();
        });

        DB::statement("ALTER TABLE platform_navigation_items ADD CONSTRAINT platform_navigation_key CHECK (item_key IN ('templates', 'how_it_works', 'pricing'))");
        DB::statement('ALTER TABLE platform_navigation_items ADD CONSTRAINT platform_navigation_position CHECK (position BETWEEN 1 AND 3)');
        DB::statement('ALTER TABLE platform_navigation_items ADD CONSTRAINT platform_navigation_label CHECK (label = BTRIM(label) AND CHAR_LENGTH(label) BETWEEN 2 AND 40)');

        $now = now();
        DB::table('platform_settings')->insert([...self::DEFAULT_SETTINGS, 'created_at' => $now, 'updated_at' => $now]);
        DB::table('platform_navigation_items')->insert(array_map(
            static fn (array $item): array => ['platform_setting_id' => 1, ...$item],
            self::DEFAULT_NAVIGATION,
        ));

        DB::unprepared(<<<'SQL'
CREATE FUNCTION assert_platform_navigation_complete() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
    target_id smallint;
    item_count integer;
BEGIN
    target_id := COALESCE(NEW.platform_setting_id, OLD.platform_setting_id);
    IF EXISTS (SELECT 1 FROM platform_settings WHERE id = target_id) THEN
        SELECT COUNT(*) INTO item_count
        FROM platform_navigation_items
        WHERE platform_setting_id = target_id;
        IF item_count <> 3 THEN
            RAISE EXCEPTION 'platform settings require exactly three navigation items';
        END IF;
    END IF;
    RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER platform_navigation_complete
AFTER INSERT OR UPDATE OR DELETE ON platform_navigation_items
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION assert_platform_navigation_complete();
SQL);

        DB::table('permissions')->updateOrInsert(
            ['key' => PermissionKey::PlatformSettingsManage->value],
            [
                'name' => PermissionKey::PlatformSettingsManage->displayName(),
                'scope' => RoleScope::Platform->value,
                'updated_at' => $now,
                'created_at' => $now,
            ],
        );

        $permissionId = DB::table('permissions')->where('key', PermissionKey::PlatformSettingsManage->value)->value('id');
        $superAdminId = DB::table('roles')->where('key', SystemRole::PlatformSuperAdmin->value)->value('id');
        if ($permissionId !== null && $superAdminId !== null) {
            DB::table('permission_role')->insertOrIgnore([
                'permission_id' => $permissionId,
                'role_id' => $superAdminId,
                'scope' => RoleScope::Platform->value,
            ]);
        }
    }

    public function down(): void
    {
        $settings = DB::table('platform_settings')->where('id', 1)->first();
        if ($settings === null) {
            throw new RuntimeException('WP 5.12 settings singleton is missing and cannot be rolled back safely.');
        }
        foreach (self::DEFAULT_SETTINGS as $column => $expected) {
            $actual = $settings->{$column};
            if (is_bool($expected)) {
                $actual = (bool) $actual;
            } elseif (is_int($expected)) {
                $actual = (int) $actual;
            }
            if ($actual !== $expected) {
                throw new RuntimeException("WP 5.12 platform setting {$column} has changed and cannot be removed safely.");
            }
        }

        $navigation = DB::table('platform_navigation_items')
            ->where('platform_setting_id', 1)
            ->orderBy('position')
            ->get(['item_key', 'label', 'is_visible', 'position'])
            ->map(static fn (object $item): array => [
                'item_key' => (string) $item->item_key,
                'label' => (string) $item->label,
                'is_visible' => (bool) $item->is_visible,
                'position' => (int) $item->position,
            ])->all();
        if ($navigation !== self::DEFAULT_NAVIGATION) {
            throw new RuntimeException('WP 5.12 platform navigation has changed and cannot be removed safely.');
        }

        $permissionId = DB::table('permissions')->where('key', PermissionKey::PlatformSettingsManage->value)->value('id');
        $superAdminId = DB::table('roles')->where('key', SystemRole::PlatformSuperAdmin->value)->value('id');
        if ($permissionId !== null) {
            $unexpectedAssignment = DB::table('permission_role')
                ->where('permission_id', $permissionId)
                ->when($superAdminId !== null, fn ($query) => $query->where('role_id', '<>', $superAdminId))
                ->exists();
            if ($unexpectedAssignment) {
                throw new RuntimeException('WP 5.12 settings permission is assigned outside the system super-admin role.');
            }
        }

        DB::unprepared('DROP TRIGGER platform_navigation_complete ON platform_navigation_items');
        DB::unprepared('DROP FUNCTION assert_platform_navigation_complete()');
        Schema::drop('platform_navigation_items');
        Schema::drop('platform_settings');

        if ($permissionId !== null) {
            DB::table('permission_role')->where('permission_id', $permissionId)->delete();
            DB::table('permissions')->where('id', $permissionId)->delete();
        }
    }
};
