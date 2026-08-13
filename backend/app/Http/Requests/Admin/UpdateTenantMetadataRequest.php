<?php

namespace App\Http\Requests\Admin;

use Illuminate\Foundation\Http\FormRequest;

class UpdateTenantMetadataRequest extends FormRequest
{
    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'storeName' => ['sometimes', 'required', 'string', 'max:255'],
            'ownerName' => ['sometimes', 'required', 'string', 'max:255'],
            'ownerEmail' => ['sometimes', 'required', 'email', 'max:255'],
            'ownerPhone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'businessType' => ['sometimes', 'required', 'string', 'max:255'],
        ];
    }
}
