# WP 5.27.7A — Authoritative onboarding-to-workspace customization continuity

| الحقل | القيمة |
|---|---|
| الهدف | ضمان انتقال هوية المتجر المختارة في التهيئة من المسودة الخادمية إلى المراجعة والتجهيز ومساحة المتجر والواجهة العامة دون فقد أو مصدر حقيقة موازٍ |
| الحالة | اكتملت T0–T4 الآلية، ورُفع الفرع وفُتح [PR #98](https://github.com/sas-prog1/Eoshop/pull/98) بحالة Ready؛ المراجعة الحية مؤجلة بطلب المالك ولم يُنفذ Merge للحزمة |
| Baseline SHA | `6247f74ca4fececef1d9323e5c62ba6cc0b8c76a` |
| آخر `main` مدمج | `8e8be9f7a515d065a5c3e61f65a7d9183f52ced9` بعد دمج PR #94 |
| رأس التحقق قبل إغلاق التوثيق | `e5cd378d94c53d08499e89a1cdc8467589aecbc9` |
| الفرع | `codex/wp5-27-7a-onboarding-customization-continuity` |
| التاريخ | 2026-09-06 |
| حزم الأساس | [WP 5.14](WP-5.14-visual-onboarding-preview.md)، [WP 5.15](WP-5.15-storefront-section-layout.md)، [WP 5.16](WP-5.16-onboarding-draft-continuity.md)، [WP 5.27.6C](WP-5.27.6C-storefront-customization-parity.md) |
| القرارات الملزمة | [ADR 0010](../decisions/ADR-0010-server-owned-store-workspace.md)، [ADR 0017](../decisions/ADR-0017-server-owned-draft-resubmission-merchant-publication.md)، [ADR 0020](../decisions/ADR-0020-store-profile-and-managed-assets.md)، [ADR 0026](../decisions/ADR-0026-visual-store-onboarding-and-preview.md)، [ADR 0027](../decisions/ADR-0027-server-owned-storefront-section-layout.md)، [ADR 0028](../decisions/ADR-0028-authoritative-onboarding-draft-continuity.md)، [ADR 0039](../decisions/ADR-0039-server-owned-storefront-marketing-blocks.md) |

## سبب الحزمة

تسمح خطوة `/app/new/design` باختيار Elegant أو Tech وتعديل هوية أولية قبل وجود قاعدة Tenant. العقد الحالي يحفظ هذه القيم، لكن الاختبارات السابقة لم تثبت الرحلة الحرفية كاملة من الحفظ وإعادة الدخول إلى `payload_snapshot` ثم `store_configs` والواجهة العامة. كما بقي مسار التصحيح القديم قادرًا على حمل اسم أو قالب في أعلى المسودة يختلف عن النسخة داخل `config`، وبقي mapper الواجهة لمسودة التهيئة أقل صرامة من mapper مساحة المتجر.

هذه الحزمة تغلق الاستمرارية والصدق فقط. لا تحول المعاينة إلى كتالوج، ولا تجعل المسودة المركزية مالكة لأصول أو حملات تابعة لمتجر لم يُجهز بعد.

## حدود السلطة

- المسودة المركزية هي مصدر حقيقة مؤقت للهوية الأولية فقط، بحفظ revisioned وتحقق خادمي.
- طلب المراجعة يحمل snapshot مشتقًا من المسودة المقفلة بعد مطابقة revision والبصمة، وليس من نسخة العميل.
- العامل يجهز مساحة المتجر من snapshot المعتمد، مع إعادة تحقق حتمية وآمنة عند retry.
- `StoreConfig` داخل Tenant يصبح مصدر الحقيقة بعد نجاح provisioning.
- لا API أو Migration أو جدول أو dependency أو مخزن إعدادات جديد.
- يثبت ADR 0010 سلطة Workspace بعد التجهيز، ويثبت ADR 0017 حدود المسودة والإرسال والتصحيح والتجهيز، ويمنع ADR 0020 امتلاك أصول مدارة قبل Tenant صالح.
- يبقى نطاق التهيئة Appearance-only ومعاينتها صادقة وفق ADR 0026، واستمرارية المسودة وفصلها عن المتجر المرسل وفق ADR 0028.
- لا تملك المسودة `homeSections` وفق ADR 0027 ولا `marketingBlocks` وفق ADR 0039؛ لا قرار معماري جديد مطلوب ما دامت هذه الحدود لا تتغير.

## عقد الهوية المسبقة

يحفظ endpoint التصميم قائمة مغلقة من 17 مفتاحًا، ويجب أن تتطابق أسماؤها وقيودها في PHP وTypeScript. «قيمة القالب» في عمود التحكم تعني أن اختيار Elegant أو Tech يحدد القيمة، ثم تبقى محفوظة ضمن العقد حتى لو لم يوجد لها حقل مستقل في شاشة التهيئة.

| المفتاح | النوع وNullability | حد الخادم | موضع التحكم في التهيئة | السلطة والتحويل عند التجهيز |
|---|---|---|---|---|
| `slogan` | `string` غير فارغ | حتى 500 محرف؛ حقل الواجهة حتى 160 | حقل «العبارة التعريفية» | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `logoIcon` | `string` غير فارغ | حتى 32 محرفًا؛ حقل الواجهة حتى 8 | حقل «الشعار النصي أو الرمز» | المسودة الخادمية؛ لا يتحول إلى managed asset |
| `primaryColor` | `string` | `#RRGGBB` | منتقي «اللون الرئيسي» | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `secondaryColor` | `string` | `#RRGGBB` | منتقي «اللون المساند» | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `textColor` | `string` | `#RRGGBB` | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `bgColor` | `string` | `#RRGGBB` | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `cardBgColor` | `string` | `#RRGGBB` | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `borderColor` | `string` | `#RRGGBB` | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `fontFamily` | enum غير فارغ | `Cairo` أو `Tajawal` أو `Almarai` أو `Alexandria` أو `IBM Plex Sans Arabic` | قائمة «الخط» | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `bannerText` | `string` غير فارغ | حتى 1000 محرف؛ حقل الواجهة حتى 180 | حقل «شريط الإعلان» | المسودة الخادمية؛ تبقى القيمة المعتمدة |
| `showHeroBanner` | `boolean` | `true` أو `false` | «إظهار صورة واجهة الترحيب» | يتحكم في طبقة الصورة فقط، ولا يخفي قسم Hero الدلالي |
| `heroBannerTitle` | `string \| null` | حتى 500 محرف؛ حقل الواجهة حتى 180 | حقل «عنوان الواجهة الترحيبية» عند إظهار الصورة | المسودة الخادمية؛ تبقى القيمة أو `null` |
| `heroBannerSubtitle` | `string \| null` | حتى 1000 محرف | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة أو `null` |
| `heroBannerBadge` | `string \| null` | حتى 255 محرفًا | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة أو `null` |
| `heroBannerButtonText` | `string \| null` | حتى 255 محرفًا | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة أو `null` |
| `heroBannerHeight` | enum `\| null` | `compact` أو `medium` أو `large` | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة أو `null` |
| `heroBannerOverlayOpacity` | `integer \| null` | من 0 إلى 100 | قيمة القالب المختار | المسودة الخادمية؛ تبقى القيمة أو `null` |

ويجب دائمًا توحيد نسختي الهوية المكررتين:

- `store_name` يساوي `config.storeName`.
- `theme_style` يساوي `config.themeStyle`.

## التحويلات المقصودة

- `homeSections` ليست سلطة للمسودة المركزية؛ يبدأ المتجر بالترتيب الافتراضي الخادمي وفق ADR 0027.
- `marketingBlocks` تبدأ `[]` وفق ADR 0039؛ الحملات والقصص والإعلانات تُنشأ بعد وجود Tenant.
- منتجات وصور المعاينة Frontend-only ولا تدخل الطلب أو كتالوج المتجر.
- كتالوج البداية يظل `products=[]`؛ عناصر المعاينة لا تدخل snapshot. تنتقل عملة baseline الخادمية إلى `catalog_settings` عبر مسار الكتالوج القائم، ولا تنشأ سلطة متصفح بديلة لأي منهما.
- رفع الشعار وHero والصور التسويقية يبقى بعد تجهيز المتجر لأن ملكية الأصل وعزله يحتاجان Tenant صالحًا.

## نطاق التنفيذ

### T0 — التدقيق وتثبيت العقد

- تتبع الحقول من `MerchantOnboardingPage` إلى draft وsnapshot والعامل وWorkspace.
- مقارنة عقد PHP بعقد TypeScript وتسجيل المفاتيح والتحويلات.
- إثبات أن المسار الأساسي موجود وأن المطلوب إغلاق drift واختبارات الاستمرارية، لا إعادة بنائه.

**الحالة:** مكتمل.

### T1 — التطبيع الخادمي

- توحيد تطبيع config المخصصة للتجهيز في helper واحد يستخدمه submit وresubmit والعامل.
- بناء snapshot من المسودة المقفلة بعد مطابقة طلب العميل.
- فرض تطابق الاسم والقالب بين أعمدة المسودة وداخل `config` في المسارات الموجهة والقديمة والتصحيح.
- إبقاء دعم snapshots القديمة حتميًا وآمنًا دون reset أو تخطي للتحقق.

**الحالة:** مكتمل.

### T2 — عقد الواجهة والرسائل الصادقة

- تثبيت قائمة المفاتيح السبعة عشر باختبار TypeScript مباشر.
- جعل mapper المسودة يفشل مغلقًا عند malformed appearance أو اختلاف الاسم/القالب، دون حقن layout أو blocks يغيران بصمة المسودة.
- تسمية `showHeroBanner` بدقة بوصفه تحكمًا في صورة الواجهة.
- توضيح أن عناصر المعاينة أمثلة لا تنتقل إلى المتجر.
- إثبات reload/resume للقالب والحقول الظاهرة.

**الحالة:** مكتمل.

### T3 — رحلة PostgreSQL كاملة

- حفظ business ثم design ثم review والإرسال والموافقة والتجهيز.
- إثبات تطابق القيم السبعة عشر في submission snapshot ثم السجل المجهز وإسقاطي Workspace للتاجر والواجهة العامة.
- إثبات layout الافتراضي و`marketingBlocks=[]` وكتالوج خالٍ من منتجات المعاينة.
- إثبات توحيد الاسم والقالب في مسار legacy draft وفي التصحيح/resubmission، وتطبيع العامل لهوية snapshot مركزية قديمة ولـlayout/blocks غير الموثوقة.
- إعادة استخدام تغطية stale revision والحقول غير المدعومة وretry العام؛ لا تدعي الحزمة اختبار القيم السبعة عشر عبر correction أو محاولة retry فعلية ما لم يضاف ذلك صراحةً.

**الحالة:** مكتمل؛ الاختبارات المركزة 5 اختبارات و197 assertion، وتشمل رحلة الاستمرارية الموسعة حتى الإسقاط العام.

### T4 — بوابات الجودة والمراجعة الحية

- تشغيل الاختبارات المركزة، حزمة Frontend، TypeScript، Vite و`npm audit`.
- تشغيل Composer/Pint/Larastan/PHPUnit وContainer integration المعزول.
- فتح Elegant وTech في خطوة التصميم، المراجعة، محرر المتجر والرابط العام، وتسجيل دليل فعلي فقط.

**الحالة:** اكتملت البوابات الآلية. أُجلت المراجعة الحية بطلب المالك، لذلك لا تُسجل لقطة أو نتيجة مرئية غير منفذة.

### T5 — الإغلاق

- تحديث نتائج الأوامر والأحجام والدليل والـSHA النهائي.
- Commit وPush وPR بحالة Ready بعد نجاح البوابات.
- لا Merge دون اعتماد صريح من المالك.

**الحالة:** رُفع التنفيذ وفُتح [PR #98](https://github.com/sas-prog1/Eoshop/pull/98) بحالة Ready بعد مزامنة `origin/main` ونجاح البوابات على الرأس نفسه. لم يُنفذ Merge للحزمة، وبقي الدليل المرئي مؤجلًا.

## معايير القبول

1. يعيد تحميل `/app/new/design` القالب وكل تحكم محفوظ من الخادم بالقيمة نفسها.
2. تنتقل القيم السبعة عشر المحفوظة إلى submission snapshot ثم السجل المجهز وإسقاطي التاجر والعام دون تغير، ويعرض القالب العام المختار نفسه بعد النشر.
3. تتوحد هوية الاسم والقالب بين أعمدة المسودة و`config` في الكتابة القديمة والتصحيح، ويأخذ Tenant وsnapshot والعامل الهوية الخادمية المعتمدة بدل أي نسخة داخلية قديمة متعارضة.
4. تُرفض الحقول المتقدمة في endpoint التصميم دون mutation أو زيادة revision.
5. لا يحقن mapper الواجهة `homeSections` أو `marketingBlocks` في المسودة، ولا يغير null/omission المؤثر في البصمة.
6. يبدأ المتجر بتخطيط خادمي افتراضي و`marketingBlocks=[]` وكتالوج خالٍ من أمثلة المعاينة.
7. تنجح بوابات Repository وFrontend وBackend وContainer و`git diff --check` على الرأس نفسه.

## مصفوفة الإثبات الآلي

| الدليل | ما يثبته بدقة |
|---|---|
| `src/contracts/storeOnboardingAppearance.test.ts` | القائمة الحرفية المستقلة للمفاتيح السبعة عشر وترتيبها، واستخراج وتطبيق عقد Appearance دون حمل products/layout/blocks |
| `src/services/provisioningApi.test.ts` | حفظ شكل config دون حقن layout/blocks، والفشل المغلق عند Appearance malformed أو اختلاف الاسم/القالب أو ادعاء checkout غير آمن |
| `src/features/onboarding/MerchantOnboardingPage.test.tsx` | استعادة القالب والتحكمات الظاهرة من مسودة خادمية، وإرسال Appearance فقط، ورسالة أن عناصر المعاينة لا تنتقل |
| `backend/tests/Integration/AccountOnboardingTest.php` | allowlist الخادمي، ثبات no-op/revision، رفض الحقول المتقدمة دون mutation، وتحويل layout/blocks الخادمي |
| `backend/tests/Integration/StoreDraftLifecycleTest.php` | الرحلة الأولى حتى snapshot والتجهيز وإسقاطي التاجر والعام، إضافة إلى توحيد هوية legacy/correction/resubmission |
| `backend/tests/Integration/ProvisioningLifecycleTest.php` | تجاهل العامل لهوية config القديمة ولادعاءات layout/blocks المركزية؛ تغطية retry العامة تبقى اختبارًا منفصلًا ولا تعني تلقائيًا إعادة اختبار 17 قيمة في attempt ثانٍ |

## المؤجل صراحةً

- رفع managed assets أثناء onboarding.
- إنشاء القصص والإعلانات و`marketingBlocks` أو ترتيب `homeSections` قبل التجهيز.
- تحويل منتجات المعاينة إلى كتالوج حقيقي.
- مزامنة تغيير اسم/قالب متجر قائم مع metadata المركزية؛ تحتاج حزمة مستقلة لأنها ليست رحلة الإنشاء.
- مكتبة الأصول والقص التلقائي وتحسين الصور.
- Marketplace إعلانات وفوترة وتحليلات.
- تقسيم حزمة JavaScript والتحسين البصري العام.

## التوافق والنشر والتراجع

- لا يتغير شكل API أو قاعدة البيانات أو تبعيات التشغيل. تبقى طلبات العميل القديم مقبولة ضمن العقود الحالية، لكن الخادم الجديد يبني snapshot من المسودة المقفلة ويطبق التطبيع نفسه في submit وresubmit والعامل.
- ترتيب النشر المحافظ هو Backend والعامل أولًا ثم Web. يجب أن تعمل جميع عمال provisioning بالإصدار الجديد قبل معالجة submission قديم حتى تتقارب الهوية وlayout وblocks بالقواعد نفسها.
- mapper الجديد لا يصلح استجابة قديمة malformed بصمت؛ يفشل مغلقًا عند اختلاف الاسم/القالب أو فساد Appearance. هذا سلوك توافق مقصود يحمي البصمة، وليس ترحيل بيانات ضمن هذه الحزمة.
- عند التراجع تُصرف الطلبات الجارية، ثم يُرجع Web أولًا وبعده Backend/worker. لا يلزم DB rollback ولا حذف draft أو submission أو Tenant؛ القيم التي طُبعت وحُفظت تظل صالحة للعقد السابق.
- لا تُعد الحزمة جاهزة للنشر ما لم تنجح البوابات الأربع و`git diff --check` على SHA واحد، وتثبت المراجعة الحية مساري Elegant وTech من التهيئة حتى الرابط العام.

## سجل التحقق

| البوابة | النتيجة |
|---|---|
| تدقيق العقد والمسار | PASS — 17 مفتاحًا ومسار الخادم والواجهة موثقان |
| الاختبارات المركزة | PASS — Backend ‏5 اختبارات/197 assertion؛ Frontend بعد مزامنة الأساس ‏9 ملفات/45 اختبارًا، ومنها عقد الحقول الحرفي 2/2 |
| Frontend quality + audit | PASS — ‏84 ملفًا/475 اختبارًا؛ TypeScript وبناء Vite ناجحان؛ `npm audit` صفر ثغرات |
| Backend quality | PASS — Pint ‏310 ملفات؛ Larastan ‏267/267؛ PHPUnit الأساسي 3 اختبارات/6 assertions |
| Container integration | PASS — ‏186 اختبارًا/2,223 assertion؛ migrations ‏1–16 وHTTP وworker وscheduler ناجحة؛ بيئة الاختبار المعزولة نُظفت |
| حجم بناء Web | JavaScript ‏1,102,108 بايت (gzip ‏285.83 kB)؛ CSS ‏193,217 بايت (gzip ‏29.84 kB)؛ صورة Hero ‏819,418 بايت؛ تحذير chunk الأكبر من 500 kB دين سابق مؤجل |
| Repository safety / diff | PASS — `repository-gate.ps1` و`git diff --check` |
| المراجعة الحية | مؤجلة صراحةً بطلب المالك؛ لا دليل مرئي مسجل |
| Commit / Push / PR / Merge | Commit التنفيذ `bd69478`؛ دمج مزامنة محلي `e5cd378`؛ الفرع مرفوع و[PR #98](https://github.com/sas-prog1/Eoshop/pull/98) Ready؛ لم ينفذ Merge للحزمة |
