<?php

namespace App\Http\Requests;

use App\Support\PublicStoreHandle;
use App\Support\StoreWorkspaceContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

class SaveStoreDraftRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        $linkedCorrection = $this->route('tenant') !== null;

        return [
            'expectedRevision' => ['required', 'integer', 'min:0'],
            'storeName' => ['required', 'string', 'max:255'],
            'businessType' => ['required', 'string', 'max:100'],
            'themeStyle' => ['required', Rule::in(['elegant', 'tech'])],
            'handle' => [
                $linkedCorrection ? 'required' : 'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null || $value === '') {
                        return;
                    }
                    try {
                        PublicStoreHandle::normalize((string) $value);
                    } catch (InvalidArgumentException $exception) {
                        $fail($exception->getMessage());
                    }
                },
            ],
            'planKey' => [$linkedCorrection ? 'required' : 'nullable', 'string', Rule::exists('plans', 'key')->where('is_active', true)],
            'config' => ['required', 'array'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $config = $this->input('config');
            $workspace = StoreWorkspaceContract::validator(is_array($config) ? $config : [], null);
            foreach ($workspace->errors()->toArray() as $field => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add($field, $message);
                }
            }
        }];
    }
}
