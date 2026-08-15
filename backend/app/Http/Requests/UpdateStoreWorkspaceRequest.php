<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use JsonException;

class UpdateStoreWorkspaceRequest extends FormRequest
{
    /** @var list<string> */
    private const CONFIG_KEYS = [
        'storeName', 'slogan', 'logoIcon', 'logoUrl', 'logoType', 'logoSize',
        'primaryColor', 'secondaryColor', 'textColor', 'bgColor', 'cardBgColor', 'borderColor',
        'themeStyle', 'bannerText', 'products', 'fontFamily', 'phone', 'currency',
        'aboutTitle', 'aboutText', 'aboutVision', 'aboutImage', 'email', 'address', 'workingHours',
        'whatsapp', 'instagram', 'twitter', 'tiktok', 'snapchat',
        'showHeroBanner', 'heroBannerImage', 'heroBannerTitle', 'heroBannerSubtitle',
        'heroBannerBadge', 'heroBannerButtonText', 'heroBannerHeight', 'heroBannerOverlayOpacity',
        'enableStockManagement', 'allowOrdersWhenOutOfStock', 'showStockBadge', 'lowStockWarningThreshold',
        'checkoutTitle', 'checkoutSubtitle', 'checkoutNotice', 'requireEmail', 'requireAddressDetails',
        'enableCustomerNotes', 'minOrderAmount', 'freeShippingThreshold', 'shippingFee', 'taxRate',
        'enableCashOnDelivery', 'cashOnDeliveryFee', 'enableBankTransfer', 'bankName', 'bankAccountName',
        'bankIban', 'bankAccountNumber', 'enableOnlineCard', 'enableApplePay', 'enableStcPay',
        'enableEWallets', 'customWallets', 'enableCoupons', 'customCoupons', 'thankYouTitle',
        'thankYouMessage', 'enableWhatsAppNotification',
    ];

