<?php

namespace App\Support;

final class StoreOnboardingAppearance
{
    /** @var list<string> */
    public const KEYS = [
        'slogan',
        'logoIcon',
        'primaryColor',
        'secondaryColor',
        'textColor',
        'bgColor',
        'cardBgColor',
        'borderColor',
        'fontFamily',
        'bannerText',
        'showHeroBanner',
        'heroBannerTitle',
        'heroBannerSubtitle',
        'heroBannerBadge',
        'heroBannerButtonText',
        'heroBannerHeight',
        'heroBannerOverlayOpacity',
    ];

    /**
     * Merge only the visual onboarding contract into the server-owned draft.
     *
     * @param  array<string, mixed>  $current
     * @param  array<string, mixed>  $appearance
     * @return array<string, mixed>
     */
    public static function merge(
        array $current,
        string $storeName,
        string $themeStyle,
        array $appearance,
    ): array {
        foreach (self::KEYS as $key) {
            if (array_key_exists($key, $appearance)) {
                $current[$key] = $appearance[$key];
            }
        }

        $current['storeName'] = $storeName;
        $current['themeStyle'] = $themeStyle;

        return $current;
    }

    /**
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public static function extract(array $config): array
    {
        return array_intersect_key($config, array_flip(self::KEYS));
    }
}
