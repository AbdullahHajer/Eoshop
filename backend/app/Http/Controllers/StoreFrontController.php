<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreFrontController extends Controller
{
    /**
     * Get Store Config for active tenant
     */
    public function getStoreConfig()
    {
        $configRecord = DB::table('store_configs')->latest()->first();

        if (! $configRecord) {
            return response()->json(['error' => 'إعدادات المتجر غير موجودة'], 404);
        }

        return response()->json(json_decode($configRecord->config_json, true));
    }

    /**
     * Update Store Config for active tenant
     */
    public function updateStoreConfig(Request $request)
    {
        $validated = $request->validate([
            'config' => 'required|array',
        ]);

        DB::table('store_configs')->insert([
            'id' => (string) Str::uuid(),
            'config_json' => json_encode($validated['config']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['message' => 'تم حفظ إعدادات المتجر بنجاح']);
    }

    /**
     * Create Order in Tenant Store Database
     */
    public function createOrder(Request $request)
    {
        $validated = $request->validate([
            'customerName' => 'required|string|max:255',
            'customerPhone' => 'required|string|max:50',
            'customerEmail' => 'nullable|email',
            'shippingAddress' => 'nullable|string',
            'totalAmount' => 'required|numeric',
            'paymentMethod' => 'required|string',
            'items' => 'required|array',
        ]);

        $orderId = (string) Str::uuid();

        DB::table('orders')->insert([
            'id' => $orderId,
            'customer_name' => $validated['customerName'],
            'customer_phone' => $validated['customerPhone'],
            'customer_email' => $validated['customerEmail'] ?? null,
            'shipping_address' => $validated['shippingAddress'] ?? null,
            'total_amount' => $validated['totalAmount'],
            'payment_method' => $validated['paymentMethod'],
            'status' => 'pending',
            'items_json' => json_encode($validated['items']),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'تم استلام الطلب بنجاح',
            'orderId' => $orderId,
        ], 201);
    }
}