    /** @return array<string, list<mixed>> */
    public static function contractRules(): array
    {
        $shortText = ['nullable', 'string', 'max:255'];
        $longText = ['nullable', 'string', 'max:5000'];
        $money = ['nullable', 'numeric', 'min:0', 'max:999999999.99'];
        $boolean = ['nullable', 'boolean'];
        $httpUrl = ['nullable', 'url:https', 'max:2048'];

        return [
            'revision' => ['required', 'integer', 'min:1'],
            'config' => ['required', 'array:'.implode(',', self::CONFIG_KEYS)],
            'config.storeName' => ['required', 'string', 'max:255'],
            'config.slogan' => ['required', 'string', 'max:500'],
            'config.logoIcon' => ['required', 'string', 'max:32'],
            'config.logoUrl' => $httpUrl,
            'config.logoType' => ['nullable', Rule::in(['icon', 'image'])],
            'config.logoSize' => ['nullable', 'integer', 'min:16', 'max:512'],
            'config.primaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.secondaryColor' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.textColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.bgColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.cardBgColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.borderColor' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'config.themeStyle' => ['required', Rule::in(['elegant', 'tech'])],
            'config.bannerText' => ['required', 'string', 'max:1000'],
            'config.fontFamily' => ['required', 'string', 'max:100'],
            'config.phone' => ['required', 'string', 'max:50'],
            'config.currency' => ['required', 'string', 'max:20'],
            'config.aboutTitle' => $shortText,
            'config.aboutText' => $longText,
            'config.aboutVision' => $longText,
            'config.aboutImage' => $httpUrl,
            'config.email' => ['nullable', 'email', 'max:255'],
            'config.address' => ['nullable', 'string', 'max:1000'],
            'config.workingHours' => $shortText,
            'config.whatsapp' => $shortText,
            'config.instagram' => $shortText,
            'config.twitter' => $shortText,
            'config.tiktok' => $shortText,
            'config.snapchat' => $shortText,
            'config.showHeroBanner' => $boolean,
            'config.heroBannerImage' => $httpUrl,
            'config.heroBannerTitle' => ['nullable', 'string', 'max:500'],
            'config.heroBannerSubtitle' => ['nullable', 'string', 'max:1000'],
            'config.heroBannerBadge' => $shortText,
            'config.heroBannerButtonText' => $shortText,
            'config.heroBannerHeight' => ['nullable', Rule::in(['compact', 'medium', 'large'])],
            'config.heroBannerOverlayOpacity' => ['nullable', 'integer', 'min:0', 'max:100'],
            'config.enableStockManagement' => $boolean,
            'config.allowOrdersWhenOutOfStock' => $boolean,
            'config.showStockBadge' => $boolean,
            'config.lowStockWarningThreshold' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'config.checkoutTitle' => ['nullable', 'string', 'max:500'],
            'config.checkoutSubtitle' => ['nullable', 'string', 'max:1000'],
            'config.checkoutNotice' => ['nullable', 'string', 'max:1000'],
            'config.requireEmail' => $boolean,
            'config.requireAddressDetails' => $boolean,
            'config.enableCustomerNotes' => $boolean,
            'config.minOrderAmount' => $money,
            'config.freeShippingThreshold' => $money,
            'config.shippingFee' => $money,
            'config.taxRate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'config.enableCashOnDelivery' => $boolean,
            'config.cashOnDeliveryFee' => $money,
            'config.enableBankTransfer' => $boolean,
            'config.bankName' => $shortText,
            'config.bankAccountName' => $shortText,
            'config.bankIban' => $shortText,
            'config.bankAccountNumber' => $shortText,
            'config.enableOnlineCard' => $boolean,
            'config.enableApplePay' => $boolean,
            'config.enableStcPay' => $boolean,
            'config.enableEWallets' => $boolean,
            'config.customWallets' => ['nullable', 'array', 'max:25'],
            'config.customWallets.*' => ['array:id,name,accountNumber,accountName,icon,badge,active,bgColor'],
            'config.customWallets.*.id' => ['required', 'string', 'max:100'],
            'config.customWallets.*.name' => ['required', 'string', 'max:255'],
            'config.customWallets.*.accountNumber' => ['required', 'string', 'max:255'],
            'config.customWallets.*.accountName' => $shortText,
            'config.customWallets.*.icon' => ['nullable', 'string', 'max:32'],
            'config.customWallets.*.badge' => $shortText,
            'config.customWallets.*.active' => $boolean,
            'config.customWallets.*.bgColor' => $shortText,
            'config.enableCoupons' => $boolean,
            'config.customCoupons' => ['nullable', 'array', 'max:100'],
            'config.customCoupons.*' => ['array:code,discountPercent,active'],
            'config.customCoupons.*.code' => ['required', 'string', 'max:50', 'regex:/^[A-Za-z0-9_-]+$/'],
            'config.customCoupons.*.discountPercent' => ['required', 'numeric', 'min:0', 'max:100'],
            'config.customCoupons.*.active' => ['required', 'boolean'],
            'config.thankYouTitle' => ['nullable', 'string', 'max:500'],
            'config.thankYouMessage' => $longText,
            'config.enableWhatsAppNotification' => $boolean,
            'config.products' => ['present', 'array', 'max:5000'],
            'config.products.*' => ['array:id,name,price,description,category,imageKeyword,imageUrl,imageUrls,stockQuantity,manageStock,sku,lowStockThreshold'],
            'config.products.*.id' => ['nullable', 'uuid', 'distinct:strict'],
            'config.products.*.name' => ['required', 'string', 'max:255'],
            'config.products.*.price' => ['required', 'numeric', 'min:0', 'max:99999999.99'],
            'config.products.*.description' => $longText,
            'config.products.*.category' => $shortText,
            'config.products.*.imageKeyword' => $shortText,
            'config.products.*.imageUrl' => $httpUrl,
            'config.products.*.imageUrls' => ['nullable', 'array', 'max:8'],
            'config.products.*.imageUrls.*' => ['required', 'url:https', 'max:2048'],
            'config.products.*.stockQuantity' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'config.products.*.manageStock' => $boolean,
            'config.products.*.sku' => ['nullable', 'string', 'max:100'],
            'config.products.*.lowStockThreshold' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
        ];
    }

    /** @return array<string, list<mixed>> */
    public function rules(): array
    {
        return self::contractRules();
    }

    /** @return list<callable(Validator): void> */
    public function after(): array
    {
        return [function (Validator $validator): void {
            try {
                $encoded = json_encode($this->input('config'), JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                $validator->errors()->add('config', 'The store workspace is not valid JSON.');

                return;
            }

            if (strlen($encoded) > 262_144) {
                $validator->errors()->add('config', 'The store workspace may not exceed 256 KiB.');
            }

            $seenSkus = [];
            foreach ((array) $this->input('config.products', []) as $index => $product) {
                $sku = is_array($product) ? ($product['sku'] ?? null) : null;
                if (! is_string($sku) || trim($sku) === '') {
                    continue;
                }
                $normalized = mb_strtolower(trim($sku));
                if (isset($seenSkus[$normalized])) {
                    $validator->errors()->add("config.products.{$index}.sku", 'Product SKUs must be unique within the store.');
                }
                $seenSkus[$normalized] = true;
            }
        }];
    }
}
