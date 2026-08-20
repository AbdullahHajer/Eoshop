<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class CreateOrderRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $payment = $this->input('payment');
        if (is_array($payment) && array_key_exists('reference', $payment) && is_string($payment['reference'])) {
            $payment['reference'] = trim($payment['reference']);
        }
        $this->merge([
            'idempotencyKey' => $this->header('Idempotency-Key'),
            'requestId' => $this->header('X-Request-ID'),
            'payment' => $payment,
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'requestId' => ['nullable', 'uuid'],
            'workspaceRevision' => ['required', 'integer', 'min:1'],
            'catalogRevision' => ['required', 'integer', 'min:1'],
            'lines' => ['required', 'array', 'min:1', 'max:'.config('orders.max_lines')],
            'lines.*' => ['array:productId,quantity'],
            'lines.*.productId' => ['required', 'uuid', 'distinct:strict'],
            'lines.*.quantity' => ['required', 'integer', 'between:1,'.config('orders.max_quantity_per_line')],
            'couponCode' => ['nullable', 'string', 'max:50', 'regex:/^[A-Za-z0-9_-]+$/'],
            'payment' => ['required', 'array:method,channelId,reference'],
            'payment.method' => ['required', Rule::in(['cod', 'bank_transfer', 'wallet'])],
            'payment.channelId' => [
                Rule::prohibitedIf(fn (): bool => $this->input('payment.method') !== 'wallet'),
                Rule::requiredIf(fn (): bool => $this->input('payment.method') === 'wallet'),
                'nullable', 'string', 'max:100', 'regex:/^[a-z0-9][a-z0-9_-]{0,99}$/',
            ],
            'payment.reference' => [
                Rule::prohibitedIf(fn (): bool => $this->input('payment.method') === 'cod'),
                Rule::requiredIf(fn (): bool => in_array($this->input('payment.method'), ['bank_transfer', 'wallet'], true)),
                'nullable', 'string', 'max:200', 'regex:/\S/u',
            ],
            'customer' => ['required', 'array:name,phone,email,notes'],
            'customer.name' => ['required', 'string', 'max:120'],
            'customer.phone' => ['required', 'string', 'max:30', 'regex:/^[0-9+() -]+$/'],
            'customer.email' => ['nullable', 'email:rfc', 'max:255'],
            'customer.notes' => ['nullable', 'string', 'max:1000'],
            'address' => ['required', 'array:city,area,street,details'],
            'address.city' => ['required', 'string', 'max:100'],
            'address.area' => ['required', 'string', 'max:100'],
            'address.street' => ['nullable', 'string', 'max:200'],
            'address.details' => ['nullable', 'string', 'max:500'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $allowed = ['idempotencyKey', 'requestId', 'workspaceRevision', 'catalogRevision', 'lines', 'couponCode', 'payment', 'customer', 'address'];
            if (array_diff(array_keys($this->all()), $allowed) !== []) {
                $validator->errors()->add('request', 'The checkout request contains unsupported fields.');
            }
        }];
    }
}
