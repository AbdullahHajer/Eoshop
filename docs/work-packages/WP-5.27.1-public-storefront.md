# WP 5.27.1 — تقييم واجهة المتجر والقالب الأساسي الفاخر

| الحقل | القيمة |
|---|---|
| النقطة | T4 — Quality, integration and handoff evidence |
| الحالة | T4 complete — البوابات الأربع ناجحة؛ متوقف قبل T5 لاعتماد المالك |
| Baseline SHA | `1621417d74f324a4b570f3a7ffa5e27d96bc1c4d` |
| الفرع | `codex/wp5-27-1-public-storefront` |
| تاريخ التقييم | 2026-08-30 |

تحقق T0 بعد `git fetch upstream`: كل من `main` و`origin/main` و`upstream/main` عند SHA أعلاه. الفرع الحالي هو `codex/wp5-27-1-public-storefront`، وكانت الحالة عند آخر تحقق:

```text
## codex/wp5-27-1-public-storefront
 M docs/README.md
?? docs/work-packages/WP-5.27.1-public-storefront.md
```

كانت التغييرات عند قبول T0 توثيقًا فقط. بدأ التنفيذ بعد قرار مالك المشروع المؤرخ في 2026-08-29.

## قرار الانتقال من T0

قُبل T0 للانتقال إلى التنفيذ. لا يعد غياب جلسة Browser أو Computer Use مانعًا للعمل، وسُجلت عناصر الدليل اليدوي المؤجلة تحت الوسم المطلوب:

`DEFERRED-QA-VISUAL-RESPONSIVE-NETWORK`

- لقطات إضافية بعرض 390px.
- التصوير من هاتف فعلي.
- تسجيل أو تصوير طلبات Network الفعلية.
- المقارنات البصرية التفصيلية قبل/بعد.

تبقى الاستجابة للجوال وخصائص الصور والاختبارات الآلية ضمن التنفيذ؛ المؤجل هو الدليل اليدوي أعلاه فقط.

## T1 — العقود والحدود المعتمدة

### مسار الرحلة المشترك

```text
Host غير مركزي
  -> GET /api/store/config
  -> PublicStorefrontScreen (loading/error/ready)
  -> StorePreview renderer (live أو preview)
  -> StorefrontHome -> StorefrontProductDetail -> Cart -> Checkout
  -> POST /api/store/orders
  -> OrderReceipt خادمي
```

### الملكية وحدود القالب

| الجزء | الملكية المعتمدة | قرار T1 |
|---|---|---|
| تحديد المستأجر والنشر | middleware ومسارات Laravel tenant | مشترك، بلا تغيير عقد |
| هوية المتجر والكتالوج | `StorefrontBootstrap` من الخادم | مشترك، لا مصدر بيانات ثانٍ |
| السعر والمخزون والطلب | `OrderService` وخدمات التسعير والحجز | الخادم هو السلطة النهائية |
| السلة | حالة React مؤقتة مع قيود مشتقة من snapshot العام | مشتركة بين live وpreview؛ لا سعر موثوق في العميل |
| renderer | `StorePreview` ومكوناته المستخرجة الحالية | واحد للواجهة العامة والمعاينة |
| Elegant | التخطيط والهوية والعرض والحالات المرئية | طبقة عرض فقط؛ لا منطق طلب مستقل |
| القالب الثاني | خارج WP 5.27.1 | مؤجل، ولا ينشأ fork الآن |

### خطة T2 الدقيقة

1. توحيد قواعد قابلية البيع والكمية في workflow مشترك للسلة.
2. منع إضافة draft/archived أو منتج نفد مخزونه، وتقييد الزيادة بالمخزون العام المتاح.
3. استخدام المعالجة نفسها في المتجر العام والمعاينة، مع إبقاء تحقق الخادم نهائيًا.
4. عرض حالة واضحة إذا اختفى المنتج المحدد بدل الانتقال الصامت إلى منتج آخر.
5. إثبات رحلة home -> product -> cart -> server order باختبار واجهة مركز، وإعادة تشغيل اختبارات التكامل الخادمية للعزل والسعر والمخزون والطلب.

لا تتطلب هذه الخطة Migration أو تغيير `GET /api/store/config` أو `POST /api/store/orders` أو ADR.

## 1. الهدف والنطاق

تقييم واجهة المتجر العامة كما يراها العميل، ثم تحسين القالب الأساسي الفاخر فوق renderer وعقد `storefront bootstrap` الحاليين. يركز التنفيذ المقترح على نقطة الدخول وحالات التحميل والخطأ، والهيدر والهوية والصفحة الرئيسية وقائمة المنتجات وبطاقاتها والتذييل، مع RTL والجوال ولوحة المفاتيح والتباين والحركة المخفّضة.

الأولوية للقالب الحالي `themeStyle=elegant` بوصفه خط القالب الأساسي. لا تشمل هذه الحزمة إنشاء قالب ثالث أو تحقيق التمييز الكامل بين `elegant` و`tech`؛ ذلك محجوز لـ WP 5.27.2.

## 2. السلوك قبل / بعد

### قبل — مثبت من المصدر والاختبارات

