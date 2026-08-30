# WP 5.27.2 — Elegant editorial and Tech Bento templates

| الحقل | القيمة |
|---|---|
| الحالة | T4 local complete — implementation and automated gates complete; visual acceptance pending |
| Baseline SHA | `a09ac954e60ba1277a7128975f266726a85a6675` |
| الفرع | `codex/wp5-27-2-elegant-tech-templates` |
| المصدر | Squash Merge لـPR #82، وجميع بوابات CI ناجحة |

## 1. الهدف

بناء فرق بصري وبنيوي حقيقي بين القالبين الموجودين في عقد `StoreConfig.themeStyle`، فوق الأساس الوظيفي المشترك الذي أنجزته WP 5.27.1:

- **Elegant:** تكوين تحريري فاخر بهرمية هادئة، مساحات واسعة، وإيقاع أقرب للمجلة والكتالوج الراقي.
- **Tech:** تكوين **Bento** معياري، أكثر كثافة ووضوحًا، ببطاقات متفاوتة الامتداد وإشارات بصرية تقنية.

لا تنشئ الحزمة متجرين وظيفيين منفصلين. القالبان واجهتان لنفس renderer ونفس bootstrap ونفس المنتجات والتنقل والسلة والCheckout والطلب الخادمي.

## 2. خط الأساس والفجوة المثبتة

- `main` و`origin/main` و`upstream/main` متطابقة عند Baseline SHA أعلاه، والشجرة المحلية نظيفة.
- `themeStyle` محصور تعاقديًا في `elegant | tech`، و`ELEGANT_PRESET` و`TECH_PRESET` موجودان بالفعل.
- `StorePreview` يغير الهيدر والألوان وبعض النصوص حسب `isElegant`، لكنه يمرر القالبين إلى `StorefrontHome` والمكونات الوظيفية المشتركة نفسها.
- `StorefrontHome` و`StorefrontProductCard` و`StorefrontProductDetail` و`StorefrontFooter` لا تقدم حاليًا فرقًا بنيويًا كافيًا بين القالبين.
- WP 5.27.1 تعمدت تأجيل هذا التمييز إلى WP 5.27.2 حتى لا تتكرر السلة والطلبات والمنتجات.

## 3. النطاق

- استراتيجية عرض صريحة مشتقة من `themeStyle` دون تغيير العقد العام.
- Home تحريري لـElegant وHome Bento لـTech، مع احترام ترتيب وإظهار `homeSections` المحفوظ قدر الإمكان.
- اختلافات محسوبة في بطاقات المنتجات، تفاصيل المنتج، والتذييل تكمل لغة كل قالب دون تغيير الإجراءات.
- الحفاظ على RTL، الجوال، لوحة المفاتيح، `prefers-reduced-motion`، والتباين `4.5:1`.
- الحفاظ على حالات التحميل والفراغ والخطأ والمتجر غير المنشور من المحرك الحالي.
- استخدام بيانات التاجر الفعلية فقط؛ لا claims أو منتجات أو روابط وهمية.

## 4. الاستثناءات

- لا API أو Migration أو schema أو dependency جديدة.
- لا تغيير في Checkout أو idempotency أو التسعير أو المخزون أو عزل tenants.
- لا قالب ثالث ولا page builder جديد ولا إعادة كتابة شاملة لـ`StorePreview`.
- لا أصول صور جديدة مطلوبة؛ تستخدم القوالب صور التاجر وfallbacks الحالية.

## 5. حدود المكونات والمحرك المشترك

- يبقى `StorePreview` مالك التنقل والسلة والCheckout والطلب وحالات الصفحة.
- يبقى `StorefrontHome` مالك اشتقاق البيانات المشتركة مثل المنتجات المنشورة والتصنيفات وحقائق المتجر.
- تفصل طبقة العرض فقط إلى حدود صغيرة للقالبين، وتستقبل نفس view model ونفس callbacks.
- تبقى `StorefrontProductCard` و`StorefrontProductDetail` و`StorefrontFooter` مشتركة مع variant عرضي مشتق من `themeStyle`، بدل نسخ المنطق.

## 6. معايير القبول

1. يظهر فرق بنيوي قابل للاختبار بين Elegant editorial وTech Bento، وليس تبديل ألوان فقط.
2. تعرض الواجهة العامة والمعاينة القالب نفسه من `themeStyle` والعقد نفسه.
3. تعمل في القالبين: الرئيسية، البحث، التصنيفات، فتح المنتج، الإضافة للسلة، Checkout والطلب وصفحات المعلومات والتواصل.
4. تبقى جميع النصوص فوق الأسطح الديناميكية بنسبة تباين لا تقل عن `4.5:1`.
5. لا تنكسر RTL أو عروض الهاتف، ولا تُضاف إجراءات بلا handler.
6. تنجح البوابات الأربع: Repository safety، Frontend quality + audit، Backend quality، Container integration.

## 7. خطة الاختبار

- اختبارات مركزة تثبت markers وبنية Elegant editorial وTech Bento لكل من Home والبطاقات والتفاصيل والتذييل.
- اختبار تكافؤ وظيفي يشغل نفس رحلة المنتج والسلة والطلب على القالبين.
- اختبارات الوصول والتباين والحركة المخفّضة الحالية مع حالات القالبين.
- `npm run check` و`npm run audit`.
- Backend quality وContainer integration لإثبات عدم كسر العقود المشتركة.

## 8. التراجع

Revert لالتزام WP 5.27.2 أو إعادة نشر صورة Web السابقة. لا يلزم rollback لقاعدة البيانات لأن الحزمة Frontend فقط ولا تضيف Migration.

## 9. التنفيذ المكتمل

