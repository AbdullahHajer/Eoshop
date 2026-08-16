<?php

namespace App\Support;

use App\Enums\ProductStatus;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;
use InvalidArgumentException;

final class ProductCatalogContract
{
    /**
     * @param  array<string, mixed>  $catalog
     */
    public static function validator(array $catalog, ?int $maxProducts, bool $legacyCompatibleIds = false): Validator
    {
        $normalized = $catalog;
        if (is_string($normalized['currencyCode'] ?? null)) {
            try {
                $normalized['currencyCode'] = CatalogMoney::normalizeCurrency($normalized['currencyCode']);
            } catch (InvalidArgumentException) {
                // The supported-currency rule will return the validation error.
            }
        }
        if (is_array($normalized['products'] ?? null)) {
            $normalized['products'] = array_map(static function (mixed $product) use ($legacyCompatibleIds): mixed {
                if (! is_array($product)) {
                    return $product;
                }
                if ($legacyCompatibleIds && isset($product['id']) && (! is_string($product['id']) || ! Str::isUuid($product['id']))) {
                    unset($product['id']);
                }
                if (! isset($product['basePrice']) && isset($product['price']) && (is_string($product['price']) || is_numeric($product['price']))) {
                    $product['basePrice'] = self::canonicalDecimal($product['price']);
                }
                $product['status'] ??= ProductStatus::Published->value;

                return $product;
            }, $normalized['products']);
        }

        $validator = ValidatorFacade::make($normalized, [
            'catalogRevision' => ['nullable', 'integer', 'min:1'],
            'currencyCode' => ['required', 'string', Rule::in(CatalogMoney::CURRENCIES)],
            'archiveProductIds' => ['sometimes', 'array', 'max:5000'],
            'archiveProductIds.*' => ['required', 'uuid', 'distinct:strict'],
            'products' => ['present', 'array', 'max:5000'],
            'products.*' => ['array:id,revision,status,name,price,basePrice,salePrice,description,category,imageKeyword,imageUrl,imageUrls,stockQuantity,manageStock,sku,lowStockThreshold'],
            'products.*.id' => ['nullable', 'uuid', 'distinct:strict'],
            'products.*.revision' => ['nullable', 'integer', 'min:1'],
            'products.*.status' => ['required', Rule::enum(ProductStatus::class)],
            'products.*.name' => ['required', 'string', 'max:255'],
            'products.*.price' => ['nullable'],
            'products.*.basePrice' => ['required', 'string', 'regex:/^(0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/'],
            'products.*.salePrice' => ['nullable', 'string', 'regex:/^(0|[1-9][0-9]{0,7})(?:\.[0-9]{1,2})?$/'],
            'products.*.description' => ['nullable', 'string', 'max:5000'],
            'products.*.category' => ['nullable', 'string', 'max:255'],
            'products.*.imageKeyword' => ['nullable', 'string', 'max:255'],
            'products.*.imageUrl' => ['nullable', 'string', 'max:2048'],
            'products.*.imageUrls' => ['nullable', 'array', 'max:8'],
            'products.*.imageUrls.*' => ['required', 'string', 'max:2048'],
            'products.*.stockQuantity' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
            'products.*.manageStock' => ['nullable', 'boolean'],
            'products.*.sku' => ['nullable', 'string', 'max:100'],
            'products.*.lowStockThreshold' => ['nullable', 'integer', 'min:0', 'max:1000000000'],
        ]);

        $validator->after(static function (Validator $validator) use ($normalized, $maxProducts): void {
            $products = is_array($normalized['products'] ?? null) ? $normalized['products'] : [];
            $archiveIds = is_array($normalized['archiveProductIds'] ?? null) ? $normalized['archiveProductIds'] : [];
            $liveProductCount = count(array_filter($products, static fn (mixed $product): bool => is_array($product)
                && ($product['status'] ?? ProductStatus::Published->value) !== ProductStatus::Archived->value));
            if ($maxProducts !== null && $liveProductCount > $maxProducts) {
                $validator->errors()->add('products', "The selected plan allows at most {$maxProducts} products.");
            }

            $seenSkus = [];
            foreach ($products as $index => $product) {
                if (! is_array($product)) {
                    continue;
                }
                $status = $product['status'] ?? null;
                $sku = is_string($product['sku'] ?? null) ? trim($product['sku']) : '';
                if ($status === ProductStatus::Published->value && $sku === '') {
                    $validator->errors()->add("products.{$index}.sku", 'A published product requires a SKU.');
                }
                if ($sku !== '') {
                    $key = mb_strtolower($sku);
                    if (isset($seenSkus[$key])) {
                        $validator->errors()->add("products.{$index}.sku", 'Product SKUs must be unique within the store.');
                    }
                    $seenSkus[$key] = true;
                }

                try {
                    $base = CatalogMoney::parse((string) ($product['basePrice'] ?? ''));
                    $saleValue = $product['salePrice'] ?? null;
                    if ($saleValue !== null && $saleValue !== '') {
                        $sale = CatalogMoney::parse((string) $saleValue);
                        if ($sale <= 0 || $sale >= $base) {
                            $validator->errors()->add("products.{$index}.salePrice", 'Sale price must be greater than zero and lower than base price.');
                        }
                    }
                } catch (InvalidArgumentException) {
                    // The field-level regex already reports the malformed amount.
                }

                foreach (array_values(array_unique(array_filter([
                    $product['imageUrl'] ?? null,
                    ...((array) ($product['imageUrls'] ?? [])),
                ], 'is_string'))) as $mediaIndex => $url) {
                    if (! self::validMediaReference($url)) {
                        $validator->errors()->add("products.{$index}.imageUrls.{$mediaIndex}", 'Product media must be HTTPS or a managed catalog-media URL.');
                    }
                }
            }

            $incomingIds = array_filter(array_column(array_filter($products, 'is_array'), 'id'), 'is_string');
            if (array_intersect($incomingIds, $archiveIds) !== []) {
                $validator->errors()->add('archiveProductIds', 'A product cannot be updated and archived in the same request.');
            }
        });

        return $validator;
    }