- يحدد `App.tsx` المضيف غير المركزي، ثم يحمل متجر المستأجر مع محاولة استرداد واحدة محدودة للأخطاء العابرة.
- تعرض `PublicStorefrontScreen` حالات loading/error/ready، ورابط تخطي، ومنطقة `main`، وإعادة المحاولة دون صفحة نهائية فارغة.
- يمر العرض الجاهز إلى `StorePreview` في وضع `live`، ويستخدم `StorefrontHome` و`StorefrontProductDetail` مع الإبقاء على السلة والطلب الخادمي القائمين.
- يعرض `StorefrontHome` الأقسام الخمسة المملوكة للخادم بالترتيب المحفوظ: `hero`, `trust`, `categories`, `featured_products`, `about`، ويحذف draft/archived ولا يخترع منتجات أو وعود خدمة.
- توجد رؤوس وتنقلات منفصلة للقالبين، قائمة منتجات، صفحات عن المتجر والتواصل والمنتج، تذييل، وسلة قابلة للوصول مع تنقل جوال ثابت.

### بعد — منفذ في T3/T4

- واجهة أساسية فاخرة متماسكة بصريًا تحترم إعدادات الهوية المحفوظة فعليًا عبر الصفحة الرئيسية والهيدر والبطاقات والتذييل.
- hero آمن التباين في كامل مجال التعتيم المسموح، ويطبق ارتفاع الواجهة المحفوظ.
- بطاقات ومنظومة صور أوضح وأخف دون تغيير حقيقة المنتج أو قواعد السعر والمخزون.
- دليل قبل/بعد قابل لإعادة الإنتاج على سطح المكتب والجوال، مع عدم تراجع الوصول أو الأداء.

## 3. الموجود، الفجوات، الطبقة المالكة وإعادة الاستخدام

| المساحة | الموجود حاليًا | الفجوة المثبتة | الطبقة المالكة | ما سيعاد استخدامه |
|---|---|---|---|---|
| دخول المتجر | كشف المضيف، bootstrap قابل للإلغاء، retry محدود، وحالات loading/error/ready | لا توجد فجوة عقد مثبتة؛ الدليل المرئي معلّق لاتصال المتصفح | `App.tsx`, `hostRouting`, `publicStorefrontRecovery`, `PublicStorefrontScreen` | المسار كاملًا دون إنشاء bootstrap ثانٍ |
| عقد البيانات | `GET /api/store/config` يعيد revisions و`StoreConfig` بعد إسقاط البيانات غير العامة | لا توجد حاجة مثبتة لتوسيع العقد | Laravel `StoreFrontController` و`StoreWorkspaceService`، و`orderApi` | DTO والمحوّل الصارم الحاليان |
| ترتيب الرئيسية | خمسة أقسام خادمية، ترتيب/إظهار محفوظ، وحالات فارغة صادقة | لا تطبق الرئيسية `heroBannerHeight` رغم أن المحرر والخادم يقبلانه؛ كما تثبت الشفرة أن عدة أسطح تستخدم white/slate ثابتة بدل `cardBgColor` و`borderColor` و`textColor` المحفوظة | `StorefrontHome` داخل renderer | `StorefrontSectionLayout` و`storefrontSectionsOrDefault` |
| hero | عنوان ووصف وزر وصورة وتعتيم من bootstrap | يسمح العقد بتعتيم `0..100` بينما تصبح الكتابة بيضاء فوق أي صورة بلا حد أدنى أو سطح حماية؛ الاختبار الحالي يثبت تبديل طبقة الصورة فقط ولا يثبت تباين النص | `StorefrontHome` مع أدوات `readableForeground/readableAccent` | الصورة والنص والزر وإعداد التعتيم الحالي |
| المنتجات | المنشور فقط، بحث وفئات وتفاصيل وسعر وعرض توفر صادق في صفحة التفاصيل | بطاقة الرئيسية لا تعرض وصفًا أو فئة أو توفر، وبطاقة القائمة تعرض شارة فئة حتى إذا كانت فارغة؛ لا يوجد اختبار مباشر مستقل لـ`StorefrontProductDetail` | `StorefrontHome`, `StorePreview`, `StorefrontProductDetail`, `ProductArt` | `Product` وcatalog projection ومعالجات الفتح/الإضافة الحالية |
| الصور والأداء | صور hero/about/product من إعدادات وكتالوج الخادم | صور الواجهة والمنتجات لا تحدد lazy/decoding أو سياسة أحجام؛ البناء الحالي يخرج أصلًا ثابتًا حجمه `819.42 kB` | مكونات العرض وخط بناء Vite | URLs وسياسة `no-referrer` وبدائل SVG الحالية |
| الهيدر والتذييل والجوال | هوية، تنقل، اتصال/سلة، dock جوال، حقوق ونسبة المنصة الاختيارية | التذييل الحالي يقتصر على الحقوق ونسبة المنصة؛ لا يوجد اختبار بصري مباشر للهيدر/التذييل أو مصفوفة responsive حديثة لهذه الحزمة | `StorePreview` | التنقل والحالة الداخلية وإعداد attribution الحالية |
| قابلية الصيانة | الصفحة الرئيسية والتفاصيل مستخرجان بالفعل | `StorePreview.tsx` ما يزال `119,736` بايت ونحو 2,080 سطرًا، ويجمع الصفحات والرؤوس والسلة وcheckout؛ أي تعديل واسع فيه يرفع خطر التراجع | واجهة React | استخراج محدود فقط إذا كان لازمًا للتغيير، بلا refactor واسع |
| الاختبارات | تغطية bootstrap، الصدق، ترتيب الأقسام، الوصول، الحركة المخفّضة والسلة/الطلب | لا توجد اختبارات لارتفاع hero، تباين hero المصور عند الحدود، تطبيق ألوان الأسطح، تفاصيل المنتج مستقلًا، أو visual regression | Vitest + Pilot | الملفات الحالية وإضافة حالات قريبة فقط |

