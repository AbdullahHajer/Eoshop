<?php

namespace App\Services;

use App\Enums\OrderPaymentState;
use App\Exceptions\OrderConflict;
use App\Support\CatalogMoney;
use App\Support\CheckoutPolicyContract;
use InvalidArgumentException;

final class OrderPricingService
{
    private const BASIS = 10_000;

    /**
     * @param  list<array{productId: string, quantity: int, product: object}>  $lines
     * @param  array<string, mixed>  $config
     * @return array<string, mixed>
     */
    public function quote(array $lines, array $config, string $currency, ?string $couponInput, string $paymentMethod, ?string $channelId): array
    {
        $items = [];
        $subtotal = 0;
        foreach ($lines as $line) {
            $product = $line['product'];
            $unit = (int) ($product->sale_price_minor ?? $product->base_price_minor);
            $quantity = (int) $line['quantity'];
            $lineTotal = $this->checkedAdd(0, $unit * $quantity);
            $subtotal = $this->checkedAdd($subtotal, $lineTotal);
            $items[] = [
                'productId' => (string) $product->id,
                'name' => (string) $product->name,
                'sku' => (string) $product->sku,
                'unitPriceMinor' => $unit,
                'quantity' => $quantity,
                'lineTotalMinor' => $lineTotal,
                'tracked' => (bool) $product->manage_stock,
            ];
        }

        [$couponCode, $couponBasisPoints] = $this->coupon($config, $couponInput);
        $discount = $this->percentage($subtotal, $couponBasisPoints);
        $discountedItems = $subtotal - $discount;
        $minimum = $this->money($config['minOrderAmount'] ?? 0, 'minOrderAmount');
        if ($discountedItems < $minimum) {
            throw new OrderConflict('The order does not meet the minimum amount.', 'order_minimum_not_met', 422);
        }

        $shippingFee = $this->money($config['shippingFee'] ?? 0, 'shippingFee');
        $freeAt = $this->money($config['freeShippingThreshold'] ?? 0, 'freeShippingThreshold');
        $shipping = $freeAt > 0 && $discountedItems >= $freeAt ? 0 : $shippingFee;
        $taxBasisPoints = $this->percentageSetting($config['taxRate'] ?? 0, 'taxRate');
        $tax = $this->percentage($discountedItems, $taxBasisPoints);
        [$paymentState, $paymentFee, $paymentChannelId, $paymentChannelLabel] = $this->payment($config, $paymentMethod, $channelId);
        $grand = $this->checkedAdd($this->checkedAdd($discountedItems, $shipping), $this->checkedAdd($tax, $paymentFee));

        return [
            'currencyCode' => CatalogMoney::normalizeCurrency($currency),
            'items' => $items,
            'itemsSubtotalMinor' => $subtotal,
            'discountMinor' => $discount,
            'shippingMinor' => $shipping,
            'taxMinor' => $tax,
            'paymentFeeMinor' => $paymentFee,
            'grandTotalMinor' => $grand,
            'couponCode' => $couponCode,
            'couponBasisPoints' => $couponBasisPoints,
            'paymentMethod' => $paymentMethod,
            'paymentState' => $paymentState->value,
            'paymentChannelId' => $paymentChannelId,
            'paymentChannelLabel' => $paymentChannelLabel,
        ];
    }

    /** @param array<string, mixed> $config @return array{?string, int} */
    private function coupon(array $config, ?string $input): array
    {
        $code = mb_strtoupper(trim((string) $input));
        if ($code === '') {
            return [null, 0];
        }
        if (! (bool) ($config['enableCoupons'] ?? false)) {
            throw new OrderConflict('Coupons are not enabled.', 'order_coupon_invalid', 422);
        }
        $matches = array_values(array_filter((array) ($config['customCoupons'] ?? []), static fn (mixed $coupon): bool => is_array($coupon)
            && ($coupon['active'] ?? false) === true
            && mb_strtoupper(trim((string) ($coupon['code'] ?? ''))) === $code));
        if (count($matches) !== 1) {
            throw new OrderConflict('The coupon is not valid.', 'order_coupon_invalid', 422);
        }

        return [$code, $this->percentageSetting($matches[0]['discountPercent'] ?? null, 'coupon')];
    }

    /** @param array<string, mixed> $config @return array{OrderPaymentState, int, ?string, ?string} */
    private function payment(array $config, string $method, ?string $channelId): array
    {
        if ($method === 'cod' && ($config['enableCashOnDelivery'] ?? false) === true) {
            return [OrderPaymentState::DueOnDelivery, $this->money($config['cashOnDeliveryFee'] ?? 0, 'cashOnDeliveryFee'), null, null];
        }
        if ($method === 'bank_transfer' && CheckoutPolicyContract::bankIsUsable($config)) {
            return [OrderPaymentState::TransferSubmittedUnverified, 0, 'bank_transfer', (string) $config['bankName']];
        }
        if ($method === 'wallet' && ($config['enableEWallets'] ?? false) === true && is_string($channelId)) {
            foreach ((array) ($config['customWallets'] ?? []) as $wallet) {
                if (is_array($wallet) && (string) ($wallet['id'] ?? '') === $channelId && CheckoutPolicyContract::walletIsUsable($wallet)) {
                    return [OrderPaymentState::TransferSubmittedUnverified, 0, $channelId, (string) ($wallet['name'] ?? 'Wallet')];
                }
            }
        }
        throw new OrderConflict('The selected payment method is unavailable.', 'order_payment_unavailable', 422);
    }

    private function money(mixed $value, string $field): int
    {
        try {
            if (is_int($value)) {
                return CatalogMoney::parse((string) $value);
            }
            if (is_float($value) && abs($value - round($value, 2)) < 0.000000001) {
                return CatalogMoney::parse(number_format($value, 2, '.', ''));
            }
            if (is_string($value)) {
                return CatalogMoney::parse(trim($value));
            }
        } catch (InvalidArgumentException) {
        }
        throw new OrderConflict("The checkout setting {$field} is invalid.", 'order_policy_invalid', 503);
    }

    private function percentageSetting(mixed $value, string $field): int
    {
        if (! is_int($value) && ! is_float($value) && ! is_string($value)) {
            throw new OrderConflict("The checkout setting {$field} is invalid.", 'order_policy_invalid', 503);
        }
        $numeric = filter_var($value, FILTER_VALIDATE_FLOAT);
        if ($numeric === false || $numeric < 0 || $numeric > 100 || abs($numeric * 100 - round($numeric * 100)) > 0.000000001) {
            throw new OrderConflict("The checkout setting {$field} is invalid.", 'order_policy_invalid', 503);
        }

        return (int) round($numeric * 100);
    }

    private function percentage(int $amount, int $basisPoints): int
    {
        return intdiv($amount * $basisPoints + intdiv(self::BASIS, 2), self::BASIS);
    }

    private function checkedAdd(int $left, int $right): int
    {
        $sum = $left + $right;
        if ($left < 0 || $right < 0 || $sum < 0 || $sum > (int) config('orders.max_total_minor')) {
            throw new OrderConflict('The order exceeds the supported amount.', 'order_amount_limit_exceeded', 422);
        }

        return $sum;
    }
}
