<?php

namespace App\Support;

use App\Http\Requests\UpdateStoreWorkspaceRequest;
use Illuminate\Support\Facades\Validator as ValidatorFacade;
use Illuminate\Support\Str;
use Illuminate\Validation\Validator;
use JsonException;

final class StoreWorkspaceContract
{
    /** @param array<string, mixed> $config */
    public static function validator(array $config, ?int $maxProducts): Validator
    {
        $normalized = $config;
        if (is_array($normalized['products'] ?? null)) {
            $normalized['products'] = array_map(static function (mixed $product): mixed {
                if (is_array($product) && isset($product['id'])
                    && (! is_string($product['id']) || ! Str::isUuid($product['id']))) {
                    unset($product['id']);
                }

                return $product;
            }, $normalized['products']);
        }

        $validator = ValidatorFacade::make(
            ['revision' => 1, 'config' => $normalized],
            UpdateStoreWorkspaceRequest::contractRules(),
        );
        $validator->after(static function (Validator $validator) use ($config, $maxProducts): void {
            $products = is_array($config['products'] ?? null) ? $config['products'] : [];
            if ($maxProducts !== null && count($products) > $maxProducts) {
                $validator->errors()->add('config.products', "The selected plan allows at most {$maxProducts} products.");
            }

            $seenSkus = [];
            foreach ($products as $index => $product) {
                $sku = is_array($product) ? ($product['sku'] ?? null) : null;
                if (! is_string($sku) || trim($sku) === '') {
                    continue;
                }
                $normalizedSku = mb_strtolower(trim($sku));
                if (isset($seenSkus[$normalizedSku])) {
                    $validator->errors()->add("config.products.{$index}.sku", 'Product SKUs must be unique within the store.');
                }
                $seenSkus[$normalizedSku] = true;
            }

            try {
                $encoded = json_encode($config, JSON_THROW_ON_ERROR);
            } catch (JsonException) {
                $validator->errors()->add('config', 'The store workspace is not valid JSON.');

                return;
            }

            if (strlen($encoded) > 262_144) {
                $validator->errors()->add('config', 'The store workspace may not exceed 256 KiB.');
            }
        });

        return $validator;
    }
}
