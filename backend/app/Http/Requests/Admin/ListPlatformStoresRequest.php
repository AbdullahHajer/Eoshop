<?php

namespace App\Http\Requests\Admin;

use App\Enums\PlatformAttentionQueue;
use App\Enums\ProvisioningState;
use App\Enums\PublicationStatus;
use App\Enums\TenantVerificationStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ListPlatformStoresRequest extends FormRequest
{
    private const QUERY_PARAMETERS = [
        'search',
        'verification',
        'provisioning',
        'publication',
        'attention',
        'page',
        'perPage',
    ];

    protected function prepareForValidation(): void
    {
        if ($this->query->has('search')) {
            $this->merge(['search' => trim((string) $this->query('search'))]);
        }
    }

    /**
     * @return array<string, list<mixed>>
     */
    public function rules(): array
    {
        return [
            'search' => ['sometimes', 'string', 'min:2', 'max:100'],
            'verification' => ['sometimes', Rule::enum(TenantVerificationStatus::class)],
            'provisioning' => ['sometimes', Rule::enum(ProvisioningState::class)],
            'publication' => ['sometimes', Rule::enum(PublicationStatus::class)],
            'attention' => ['sometimes', Rule::enum(PlatformAttentionQueue::class)],
            'page' => ['sometimes', 'integer', 'min:1', 'max:100000'],
            'perPage' => ['sometimes', 'integer', 'min:10', 'max:100'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->query->all()), self::QUERY_PARAMETERS) !== []) {
                $validator->errors()->add('query', 'The store list contains unsupported query parameters.');
            }
        }];
    }
}
