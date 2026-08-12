<?php

namespace App\Services;

use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use JsonException;

class GeminiStoreGeneratorService
{
    protected string $apiKey;

    protected string $baseUrl;

    protected string $model;

    protected int $timeout;

    public function __construct()
    {
        $this->apiKey = (string) config('services.gemini.api_key', '');
        $this->baseUrl = rtrim((string) config('services.gemini.base_url'), '/');
        $this->model = (string) config('services.gemini.model');
        $this->timeout = (int) config('services.gemini.timeout', 30);
    }

    /**
     * Generate Store branding and products using Google Gemini API
     *
     * @throws Exception
     */
    public function generateStoreIdeas(string $description): array
    {
        if (empty($this->apiKey) || $this->apiKey === 'YOUR_GEMINI_API_KEY_HERE') {
            throw new Exception('مفتاح Gemini API غير معرف في ملف الإعدادات .env');
        }

        if (! preg_match('/^[A-Za-z0-9._-]+$/', $this->model)) {
            throw new Exception('اسم نموذج Gemini غير صالح');
        }

        $systemInstruction = 'أنت خبير في التجارة الإلكترونية وتصميم الهويات البصرية للمتاجر السعودية والخليجية. مهمتك هي مساعدة المستخدم في توليد هوية كاملة لمتجره الإلكتروني الجديد بناءً على الوصف المقدم باللغة العربية. يجب أن ترجع النتيجة ككائن JSON ملتزم تماماً بالهيكل المطلوب، باللغة العربية الفصحى الأنيقة والجذابة للمشترين.';

        $prompt = "أريد فكرة متجر وتفاصيل كاملة بناءً على هذا الوصف: \"{$description}\". قم بإنشاء اسم متجر جذاب وعصري، شعار قصير ومميز (Slogan)، ألوان متناسقة، وقائمة بـ 4 منتجات متميزة وواقعية مع أسعارها بالريال السعودي (SAR).";

        $responseSchema = [
            'type' => 'OBJECT',
            'required' => ['storeName', 'slogan', 'primaryColor', 'secondaryColor', 'themeStyle', 'bannerText', 'products'],
            'properties' => [
                'storeName' => ['type' => 'STRING', 'description' => 'اسم تجاري مميز للمتجر باللغة العربية (مثال: نكهة الهيل، عبير العود)'],
                'slogan' => ['type' => 'STRING', 'description' => 'شعار لفظي قصير وجذاب (مثال: شغف القهوة في كل كوب، سحر الشرق بين يديك)'],
                'primaryColor' => ['type' => 'STRING', 'description' => 'رمز لون أساسي متناسق بنظام Hex (مثال: #8B5A2B للقهوة، #D4AF37 للذهب والعطور)'],
                'secondaryColor' => ['type' => 'STRING', 'description' => 'رمز لون فرعي متناسق بنظام Hex (مثال: #fdfaf6 أو #1e293b)'],
                'themeStyle' => ['type' => 'STRING', 'description' => "أسلوب تصميم القالب: 'elegant' أو 'tech'"],
                'bannerText' => ['type' => 'STRING', 'description' => 'عبارة ترحيبية أو عرض ترويجي للواجهة (مثال: خصم 20% على أول طلب)'],
                'products' => [
                    'type' => 'ARRAY',
                    'description' => 'قائمة من 4 منتجات أساسية لبدء المتجر',
                    'items' => [
                        'type' => 'OBJECT',
                        'required' => ['name', 'price', 'description', 'category', 'imageKeyword'],
                        'properties' => [
                            'name' => ['type' => 'STRING', 'description' => 'اسم المنتج بالتفصيل'],
                            'price' => ['type' => 'NUMBER', 'description' => 'سعر المنتج بالريال السعودي كرقم'],
                            'description' => ['type' => 'STRING', 'description' => 'وصف تسويقي مغري وقصير'],
                            'category' => ['type' => 'STRING', 'description' => 'التصنيف الفرعي للمنتج'],
                            'imageKeyword' => ['type' => 'STRING', 'description' => 'كلمة مفتاحية بالإنجليزية مناسبة لصورة المنتج (مثال: coffee-beans, perfume, oud-wood, smartwatch)'],
                        ],
                    ],
                ],
            ],
        ];

        $payload = [
            'contents' => [
                [
                    'parts' => [
                        ['text' => $prompt],
                    ],
                ],
            ],
            'systemInstruction' => [
                'parts' => [
                    ['text' => $systemInstruction],
                ],
            ],
            'generationConfig' => [
                'responseMimeType' => 'application/json',
                'responseSchema' => $responseSchema,
            ],
        ];

        $endpoint = "{$this->baseUrl}/models/{$this->model}:generateContent";

        $response = Http::acceptJson()
            ->asJson()
            ->withHeaders([
                'x-goog-api-key' => $this->apiKey,
                'User-Agent' => 'eoshop-saas',
            ])
            ->timeout($this->timeout)
            ->retry(2, 250, throw: false)
            ->post($endpoint, $payload);

        if ($response->failed()) {
            Log::error('Gemini API request failed', [
                'status' => $response->status(),
                'model' => $this->model,
                'request_id' => $response->header('x-request-id'),
            ]);
            throw new Exception('فشل التواصل مع خدمة الذكاء الاصطناعي Gemini');
        }

        $responseData = $response->json();
        $textResult = $responseData['candidates'][0]['content']['parts'][0]['text'] ?? null;

        if (! $textResult) {
            throw new Exception('لم يتم إرجاع أي نتائج من الذكاء الاصطناعي');
        }

        try {
            $decoded = json_decode($textResult, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException $exception) {
            Log::warning('Gemini returned invalid JSON', [
                'model' => $this->model,
                'error' => $exception->getMessage(),
            ]);

            throw new Exception('أرجعت خدمة الذكاء الاصطناعي استجابة غير صالحة');
        }

        if (! is_array($decoded)) {
            throw new Exception('أرجعت خدمة الذكاء الاصطناعي استجابة غير صالحة');
        }

        return $decoded;
    }
}