ملاحظة: أوصاف «الفخامة» أو جودة التوازن والمسافات واله hierarchy البصرية لم تُسجّل كعيوب مثبتة بعد، لأنها تحتاج مشاهدة فعلية ولقطات من متجر منشور.

### حدود الفصل المقترحة لهذه الحزمة فقط

لا تقترح T0 إعادة كتابة `StorePreview`. إذا أثبتت اللقطات الحاجة، يقتصر الفصل على:

1. `StorefrontHeader`: فرعا header والتنقل الحاليان مع نفس props والحالة والمعالجات الموجودة.
2. `StorefrontHero`: قسم hero الموجود داخل `StorefrontHome` لتطبيق الارتفاع والتباين واختباره بمعزل.
3. `StorefrontProductGrid`: عنوان/بحث/فئات/بطاقات صفحة المنتجات، دون نقل catalog أو cart authority.
4. `StorefrontFooter`: الحقوق وplatform attribution وأي روابط متجر صادقة يثبت اعتمادها.

يبقى `StorePreview` هو renderer الجامع وحامل حالة الصفحة والسلة، وتستخدمه الواجهة العامة (`PublicStorefrontScreen` بوضع `live`) والمعاينة (`OnboardingStorePreview` ومواضع المعاينة داخل `App` بوضع `preview`). المكونات المستخرجة ستكون presentational وتستقبل `StoreConfig` والحالة والمعالجات نفسها؛ لا عقد ثانٍ ولا fork للواجهة العامة.

## 4. API وقواعد العمل والصلاحيات

- لا تغيير مقترح على `GET /api/store/config` أو `POST /api/store/orders`.
- تبقى Laravel سلطة النشر، المنتجات، الأسعار، المخزون، وسائل الدفع والطلب.
- يبقى bootstrap العام قراءة بلا جلسة على نطاق منشور فقط، خلف middleware تهيئة المستأجر ومنع النطاقات المركزية.
- لا يضاف مصدر حقيقة في React أو `localStorage`، ولا منتجات أو تقييمات أو وعود وهمية.
- checkout والطلب خارج نطاق إعادة التصميم؛ أي تفاعل إضافة للسلة سيعيد استخدام المعالجات الحالية فقط.

## 5. قاعدة البيانات والمهاجرات والفهارس

لا تغيير متوقع. الحقول اللازمة موجودة داخل عقد وإعدادات المتجر الحالية، ومنها الألوان و`themeStyle` و`heroBannerHeight` و`heroBannerOverlayOpacity` وترتيب الأقسام. لا مهاجرة، لا جدول، لا فهرس، ولا backfill مقترح في T0.

## 6. إثبات العزل والأمان

- `routes/tenant.php` يقيد المسارات العامة بتهيئة tenancy ومنع الوصول من النطاقات المركزية.
- `StoreWorkspaceService::readPublic()` يتحقق من جاهزية workspace ويؤلف snapshot داخل اتصال tenant ومعاملة `REPEATABLE READ`.
- الإسقاط العام يحذف coupons غير العامة ويعطل وسائل الدفع غير القابلة للاستخدام وينظف بيانات الاتصال.
- اختبارات التكامل الموجودة تغطي نطاقين مختلفين، النطاق المركزي/المجهول، وحالة عدم النشر.
- خطة التنفيذ لا تنقل بيانات بين tenants ولا تضيف قراءة مركزية من واجهة المتجر.

## 7. قياس الأداء قبل / بعد

### قبل — قياس محلي فعلي من صورة Pilot المبنية من baseline

- TypeScript + Vite production build: PASS؛ تم تحويل 2,160 module.
- CSS: `122.80 kB`، مضغوط `18.43 kB`؛ الحجم الفعلي عبر HTTP `122,807` بايت.
- JavaScript: `981.22 kB`، مضغوط `259.04 kB`؛ الحجم الفعلي عبر HTTP `981,219` بايت، مع تحذير chunk أكبر من `500 kB`.
- أصل صورة ثابت: `819.42 kB`.
- `StorePreview.tsx`: `119,736` بايت.
- bootstrap المنشور: HTTP 200 وحجم JSON غير مضغوط `5,934` بايت لأربعة منتجات، `workspaceRevision=1` و`catalogRevision=2`.
- إعدادات المنصة العامة: HTTP 200 وحجم JSON غير مضغوط `1,881` بايت.
- مخطط التحميل الثابت المثبت من HTML والشفرة هو ستة طلبات أولية محتملة: document، manifest، JavaScript، CSS، `/api/platform-settings` و`/api/store/config`. العدد الفعلي من سجل شبكة المتصفح، بما فيه أي طلب favicon أو cache، معلّق إلى حين اتصال المتصفح ولا يُدّعى أنه مقاس بعد.
- صورة `819.42 kB` تخص أسطح المنصة وتُصدر مع البناء؛ لم تكن ضمن بيانات متجر Pilot الحالي، ويجب أن يثبت سجل الشبكة إن كانت تُطلب على نطاق المتجر قبل نسب تكلفتها للواجهة العامة.
- صور hero/about/product الحالية لا تحدد `loading` أو `decoding` أو `sizes`. Hero المرئي قد يبقى eager، أما الصور تحت الطية والمصغرات فتحتاج قرارًا محدودًا مبنيًا على القياس.
- قيم الاستجابة الزمنية المحلية لم تُحوّل إلى هدف latency إنتاجي لأنها قيست على Docker محلي ولا تمثل الشبكة أو البنية الإنتاجية.

