<?php

namespace App\Http\Controllers\Auth;

use App\Enums\UserStatus;
use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureActiveUserSession;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\AuthenticatedUserResource;
use App\Models\User;
use Illuminate\Auth\Events\Registered;
use Illuminate\Auth\SessionGuard;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class AuthenticationController extends Controller
{
    public function csrf(Request $request): JsonResponse
    {
        return response()->json([
            'csrf_token' => $request->session()->token(),
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $user = $request->user();

        $status = $user instanceof User ? $user->getAttribute('status') : null;

        if (! $user instanceof User || $status !== UserStatus::Active || $user->trashed()) {
            if ($user !== null) {
                $this->invalidateSession($request);
            }

            return response()->json(['data' => null]);
        }

        $user->loadMissing('platformRoles');

        return response()->json([
            'data' => (new AuthenticatedUserResource($user))->resolve($request),
        ]);
    }

    public function register(RegisterRequest $request): JsonResponse
    {
        if ($request->user() !== null) {
            return response()->json([
                'message' => 'سجّل الخروج قبل إنشاء حساب آخر.',
            ], 409);
        }

        /** @var User $user */
        $user = DB::transaction(fn (): User => User::query()->create([
            'name' => $request->string('name')->toString(),
            'email' => $request->string('email')->toString(),
            'phone' => $request->input('phone'),
            'password' => $request->string('password')->toString(),
            'status' => UserStatus::Active,
            'last_login_at' => now(),
        ]));

        event(new Registered($user));
        /** @var SessionGuard $guard */
        $guard = Auth::guard('web');
        $guard->login($user);
        $request->session()->regenerate(true);
        $this->bindSessionToPassword($request, $guard, $user);
        $user->load('platformRoles');

        return response()->json([
            'data' => (new AuthenticatedUserResource($user))->resolve($request),
        ], 201);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $credentials = [
            'email' => $request->string('email')->toString(),
            'password' => $request->string('password')->toString(),
        ];

        /** @var SessionGuard $guard */
        $guard = Auth::guard('web');
        $authenticated = $guard->attemptWhen(
            $credentials,
            static fn ($candidate): bool => $candidate instanceof User
                && $candidate->getAttribute('status') === UserStatus::Active
                && ! $candidate->trashed(),
            $request->boolean('remember'),
        );

        if (! $authenticated) {
            throw ValidationException::withMessages([
                'email' => ['بيانات الدخول غير صحيحة.'],
            ]);
        }

        $request->session()->regenerate(true);

        /** @var User $user */
        $user = $request->user();

        if ($user->getAttribute('status') !== UserStatus::Active || $user->trashed()) {
            $this->invalidateSession($request);

            throw ValidationException::withMessages([
                'email' => ['بيانات الدخول غير صحيحة.'],
            ]);
        }

        $this->bindSessionToPassword($request, $guard, $user);
        $user->forceFill(['last_login_at' => now()])->save();
        $user->load('platformRoles');

        return response()->json([
            'data' => (new AuthenticatedUserResource($user))->resolve($request),
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $this->invalidateSession($request);

        return response()->json(['message' => 'تم تسجيل الخروج بنجاح.']);
    }

    private function invalidateSession(Request $request): void
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();
    }

    private function bindSessionToPassword(Request $request, SessionGuard $guard, User $user): void
    {
        $request->session()->put(
            'password_hash_'.Auth::getDefaultDriver(),
            $guard->hashPasswordForCookie($user->getAuthPassword()),
        );
        $request->session()->put(
            EnsureActiveUserSession::SESSION_GENERATION_KEY,
            (int) $user->getAttribute('session_generation'),
        );
    }
}
