<?php

namespace App\Http\Requests\Payments;

use Illuminate\Contracts\Validation\Validator as ValidatorContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\Exceptions\HttpResponseException;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class ConfigureBasGateConnectionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $credentials = $this->input('credentials');
        if (is_array($credentials)) {
            foreach (['appId', 'clientId'] as $field) {
                if (isset($credentials[$field]) && is_string($credentials[$field])) {
                    $credentials[$field] = trim($credentials[$field]);
                }
            }
        }

        $this->merge([
            'credentials' => $credentials,
            'idempotencyKey' => $this->header('Idempotency-Key'),
            'requestId' => $this->header('X-Request-ID'),
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $opaqueSecret = [
            'required',
            'string',
            'min:8',
            'max:512',
            'regex:/^[^\p{C}\p{Z}]+$/u',
        ];

        return [
            'idempotencyKey' => ['required', 'uuid'],
            'requestId' => ['nullable', 'uuid'],
            'expectedRevision' => ['required', 'integer', 'min:0'],
            'environment' => ['required', Rule::in(['sandbox', 'production'])],
            'credentials' => ['required', 'array:appId,merchantKey,clientId,clientSecret'],
            'credentials.appId' => ['required', 'uuid'],
            'credentials.merchantKey' => $opaqueSecret,
            'credentials.clientId' => ['required', 'uuid'],
            'credentials.clientSecret' => $opaqueSecret,
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(
                array_keys($this->all()),
                ['expectedRevision', 'environment', 'credentials', 'idempotencyKey', 'requestId'],
            );
            if ($unknown !== []) {
                $validator->errors()->add('request', 'The payment connection request contains unsupported fields.');
            }
        }];
    }

    protected function failedValidation(ValidatorContract $validator): void
    {
        throw new HttpResponseException(response()->json([
            'message' => 'The payment connection request is invalid.',
            'code' => 'payment_connection_validation_failed',
            'errors' => $validator->errors(),
        ], 422)->header('Cache-Control', 'no-store, private'));
    }
}
