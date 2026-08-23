<?php

namespace Tests\Integration;

use App\Enums\UserStatus;
use App\Models\Plan;
use App\Models\User;
use App\Support\StoreOnboardingAppearance;
use App\Support\StoreOnboardingBaseline;
use Database\Seeders\IdentitySeeder;
use Illuminate\Database\QueryException;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\Group;
use Tests\TestCase;

#[Group('database')]
class AccountOnboardingTest extends TestCase
{
    use DatabaseTransactions;

    public function test_profile_update_is_revisioned_normalized_redacted_and_no_op_safe(): void
    {
        $user = $this->createUser('profile-owner@example.test');
        $this->actingAs($user);

        $updated = $this->putJson('/api/account/profile', [
            'expectedRevision' => 1,
            'name' => '  Profile Owner  ',
            'phone' => '0777 000 111',
        ])->assertOk()
            ->assertJsonPath('data.name', 'Profile Owner')
            ->assertJsonPath('data.phone', '+967777000111')
            ->assertJsonPath('data.profileRevision', 2)
            ->assertJsonMissingPath('data.session_generation');

        $auditCount = DB::table('admin_audit_logs')
            ->where('action', 'identity.account.profile.updated')
            ->count();
        $this->assertSame(1, $auditCount);
        $this->assertSame(['name', 'phone'], $this->profileAuditFields($user));

        $this->putJson('/api/account/profile', [
            'expectedRevision' => 2,
            'name' => 'Profile Owner',
            'phone' => '+967777000111',
        ])->assertOk()->assertJsonPath('data.profileRevision', 2);
        $this->assertSame($auditCount, DB::table('admin_audit_logs')
            ->where('action', 'identity.account.profile.updated')->count());

        $this->putJson('/api/account/profile', [
            'expectedRevision' => 1,
            'name' => 'Stale Writer',
            'phone' => null,
        ])->assertConflict()
            ->assertJsonPath('code', 'account_profile_revision_conflict')
            ->assertJsonPath('current.profileRevision', 2);

        $this->putJson('/api/account/profile', [
            'expectedRevision' => 2,
            'name' => 'Profile Owner',
            'phone' => null,
            'email' => 'forged@example.test',
        ])->assertUnprocessable();

        $this->assertSame('profile-owner@example.test', $user->refresh()->email);
        $this->assertSame((int) $updated->json('data.profileRevision'), $user->profile_revision);
    }

    public function test_password_change_revokes_other_sessions_remember_state_and_old_reset_links(): void
    {
        $user = $this->createUser('password-owner@example.test');
        $oldRemember = 'remember-before-change';
        $user->forceFill(['remember_token' => $oldRemember])->save();
        $oldResetToken = Password::broker()->createToken($user);

        $this->actingAs($user)->getJson('/api/auth/session')->assertOk();
        DB::table('sessions')->insert([
            'id' => 'other-device-session',
            'user_id' => $user->getKey(),
            'payload' => 'opaque-test-payload',
            'last_activity' => now()->timestamp,
        ]);

        $this->putJson('/api/account/password', [
            'currentPassword' => 'wrong-password',
            'password' => 'new-secure-pass-456',
            'password_confirmation' => 'new-secure-pass-456',
        ])->assertUnprocessable();

        $this->putJson('/api/account/password', [
            'currentPassword' => 'secure-pass-123',
            'password' => 'new-secure-pass-456',
            'password_confirmation' => 'new-secure-pass-456',
        ])->assertOk();

        $user->refresh();
        $this->assertTrue(Hash::check('new-secure-pass-456', (string) $user->password));
        $this->assertSame(2, $user->session_generation);
        $this->assertNotSame($oldRemember, $user->getRememberToken());
        $this->assertDatabaseMissing('sessions', ['id' => 'other-device-session']);
        $this->assertDatabaseMissing('password_reset_tokens', ['email' => $user->email]);
        $this->getJson('/api/auth/session')->assertOk()->assertJsonPath('data.id', $user->getKey());

        $this->postJson('/api/auth/reset-password', [
            'token' => $oldResetToken,
            'email' => $user->email,
            'password' => 'stale-link-pass-789',
            'password_confirmation' => 'stale-link-pass-789',
        ])->assertUnprocessable();
        $this->assertTrue(Hash::check('new-secure-pass-456', (string) $user->refresh()->password));
    }