- `StorefrontHome` يعرض Elegant كتدفق تحريري غير متماثل بمساحات أوسع، ويعرض Tech كشبكة Bento من 12 عمودًا مع بطاقات متفاوتة الامتداد.
- `StorefrontProductCard` يحافظ على عقد المنتج والإضافة نفسه، مع بطاقة طويلة وصورة `4:5` في Elegant وبطاقة مربعة أكثر كثافة في Tech.
- `StorefrontProductDetail` يستخدم تكوينًا تحريريًا متوازنًا في Elegant وتقسيم Bento بنسبة `7/5` في Tech، دون نسخ منطق الكمية أو المخزون أو السلة.
- `StorefrontFooter` يبقى مكونًا مشتركًا؛ Elegant يحتفظ بأعمدة هادئة مفتوحة وTech يجمع المحتوى في بلاطات Bento محددة.
- `StorePreview` يمرر `themeStyle` إلى المكونات المشتركة ويبقى مالك التنقل والبحث والسلة وCheckout والطلب الخادمي.
- أضيفت markers دلالية للقوالب لاختبار الفرق البنيوي دون ربط الاختبارات بعدّ نصوص أو تفاصيل عرض هشة.

الملفات الوظيفية المعدلة:

- `src/components/StorePreview.tsx`
- `src/components/StorefrontHome.tsx`
- `src/components/StorefrontProductCard.tsx`
- `src/components/StorefrontProductDetail.tsx`
- `src/components/StorefrontFooter.tsx`
- `src/components/StorefrontTemplateVariants.test.tsx`
- `src/components/StorefrontVerticalSlice.test.tsx`

لا توجد تعديلات في Backend أو API أو schema أو migrations أو dependencies. مسار الطلب والتسعير والمخزون وعزل المستأجرين هو نفسه المنجز في WP 5.27.1.

## 10. نتائج التحقق المحلي

| البوابة | النتيجة | الدليل |
|---|---|---|
| Repository safety — invariants/Compose | PASS | `scripts/ci/repository-gate.ps1`؛ ملفات المنع وعقد المستودع وإعداد Compose سليمة |
| Repository safety — actionlint/gitleaks | CI pending | لم تُشغّل محليًا لأن بيئة التنفيذ رفضت تنزيل صور خارجية ومنحها قراءة المستودع؛ لا تُسجل كنجاح محلي |
| Frontend quality + audit | PASS | TypeScript؛ Vitest: **68 ملفًا / 353 اختبارًا**؛ Vite: **2,163 module**؛ npm audit: **0 vulnerabilities** |
| الاختبارات المركزة | PASS | **3 ملفات / 11 اختبارًا** تشمل الفصل البنيوي والتكافؤ الوظيفي ورحلة الشراء للقالبين |
| Backend quality | PASS | Composer validate/audit؛ Pint: **295 ملفًا**؛ Larastan: **255/255**؛ PHPUnit: **3 اختبارات / 6 assertions** |
| Container integration | PASS | صورة Web مبنية من الفرع؛ PostgreSQL: **171 اختبارًا / 1,918 assertions**؛ HTTP والمهاجرات والـworker والـscheduler ناجحة |

الأوامر الرئيسية:

```powershell
npm run check
npm run audit
docker build --file docker/nginx/Dockerfile --tag eoshop/web:wp5272 .
docker run --rm eoshop/backend-quality:ci sh -lc "composer validate --strict --no-check-publish && composer audit --locked && composer check"
./scripts/ci/integration-gate.ps1 -ProjectName eoshop-wp5272-local -Port 18272
```

## 11. أثر البناء والأداء

| الأصل | Build سابق محليًا | Build WP 5.27.2 | الفرق |
|---|---:|---:|---:|
| JavaScript | 993,259 bytes | 995,340 bytes | +2,081 bytes (+0.21%) |
| CSS | 124,816 bytes | 125,791 bytes | +975 bytes (+0.78%) |

- JavaScript بعد gzip: **262.68 kB**، وCSS بعد gzip: **18.83 kB**.
- تحذير chunk الأكبر من 500 kB ما زال دينًا معروفًا؛ لم تُرفع عتبته ولم تُضف dependency جديدة.
- لا توجد صور جديدة. صورة Hero التجريبية الحالية بحجم **819,418 bytes** تبقى أصلًا قائمًا ودين تحسين منفصلًا.

## 12. القبول البصري والبنود المؤجلة

- تعذرت المعاينة الآلية في هذه الجلسة لأن بيئة المتصفح لم تعرض متصفحًا متصلًا. يلزم قبل تحويل أي PR إلى Ready فحص Elegant وTech يدويًا عند قرابة `1440px` و`390px`، مع RTL والصفحة الرئيسية والمنتجات والتفاصيل والتذييل والسلة.
- اختبارات DOM تثبت الآن أن Elegant وTech مختلفان بنيويًا وأن التنقل والتصنيف وفتح المنتج والإضافة للسلة ورحلة الطلب الخادمية تعمل في القالبين.
- لا تشمل الحزمة page builder جديدًا، قالبًا ثالثًا، إعادة تصميم Checkout، أو معالجة تقسيم الحزمة الكبيرة.

## 13. Commit / PR / CI / Merge

- Implementation commit: `f911609` (`feat(storefront): differentiate elegant and tech templates`).
- Push: فرع المهمة في مستودع الموظف فقط؛ يتضمن التزام التنفيذ والتزام إغلاق هذه الوثيقة.
- PR: لم يُفتح.
- CI: لم يبدأ؛ actionlint وgitleaks ينتظران CI عند فتح PR.
- Merge: غير مسموح ضمن هذه المرحلة.