### ميزانية بعد التنفيذ

- لا زيادة غير مبررة في حجم JavaScript أو CSS عن baseline أعلاه؛ يسجل أي فرق فعلي قبل الاعتماد.
- لا تغيير في عدد استعلامات bootstrap ولا في payload نتيجة تحسين العرض.
- تحميل الصور غير الحرجة يؤجل، مع إبقاء hero الحرج قابلًا للعرض دون قفزة تخطيط ملحوظة.
- يبقى تحذير chunk دينًا معروفًا ما لم يثبت أن فصلًا محدودًا داخل هذه الحزمة آمن وضروري؛ لا refactor أداء واسع ضمن حزمة UX.

## 8. اختبارات منفذة ونتائجها الفعلية

- `StorefrontHome.test.tsx`
- `StorePreviewTruthfulness.test.tsx`
- `PublicStorefrontAccessibility.test.tsx`
- `PublicStorefrontReducedMotion.test.tsx`
- `storefrontOrderOrchestration.test.tsx`
- `publicStorefrontRecovery.test.ts`
- `orderApi.test.ts`

الأمر الدقيق:

```powershell
npm.cmd exec -- vitest run src/components/StorefrontHome.test.tsx src/components/StorePreviewTruthfulness.test.tsx src/features/storefront/PublicStorefrontAccessibility.test.tsx src/features/storefront/PublicStorefrontReducedMotion.test.tsx src/components/storefrontOrderOrchestration.test.tsx src/workflows/publicStorefrontRecovery.test.ts src/services/orderApi.test.ts --maxWorkers=2
```

النتيجة: **7 ملفات / 30 اختبارًا ناجحًا** في 54.02 ثانية.

أمر البناء المحلي الدقيق:

```powershell
npm.cmd run build
```

النتيجة: **PASS** لـ`tsc --noEmit` وVite؛ 2,160 module، وبناء في 24.10 ثانية. القياس المرجعي النهائي أعلاه مأخوذ من بناء Linux داخل Docker من SHA نفسه؛ أمره التشغيلي كان:

```powershell
$env:QA_ADMIN_PASSWORD='<ephemeral-generated-value>'; .\scripts\qa\prepare-pilot.ps1 -AdminEmail 't0.admin@eoshop.local' -AdminName 'WP 5.27.1 T0 Administrator' -ProjectName 'eoshop-wp5271-t0' -Port 8027
```

ظهر تحذير engine في التشغيل المحلي لأن Node المحلي `24.14.1` أقل قليلًا من الحد الذي تطلبه نسخة jsdom المقفلة (`24.15.0`)، لكن الاختبارات والبناء نجحا. بناء Docker استخدم Node `22.23.1` المقفول ونجح.

## 9. رابط محلي وخطوات التجربة

- Pilot المنفصل: مشروع Compose باسم `eoshop-wp5271-t0` على المنفذ `8027`، وله PostgreSQL volume وstorage volume منفصلان قابلان للاستبدال دون لمس Pilot السابق.
- المنصة/الصحة: `http://127.0.0.1:8027/` و`http://127.0.0.1:8027/up`.
- المتجر المنشور: `http://athar-yemen-t0.lvh.me:8027/`؛ API والمنزل يعيدان HTTP 200.
- القالب: `elegant`، اسم المتجر «متجر أثر اليمن»، وأربعة منتجات/فئات Pilot غير حقيقية، مع معلومات اتصال وعنوان وساعات عمل تجريبية فقط.
- تم إنشاء الرحلة بخدمات المشروع الحالية: draft/application evidence/submission/review/provisioning/publication؛ لا endpoint أو seeder أو ملف مصدر جديد.
- النطاق غير الصالح: `http://missing-wp5271-t0.lvh.me:8027/api/store/config` يعيد HTTP 404.
- خطوات المعاينة: افتح الرابط المنشور، راجع home ثم products ثم about/contact/product، ولا تدخل بيانات عميل ولا ترسل طلبًا.

## 10. صور سطح المكتب والجوال

**مؤجلة ولا تمنع التنفيذ.** متجر Pilot المنشور جاهز، لكن لا توجد جلسة متصفح متصلة بأداة التحكم داخل التطبيق. لم تُستخدم لقطة قديمة أو mock بوصفهما دليلًا جديدًا. القرار المعتمد يسجل هذه العناصر تحت `DEFERRED-QA-VISUAL-RESPONSIVE-NETWORK`.

الدليل اليدوي المؤجل إلى مرحلة QA اللاحقة:

- Before desktop: `1440 × 900` للصفحة الرئيسية وقائمة المنتجات.
- Before mobile: `390 × 844` للصفحة الرئيسية، التنقل، وبطاقات المنتجات.
- حالة loading/error موثقة دون بيانات حساسة.
- بعد التنفيذ: نفس المسارات والأبعاد للمقارنة المباشرة، وتحفظ الملفات تحت `docs/evidence/WP-5.27.1/`.

