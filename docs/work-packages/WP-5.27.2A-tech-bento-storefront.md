# WP 5.27.2A — Tech Bento storefront

| الحقل | القيمة |
|---|---|
| المرحلة الحالية | T2A.1 — سكة تصنيفات Tech Bento |
| الحالة | T2A.1 مكتملة ومختبرة؛ متوقفة قبل تعديل `StorePreview.tsx` أو محرر التخصيص أو بدء T2B |
| Base SHA الحالي | `2f48de0f090198f176efd909eb10f4bd38f9d2a9` |
| الفرع | `codex/wp5-27-2a-tech-bento-storefront-v2` |
| التاريخ | 2026-09-01 |

## 1. سبب استبدال فرع التنفيذ

حُفظ تنفيذ T1 المحلي القديم عند `1570750e250c75bc3959cb52604dc4542544176d` في الفرع الأرشيفي `codex/archive-wp5-27-2a-t1-1570750`. عند محاولة دمج `upstream/main` ظهرت 11 تعارضًا لأن عقد Marketing Blocks نفسه أصبح مدمجًا وموسعًا في `main` مع عمل Elegant؛ أُلغي الدمج دون حل يدوي أو اختيار `ours/theirs`.

أُنشئ فرع v2 مباشرة من `upstream/main` عند SHA أعلاه، دون `cherry-pick` للالتزام القديم ودون `rebase` أو `reset`. لذلك تعد T1 موروثة ومكتملة من مصدر الحقيقة الحالي، ويبدأ T2 فوق عقد واحد يحافظ على Tech وElegant معًا بدل إعادة تأسيس العقد.

## 2. هدف T1

تأسيس عقد واحد مملوك للخادم للمساحات التسويقية التي يحتاجها القالب:

- خمسة مربعات داخل Hero.
- إعلانان جانبيان.
- عشرة عناصر اكتشاف تحت Hero.
- صورة Hero مستقلة للجوال ووجهة وفocal point.
- حفظ Revisioned، أصول تابعة للمتجر، إسقاط عام آمن وتوافق مع المتاجر القديمة.

## 3. العقد المنفذ

```text
StorefrontMarketingBlock
  id, placement, position, enabled
  contentType, title, subtitle?, badge?, ctaLabel
  imageUrl, mobileImageUrl?, altText
  backgroundColor?, textColor?, overlayOpacity?
  focalPointX?, focalPointY?
  targetType, targetValue?
  disclosure, sponsorName?
  startsAt?, endsAt?
```

الإضافات إلى `StoreConfig`:

- `marketingBlocks?`
- `heroBannerMobileImage?`
- `heroBannerTargetType?`
- `heroBannerTargetValue?`
- `heroBannerFocalPointX?`
- `heroBannerFocalPointY?`

أضافت حزمة Elegant اللاحقة `editorial_story` إلى العقد المشترك. لا توجد `featuredProductIds`، ولا Migration أو endpoint أو dependency أو جدول جديد لهذه المساحات.

## 4. قواعد الخادم

- placements: `hero_bento` بحد 5، و`side_ad` بحد 2، و`discovery` بحد 10، و`editorial_story` بحد 5؛ الإجمالي الخادمي 22. يستخدم Tech المواضع الثلاثة الأولى فقط، ويحتفظ Elegant بموضعه دون حذف أو إعادة تفسير.
- المواضع تبدأ من 1 ومتتابعة وفريدة داخل كل placement.
- العنوان 2–80، النص المساعد حتى 180، الشارة حتى 40، الزر 2–40، alt ‏2–160 والراعي حتى 80 حرفًا.
- الألوان `#RRGGBB` والنسب/focal points أعداد صحيحة بين 0 و100.
- الجدولة RFC3339 بتوقيت UTC فقط، والنهاية بعد البداية.
- الصور managed paths لنفس tenant فقط.
- أهداف المنتج والتصنيف تُراجع مع كتالوج الخادم غير المؤرشف.
- الرابط الخارجي HTTPS آمن، للحملة فقط، ويتطلب إفصاحًا واسم راعٍ.
- الإسقاط العام يحذف المعطل والخارج عن الجدولة والهدف غير المنشور.
- legacy دون العقد يُقرأ `[]`، والعميل القديم لا يستطيع حذف عقد موجود بصمت.
- provisioning يبدأ `marketingBlocks=[]` بغض النظر عن المسودة المركزية.
- no-op لا يرفع revision.

