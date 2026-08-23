<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\Validator;

class ChangeAccountPasswordRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'currentPassword' => ['required', 'string'],
            'password' => ['required', 'confirmed', Password::min(10)],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $unknown = array_diff(array_keys($this->all()), ['currentPassword', 'password', 'password_confirmation']);
            if ($unknown !== []) {
                $validator->errors()->add('request', 'يحتوي الطلب على حقول غير مدعومة.');
            }
        }];
    }
}
