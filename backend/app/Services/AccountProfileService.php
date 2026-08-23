<?php

namespace App\Services;

use App\Enums\UserStatus;
use App\Exceptions\AccountProfileConflict;
use App\Models\User;
use App\Support\AccountPhone;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AccountProfileService
{
    public function __construct(private readonly AdminAuditService $audit) {}

    /** @param array{expectedRevision: int, name: string, phone?: string|null} $input */
    public function update(User $actor, array $input, Request $request): User
    {
        return DB::connection((string) config('tenancy.database.central_connection'))
            ->transaction(function () use ($actor, $input, $request): User {
                $user = User::withTrashed()->whereKey($actor->getKey())->lockForUpdate()->firstOrFail();
                if ($user->trashed() || $user->getAttribute('status') !== UserStatus::Active) {
                    throw new AuthorizationException('The account is not active.');
                }
                if ((int) $user->getAttribute('profile_revision') !== (int) $input['expectedRevision']) {
                    throw new AccountProfileConflict($user);
                }

                $name = trim($input['name']);
                $phone = AccountPhone::normalize($input['phone'] ?? null);
                $old = ['name' => (string) $user->getAttribute('name'), 'phone' => $user->getAttribute('phone')];
                $new = ['name' => $name, 'phone' => $phone];
                if ($old === $new) {
                    return $user;
                }

                $changed = array_keys(array_filter(
                    $new,
                    static fn (mixed $value, string $key): bool => $old[$key] !== $value,
                    ARRAY_FILTER_USE_BOTH,
                ));
                $user->forceFill([
                    ...$new,
                    'profile_revision' => ((int) $user->getAttribute('profile_revision')) + 1,
                ])->save();
                $this->audit->record(
                    request: $request,
                    actor: $user,
                    action: 'identity.account.profile.updated',
                    subject: $user,
                    tenant: null,
                    oldValues: ['changed_fields' => $changed],
                    newValues: ['changed_fields' => $changed],
                );

                return $user->refresh();
            });
    }
}
