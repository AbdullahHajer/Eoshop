<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

class SaveStoreOnboardingDesignRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'themeStyle' => ['required', Rule::in(['elegant', 'tech'])],
            'config' => ['required', 'array'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), ['expectedRevision', 'themeStyle', 'config']) !== []) {
                $validator->errors()->add('request', 'يحتوي الطلب على حقول غير مدعومة.');
            }
        }];
    }
}
