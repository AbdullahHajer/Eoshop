<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\ForgotPasswordRequest;
use App\Http\Requests\Auth\ResetPasswordRequest;
use App\Services\IdentityPasswordResetService;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class PasswordResetController extends Controller
{
    public function requestLink(
        ForgotPasswordRequest $request,
        IdentityPasswordResetService $resets,
    ): JsonResponse {
        $resets->requestLink($request, $request->string('email')->toString());

        return response()->json([
            'message' => 'إذا كان البريد مسجلاً فستصلك تعليمات إعادة كلمة المرور.',
        ], 202);
    }

    public function reset(
        ResetPasswordRequest $request,
        IdentityPasswordResetService $resets,
    ): JsonResponse {
        $user = $resets->reset(
            request: $request,
            email: $request->string('email')->toString(),
            token: $request->string('token')->toString(),
            password: $request->string('password')->toString(),
        );

        $resetUserId = (string) $user->getKey();

        if ($request->user()?->getAuthIdentifier() === $resetUserId) {
            Auth::guard('web')->logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();
        }

        return response()->json([
            'message' => 'تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن.',
        ]);
    }
}
