<?php

namespace App\Http\Requests;

use App\Support\ProductCatalogContract;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Validator;

class UpdateProductCatalogRequest extends FormRequest
{
    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return [
            'catalogRevision' => ['required', 'integer', 'min:1'],
            'currencyCode' => ['required', 'string'],
            'products' => ['present', 'array'],
            'archiveProductIds' => ['sometimes', 'array'],
        ];
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            $catalog = ProductCatalogContract::validator($this->all(), null);
            foreach ($catalog->errors()->toArray() as $field => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add($field, $message);
                }
            }
        }];
    }
}
