<?php

namespace App\Http\Requests;

use App\Enums\OrderStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class UpdateOrderStatusRequest extends FormRequest
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
            'status' => ['required', Rule::enum(OrderStatus::class)],
            'reasonCode' => ['required', 'string', 'max:64', 'regex:/^[a-z0-9._-]+$/'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), ['idempotencyKey', 'requestId', 'status', 'reasonCode']) !== []) {
                $validator->errors()->add('request', 'The order transition contains unsupported fields.');
            }
        }];
    }
}
