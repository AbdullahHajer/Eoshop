<?php

namespace App\Http\Requests;

use App\Support\PublicStoreHandle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;
use JsonException;

class StoreSubmissionRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'idempotencyKey' => $this->header('Idempotency-Key'),
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'idempotencyKey' => ['required', 'uuid'],
            'storeName' => ['required', 'string', 'max:255'],
            'businessType' => ['required', 'string', 'max:100'],
            'themeStyle' => ['required', Rule::in(['elegant', 'tech'])],
            'handle' => [
                'required',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    try {
                        PublicStoreHandle::normalize((string) $value);
                    } catch (InvalidArgumentException $exception) {
                        $fail($exception->getMessage());
                    }
                },
            ],
            'planKey' => ['required', 'string', Rule::exists('plans', 'key')->where('is_active', true)],
            'config' => ['required', 'array'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            try {
                $encoded = json_encode($this->input('config'), JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                $validator->errors()->add('config', 'The initial store configuration is not valid JSON.');

                return;
            }

            if (strlen($encoded) > 262_144) {
                $validator->errors()->add('config', 'The initial store configuration may not exceed 256 KiB.');
            }
        }];
    }
}
