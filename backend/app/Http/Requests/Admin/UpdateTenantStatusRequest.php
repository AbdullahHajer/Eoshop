<?php

namespace App\Http\Requests\Admin;

use App\Enums\TenantVerificationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTenantStatusRequest extends FormRequest
{
    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'status' => ['required', Rule::enum(TenantVerificationStatus::class)],
            'reason' => [
                Rule::requiredIf(fn (): bool => TenantVerificationStatus::tryFrom((string) $this->input('status'))?->requiresReason() === true),
                'nullable',
                'string',
                'max:1000',
            ],
        ];
    }
}