أكواد الأخطاء الجديدة/المستخدمة:

- `workspace_marketing_blocks_required`
- `workspace_marketing_blocks_invalid`
- `workspace_asset_budget_exceeded`
- `workspace_asset_path_invalid`
- `workspace_asset_unavailable`
- `workspace_revision_conflict`
- `store_asset_quota_exceeded`

## 5. الأصول والميزانيات

| الموضع | Desktop | Mobile |
|---|---:|---:|
| Hero الأساسي | 2 MiB | 1 MiB |
| Hero Bento | 750 KiB | 500 KiB |
| Side ad | 1024 KiB | 600 KiB |
| Discovery | 350 KiB | 350 KiB |
| Editorial story | 900 KiB | 500 KiB |

- حد الملف الواحد يبقى 5 MiB عند الرفع.
- الافتراضي لكل متجر: 64 أصلًا و75 MiB.
- يمكن إعادة استخدام الأصل، ويطبق أشد حد لكل مواضع استخدامه.

## 6. الملفات الأساسية

- `backend/app/Support/StorefrontMarketingBlocks.php`
- `backend/app/Support/StoreAssetPath.php`
- `backend/app/Services/StoreWorkspaceService.php`
- `backend/app/Services/StoreAssetService.php`
- `backend/app/Http/Requests/UpdateStoreWorkspaceRequest.php`
- `src/contracts/storefrontMarketingBlocks.ts`
- `src/services/workspaceApi.ts`
- `src/types.ts`
- `backend/tests/Integration/StoreWorkspaceTest.php`
- `src/contracts/storefrontMarketingBlocks.test.ts`
- `src/services/workspaceApi.test.ts`

## 7. سجل التحقق الموروث من T1

نتائج الاسترداد المركزة:

- Frontend contract + adapter: **30 اختبارًا ناجحًا**.
- TypeScript (`tsc --noEmit`): **PASS**.
- Pint على الملفات الخادمية المتغيرة: **PASS**.
- PostgreSQL integration المركزة: **3 اختبارات / 41 assertion ناجحة**.
- ملفات PHP الأساسية الأربعة تطابق SHA-256 للمرفقات المرسلة من المالك.

النتائج الكاملة على الفرع نفسه:

| البوابة | النتيجة |
|---|---|
| Repository safety | **PASS** |
| Frontend quality + audit | **PASS** — 68 ملفًا / 369 اختبارًا، TypeScript وVite ناجحان، و0 ثغرات |
| Backend quality | **PASS** — Pint ‏296 ملفًا، Larastan ‏256/256، وPHPUnit ‏3/6 |
| Container integration | **PASS** — PostgreSQL ‏174 اختبارًا / 1,959 assertion، HTTP وworker وscheduler |
| `git diff --check` | **PASS** |

بناء Linux داخل Docker:

- JavaScript: `997,050` بايت تقريبًا، gzip `263.37 kB`.
- CSS: `124,660` بايت تقريبًا، gzip `18.61 kB`.
- الصورة الثابتة الموجودة مسبقًا: `819.42 kB`.
- تحذير chunk الأكبر من 500 kB ما زال دينًا سابقًا، ولم تُنفذ إعادة تقسيم واسعة في T1.

شغلت بوابة التكامل في مشروع معزول باسم `eoshop-t1-recovery` ثم حذفت الحاويات والشبكة والـvolumes تلقائيًا بعد النجاح.

### تحقق نقطة بداية فرع v2

أعيد التحقق على `d00e86bb976a6c77affbf8721f16db30f61ea5c7` قبل أي تعديل في واجهة Tech:

