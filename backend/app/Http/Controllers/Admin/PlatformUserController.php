<?php

namespace App\Http\Controllers\Admin;

use App\Enums\UserStatus;
use App\Exceptions\PlatformUserConflict;
use App\Http\Controllers\Controller;
use App\Http\Requests\Admin\InvitePlatformUserRequest;
use App\Http\Requests\Admin\ListPlatformUsersRequest;
use App\Http\Requests\Admin\ReplacePlatformUserRolesRequest;
use App\Http\Requests\Admin\ResendPlatformInvitationRequest;
use App\Http\Requests\Admin\UpdatePlatformUserStatusRequest;
use App\Http\Resources\PlatformRoleResource;
use App\Http\Resources\PlatformUserResource;
use App\Models\User;
use App\Services\AdminAuditService;
use App\Services\PlatformUserLifecycleService;
use App\Services\PlatformUserReadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlatformUserController extends Controller
{
    public function index(
        ListPlatformUsersRequest $request,
        PlatformUserReadService $users,
    ): AnonymousResourceCollection {
        return PlatformUserResource::collection($users->users($request->validated()));
    }

    public function roles(PlatformUserReadService $users): AnonymousResourceCollection
    {
        return PlatformRoleResource::collection($users->roles());
    }

    public function store(
        InvitePlatformUserRequest $request,
        PlatformUserLifecycleService $lifecycle,
        PlatformUserReadService $users,
        AdminAuditService $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            /** @var array{name: string, email: string, roleKeys: list<string>} $payload */
            $payload = $request->validated();
            $result = $lifecycle->invite($payload, $actor, $request);
        } catch (PlatformUserConflict $exception) {
            return $this->conflict($exception);
        }

        return response()->json([
            'data' => (new PlatformUserResource($users->user($result['user'])))->resolve($request),
            'invitationDispatch' => ['status' => $result['dispatchStatus']],
            'meta' => ['requestId' => $audit->requestId($request)],
        ], 201);
    }

    public function replaceRoles(
        ReplacePlatformUserRolesRequest $request,
        User $user,
        PlatformUserLifecycleService $lifecycle,
        PlatformUserReadService $users,
        AdminAuditService $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $updated = $lifecycle->replaceRoles(
                target: $user,
                expectedRoleKeys: $request->validated('expectedRoleKeys'),
                roleKeys: $request->validated('roleKeys'),
                actor: $actor,
                request: $request,
            );
        } catch (PlatformUserConflict $exception) {
            return $this->conflict($exception);
        }

        return $this->userResponse($users->user($updated), $request, $audit);
    }

    public function updateStatus(
        UpdatePlatformUserStatusRequest $request,
        User $user,
        PlatformUserLifecycleService $lifecycle,
        PlatformUserReadService $users,
        AdminAuditService $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $updated = $lifecycle->changeStatus(
                target: $user,
                expectedStatus: UserStatus::from((string) $request->validated('expectedStatus')),
                status: UserStatus::from((string) $request->validated('status')),
                actor: $actor,
                request: $request,
            );
        } catch (PlatformUserConflict $exception) {
            return $this->conflict($exception);
        }

        return $this->userResponse($users->user($updated), $request, $audit);
    }

    public function resendInvitation(
        ResendPlatformInvitationRequest $request,
        User $user,
        PlatformUserLifecycleService $lifecycle,
        AdminAuditService $audit,
    ): JsonResponse {
        /** @var User $actor */
        $actor = $request->user();

        try {
            $status = $lifecycle->resendInvitation($user, $actor, $request);
        } catch (PlatformUserConflict $exception) {
            return $this->conflict($exception);
        }

        return match ($status) {
            'accepted' => response()->json([
                'invitationDispatch' => ['status' => $status],
                'meta' => ['requestId' => $audit->requestId($request)],
            ], 202),
            'throttled' => response()->json([
                'message' => 'Invitation dispatch is temporarily throttled.',
                'code' => 'platform_invitation_throttled',
                'invitationDispatch' => ['status' => $status],
            ], 429),
            default => response()->json([
                'message' => 'Invitation dispatch failed. The pending account remains available for retry.',
                'code' => 'platform_invitation_dispatch_failed',
                'invitationDispatch' => ['status' => 'failed'],
            ], 503),
        };
    }

    private function userResponse(User $user, Request $request, AdminAuditService $audit): JsonResponse
    {
        return response()->json([
            'data' => (new PlatformUserResource($user))->resolve($request),
            'meta' => ['requestId' => $audit->requestId($request)],
        ]);
    }

    private function conflict(PlatformUserConflict $exception): JsonResponse
    {
        return response()->json([
            'message' => $exception->getMessage(),
            'code' => $exception->errorCode,
        ], $exception->httpStatus);
    }
}