## 11. المخاطر المتبقية

- عدم وجود baseline بصري بعد يمنع تثبيت العيوب المتعلقة بالمسافات والتدرج البصري والتوازن قبل الكود.
- تغيير المكونات المشتركة قد يؤثر في preview داخل التخصيص وفي القالب `tech`، لذلك يجب اختبار `live` و`preview` معًا.
- ألوان وصور التاجر مدخلات متغيرة؛ إصلاح حالة واحدة لا يكفي دون اختبارات حدود التباين وإعادة التدفق.
- المكوّن الكبير يزيد احتمال لمس checkout خارج النطاق؛ يجب إبقاء diff محدودًا.
- تحذير حجم bundle قائم قبل الحزمة.

## 12. المؤجل والاستثناءات

- إعادة بناء checkout أو الطلبات أو المخزون أو الإيصال؛ مؤجل إلى WP 5.27.3.
- التمييز الكامل بين القالبين أو توسيع `themeStyle`؛ مؤجل إلى WP 5.27.2.
- CMS حر، أقسام جديدة، ترتيب جديد، أو عقد تخطيط ثانٍ.
- تعديل API أو schema أو migration دون دليل جديد ومراجعة مستقلة.
- مراجعة شاملة للوحة التاجر أو الإدارة أو هوية المنصة.
- refactor كامل لـ`StorePreview` أو code-splitting شامل.

## 13. خطة الاختبارات وPilot والتراجع

### اختبارات التنفيذ المقترحة

1. اختبارات مكون قريبة تثبت تطبيق `heroBannerHeight`، ألوان الأسطح، وتباين hero المصور عند `0` و`100`.
2. اختبارات بطاقات الصفحة الرئيسية والقائمة للحالات: منتجات منشورة/فارغة، فئة فارغة، صورة موجودة/بديل، ومحتوى طويل.
3. اختبار مستقل لصفحة تفاصيل المنتج، ثم إعادة تشغيل تغطية الصدق والوصول والحركة والسلة والbootstrap الحالية.
4. `npm run check` كامل، بوابة سلامة المستودع، و`git diff --check`.
5. اختبارات Laravel ذات الصلة بـ`StoreWorkspaceTest`, `TenancyActivationTest`, و`DomainSubscriptionPublicationTest` لإثبات عدم تغيير العقد والعزل.
6. Pilot على متجر منشور بمقاسات 320/390/768/1024/1440، لوحة مفاتيح فقط، reduced motion، ألوان حدية، نص عربي طويل، كتالوج فارغ وممتلئ، ونطاق مركزي/مجهول.
7. تسجيل payload وbundle وحالة الشبكة قبل/بعد، وصور desktop/mobile المقارنة.

### التراجع

- لأن الخطة واجهة فقط: إعادة نشر صورة web السابقة أو revert لالتزام WP 5.27.1.
- لا rollback لقاعدة البيانات أو tenant schema أو backend متوقع.
- إذا ظهر تراجع في live storefront يعاد web السابق مع إبقاء backend/db/worker/scheduler دون تغيير.

## 14. Commit / PR / CI / Merge

لا ينطبق في T0: لم يُنشأ commit ولم يحدث push أو PR. الفرع محلي فقط، و`main` و`upstream` لم يتغيرا.

## 15. قرار T1

- **ADR:** غير مطلوب؛ مصدر الحقيقة وحدود renderer/API لم تتغير.
- **Migration:** غير مطلوبة.
- **API:** لا تغيير في العقود العامة الحالية.
- **الحدود:** renderer واحد لـlive وpreview، وLaravel هو سلطة السعر والمخزون وإنشاء الطلب.

## 16. تقرير T2 المرحلي

### إغلاق T2 المعتمد

- **المسارات الفعلية المكتملة:** الرئيسية → تفاصيل المنتج → السلة ومراجعة الكمية → إرسال الطلب إلى الخادم → صفحة النجاح وإيصال الطلب.
- **أهم ملفات Frontend المعدلة:** `src/App.tsx`، `src/workflows/orderState.ts`، `src/components/StorePreview.tsx`، `src/components/StorefrontHome.tsx`، `src/components/StorefrontProductDetail.tsx`، و`src/features/onboarding/OnboardingStorePreview.tsx`.
- **أهم ملفات Backend المعدلة:** لا تعديل في كود Backend الإنتاجي أو العقود؛ أضيف إثبات العزل إلى `backend/tests/Integration/StoreWorkspaceTest.php` فقط.
- **المتجر الصحيح:** يحدد الخادم المستأجر من النطاق، وينشئ الطلب داخل schema ذلك المستأجر. اختبار المنتج العابر للمستأجر أعاد `order_product_unavailable` ولم ينشئ طلبًا في أي من المتجرين.
- **أثر المخزون:** طلب كميته 2 حجز وحدتين داخل معاملة الطلب؛ وبعد إكماله أصبح المخزون الفعلي 8 بدل 10، وعاد `reserved_quantity` إلى صفر، وتحول الحجز إلى `committed`.
- **Idempotency:** إعادة إرسال الطلب بالمفتاح والـpayload نفسيهما أعادت `replayed=true` ونفس `order.id`، مع بقاء طلب واحد وحجز واحد فقط. تغيير العملية مع المفتاح نفسه أعاد `order_idempotency_conflict`.
- **مدخلات العميل غير الموثوقة:** لا يقبل عقد الطلب `store_id` أو سعرًا/إجماليًا من العميل. `CreateOrderRequest` يسمح فقط بالحقول المحددة ويرفض `grandTotal` وأي حقول إضافية، بينما يقرأ `OrderService` المنتج داخل tenant schema ويحسب السعر النهائي خادميًا.