- عقد Marketing Blocks: **PASS** — ملف واحد / 20 اختبارًا، مع إثبات المواضع الأربعة والسعة الدقيقة 22.
- Repository safety: **PASS**.
- Frontend quality + audit: **PASS** — 74 ملفًا / 393 اختبارًا، TypeScript وVite ناجحان، و0 ثغرات.
- Backend quality: **PASS** — Pint ‏296 ملفًا، Larastan ‏256/256، وPHPUnit ‏3 اختبارات / 6 assertions، وComposer audit دون advisories.
- Container integration: **PASS** — PostgreSQL ‏174 اختبارًا / 1,960 assertion، وmigrations وHTTP وworker وscheduler ناجحة.
- `git diff --check`: **PASS**.

بناء نقطة البداية المحلي بعد دمج Elegant:

- JavaScript: `1,035,738` بايت، gzip `272.19 kB`.
- CSS: `164,339` بايت، gzip `25.10 kB`.
- Hero image: `819,418` بايت.
- تحذير chunk الأكبر من 500 kB ما زال دينًا قائمًا ولم يُعالج في نقطة البداية.

شغلت بوابة التكامل في مشروع معزول باسم `eoshop-wp5272a-v2-baseline` ثم حذفت الحاويات والشبكة والـvolumes تلقائيًا بعد النجاح.

## 8. حدود T2 التالية

بعد توريث T1 من `main` والتحقق من العقد المشترك:

1. بناء Tech Bento فوق renderer والشراء المشتركين، لا fork جديد للمتجر.
2. إظهار Hero والمربعات والإعلانات وعناصر الاكتشاف من العقد الخادمي فقط.
3. الحفاظ على الصفحة الأولى ضمن viewport المرجعي قدر الإمكان دون فراغات رأسية زائدة.
4. ربط كل CTA بالهدف الموثوق، مع إفصاح ظاهر للإعلانات والرعاية.
5. حالات loading/empty/error والجوال وRTL والتباين والحركة المخفّضة.
6. بناء محرر التخصيص كمرحلة مستقلة بعد إثبات العرض؛ لا تُخزن مسودات وهمية في المتصفح.

### تنفيذ T2A

أُنجزت طبقة العرض المعزولة في `src/features/storefront/tech-bento/` وتشمل:

- نموذج عرض يقرأ العقد المشترك فقط ويُسقط `hero_bento` حتى 5، و`side_ad` حتى 2، و`discovery` حتى 10، ولا يستهلك `editorial_story`.
- Hero responsive يستخدم صورة الجوال والارتفاع وموضع الصورة والهدف المحفوظ، مع حد تعتيم أدنى يحافظ على وضوح النص فوق الصور.
- شبكة Bento مرنة، عمود الإعلانات، ودوائر Discovery أفقية على الشاشات الصغيرة.
- حالات loading والفراغ والصورة المفقودة، وإفصاح `إعلان`/`برعاية`، وحركة مخفّضة وfocus ظاهر.
- ربط العرض في `StorefrontHome.tsx` فقط مع الحفاظ على callbacks الحالية للأهداف والمنتجات.

لم تُعدل في T2A: `StorePreview.tsx` واختباراته، `StorefrontFooter`، أي ملف داخل `elegant-stories`، أو `docs/README.md`. ولم يُنشأ عقد أو Type أو API أو جدول بديل.

نتائج T2A:

- الاختبارات المركزة: **PASS** — 3 ملفات / 17 اختبارًا.
- Frontend quality: **PASS** — TypeScript، 76 ملفًا / 405 اختبارات، وبناء Vite.
- npm audit: **PASS** — 0 ثغرات.
- Build: JavaScript ‏`1,046,538` بايت / gzip `274.52 kB`، وCSS ‏`177,481` بايت / gzip `27.34 kB`.
- الزيادة من نقطة بداية v2: JavaScript ‏`10,800` بايت، وCSS ‏`13,142` بايت.
- بقي تحذير chunk الأكبر من 500 kB دينًا سابقًا؛ لم تُنفذ إعادة تقسيم واسعة في T2A.
- تعذرت لقطة سطح المكتب لأن جلسة العمل لم تجد متصفحًا متصلًا، ولم تُنشأ بيانات أو route تجريبية فقط لغرض الصورة.

### تنفيذ T2A.1

