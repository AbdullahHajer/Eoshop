<?php

namespace App\Console\Commands;

use App\Enums\SystemRole;
use App\Enums\UserStatus;
use App\Models\AdminAuditLog;
use App\Models\Role;
use App\Models\User;
use App\Services\RoleAssignmentService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;

class ProvisionQaAdministrator extends Command
{
    protected $signature = 'qa:provision-admin
        {--email= : Email address for the explicit Pilot QA administrator}
        {--name=Pilot QA Administrator : Display name for the administrator}
        {--password-env=QA_ADMIN_PASSWORD : Environment variable containing the plaintext password}';

    protected $description = 'Provision or rotate an explicit non-production Pilot QA administrator.';

    public function handle(RoleAssignmentService $assignments): int
    {
        if (app()->environment('production') || config('app.env') === 'production') {
            $this->components->error('This command is disabled in production.');

            return self::FAILURE;
        }

        $email = Str::lower(trim((string) $this->option('email')));
        $name = trim((string) $this->option('name'));
        $passwordVariable = trim((string) $this->option('password-env'));

        if (! preg_match('/\A[A-Z][A-Z0-9_]{2,63}\z/', $passwordVariable)) {
            $this->components->error('The password environment variable name is invalid.');

            return self::INVALID;
        }

        $password = getenv($passwordVariable);
        $validator = Validator::make([
            'email' => $email,
            'name' => $name,
            'password' => is_string($password) ? $password : null,
        ], [
            'email' => ['required', 'email:rfc', 'max:255'],
            'name' => ['required', 'string', 'max:255'],
            'password' => ['required', 'string', Password::min(12)->letters()->numbers(), 'max:128'],
        ]);

        if ($validator->fails()) {
            $this->components->error('Provide a valid email, name and a password of 12–128 characters containing letters and numbers through '.$passwordVariable.'.');

            return self::INVALID;
        }

        $role = Role::query()->where('key', SystemRole::PlatformSuperAdmin->value)->first();
        if ($role === null) {
            $this->components->error('The platform role catalog is missing. Run migrations and the database seeder first.');

            return self::FAILURE;
        }

        $password = (string) $password;
        $central = DB::connection((string) config('tenancy.database.central_connection'));
        $outcome = $central->transaction(function () use ($email, $name, $password, $role, $assignments, $central): string {
            $existingUser = User::withTrashed()->where('email', $email)->lockForUpdate()->first();
            if ($existingUser instanceof User) {
                if ($existingUser->trashed()) {
                    return 'deleted';
                }

                $alreadyAdministrator = $central->table('role_user')
                    ->where('user_id', $existingUser->getKey())
                    ->where('role_id', $role->getKey())
                    ->exists();
                if ($existingUser->getRawOriginal('status') !== UserStatus::Active->value || ! $alreadyAdministrator) {
                    return 'ineligible';
                }

                $existingUser->fill([
                    'name' => $name,
                    'password' => $password,
                    'status' => UserStatus::Active,
                    'email_verified_at' => $existingUser->email_verified_at ?? now(),
                ]);
                $existingUser->remember_token = Str::random(60);
                $existingUser->save();

                $central->table('sessions')->where('user_id', $existingUser->getKey())->delete();
                AdminAuditLog::query()->create([
                    'actor_user_id' => $existingUser->getKey(),
                    'action' => 'identity.qa_admin.credential_rotated',
                    'subject_type' => User::class,
                    'subject_id' => (string) $existingUser->getKey(),
                    'old_values' => null,
                    'new_values' => ['sessions_revoked' => true],
                    'occurred_at' => now(),
                ]);

                return 'rotated';
            }

            $user = new User;
            $user->fill([
                'name' => $name,
                'email' => $email,
                'password' => $password,
                'status' => UserStatus::Active,
                'email_verified_at' => now(),
            ]);
            $user->remember_token = Str::random(60);
            $user->save();
            $assignments->assignPlatformRole($user, $role, $user);

            return 'created';
        });

        if ($outcome === 'deleted') {
            $this->components->error('A deleted identity already owns this email. Refusing to restore it implicitly.');

            return self::FAILURE;
        }

        if ($outcome === 'ineligible') {
            $this->components->error('An existing identity owns this email but is not an active Pilot QA super administrator. Refusing to adopt or reactivate it.');

            return self::FAILURE;
        }

        $this->components->info("Pilot QA administrator {$outcome}: {$email}");
        $this->line('The password was read from the named environment variable and was not displayed.');

        return self::SUCCESS;
    }
}
