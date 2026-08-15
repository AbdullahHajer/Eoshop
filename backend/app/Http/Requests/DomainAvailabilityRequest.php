<?php

namespace App\Http\Requests;

use App\Support\PublicStoreHandle;
use Illuminate\Foundation\Http\FormRequest;
use InvalidArgumentException;

class DomainAvailabilityRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
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
        ];
    }
}