- دُمج `upstream/main` عند `2f48de0f090198f176efd909eb10f4bd38f9d2a9` بدمج عادي دون `rebase` أو `reset` أو `force`، ولم تظهر تعارضات. نتج Commit دمج محلي عند `891a6cf5e7d873b13ad8168e420d2cdc3b98c80b` قبل Commit تنفيذ T2A.1.
- أضيف `TechCategoryRail` داخل تخطيط Tech Bento: التصنيفات يسارًا، Hero وBento في الوسط، والإعلانان يمينًا على سطح المكتب؛ وتتحول السكة إلى قائمة أفقية قابلة للتمرير على الجوال.
- تستخرج التصنيفات الفريدة من المنتجات ذات `status === "published"` فقط، وتتجاهل المسودات والتصنيف الفارغ، ثم تستخدم callback ‏`onSelectCategory` الموجود دون عقد أو API أو جدول جديد.
- أوقف عرض قسم التصنيفات القديم أسفل الصفحة عند تشغيل Tech Bento، مع إبقائه للقوالب الأخرى بحسب مسار العرض القائم.
- تغطي الاختبارات الحالة الفارغة، النقر، RTL، تخطيط الجوال، التركيز المرئي والحركة المخفّضة، إضافة إلى إثبات عدم تكرار قسم التصنيفات القديم.
- بقيت `StorePreview.tsx` واختباراته، `StorefrontFooter`، محرر التخصيص، ملفات `elegant-stories` و`docs/README.md` خارج تعديلات T2A.1.

نتائج T2A.1 على الشجرة النهائية قبل Commit:

| البوابة | النتيجة |
|---|---|
| الاختبارات المركزة | **PASS** — 4 ملفات / 21 اختبارًا |
| Repository safety | **PASS** |
| Frontend quality + audit | **PASS** — 78 ملفًا / 415 اختبارًا، TypeScript وVite ناجحان، و0 ثغرات |
| Backend quality | **PASS** — Composer validate/audit، Pint ‏296 ملفًا، Larastan ‏256/256، وPHPUnit ‏3 اختبارات / 6 assertions |
| Container integration | **PASS** — PostgreSQL ‏174 اختبارًا / 1,960 assertion، والترحيلات وHTTP وworker وscheduler ناجحة |
| `git diff --check` | **PASS** |

بناء T2A.1:

- البناء المحلي: JavaScript ‏`1,058.17 kB` / gzip `277.06 kB`، وCSS ‏`190.74 kB` / gzip `29.25 kB`.
- بناء صورة الويب Linux داخل Docker: JavaScript ‏`1,058.17 kB` / gzip `277.06 kB`، وCSS ‏`190.58 kB` / gzip `29.21 kB`، وHero ‏`819.42 kB`.
- بقي تحذير chunk الأكبر من 500 kB دينًا سابقًا، ولم تنفذ T2A.1 تقسيمًا واسعًا أو تغييرًا في التصميم خارج سكة التصنيفات.

## 9. المخاطر والتراجع

- خطر كِبر payload محدود بحد 22 وبميزانيات الصور؛ تقاس الشبكة لاحقًا عند توفر بيئة مناسبة.
- خطر فقد عقد بواسطة عميل قديم مغلق برفض الحذف الضمني.
- خطر cross-tenant مغلق بمسار أصل مطابق لنفس tenant وفحص السجل قبل الربط.
- التراجع لا يحتاج Migration rollback؛ يعاد الالتزام السابق مع الحفاظ على حقول العقد المجهولة أو تنظيفها أولًا عبر الكاتب الحالي.

## 10. بوابة الانتقال

قبل الربط النهائي بعد مزامنة تغييرات `main` المشتركة، يجب أن تنجح:

- Repository safety.
- Frontend quality + audit.
- Backend quality.
- Container integration على PostgreSQL معزول.
- `git diff --check`.
- مراجعة PR وCI.

## 11. امتداد WP 5.27.2B اللاحق

أضاف [ADR 0040](../decisions/ADR-0040-elegant-editorial-stories-and-discovery.md) placement واحدًا باسم `editorial_story` بحد خمس قصص، فأصبح الحد الإجمالي للعقد المشترك 22. هذا امتداد لاحق لقالب Elegant؛ لا يغير حدود Tech نفسها (5 Hero Bento و2 Side Ad و10 Discovery)، ولا يضيف `featuredProductIds` أو endpoint أو Migration.
