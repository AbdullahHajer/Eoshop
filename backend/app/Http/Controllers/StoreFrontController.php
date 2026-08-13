<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class StoreFrontController extends Controller
{
    /**
     * Get Store Config for the active tenant.
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
     * Update Store Config for the active tenant.
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
}