    public static function validMediaReference(string $url): bool
    {
        if (preg_match('#^/api/catalog-media/[a-z0-9-]+/[0-9a-f-]{36}$#i', $url) === 1) {
            return true;
        }

        return filter_var($url, FILTER_VALIDATE_URL) !== false
            && str_starts_with(mb_strtolower($url), 'https://');
    }

    /** @param array<string, mixed> $catalog */
    public static function normalize(array $catalog, bool $legacyCompatibleIds = false): array
    {
        $currency = CatalogMoney::normalizeCurrency((string) ($catalog['currencyCode'] ?? ''));
        $products = array_map(static function (mixed $product) use ($legacyCompatibleIds): mixed {
            if (! is_array($product)) {
                return $product;
            }
            if ($legacyCompatibleIds && isset($product['id']) && (! is_string($product['id']) || ! Str::isUuid($product['id']))) {
                unset($product['id']);
            }
            $product['basePrice'] = isset($product['basePrice'])
                ? self::canonicalDecimal($product['basePrice'])
                : self::canonicalDecimal($product['price'] ?? '');
            $product['salePrice'] = isset($product['salePrice']) && $product['salePrice'] !== ''
                ? self::canonicalDecimal($product['salePrice'])
                : null;
            $product['status'] ??= ProductStatus::Published->value;

            return $product;
        }, is_array($catalog['products'] ?? null) ? $catalog['products'] : []);

        return [
            'catalogRevision' => isset($catalog['catalogRevision']) ? (int) $catalog['catalogRevision'] : null,
            'currencyCode' => $currency,
            'products' => $products,
            'archiveProductIds' => array_values(is_array($catalog['archiveProductIds'] ?? null) ? $catalog['archiveProductIds'] : []),
        ];
    }

    private static function canonicalDecimal(mixed $value): string
    {
        if (is_int($value)) {
            return (string) $value;
        }
        if (is_float($value)) {
            return number_format($value, 2, '.', '');
        }

        return trim((string) $value);
    }
}
