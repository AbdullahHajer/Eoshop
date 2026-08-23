<?php

namespace App\Support;

final class StoreOnboardingBaseline
{
    /** @return array<string, mixed> */
    public static function make(string $storeName): array
    {
        return [
            'storeName' => $storeName,
            'slogan' => 'كل ما تحتاجه في مكان واحد',
            'logoIcon' => '🛍️',
            'primaryColor' => '#0284C7',
            'secondaryColor' => '#0F172A',
            'textColor' => '#334155',
            'bgColor' => '#F8FAFC',
            'cardBgColor' => '#FFFFFF',
            'borderColor' => '#E2E8F0',
            'themeStyle' => 'elegant',
            'bannerText' => 'أهلاً بك في '.$storeName,
            'products' => [],
            'fontFamily' => 'Cairo',
            'phone' => null,
            'currency' => 'YER',
            'enableStockManagement' => true,
            'allowOrdersWhenOutOfStock' => false,
            'showStockBadge' => true,
            'lowStockWarningThreshold' => 5,
            'enableCashOnDelivery' => true,
            'cashOnDeliveryFee' => 0,
            'enableBankTransfer' => false,
            'enableOnlineCard' => false,
            'enableApplePay' => false,
            'enableStcPay' => false,
            'enableEWallets' => false,
            'customWallets' => [],
            'enableCoupons' => false,
            'customCoupons' => [],
            'enableWhatsAppNotification' => false,
        ];
    }
}
