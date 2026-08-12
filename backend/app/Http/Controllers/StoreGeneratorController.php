<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Services\GeminiStoreGeneratorService;
use Exception;

class StoreGeneratorController extends Controller
{
    protected GeminiStoreGeneratorService $geminiService;

    public function __construct(GeminiStoreGeneratorService $geminiService)
    {
        $this->geminiService = $geminiService;
    }

    public function generate(Request $request)
    {
        $request->validate([
            'description' => 'required|string|min:3|max:1000',
        ], [
            'description.required' => 'الرجاء إدخال وصف صحيح للمتجر',
        ]);

        try {
            $storeData = $this->geminiService->generateStoreIdeas($request->input('description'));
            return response()->json($storeData);
        } catch (Exception $e) {
            return response()->json([
                'error' => $e->getMessage() ?: 'فشل توليد الأفكار، يرجى المحاولة لاحقاً'
            ], 500);
        }
    }
}