### المسار المكتمل

يعمل المسار الآتي داخل renderer المشترك:

`home -> product details -> constrained cart -> checkout -> POST /api/store/orders -> server receipt`

- تعرض الرئيسية المنتجات المنشورة فقط وتفتح تفاصيل المنتج نفسه.
- تمنع واجهة القائمة والرئيسية إضافة المنتج النافد.
- تقيد التفاصيل والسلة الكمية بالـ`availableQuantity` العام، وتمنع draft/archived محليًا كحاجز UX.
- إذا اختفى المنتج المحدد أو ألغي نشره، تظهر حالة «المنتج غير متاح» بدل عرض أول منتج بصمت.
- يرسل checkout معرف المنتج والكمية وبيانات العميل/العنوان/الدفع فقط؛ لا يرسل سعرًا موثوقًا من المتصفح.
- تعرض نتيجة النجاح رقم الطلب والإجماليات والعناصر من `OrderReceipt` الخادمي.
- تبقى idempotency وإعادة تحميل quote القديم وآلية التسعير والحجز وإنشاء الطلب الحالية دون fork أو تغيير عقد.

### تعديلات Frontend وBackend

Frontend:

- أضيفت عمليات مشتركة في `orderState.ts` لقابلية البيع، الكمية المتاحة، الإضافة، تغيير الكمية والمصالحة.
- استخدم `App` ومعاينة onboarding العمليات نفسها.
- حُدثت `StorefrontHome` و`StorePreview` و`StorefrontProductDetail` لحالات disabled وحد المخزون والمنتج المفقود.
- بقي renderer واحد للمتجر العام والمعاينة، ولم تُنسخ رحلة أو صفحة لقالب مستقل.

Backend:

- لا تعديل في كود Backend أو API أو قاعدة البيانات؛ أثبت التتبع أن `OrderService` الحالي يقرأ المنتجات من schema المستأجر، يحسب السعر خادميًا، يحجز المخزون داخل المعاملة، وينشئ order في المستأجر المحدد من النطاق.
- أضيف اختبار تكامل مركز يرسل معرف منتج من مستأجر آخر إلى نطاق المتجر الأصلي، ويتوقع `order_product_unavailable` بلا إنشاء order في أي من المستأجرين.

### الاختبارات والنتائج

الاختبار الجديد للرحلة:

```powershell
npm.cmd exec -- vitest run src/components/StorefrontVerticalSlice.test.tsx --maxWorkers=1
```

النتيجة: **ملف واحد / اختباران ناجحان**. يثبت الأول الرحلة الكاملة وإيصال السعر الخادمي، ويثبت الثاني حالة المنتج المختفي.

حزمة الانحدار المركزة:

```powershell
npm.cmd exec -- vitest run src/components/StorefrontVerticalSlice.test.tsx src/workflows/orderState.test.ts src/components/orderCheckoutFlows.test.tsx src/components/StorefrontHome.test.tsx src/components/StorePreviewTruthfulness.test.tsx src/features/storefront/PublicStorefrontAccessibility.test.tsx src/components/storefrontOrderOrchestration.test.tsx src/services/orderApi.test.ts --maxWorkers=1
```

النتيجة: **8 ملفات / 40 اختبارًا ناجحًا** في 114.46 ثانية.

```powershell
npm.cmd run lint
```

النتيجة: **PASS** لـ`tsc --noEmit`.

```powershell
npm.cmd run build
```

النتيجة: **PASS**؛ 2,160 module، CSS `123.01 kB` (gzip `18.48 kB`)، JavaScript `984.02 kB` (gzip `259.90 kB`)، والصورة الثابتة `819.42 kB`. مقارنة baseline: CSS `+0.21 kB` وJS `+2.80 kB`، مع بقاء تحذير chunk الأكبر من 500 kB إلى T4.

بعد تثبيت الحد العام للكمية عند 99 بما يطابق `orders.max_quantity_per_line`، أعيد تشغيل الرحلة وقواعد السلة وcheckout: **3 ملفات / 16 اختبارًا ناجحًا** في 57.02 ثانية.

فحص صياغة اختبار Backend الجديد اجتاز:

```text
php -l tests/Integration/StoreWorkspaceTest.php
No syntax errors detected
```

بعد الموافقة الصريحة، بُني target `quality` الموجود أصلًا في `docker/php/Dockerfile` باسم محلي `eoshop/backend-quality:t2`. لم تتغير dependencies أو ملفات Composer. شُغلت الاختبارات على شبكة وقاعدة Pilot المعزولة مع `ORDER_CHECKOUT_ENABLED=true` المطابق لـ`backend/phpunit.xml` وبيئة CI:

