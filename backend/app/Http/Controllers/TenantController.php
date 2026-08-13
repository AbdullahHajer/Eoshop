<?php

namespace App\Http\Controllers;

use App\Models\Domain;
use App\Models\Tenant;
use Exception;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class TenantController extends Controller
{
    /**
     * Register a new store (Tenant creation with isolated PostgreSQL DB)
     */
    public function registerStore(Request $request)
    {
        $validated = $request->validate([
            'storeName' => 'required|string|max:255',
            'ownerName' => 'required|string|max:255',
            'ownerEmail' => 'required|email|max:255',
            'businessType' => 'required|string',
            'subdomain' => 'required|string|alpha_dash|unique:domains,domain',
            'themeStyle' => 'required|in:elegant,tech',
            'config' => 'required|array',
            'docType' => 'nullable|string',
        ]);

        try {
            DB::beginTransaction();

            $subdomain = Str::slug($validated['subdomain']);
            $tenantId = 'store-'.Str::random(8);

            // 1. Create Tenant record in Central Platform Database
            $tenant = Tenant::create([
                'id' => $tenantId,
                'store_name' => $validated['storeName'],
                'owner_name' => $validated['ownerName'],
                'owner_email' => $validated['ownerEmail'],
                'business_type' => $validated['businessType'],
                'verification_status' => 'pending',
                'theme_style' => $validated['themeStyle'],
            ]);

            // 2. Attach Subdomain Domain
            $tenant->domains()->create([
                'domain' => $subdomain,
            ]);

            DB::commit();

            // 3. Initialize Store Config in the Newly Isolated Tenant Database
            $tenant->run(function () use ($validated) {
                DB::table('store_configs')->insert([
                    'id' => (string) Str::uuid(),
                    'config_json' => json_encode($validated['config']),
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            });

            return response()->json([
                'message' => 'تم إنشاء المتجر بنجاح وجاري إعداده للتفعيل',
                'tenant' => $tenant->load('domains'),
            ], 201);

        } catch (Exception $e) {
            if (DB::transactionLevel() > 0) {
                DB::rollBack();
            }
            report($e);

            return response()->json([
                'message' => 'تعذر إنشاء المتجر الآن. لم يكتمل طلب التأسيس.',
            ], 500);
        }
    }
}
