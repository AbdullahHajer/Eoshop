<?php

namespace App\Services;

use App\Enums\OrderStatus;
use App\Enums\PermissionKey;
use App\Enums\ProductStatus;
use App\Exceptions\MerchantDashboardUnavailable;
use App\Models\Tenant;
use App\Models\User;
use App\Support\OrderReadiness;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\DB;
use JsonException;

class MerchantDashboardService
{
    /** @return array<string, mixed> */
    public function snapshot(Tenant $tenant, User $actor): array
    {
        if (! OrderReadiness::operationalCheck($tenant)) {
            throw new MerchantDashboardUnavailable;
        }

        $productsManage = $actor->hasTenantPermission($tenant, PermissionKey::TenantProductsManage);
        $visibility = [
            'orders' => $actor->hasTenantPermission($tenant, PermissionKey::TenantOrdersView),
            'inventory' => $actor->hasTenantPermission($tenant, PermissionKey::TenantInventoryView),
            'analytics' => $actor->hasTenantPermission($tenant, PermissionKey::TenantAnalyticsView),
            'productsManage' => $productsManage,
            'workspaceManage' => $productsManage
                && $actor->hasTenantPermission($tenant, PermissionKey::TenantStoreManage),
        ];

        return $tenant->run(function () use ($tenant, $visibility): array {
            $businessTimezone = (string) config('app.timezone');
            $now = CarbonImmutable::now($businessTimezone);
            $today = $now->startOfDay();
            $todayInstant = $today->utc();
            $tomorrowInstant = $today->addDay()->utc();
            $seriesStart = $today->subDays(6);
            $seriesStartInstant = $seriesStart->utc();
            $currencyCode = (string) DB::table('catalog_settings')->where('id', 1)->value('currency_code');
            if ($currencyCode === '') {
                throw new MerchantDashboardUnavailable;
            }

            $publishedProducts = null;
            $draftProducts = null;
            if ($visibility['productsManage']) {
                $productMetrics = DB::table('products')
                    ->whereIn('status', [ProductStatus::Published->value, ProductStatus::Draft->value])
                    ->selectRaw(
                        'SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS published_count,
                         SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS draft_count',
                        [ProductStatus::Published->value, ProductStatus::Draft->value],
                    )->first();
                $publishedProducts = (int) ($productMetrics->published_count ?? 0);
                $draftProducts = (int) ($productMetrics->draft_count ?? 0);
            }
            $lowStockProducts = null;
            if ($visibility['inventory']) {
                $lowStockProducts = DB::table('products')
                    ->where('status', '!=', ProductStatus::Archived->value)
                    ->where('manage_stock', true)
                    ->whereRaw('(stock_quantity - reserved_quantity) <= low_stock_threshold')
                    ->count();
            }

            $ordersToday = null;
            $openOrders = null;
            $submittedOrders = null;
            $recentOrders = [];
            $salesTodayMinor = null;
            if ($visibility['orders']) {
                $ordersToday = DB::table('orders')
                    ->where('created_at', '>=', $todayInstant)
                    ->where('created_at', '<', $tomorrowInstant)
                    ->count();
                $openMetrics = DB::table('orders')
                    ->whereIn('status', [
                        OrderStatus::Submitted->value,
                        OrderStatus::Accepted->value,
                        OrderStatus::Processing->value,
                    ])
                    ->selectRaw(
                        'COUNT(*) AS open_count,
                         SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) AS submitted_count',
                        [OrderStatus::Submitted->value],
                    )->first();
                $openOrders = (int) ($openMetrics->open_count ?? 0);
                $submittedOrders = (int) ($openMetrics->submitted_count ?? 0);
            }
            if ($visibility['analytics']) {
                $salesTodayMinor = (int) DB::table('orders')
                    ->where('status', OrderStatus::Completed->value)
                    ->where('completed_at', '>=', $todayInstant)
                    ->where('completed_at', '<', $tomorrowInstant)
                    ->sum('grand_total_minor');
            }

            if ($visibility['orders']) {
                $recentOrders = DB::table('orders')
                    ->latest('created_at')
                    ->latest('id')
                    ->limit(5)
                    ->get([
                        'id', 'order_number', 'status', 'payment_state', 'currency_code',
                        'grand_total_minor', 'created_at',
                    ])
                    ->map(static fn (object $order): array => [
                        'id' => (string) $order->id,
                        'number' => (string) $order->order_number,
                        'status' => (string) $order->status,
                        'paymentState' => (string) $order->payment_state,
                        'currencyCode' => (string) $order->currency_code,
                        'grandTotalMinor' => (int) $order->grand_total_minor,
                        'createdAt' => CarbonImmutable::parse((string) $order->created_at)->toIso8601String(),
                    ])->all();
            }

            $salesSeries = [];
            $topProducts = [];
            if ($visibility['analytics']) {
                $localSaleDate = 'timezone(?, completed_at)::date';
                $seriesByDate = DB::table('orders')
                    ->selectRaw("{$localSaleDate} AS sale_date, SUM(grand_total_minor) AS total_minor", [$businessTimezone])
                    ->where('status', OrderStatus::Completed->value)
                    ->where('completed_at', '>=', $seriesStartInstant)
                    ->where('completed_at', '<', $tomorrowInstant)
                    ->groupByRaw('1')
                    ->pluck('total_minor', 'sale_date');
                for ($offset = 0; $offset < 7; $offset++) {
                    $date = $seriesStart->addDays($offset)->toDateString();
                    $salesSeries[] = ['date' => $date, 'totalMinor' => (int) ($seriesByDate[$date] ?? 0)];
                }
                $topProducts = DB::table('order_items')
                    ->join('orders', 'orders.id', '=', 'order_items.order_id')
                    ->where('orders.status', OrderStatus::Completed->value)
                    ->where('orders.completed_at', '>=', $now->subDays(30))
                    ->where('orders.completed_at', '<=', $now)
                    ->groupBy('order_items.product_id')
                    ->orderByDesc('quantity')
                    ->orderBy('product_name')
                    ->limit(5)
                    ->get([
                        'order_items.product_id',
                        DB::raw('MAX(order_items.product_name) AS product_name'),
                        DB::raw('SUM(order_items.quantity) AS quantity'),
                    ])
                    ->map(static fn (object $product): array => [
                        'productId' => (string) $product->product_id,
                        'name' => (string) $product->product_name,
                        'quantity' => (int) $product->quantity,
                    ])->all();
            }

            $contactReady = true;
            if ($visibility['workspaceManage']) {
                try {
                    $config = json_decode(
                        (string) DB::table('store_configs')->where('is_current', true)->value('config_json'),
                        true,
                        512,
                        JSON_THROW_ON_ERROR,
                    );
                } catch (JsonException) {
                    throw new MerchantDashboardUnavailable;
                }
                $contactReady = is_array($config) && collect(['phone', 'whatsapp', 'email'])
                    ->contains(static fn (string $field): bool => isset($config[$field]) && trim((string) $config[$field]) !== '');
            }

            $tasks = [];
            if ($visibility['orders'] && $submittedOrders > 0) {
                $tasks[] = ['code' => 'orders_new', 'count' => $submittedOrders, 'section' => 'orders', 'priority' => 'high'];
            }
            if ($visibility['inventory'] && $lowStockProducts > 0) {
                $tasks[] = ['code' => 'inventory_low', 'count' => $lowStockProducts, 'section' => 'inventory', 'priority' => 'high'];
            }
            if ($visibility['productsManage'] && $draftProducts > 0) {
                $tasks[] = ['code' => 'products_draft', 'count' => $draftProducts, 'section' => 'products', 'priority' => 'medium'];
            }
            if ($visibility['workspaceManage'] && ! $contactReady) {
                $tasks[] = ['code' => 'store_contact_missing', 'count' => 1, 'section' => 'pages', 'priority' => 'medium'];
            }

            return [
                'tenantId' => (string) $tenant->getKey(),
                'generatedAt' => $now->toIso8601String(),
                'currencyCode' => $currencyCode,
                'visibility' => $visibility,
                'metrics' => [
                    'salesTodayMinor' => $salesTodayMinor,
                    'ordersToday' => $ordersToday,
                    'openOrders' => $openOrders,
                    'publishedProducts' => $publishedProducts,
                    'draftProducts' => $draftProducts,
                    'lowStockProducts' => $lowStockProducts,
                ],
                'tasks' => $tasks,
                'recentOrders' => $recentOrders,
                'salesSeries' => $salesSeries,
                'topProducts' => $topProducts,
            ];
        });
    }
}
