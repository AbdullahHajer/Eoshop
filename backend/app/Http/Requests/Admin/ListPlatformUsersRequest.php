<?php

namespace App\Http\Requests\Admin;

use App\Enums\RoleScope;
use App\Enums\UserStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ListPlatformUsersRequest extends FormRequest
{
    private const QUERY_PARAMETERS = ['search', 'status', 'role', 'page', 'perPage'];

    protected function prepareForValidation(): void
    {
        if ($this->query->has('search')) {
            $this->merge(['search' => trim((string) $this->query('search'))]);
        }
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'string', 'min:2', 'max:100'],
            'status' => ['sometimes', Rule::enum(UserStatus::class)],
            'role' => [
                'sometimes',
                'string',
                'max:120',
                Rule::exists('roles', 'key')->where(fn ($query) => $query
                    ->where('scope', RoleScope::Platform->value)
                    ->where('system', true)),
            ],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'perPage' => ['sometimes', 'integer', 'min:10', 'max:100'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->query->all()), self::QUERY_PARAMETERS) !== []) {
                $validator->errors()->add('query', 'The platform user list contains unsupported query parameters.');
            }
        }];
    }
}
