<?php

namespace App\Http\Requests;

use App\Enums\InventoryMovementKind;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AdjustInventoryRequest extends FormRequest
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
            'reasonCode' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9._-]+$/'],
            'note' => ['nullable', 'string', 'max:500'],
            'lines' => ['required', 'array', 'min:1', 'max:100'],
            'lines.*' => ['array:productId,expectedInventoryRevision,movementKind,delta'],
            'lines.*.productId' => ['required', 'uuid', 'distinct:strict'],
            'lines.*.expectedInventoryRevision' => ['required', 'integer', 'min:1'],
            'lines.*.movementKind' => ['required', Rule::in([
                InventoryMovementKind::Receive->value,
                InventoryMovementKind::Issue->value,
                InventoryMovementKind::Return->value,
                InventoryMovementKind::Correction->value,
            ])],
            'lines.*.delta' => ['required', 'integer', 'between:-1000000000,1000000000', 'not_in:0'],
        ];
    }
}
