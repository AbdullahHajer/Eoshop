<?php

namespace App\Support;

use App\Exceptions\StoreWorkspaceConflict;
use App\Exceptions\StoreWorkspaceValidation;

final class StorefrontSectionLayout
{
    /** @return list<string> */
    public static function ids(): array
    {
        return ['hero', 'trust', 'categories', 'featured_products', 'about'];
    }

    /** @return list<array{id: string, visible: bool}> */
    public static function defaults(): array
    {
        return array_map(
            static fn (string $id): array => ['id' => $id, 'visible' => true],
            self::ids(),
        );
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function forProvisioning(array $config): array
    {
        $config['homeSections'] = self::defaults();

        return $config;
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function withoutLayout(array $config): array
    {
        unset($config['homeSections']);

        return $config;
    }

    /** @param array<string, mixed> $config
     * @return array<string, mixed>
     */
    public static function forProjection(array $config): array
    {
        if (! array_key_exists('homeSections', $config)) {
            $config['homeSections'] = self::defaults();

            return $config;
        }

        if (! self::isValid($config['homeSections'])) {
            throw new StoreWorkspaceConflict(
                'The stored storefront section layout is invalid.',
                'workspace_layout_invalid',
            );
        }

        return $config;
    }

    /**
     * @param  array<string, mixed>  $incoming
     * @param  array<string, mixed>  $current
     * @return array<string, mixed>
     */
    public static function forWrite(array $incoming, array $current): array
    {
        $currentHasLayout = array_key_exists('homeSections', $current);
        if ($currentHasLayout && ! self::isValid($current['homeSections'])) {
            throw new StoreWorkspaceConflict(
                'The stored storefront section layout is invalid.',
                'workspace_layout_invalid',
            );
        }

        if (! array_key_exists('homeSections', $incoming)) {
            if ($currentHasLayout) {
                throw new StoreWorkspaceValidation(
                    'The storefront section layout is required when updating this workspace.',
                    'workspace_layout_required',
                );
            }

            $incoming['homeSections'] = self::defaults();

            return $incoming;
        }

        if (! self::isValid($incoming['homeSections'])) {
            throw new StoreWorkspaceValidation(
                'The storefront section layout is invalid.',
            );
        }

        return $incoming;
    }

    public static function isValid(mixed $layout): bool
    {
        if (! is_array($layout) || ! array_is_list($layout) || count($layout) !== count(self::ids())) {
            return false;
        }

        $seen = [];
        $visible = false;
        foreach ($layout as $section) {
            if (! is_array($section) || array_diff(array_keys($section), ['id', 'visible']) !== []
                || array_diff(['id', 'visible'], array_keys($section)) !== []
                || ! is_string($section['id']) || ! in_array($section['id'], self::ids(), true)
                || ! is_bool($section['visible']) || isset($seen[$section['id']])) {
                return false;
            }
            $seen[$section['id']] = true;
            $visible = $visible || $section['visible'];
        }

        return count($seen) === count(self::ids()) && $visible;
    }
}
