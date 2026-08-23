<?php

namespace App\Http\Requests;

use App\Support\PublicStoreHandle;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class SaveStoreOnboardingReviewRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'expectedRevision' => ['required', 'integer', 'min:1'],
            'handle' => ['required', 'string', 'max:50'],
            'planKey' => ['required', 'string', 'max:50'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if (array_diff(array_keys($this->all()), ['expectedRevision', 'handle', 'planKey']) !== []) {
                $validator->errors()->add('request', 'يحتوي الطلب على حقول غير مدعومة.');
            }
            try {
                PublicStoreHandle::normalize((string) $this->input('handle'));
            } catch (InvalidArgumentException $exception) {
                $validator->errors()->add('handle', $exception->getMessage());
            }
        }];
    }
}
