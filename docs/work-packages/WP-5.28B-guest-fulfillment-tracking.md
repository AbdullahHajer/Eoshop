# WP 5.28B — Guest fulfillment and tracking

| الحقل | القيمة |
|---|---|
| الهدف | إكمال دورة الطلب الأولى بإدارة تجهيز وتوصيل يدوية صادقة ورابط تتبع آمن للضيف حتى إثبات التسليم |
| الحالة | اكتملت T0–T4 محليًا وأُغلقت أدلة T5؛ جاهزة للـCommit والرفع بعد اعتماد المالك، دون Push أو PR أو Merge |
| Base SHA | `74430e5294730620e5f71bf6fe2e101aa22ad852` |
| الفرع | `codex/wp5-28b-guest-fulfillment-tracking` |
| التاريخ | 2026-09-07 |

## سياق الحزمة

أغلق WP 5.28A تناقض إيصال `submitted` وفعّل مسار تشغيل checkout دون تغيير قيمته الآمنة افتراضيًا. يبقى النقص المانع للإطلاق أن العميل لا يملك قناة آمنة لمتابعة طلبه، وأن حالة الطلب التجارية الحالية لا تميز بين تجهيز الطلب وخروجه للتوصيل وإثبات استلامه. تعالج هذه الحزمة هذا النقص يدويًا في V1 دون شركة شحن أو حساب عميل.

## النطاق

1. إبقاء `OrderStatus` عقدًا تجاريًا، وإضافة دورة تنفيذ مستقلة: `unfulfilled → preparing → dispatched → delivered`، مع حالة تبنٍ داخلية `legacy_completed` للطلبات المكتملة قبل هذا العقد.
2. ربط قبول الطلب بالحجز القائم، ثم ربط بدء التجهيز بـ`processing` وإثبات التسليم بـ`completed` في معاملات ذرية.
3. إضافة سجل تنفيذ append-only بتسلسل وتوقيت وفاعل وسبب خادمي لكل محطة.
4. إنشاء capability عشوائية 256-bit لكل طلب جديد؛ يخزن الخادم digest للبحث ونسخة مشفرة لإعادة رابط idempotent نفسه، ولا يخزن النص الخام في نتيجة العملية أو السجلات.
5. إعادة رابط نسبي للضيف بعد checkout، وفتح صفحة تتبع من fragment لا يصل إلى الخادم أو access log.
6. تقديم إسقاط عام محدود: رقم الطلب، حالة الطلب، حالة التنفيذ، وأحداث زمنية آمنة فقط؛ لا PII ولا UUID داخلي ولا مبلغ أو عنوان أو مرجع دفع.
7. إضافة إجراءات التاجر المتتابعة «بدء التجهيز»، «خرج للتوصيل»، «تأكيد التسليم» مع صلاحيات الطلب الحالية وIdempotency-Key.
8. استمرار تتبع الطلب القائم على النطاق المرتبط نفسه بعد إلغاء النشر أو انتهاء الاشتراك، ما دام المتجر مهيأ تقنيًا ولم يُعد إسناد النطاق.

## العقد المعتمد

### دورة الطلب والتنفيذ

- الإنشاء: `submitted + unfulfilled`.
- القبول: `submitted → accepted`، وتبقى حالة التنفيذ `unfulfilled`.
- بدء التجهيز: `accepted + unfulfilled → processing + preparing` ذريًا.
- بدء التوصيل: `processing + preparing → processing + dispatched`.
- إثبات التسليم: `processing + dispatched → completed + delivered` ذريًا.
- الإلغاء أو انتهاء الحجز مسموحان من `submitted` فقط ويتركان التنفيذ `unfulfilled`.
- لا skip أو رجوع أو إعادة فتح أو إلغاء بعد commit المخزون.
- لا يسمح status endpoint العام بعد الحزمة بالانتقال المباشر إلى `processing` أو `completed`؛ يملك fulfillment writer هذين الاقترانين.
- الطلبات المكتملة قبل الحزمة تسقط إلى `legacy_completed` ولا تعرض للعميل على أنها تسليم مثبت.

