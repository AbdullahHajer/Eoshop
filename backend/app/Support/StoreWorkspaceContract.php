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
            ['revision' => 1, 'catalogRevision' => 1, 'config' => $normalized],
            UpdateStoreWorkspaceRequest::contractRules(),
        );
        $validator->after(static function (Validator $validator) use ($config, $maxProducts): void {
            $products = is_array($config['products'] ?? null) ? $config['products'] : [];
            $catalog = ProductCatalogContract::validator([
                'currencyCode' => $config['currency'] ?? null,
                'products' => $products,
                'archiveProductIds' => [],
            ], $maxProducts, true);
            foreach ($catalog->errors()->toArray() as $field => $messages) {
                foreach ($messages as $message) {
                    $validator->errors()->add('config.'.$field, $message);
                }
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
            CheckoutPolicyContract::appendErrors($validator, $config);
        });

        return $validator;
    }
}
