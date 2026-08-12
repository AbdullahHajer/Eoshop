<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Models\User;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PasswordResetController extends Controller
{
    public function requestLink(ForgotPasswordRequest $request): JsonResponse
    {
        Password::broker()->sendResetLink([
            'email' => $request->string('email')->toString(),
        ]);

        return response()->json([
            'message' => 'إذا كان البريد مسجلاً فستصلك تعليمات إعادة كلمة المرور.',
        ], 202);
    }

    public function reset(ResetPasswordRequest $request): JsonResponse
    {
        $resetUserId = null;

        $status = Password::broker()->reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) use (&$resetUserId): void {
                $user->forceFill([
                    'password' => $password,
                    'remember_token' => Str::random(60),
                ])->save();

                $resetUserId = (string) $user->getKey();
                event(new PasswordReset($user));
            },
        );

        if ($status !== Password::PasswordReset) {
            throw ValidationException::withMessages([
                'email' => ['رابط إعادة كلمة المرور غير صالح أو منتهي.'],
            ]);
        }

        if ($request->user()?->getAuthIdentifier() === $resetUserId) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        DB::table('sessions')->where('user_id', $resetUserId)->delete();

        return response()->json([
            'message' => 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.',
        ]);
    }
}