### رابط الضيف

- الصيغة العامة في المتصفح `/track#token=<capability>`؛ fragment لا يدخل طلب HTTP.
- الاستعلام الخادمي لا يضع capability في path أو query. ينقلها في header محجوب عن URL.
- النص الخام لا يحفظ في localStorage أو sessionStorage أو cookie أو analytics أو DOM ظاهر.
- إعادة checkout بنفس Idempotency-Key تعيد الرابط نفسه دون وضعه في `order_operation_results.response_json`.
- capability خاطئة أو ناقصة أو منتهية أو تابعة لمتجر آخر تعطي الاستجابة العامة نفسها `404 order_tracking_not_found`.
- الرابط يبقى صالحًا ما دام الطلب غير نهائي، ثم 90 يومًا غير منزلقة من `delivered_at` أو `cancelled_at` أو `expired_at`.

### الإسقاط العام

يسمح فقط بـ:

- `number`
- `orderStatus`
- `fulfillmentStatus`
- `createdAt`
- `updatedAt`
- `timeline[] = { stage, occurredAt }`

ويمنع: معرف الطلب الداخلي، الاسم والهاتف والبريد والعنوان والملاحظات، المنتجات والمبالغ والقسائم، طريقة الدفع ومرجعها، معرفات الفاعلين والعمليات، وأسباب التاجر الداخلية.

## الحدود

- لا حسابات عملاء أو سجل طلبات قابل للبحث برقم الطلب.
- لا SMS أو بريد أو WhatsApp تلقائي.
- لا تكامل شركة شحن أو GPS أو ETA أو شحنة جزئية.
- لا إرجاع أو استبدال أو refund أو إلغاء بعد القبول.
- لا تغيير لعقد الدفع الحالي ولا Attribution أو Marketing Center.
- لا polling لحظي؛ تحميل من الخادم مع تحديث يدوي وإعادة تحقق آمنة عند عودة الصفحة يكفي V1.
- لا dependencies جديدة.

## مراحل التنفيذ

### T0 — Baseline وتدقيق العقود

- تثبيت base المدمج بعد PR #99.
- تدقيق status/history/idempotency/inventory والواجهة العامة ومسار التاجر.
- حجز tenant migration رقم `000010` وADR 0042.

### T1 — العقد والقرار

- اعتماد ADR 0042.
- تثبيت state machine، capability، الإسقاط، TTL، unpublish behavior وخطة التراجع.

### T2 — Backend authority

- migration وجداول التنفيذ والأحداث والوصول.
- token helper، tracking reader، exact-domain middleware والـrate limit.
- fulfillment mutation ذرية وإغلاق direct completion.
- اختبارات PostgreSQL للعزل والخصوصية وidempotency والقيود.

### T3 — Customer and merchant UI

- صفحة تتبع ضيف RTL ومتجاوبة وقابلة للوصول.
- CTA ونسخ الرابط من الإيصال الحي فقط.
- إجراءات التنفيذ المتتابعة في تفاصيل الطلب والتسميات الصادقة.
- حالات loading/error/expired/cancelled/legacy دون اختلاق أحداث.

### T4 — Regression and integration

- الاختبارات المركزة، Frontend quality/audit، Backend quality، Container integration و`git diff --check`.
- إثبات متجرين، token مزور، replay، checkout disabled، unpublish واستبعاد PII.

### T5 — Closeout

- تحديث الأدلة والحالة الحالية والأحجام.
- Commit/Push/PR Ready فقط بعد اعتماد المالك؛ لا Merge ضمن الحزمة دون أمر صريح.

## معايير القبول

