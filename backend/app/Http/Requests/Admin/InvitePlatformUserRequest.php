<?php

namespace App\Http\Requests\Admin;

use App\Enums\RoleScope;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class InvitePlatformUserRequest extends FormRequest
{
    private const BODY_FIELDS = ['name', 'email', 'roleKeys'];

    protected function prepareForValidation(): void
    {
        $roles = $this->input('roleKeys');
        if (is_array($roles)) {
            sort($roles, SORT_STRING);
        }

        $this->merge([
            'name' => trim((string) $this->input('name')),
            'email' => mb_strtolower(trim((string) $this->input('email'))),
            'roleKeys' => $roles,
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'email' => ['required', 'string', 'email:rfc', 'max:255'],
            'roleKeys' => ['required', 'array', 'min:1', 'max:20'],
            'roleKeys.*' => [
                'required',
                'string',
                'max:120',
                'distinct:strict',
                Rule::exists('roles', 'key')->where(fn ($query) => $query
                    ->where('scope', RoleScope::Platform->value)
                    ->where('system', true)),
            ],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), self::BODY_FIELDS) !== []) {
                $validator->errors()->add('body', 'The invitation contains unsupported fields.');
            }
        }];
    }
}
