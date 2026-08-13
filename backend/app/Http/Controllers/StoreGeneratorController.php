<?php

namespace App\Http\Controllers;

use App\Services\GeminiStoreGeneratorService;
use Exception;
use Illuminate\Http\Request;

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
            report($e);

            return response()->json([
                'message' => 'تعذر توليد الأفكار الآن. يرجى المحاولة لاحقاً.',
            ], 500);
        }
    }
}