```powershell
docker run --rm --network eoshop-wp5271-t0_app --env-file backend/.env `
  --env APP_ENV=testing --env APP_DEBUG=false --env LOG_CHANNEL=stderr `
  --env DB_HOST=db --env DB_PORT=5432 --env CACHE_STORE=database `
  --env DB_CACHE_CONNECTION=pgsql --env DB_CACHE_LOCK_CONNECTION=pgsql `
  --env DB_QUEUE_CONNECTION=pgsql --env QUEUE_CONNECTION=database `
  --env SESSION_DRIVER=database --env SESSION_CONNECTION=pgsql `
  --env ORDER_CHECKOUT_ENABLED=true `
  eoshop/backend-quality:t2 vendor/bin/phpunit --colors=never `
  --filter 'test_(public_checkout_rejects_a_product_owned_by_another_tenant_without_leaking_it|public_checkout_prices_reserves_replays_and_merchant_accepts_atomically|checkout_rejects_stale_quotes_client_totals_and_insufficient_stock_without_side_effects)' `
  tests/Integration/StoreWorkspaceTest.php
```

النتيجة: **3 اختبارات / 117 assertion ناجحة** في 41.722 ثانية على PHP 8.4.25 وPHPUnit 11.5.56.

المحاولة التشخيصية الأولى أعادت 503 للاختبارات الثلاثة لأن حاوية Pilot الإنتاجية تضبط `ORDER_CHECKOUT_ENABLED=false`. لم يكن ذلك فشلًا في العزل أو السعر أو المخزون؛ بعد ضبط flag الاختبار بالقيمة التي تفرضها CI نجحت المجموعة كاملة.

### المخاطر وتغير النطاق

- لا تغيير في النطاق أو العقد أو schema، ولا خطر عزل جديد ظهر من التتبع أو التنفيذ.
- لا توجد فجوة تحقق خادمية متبقية في نطاق T2؛ نجحت اختبارات العزل والسعر والطلب والمخزون المركزة.
- زيادة bundle الحالية صغيرة لكنها ليست إغلاقًا لدين chunk الكبير؛ يعالج في T4 دون refactor واسع.

### المتبقي لـT3 وT4

- T3: إكمال Elegant بصريًا: `heroBannerHeight`، تباين hero، الهوية والألوان، header/footer، الصور وlazy loading، الحالات والـresponsive.
- T4: فصل المكونات الضروري فقط، تحسين الصور والحزمة، الاختبارات الشاملة وDocker والبوابات الأربع، وتسجيل القياسات النهائية.
- `DEFERRED-QA-VISUAL-RESPONSIVE-NETWORK`: الصور اليدوية الإضافية ولقطات الهاتف وسجل Network والمقارنات التفصيلية تبقى مؤجلة وفق القرار المعتمد.

## 17. إغلاق T3 وT4

### الصفحات والتنقلات المكتملة

- الصفحة الرئيسية بالقالب `elegant`: إعلان المتجر، header، بحث فعلي، تنقل، Hero، معلومات الخدمة، التصنيفات، المنتجات المنشورة، نبذة المتجر والتذييل.
- البحث ينقل إلى صفحة المنتجات ويطبق الاستعلام نفسه، مع إجراء واضح لمسحه وإعادة ضبط عوامل التصفية.
- بطاقة المنتج تفتح التفاصيل وتضيف للسلة فعليًا، وتمنع الإضافة عند نفاد المخزون.
- تفاصيل المنتج تعرض الصور والوصف والسعر العام والتوفر وحد الكمية، ثم تضيف الكمية المسموحة إلى السلة.
- السلة تسمح بالزيادة والنقصان ضمن الحد العام، ثم تنتقل إلى checkout وتعيد التركيز إلى عنوانه.
- checkout يعرض وسائل الدفع المنشورة فقط، يرسل طلبًا خادميًا، ثم يعرض صفحة نجاح وإيصالًا خادميًا مع الطباعة وWhatsApp عندما يكون الهدف صالحًا.
- صفحات «عن المتجر» و«التواصل» والتذييل تعرض بيانات التاجر المحفوظة فقط، وروابط الهاتف والبريد وWhatsApp والحسابات الصالحة دون وجهات وهمية.
- بقيت حالات loading، الخطأ مع retry، المتجر غير المنشور/النطاق غير الصالح، الكتالوج الفارغ والمنتج المختفي صريحة وغير فارغة.
- أضيف `dir=rtl` إلى renderer، وبقيت شبكة البطاقات والتنقل السفلي والسلة متجاوبة مع الشاشات الصغيرة والحواف الآمنة.

### الفصل المحدود والمحرك المشترك

استُخرجت المكونات التالية دون إعادة كتابة `StorePreview`:

- `StorefrontHero.tsx`: يطبق `heroBannerHeight` فعليًا للأنماط `compact/medium/large`، ويحافظ على طبقة تباين واقية مستقلة حتى عندما يحفظ التاجر opacity بقيمة صفر.
- `StorefrontProductCard.tsx`: بطاقة واحدة مشتركة بين الرئيسية وقائمة المنتجات، مع عقد فتح/إضافة واحد وحالة مخزون وصور محسنة.
- `StorefrontFooter.tsx`: تنقل فعلي ومعلومات اتصال وروابط اجتماعية محققة وplatform attribution.

يبقى `StorePreview` renderer الجامع نفسه في وضعي `live` و`preview`، وتستخدم المكونات الجديدة `StoreConfig` و`Product` ومعالجات السلة والتنقل الحالية. لم يُنشأ renderer أو عقد أو مسار خاص للواجهة العامة، ولم يبدأ القالب الثاني.

### الهوية والصور والوصول

- طُبقت `bgColor`, `cardBgColor`, `borderColor`, `textColor`, `primaryColor` و`secondaryColor` على الأسطح الرئيسية والمنتجات والتفاصيل وصفحتي المعلومات والتواصل والسلة والتذييل مع تصحيح تباين الألوان المحفوظة.
- Hero الحرج يستخدم `loading=eager`, `fetchPriority=high`, `decoding=async` و`sizes=100vw`؛ صور المنتجات والنبذة والمصغرات غير الحرجة تستخدم lazy loading وdecoding و`sizes` مناسبة.
- أزيلت الزخارف النصية من إجراءات Elegant التي لها أيقونة فعلية، ولم تُترك أزرار جديدة بلا handler.
- بقي trap التركيز في السلة، استعادته عند الإغلاق، رابط التخطي، semantics للـnavigation/radio، وحالة `prefers-reduced-motion` مغطاة بالاختبارات.

### أثر Backend وAPI وقاعدة البيانات والعزل

- لا Migration أو dependency أو تغيير API أو schema أو كود Backend إنتاجي في T3/T4.
- بقي `GET /api/store/config` و`POST /api/store/orders` وعقد revisions كما هما.
- السعر وtenant والمخزون والطلب بقيت خادمية السلطة؛ تغييرات T3 عرضية ولا تضيف مصدر حقيقة في العميل.
- بوابة التكامل أعادت اختبارات قاعدة البيانات الكاملة على PostgreSQL معزول: **171 اختبارًا / 1,918 assertion ناجحة**، وتشمل حدود tenants والطلبات وidempotency وrollback والمخزون.

### أوامر ونتائج T4

Frontend quality:

```powershell
npm.cmd run check
npm.cmd run audit
```

- `tsc --noEmit`: **PASS**.
- Vitest: **66 ملفًا / 344 اختبارًا ناجحًا** في 198.06 ثانية.
- Vite production build: **PASS**؛ 2,163 module في 25.25 ثانية.
- npm audit: **0 vulnerabilities**.

Backend quality داخل `eoshop/backend-quality:t2`، وهو مطابق لكود Backend الحالي الذي لم يتغير بعد T2:

```powershell
docker run --rm eoshop/backend-quality:t2 sh -lc "composer validate --strict --no-check-publish && composer audit --locked && composer check"
```

- Composer validate: **PASS**، وComposer audit: لا تنبيهات.
- Pint: **295 ملفًا ناجحًا**.
- Larastan: **255/255 بلا أخطاء**.
- PHPUnit ضمن `composer check`: **3 اختبارات / 6 assertions ناجحة**.

بوابة المستودع:

```powershell
.\scripts\ci\repository-gate.ps1
```

النتيجة: **Repository gate passed**. استُخدم `DOCKER_CONFIG` المحلي الذي يحتوي إضافة Docker Compose؛ لم يتغير سكربت CI.

Container integration:

```powershell
.\scripts\ci\integration-gate.ps1 -ProjectName 'eoshop-wp5271-t4' -Port 18271
```

النتيجة: **Container integration gate passed** بعد بناء `eoshop/backend:ci` و`eoshop/web:ci`، migrations نظيفة، اختبارات قاعدة البيانات، migration/rollback guards، HTTP/session/publication smoke، وتشغيل worker/scheduler. حُذفت حاويات وشبكة وvolumes المشروع المعزول تلقائيًا في النهاية.

### البوابات الأربع

| البوابة | النتيجة |
|---|---|
| Repository safety | PASS |
| Frontend quality + audit | PASS |
| Backend quality | PASS |
| Container integration | PASS |

`git diff --check`: **PASS** دون أخطاء whitespace.

### حجم Build قبل وبعد T3

| الأصل | قبل T3 (T2) | بعد T3/T4 | الفرق |
|---|---:|---:|---:|
| JavaScript | `984,016` بايت | `993,081` بايت | `+9,065` بايت (`+0.92%`) |
| CSS | `123,007` بايت | `124,816` بايت | `+1,809` بايت (`+1.47%`) |
| الصورة الثابتة | `819,418` بايت | `819,418` بايت | دون تغيير |

القياس المحلي بعد T3: JS gzip `261.97 kB` وCSS gzip `18.65 kB`. بناء Web داخل Docker أكد JS `993.08 kB` gzip `261.97 kB` وCSS `124.66 kB` gzip `18.61 kB`. يبقى تحذير chunk الأكبر من `500 kB` دين أداء سابقًا، ولا يُعالج هنا بإعادة تقسيم شاملة خارج النطاق.

### التراجع والمؤجل

- التراجع: revert لالتزام T3/T4 أو إعادة نشر صورة Web السابقة؛ لا rollback قاعدة بيانات لأن الحزمة لم تضف Migration.
- `DEFERRED-QA-VISUAL-RESPONSIVE-NETWORK`: لقطات الهاتف وقياسات Network والمقارنة البصرية اليدوية ما زالت مؤجلة حسب الاعتماد ولا تمنع T4.
- code splitting واسع، القالب الثاني، وإعادة بناء checkout أو `StorePreview` مؤجلة؛ لا توجد مشكلة API أو عزل أو dependency كبيرة ظهرت.
- يتوقف العمل بعد هذا التقرير ولا يبدأ T5 قبل اعتماد المالك.
