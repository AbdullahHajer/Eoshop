<?php

namespace App\Http\Requests\Admin;

use App\Enums\RoleScope;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ReplacePlatformUserRolesRequest extends FormRequest
{
    private const BODY_FIELDS = ['expectedRoleKeys', 'roleKeys'];

    protected function prepareForValidation(): void
    {
        $expected = $this->input('expectedRoleKeys');
        $desired = $this->input('roleKeys');
        if (is_array($expected)) {
            sort($expected, SORT_STRING);
        }
        if (is_array($desired)) {
            sort($desired, SORT_STRING);
        }

        $this->merge(['expectedRoleKeys' => $expected, 'roleKeys' => $desired]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $roleRule = Rule::exists('roles', 'key')->where(fn ($query) => $query
            ->where('scope', RoleScope::Platform->value)
            ->where('system', true));

        return [
            'expectedRoleKeys' => ['required', 'array', 'min:1', 'max:20'],
            'expectedRoleKeys.*' => ['required', 'string', 'max:120', 'distinct:strict', $roleRule],
            'roleKeys' => ['required', 'array', 'min:1', 'max:20'],
            'roleKeys.*' => ['required', 'string', 'max:120', 'distinct:strict', $roleRule],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), self::BODY_FIELDS) !== []) {
                $validator->errors()->add('body', 'The role replacement contains unsupported fields.');
            }
        }];
    }
}
