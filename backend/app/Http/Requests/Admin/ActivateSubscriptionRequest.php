<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class ActivateSubscriptionRequest extends FormRequest
{
    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'endsAt' => ['required', 'date', 'after:now', 'before_or_equal:'.now()->addYear()->toIso8601String()],
        ];
    }
}
