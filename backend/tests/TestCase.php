<?php

namespace Tests;

use App\Http\Middleware\EnsureActiveUserSession;
use Illuminate\Contracts\Auth\Authenticatable as UserContract;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    public function actingAs(UserContract $user, $guard = null): static
    {
        parent::actingAs($user, $guard);

        $generation = method_exists($user, 'getAttribute')
            ? $user->getAttribute('session_generation')
            : null;

        if (is_int($generation)) {
            $this->withSession([
                EnsureActiveUserSession::SESSION_GENERATION_KEY => $generation,
            ]);
        }

        return $this;
    }
}
