<?php

namespace App\Support;

final class StoreProvisioningConfig
{
    /**
     * Canonicalize the configuration retained by the central draft.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function forCentralDraft(
        array $config,
        string $storeName,
        string $themeStyle,
    ): array {
        $config = StoreOnboardingAppearance::merge(
            $config,
            trim($storeName),
            $themeStyle,
            StoreOnboardingAppearance::extract($config),
        );
        $config = StorefrontSectionLayout::withoutLayout($config);
        unset($config['marketingBlocks']);

        return $config;
    }

    /**
     * Convert a central draft configuration into the server-owned initial workspace shape.
     *
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function fromCentralDraft(
        array $config,
        string $storeName,
        string $themeStyle,
    ): array {
        $config = self::forCentralDraft(
            $config,
            $storeName,
            $themeStyle,
        );
        $config = StorefrontSectionLayout::forProvisioning($config);

        return StorefrontMarketingBlocks::forProvisioning($config);
    }
}