1. لا يمكن الانتقال إلى `completed` لطلب جديد دون حدث `delivered` مقترن في المعاملة نفسها.
2. لا يغير الانتقال بعد قبول الطلب المخزون مرة ثانية.
3. يعيد replay رابط التتبع نفسه، ولا يظهر raw capability في قاعدة نتائج العمليات أو logs أو URL الخادم.
4. لا يستطيع token من متجر A قراءة طلب في متجر B، وجميع حالات الفشل غير القابلة للتمييز تعيد 404 موحدة.
5. صفحة التتبع لا تعرض أي PII أو مرجع دفع أو معرف داخلي، وتعرض الأحداث المثبتة فقط.
6. يبقى التتبع متاحًا بعد unpublish على النطاق المرتبط، بينما يبقى storefront/checkout مغلقين وفق قواعد النشر.
7. التاجر ذو `tenant.orders.view` يرى الحالة والسجل دون أزرار، و`tenant.orders.manage` فقط ينفذ المرحلة التالية.
8. preview لا ينشئ رابطًا ولا يتصل بتتبع حقيقي، والطلبات القديمة لا تُسمى «مُسلّمة» دون دليل.
9. تنجح البوابات الأربع على SHA واحد، مع تنظيف موارد التكامل.

## المخاطر والضوابط

- **تسريب capability:** fragment + header، no-store/no-referrer، عدم التخزين في browser storage أو operation result، وعدم كتابتها في الرسائل أو logs.
- **ادعاء تسليم قديم:** `legacy_completed` وعرض لغوي محايد.
- **انفصال order عن fulfillment:** قيود deferred وتحديث ذري وسجلان مرتبطان بالعملية نفسها عند preparing/delivered.
- **توقف التتبع عند إلغاء النشر:** middleware مستقل يفحص النطاق المرتبط وتهيئة schema، لا جاهزية النشر أو checkout flag.
- **تعداد الطلبات:** لا بحث بالرقم أو PII، digest مفهرس داخل tenant schema، 404 موحدة وrate limits.
- **تراجع يفقد دليلًا:** rollback بعد وجود أدلة fulfillment أو access مرفوض؛ التراجع التشغيلي forward-only مع إبقاء البيانات.

## سجل التحقق

- T0: الرأس `74430e5294730620e5f71bf6fe2e101aa22ad852`، الفرع مستقل ونظيف قبل التنفيذ.
- T1: اعتمد العقد أعلاه وADR 0042، وحُجز tenant migration رقم `000010`.
- T2: أضيفت حالة التنفيذ وسجلاتها غير القابلة للتعديل، capability عشوائية 256-bit مع digest ونسخة مشفرة، قارئ تتبع محدود، انتقالات تاجر ذرية، حماية exact-domain وrate limit قبل تهيئة tenant، وbackfill صادق للطلبات السابقة.
- T3: أضيفت صفحة تتبع الضيف من fragment، رابط ونسخ صريح من الإيصال الحي فقط، تحديث يدوي وإعادة تحقق واحدة عند bfcache، وتسلسل إجراءات التنفيذ وسجلها في مساحة التاجر. لا ينشئ preview رابطًا حقيقيًا.
- T4 — Repository safety: ناجحة.
- T4 — Frontend quality: ‏87 ملفًا و501 اختبار ناجح؛ TypeScript وبناء Vite ناجحان، و`npm audit` بلا ثغرات.
- T4 — Backend quality: Composer validate/audit ناجحان، Pint ‏319 ملفًا، Larastan ‏276/276 دون أخطاء، وPHPUnit الأساسي 3 اختبارات/6 assertions.
- T4 — Container integration: ‏187 اختبارًا و2,411 assertion على PostgreSQL، مع نجاح migrations وHTTP والـworker والـscheduler وتنظيف الحاويات والشبكة والـvolumes تلقائيًا.
- T4 — Security review: ناجحة بلا ملاحظات P0–P3؛ لا يظهر raw capability في DOM أو التخزين أو logs أو path/query، واستجابات 404/429 محمية بـ`no-store` و`no-referrer`.
- T4 — Build: JavaScript ‏1,128.13 kB (gzip ‏291.56 kB)، وCSS ‏194.22 kB (gzip ‏29.90 kB)، وصورة Hero الثابتة ‏819.42 kB. تحذير chunk الأكبر من 500 kB دين سابق غير مانع.
- T5: حُدثت وثائق الحزمة والحالة الحالية، ونجح `git diff --check`. بقي العمل محليًا غير ملتزم؛ لا Commit أو Push أو PR أو Merge.
