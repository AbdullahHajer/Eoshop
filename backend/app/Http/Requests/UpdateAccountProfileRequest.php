<?php

namespace App\Http\Requests;

use App\Support\AccountPhone;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class UpdateAccountProfileRequest extends FormRequest
{
    protected function prepareForValidation(): void
    {
        $this->merge(['name' => trim((string) $this->input('name'))]);
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'name' => ['required', 'string', 'min:2', 'max:120'],
            'phone' => ['nullable', 'string', 'max:32'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->all()), ['expectedRevision', 'name', 'phone']);
            if ($unknown !== []) {
                $validator->errors()->add('request', 'يحتوي الطلب على حقول غير مدعومة.');
            }
            try {
                AccountPhone::normalize($this->input('phone'));
            } catch (InvalidArgumentException $exception) {
                $validator->errors()->add('phone', $exception->getMessage());
            }
        }];
    }
}
