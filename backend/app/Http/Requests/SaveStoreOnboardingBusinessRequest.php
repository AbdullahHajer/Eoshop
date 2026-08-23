<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class SaveStoreOnboardingBusinessRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge([
            'storeName' => trim((string) $this->input('storeName')),
            'businessType' => trim((string) $this->input('businessType')),
        ]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:0'],
            'storeName' => ['required', 'string', 'min:2', 'max:255'],
            'businessType' => ['required', 'string', 'min:2', 'max:100'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), ['expectedRevision', 'storeName', 'businessType']) !== []) {
                $validator->errors()->add('request', 'يحتوي الطلب على حقول غير مدعومة.');
            }
        }];
    }
}
