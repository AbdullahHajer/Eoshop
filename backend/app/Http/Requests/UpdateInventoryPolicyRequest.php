<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateInventoryPolicyRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'idempotencyKey' => $this->header('Idempotency-Key'),
            'requestId' => $this->header('X-Request-ID'),
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'requestId' => ['nullable', 'uuid'],
            'expectedInventoryRevision' => ['required', 'integer', 'min:1'],
            'manageStock' => ['required', 'boolean'],
            'lowStockThreshold' => ['required', 'integer', 'min:0', 'max:1000000000'],
        ];
    }
}
