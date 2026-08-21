<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class ListAdminAuditLogsRequest extends FormRequest
{
    private const QUERY_PARAMETERS = [
        'search',
        'action',
        'tenantId',
        'page',
        'perPage',
    ];

    protected function prepareForValidation(): void
    {
        $normalized = [];
        foreach (['search', 'action', 'tenantId'] as $field) {
            if ($this->query->has($field)) {
                $normalized[$field] = trim((string) $this->query($field));
            }
        }

        if ($normalized !== []) {
            $this->merge($normalized);
        }
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'string', 'min:2', 'max:100'],
            'action' => ['sometimes', 'string', 'min:1', 'max:120', 'regex:/^[a-z0-9._-]+$/'],
            'tenantId' => ['sometimes', 'string', 'min:1', 'max:255'],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'perPage' => ['sometimes', 'integer', 'min:10', 'max:100'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->query->all()), self::QUERY_PARAMETERS) !== []) {
                $validator->errors()->add('query', 'The audit list contains unsupported query parameters.');
            }
        }];
    }
}
