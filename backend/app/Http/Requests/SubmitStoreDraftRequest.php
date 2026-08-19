<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class SubmitStoreDraftRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['idempotencyKey' => $this->header('Idempotency-Key')]);
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'idempotencyKey' => ['required', 'uuid'],
        ];
    }
}