    public function test_guided_draft_persists_each_step_blocks_skips_and_keeps_no_ops_revision_stable(): void
    {
        $this->seed(IdentitySeeder::class);
        $owner = $this->createUser('guided-owner@example.test');
        $this->actingAs($owner);

        $this->putJson('/api/merchant/store-draft/design', [
            'expectedRevision' => 1,
            'themeStyle' => 'elegant',
            'config' => StoreOnboardingAppearance::extract(StoreOnboardingBaseline::make('متجر غير محفوظ')),
        ])->assertUnprocessable()->assertJsonPath('code', 'onboarding_prerequisite_missing');

        $business = $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 0,
            'storeName' => 'متجر الرحلة',
            'businessType' => 'retail',
        ])->assertOk()
            ->assertJsonPath('data.revision', 1)
            ->assertJsonPath('data.onboardingStage', 'business')
            ->assertJsonPath('data.nextRequiredStep', 'design');

        $auditCount = DB::table('admin_audit_logs')->where('action', 'merchant.store_onboarding.saved')->count();
        $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 1,
            'storeName' => 'متجر الرحلة',
            'businessType' => 'retail',
        ])->assertOk()->assertJsonPath('data.revision', 1);
        $this->assertSame($auditCount, DB::table('admin_audit_logs')
            ->where('action', 'merchant.store_onboarding.saved')->count());

        $config = (array) $business->json('data.config');
        $this->putJson('/api/merchant/store-draft/design', [
            'expectedRevision' => 1,
            'themeStyle' => 'tech',
            'config' => StoreOnboardingAppearance::extract($config) + [
                'products' => [[
                    'name' => 'منتج لا يجوز حفظه من التهيئة',
                    'price' => 1,
                ]],
            ],
        ])->assertUnprocessable();
        $this->assertSame(1, (int) $business->json('data.revision'));
        $storedConfig = json_decode((string) DB::table('store_drafts')
            ->where('owner_user_id', $owner->getKey())
            ->value('config'), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame([], $storedConfig['products'] ?? null);

        $design = $this->putJson('/api/merchant/store-draft/design', [
            'expectedRevision' => 1,
            'themeStyle' => 'tech',
            'config' => StoreOnboardingAppearance::extract($config),
        ])->assertOk()
            ->assertJsonPath('data.revision', 2)
            ->assertJsonPath('data.onboardingStage', 'design')
            ->assertJsonPath('data.nextRequiredStep', 'review');

        $handle = 'guided-'.Str::lower(Str::random(10));
        $this->putJson('/api/merchant/store-draft/review', [
            'expectedRevision' => (int) $design->json('data.revision'),
            'handle' => $handle,
            'planKey' => 'starter',
        ])->assertOk()
            ->assertJsonPath('data.revision', 3)
            ->assertJsonPath('data.onboardingStage', 'review')
            ->assertJsonPath('data.onboardingReadiness.review', true)
            ->assertJsonPath('data.nextRequiredStep', 'submit');

        $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 1,
            'storeName' => 'كاتب قديم',
            'businessType' => 'retail',
        ])->assertConflict()->assertJsonPath('code', 'draft_revision_conflict');

        Plan::query()->whereKey('starter')->update(['is_active' => false]);
        $this->getJson('/api/merchant/store-draft')->assertOk()
            ->assertJsonPath('data.onboardingReadiness.review', false)
            ->assertJsonPath('data.onboardingReadiness.blockers.0', 'plan_unavailable')
            ->assertJsonPath('data.nextRequiredStep', 'review');
    }

    public function test_database_rejects_invalid_account_revision_and_review_shape(): void
    {
        $this->seed(IdentitySeeder::class);
        $owner = $this->createUser('constraint-owner@example.test');
        $this->actingAs($owner);
        $draftId = (string) $this->putJson('/api/merchant/store-draft/business', [
            'expectedRevision' => 0,
            'storeName' => 'Constraint Store',
            'businessType' => 'retail',
        ])->assertOk()->json('data.id');

        DB::beginTransaction();
        try {
            DB::table('store_drafts')->where('id', $draftId)->update(['onboarding_stage' => 'review']);
            $this->fail('PostgreSQL must reject a review stage without handle and plan.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('store_drafts_review_shape', (string) ($exception->errorInfo[2] ?? ''));
        } finally {
            DB::rollBack();
        }

        DB::beginTransaction();
        try {
            DB::table('users')->where('id', $owner->getKey())->update(['profile_revision' => 0]);
            $this->fail('PostgreSQL must reject a non-positive profile revision.');
        } catch (QueryException $exception) {
            $this->assertStringContainsString('users_profile_revision_positive', (string) ($exception->errorInfo[2] ?? ''));
        } finally {
            DB::rollBack();
        }
    }

    /** @return list<string> */
    private function profileAuditFields(User $user): array
    {
        $audit = DB::table('admin_audit_logs')
            ->where('actor_user_id', $user->getKey())
            ->where('action', 'identity.account.profile.updated')
            ->first();
        $this->assertNotNull($audit);
        $this->assertStringNotContainsString('Profile Owner', (string) $audit->old_values);
        $this->assertStringNotContainsString('+967777000111', (string) $audit->new_values);

        return (array) (json_decode((string) $audit->new_values, true, 512, JSON_THROW_ON_ERROR)['changed_fields'] ?? []);
    }

    private function createUser(string $email): User
    {
        return User::query()->create([
            'name' => 'WP 5.13 User',
            'email' => $email,
            'password' => 'secure-pass-123',
            'status' => UserStatus::Active,
        ]);
    }
}
