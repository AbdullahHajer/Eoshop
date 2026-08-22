<?php

namespace App\Http\Requests\Admin;

use App\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdatePlatformUserStatusRequest extends FormRequest
{
    private const BODY_FIELDS = ['expectedStatus', 'status'];

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedStatus' => ['required', Rule::enum(UserStatus::class)],
            'status' => ['required', Rule::enum(UserStatus::class)],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), self::BODY_FIELDS) !== []) {
                $validator->errors()->add('body', 'The status update contains unsupported fields.');
            }
        }];
    }
}
