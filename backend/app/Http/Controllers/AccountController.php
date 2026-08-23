<?php

namespace App\Http\Controllers;

use App\Exceptions\AccountProfileConflict;
use App\Http\Requests\ChangeAccountPasswordRequest;
use App\Http\Requests\UpdateAccountProfileRequest;
use App\Http\Resources\AuthenticatedUserResource;
use App\Models\User;
use App\Services\AccountPasswordService;
use App\Services\AccountProfileService;
use App\Services\AuthenticatedSessionBinder;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;

class AccountController extends Controller
{
    public function updateProfile(
        UpdateAccountProfileRequest $request,
        AccountProfileService $profiles,
    ): AuthenticatedUserResource|JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        try {
            $user = $profiles->update($actor, $request->validated(), $request);
        } catch (AccountProfileConflict $exception) {
            $exception->current->loadMissing('platformRoles');

            return response()->json([
                'message' => $exception->getMessage(),
                'code' => 'account_profile_revision_conflict',
                'current' => (new AuthenticatedUserResource($exception->current))->resolve($request),
            ], 409);
        }
        $user->loadMissing('platformRoles');

        return new AuthenticatedUserResource($user);
    }

    public function changePassword(
        ChangeAccountPasswordRequest $request,
        AccountPasswordService $passwords,
        AuthenticatedSessionBinder $sessions,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();
        $user = $passwords->change(
            actor: $actor,
            currentPassword: $request->string('currentPassword')->toString(),
            password: $request->string('password')->toString(),
            currentSessionId: $request->session()->getId(),
            request: $request,
        );

        /** @var SessionGuard $guard */
        $guard = Auth::guard('web');
        $request->session()->regenerate(true);
        $sessions->bind($request, $guard, $user);

        return response()->json(['message' => 'تم تحديث كلمة المرور وإلغاء الجلسات الأخرى.']);
    }
}
