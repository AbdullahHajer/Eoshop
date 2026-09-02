<?php

namespace Tests\Integration;

use App\Enums\RoleScope;
use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\Role;
use App\Models\User;
use App\Services\PlatformAssetService;
use App\Services\RoleAssignmentService;
use Database\Seeders\IdentitySeeder;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class PlatformAssetTest extends TestCase
{
    use DatabaseTransactions;

    protected function setUp(): void
    {
        parent::setUp();
        $this->seed(IdentitySeeder::class);
        Storage::fake('local');
    }

    public function test_upload_is_permission_owned_closed_and_validated_from_real_image_content(): void
    {
        $manager = $this->operator('asset-manager@example.test', SystemRole::PlatformSuperAdmin);
        $reviewer = $this->operator('asset-reviewer@example.test', SystemRole::PlatformReviewer);
        $key = (string) Str::uuid();

        $this->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->image('hero.png', 640, 360),
        ], ['Idempotency-Key' => $key])->assertUnauthorized();
        $this->actingAs($reviewer)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->image('hero.png', 640, 360),
        ], ['Idempotency-Key' => $key])->assertForbidden();
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'unsupported', 'image' => UploadedFile::fake()->image('hero.png', 640, 360),
        ], ['Idempotency-Key' => $key])->assertUnprocessable();
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'extra' => 'closed',
            'image' => UploadedFile::fake()->createWithContent('fake.png', 'not-an-image'),
        ], ['Idempotency-Key' => $key])->assertUnprocessable();
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->createWithContent('fake.png', 'not-an-image'),
        ], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertConflict()->assertJsonPath('code', 'platform_asset_invalid');
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->image('small.png', 319, 180),
        ], ['Idempotency-Key' => (string) Str::uuid()])
            ->assertConflict()->assertJsonPath('code', 'platform_asset_invalid');

        $source = UploadedFile::fake()->image('hero.png', 640, 360);
        $content = file_get_contents((string) $source->getRealPath());
        $this->assertIsString($content);
        $replayKey = (string) Str::uuid();
        $response = $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->createWithContent('hero.png', $content),
        ], ['Idempotency-Key' => $replayKey])
            ->assertCreated()
            ->assertJsonPath('data.purpose', 'landing_hero')
            ->assertJsonPath('data.mimeType', 'image/png')
            ->assertJsonPath('data.width', 640)
            ->assertJsonPath('data.height', 360);

        $assetId = $response->json('data.id');
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->createWithContent('hero.png', $content),
        ], ['Idempotency-Key' => $replayKey])->assertCreated()->assertJsonPath('data.id', $assetId);
        $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->image('different.png', 800, 450),
        ], ['Idempotency-Key' => $replayKey])
            ->assertConflict()->assertJsonPath('code', 'platform_asset_idempotency_conflict');
        $this->assertDatabaseHas('platform_assets', ['id' => $assetId, 'state' => 'ready', 'purpose' => 'landing_hero']);
        $this->assertNotNull(DB::table('platform_assets')->where('id', $assetId)->value('orphaned_at'));
        $this->get('/api/platform-assets/'.$assetId)->assertNotFound();
    }

    public function test_revisioned_settings_binding_controls_public_delivery_and_safe_recoverable_replacement(): void
    {
        $manager = $this->operator('asset-bind@example.test', SystemRole::PlatformSuperAdmin);
        $upload = $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'landing_hero', 'image' => UploadedFile::fake()->image('hero.png', 800, 450),
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $assetId = (string) $upload->json('data.id');
        $url = (string) $upload->json('data.url');

        $payload = $this->settingsPayload($manager);
        $payload['landingHeroImageUrl'] = $url;
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $payload)
            ->assertOk()->assertJsonPath('data.landingHeroImageUrl', $url);
        $this->assertDatabaseHas('platform_assets', ['id' => $assetId, 'orphaned_at' => null]);
        $this->get($url)->assertOk()->assertHeader('X-Content-Type-Options', 'nosniff');
        $this->assertDatabaseHas('admin_audit_logs', ['action' => 'platform.settings.updated', 'actor_user_id' => $manager->id]);

        $stale = $payload;
        $stale['authImageUrl'] = $url;
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $stale)
            ->assertConflict()->assertJsonPath('code', 'platform_settings_revision_conflict');

        $replacement = $this->settingsPayload($manager);
        $replacement['landingHeroImageUrl'] = 'https://cdn.example.test/platform/replacement.webp';
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $replacement)->assertOk();
        $this->get($url)->assertNotFound();

        $storedPath = (string) DB::table('platform_assets')->where('id', $assetId)->value('path');
        Storage::disk('local')->assertExists($storedPath);
        $this->assertNotNull(DB::table('platform_assets')->where('id', $assetId)->value('orphaned_at'));

        DB::table('platform_assets')->where('id', $assetId)->update(['orphaned_at' => now()->utc()->subHours(25)]);
        $result = app(PlatformAssetService::class)->prune();
        $this->assertSame(1, $result['quarantined']);
        $this->assertDatabaseHas('platform_assets', ['id' => $assetId, 'state' => 'quarantined']);
        $this->assertTrue(app(PlatformAssetService::class)->restore($assetId));
        $this->assertDatabaseHas('platform_assets', ['id' => $assetId, 'state' => 'ready']);
        $this->get($url)->assertNotFound();
    }

    public function test_managed_paths_are_exact_and_purpose_cannot_cross_slots(): void
    {
        $manager = $this->operator('asset-purpose@example.test', SystemRole::PlatformSuperAdmin);
        $upload = $this->actingAs($manager)->post('/api/admin/platform-assets', [
            'purpose' => 'authentication', 'image' => UploadedFile::fake()->image('auth.png', 640, 360),
        ], ['Idempotency-Key' => (string) Str::uuid()])->assertCreated();
        $url = (string) $upload->json('data.url');

        foreach ([$url.'?download=1', $url.'/', '/api/store-assets/example/'.basename($url), 'http://cdn.example.test/image.jpg'] as $unsafe) {
            $payload = $this->settingsPayload($manager);
            $payload['landingHeroImageUrl'] = $unsafe;
            $this->actingAs($manager)->putJson('/api/admin/platform-settings', $payload)
                ->assertUnprocessable()->assertJsonValidationErrors('landingHeroImageUrl');
        }

        $payload = $this->settingsPayload($manager);
        $payload['landingHeroImageUrl'] = $url;
        $this->actingAs($manager)->putJson('/api/admin/platform-settings', $payload)
            ->assertConflict()->assertJsonPath('code', 'platform_asset_unavailable');
    }

    /** @return array<string, mixed> */
    private function settingsPayload(User $manager): array
    {
        $data = $this->actingAs($manager)->getJson('/api/admin/platform-settings')->assertOk()->json('data');
        $data['expectedRevision'] = $data['revision'];
        unset($data['revision'], $data['updatedAt'], $data['updatedByUserId']);

        return $data;
    }

    private function operator(string $email, SystemRole $role): User
    {
        $user = User::query()->create(['name' => 'Platform Asset User', 'email' => $email, 'status' => UserStatus::Active]);
        app(RoleAssignmentService::class)->assignPlatformRole(
            $user,
            Role::query()->where('key', $role->value)->where('scope', RoleScope::Platform)->firstOrFail(),
            $user,
        );

        return $user;
    }
}
