<?php

namespace App\Support;

use App\Models\Tenant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class OrderReadiness
{
    public static function check(Tenant $tenant): bool
    {
        return (bool) config('orders.checkout_enabled') && self::operationalCheck($tenant);
    }

    public static function operationalCheck(Tenant $tenant): bool
    {
        return TenantWorkspaceReadiness::check($tenant) && self::tablesReady($tenant);
    }

    public static function maintenanceCheck(Tenant $tenant): bool
    {
        return TenantWorkspaceReadiness::maintenanceCheck($tenant) && self::tablesReady($tenant);
    }

    private static function tablesReady(Tenant $tenant): bool
    {

        $ready = static fn (): bool => Schema::hasTable('order_operations')
            && Schema::hasTable('orders')
            && Schema::hasTable('order_items')
            && Schema::hasTable('order_addresses')
            && Schema::hasTable('payment_attempts')
            && Schema::hasTable('order_status_history')
            && Schema::hasTable('order_operation_results')
            && DB::table('store_configs')->where('is_current', true)->where('products_materialized', true)->count() === 1
            && DB::table('catalog_settings')->where('id', 1)->count() === 1;

        return tenancy()->initialized && (string) tenant('id') === (string) $tenant->getKey()
            ? $ready()
            : $tenant->run($ready);
    }
}
