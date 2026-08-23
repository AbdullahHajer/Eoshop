<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Models\User;
use App\Support\IdentityLifecycleLock;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use SensitiveParameter;

class AccountPasswordService
{
    public function __construct(private readonly AdminAuditService $audit) {}

    public function change(
        User $actor,
        #[SensitiveParameter] string $currentPassword,
        #[SensitiveParameter] string $password,
        string $currentSessionId,
        Request $request,
    ): User {
        $central = DB::connection((string) config('tenancy.database.central_connection'));

        return $central->transaction(function () use ($actor, $currentPassword, $password, $currentSessionId, $request, $central): User {
            IdentityLifecycleLock::acquire($central);
            $user = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
            if ($user->trashed() || $user->getAttribute('status') !== UserStatus::Active) {
                throw new AuthorizationException('The account is not active.');
            }
            if (! Hash::check($currentPassword, (string) $user->getAuthPassword())) {
                throw ValidationException::withMessages(['currentPassword' => ['كلمة المرور الحالية غير صحيحة.']]);
            }
            if (Hash::check($password, (string) $user->getAuthPassword())) {
                throw ValidationException::withMessages(['password' => ['اختر كلمة مرور جديدة مختلفة.']]);
            }

            $generation = (int) $user->getAttribute('session_generation');
            $user->forceFill([
                'password' => $password,
                'remember_token' => Str::random(60),
            ])->save();
            $updated = $central->table('users')
                ->where('id', $user->getKey())
                ->where('session_generation', $generation)
                ->update(['session_generation' => DB::raw('session_generation + 1')]);
            if ($updated !== 1) {
                throw ValidationException::withMessages(['currentPassword' => ['تعذر تحديث بيانات الاعتماد بأمان. أعد المحاولة.']]);
            }
            $user->setAttribute('session_generation', $generation + 1);

            $central->table('password_reset_tokens')->where('email', $user->getAttribute('email'))->delete();
            $central->table('sessions')
                ->where('user_id', $user->getKey())
                ->where('id', '<>', $currentSessionId)
                ->delete();
            $this->audit->record(
                request: $request,
                actor: $user,
                action: 'identity.account.password.changed',
                subject: $user,
                tenant: null,
                oldValues: null,
                newValues: [
                    'changed_fields' => ['password'],
                    'other_sessions_revoked' => true,
                    'remember_token_rotated' => true,
                    'reset_links_revoked' => true,
                ],
            );

            return $user->refresh();
        });
    }
}
