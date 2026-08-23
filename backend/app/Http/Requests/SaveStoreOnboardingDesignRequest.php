<?php

namespace App\Http\Requests;

use App\Support\StoreOnboardingAppearance;
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
            'config' => ['required', 'array:'.implode(',', StoreOnboardingAppearance::KEYS)],
            'config.slogan' => ['required', 'string', 'max:500'],
            'config.logoIcon' => ['required', 'string', 'max:32'],
            'config.primaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.secondaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.textColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.bgColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.cardBgColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.borderColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.fontFamily' => ['required', Rule::in(['Cairo', 'Tajawal', 'Almarai', 'Alexandria', 'IBM Plex Sans Arabic'])],
            'config.bannerText' => ['required', 'string', 'max:1000'],
            'config.showHeroBanner' => ['required', 'boolean'],
            'config.heroBannerTitle' => ['nullable', 'string', 'max:500'],
            'config.heroBannerSubtitle' => ['nullable', 'string', 'max:1000'],
            'config.heroBannerBadge' => ['nullable', 'string', 'max:255'],
            'config.heroBannerButtonText' => ['nullable', 'string', 'max:255'],
            'config.heroBannerHeight' => ['nullable', Rule::in(['compact', 'medium', 'large'])],
            'config.heroBannerOverlayOpacity' => ['nullable', 'integer', 'min:0', 'max:100'],
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
