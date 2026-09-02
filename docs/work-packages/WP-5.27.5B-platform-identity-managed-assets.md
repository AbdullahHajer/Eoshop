# WP 5.27.5B — Platform Identity Managed Assets

## الحالة

اكتملت T1–T4 محليًا على `codex/wp5-27-5b-platform-identity-assets` من Base `0b55a8b1a38db70688b4ca3ca516e9ea81351a2e`. لم يُفتح PR ولم يحدث Merge.

## الهدف والنطاق

تمكين مدير المنصة الحاصل على `platform.settings.manage` من معاينة ورفع صورة الصفحة الرئيسية أو المصادقة من الجهاز، ثم ربطها بإعدادات المنصة Revisioned، مع إبقاء HTTPS الخارجي الآمن. التفاصيل المعمارية والعقد في ADR-0041.

## T0 — Baseline

- أحدث `upstream/main`: `0b55a8b1a38db70688b4ca3ca516e9ea81351a2e`.
- الشجرة كانت نظيفة عند إنشاء الفرع.
- `npm run check`: TypeScript ناجح، و390 اختبارًا في 79 ملفًا نجحت؛ العملية خرجت بفشل بيئي لأن عاملي Vitest لم يبدآ خلال المهلة. لم يكن هناك فشل assertion. يُعاد القياس ضمن T4 وDocker/CI.

## العقد المثبت

- Migration: `2026_09_02_000016_create_platform_assets.php`.
- Upload: `POST /api/admin/platform-assets`، Multipart، Permission + Idempotency.
- Public delivery: `GET /api/platform-assets/{uuid}` عبر `known.domain`، ولا يعرض إلا الأصل المرتبط حاليًا.
- Settings remain `string|null`: safe HTTPS أو managed URL exact.
- Purpose allowlist: `landing_hero`, `authentication`.
- Limits: JPEG/PNG/WebP، 5 MiB، 320×180..6000×6000، ≤25MP، 32 أصلًا و100MiB.
- Cleanup: 24h orphan grace ثم 30-day recoverable quarantine.

## مراحل التنفيذ

- T1 مكتملة: العقد، Migration، URL validation، permissions، lifecycle.
- T2 مكتملة: upload/delivery، revisioned binding، isolation، cleanup/restore.
- T3 مكتملة: file preview، upload/failure/retry، external URL fallback، landing/auth application.
- T4 مكتملة: focused tests، frontend/backend quality، build، repository safety، container integration، docs.

## الملفات الجوهرية

- Backend: `PlatformAssetService`، طلب ووحدات تحكم الرفع/العرض، `PlatformAsset`، Migration 16، إعدادات quota، وأوامر prune/restore.
- Settings: التحقق من مسار الأصل، الإسقاط العام، والربط داخل معاملة revision والتدقيق القائمة.
- Frontend: `PlatformIdentityAssetField`، عميل multipart idempotent، URL mapper مغلق، وربط حقلي الصفحة الرئيسية والمصادقة بلوحة إعدادات المنصة.
- Quality: `PlatformAssetTest` واختبارات React/API/mapper، وتحديث ترتيب ترحيلات 15 و16 في بوابة التكامل.

## نتائج T4

- Repository safety: ناجحة، بما فيها `docker compose config`.
- Frontend quality: `83` ملف اختبار و`436` اختبارًا ناجحًا؛ TypeScript وVite build ناجحان.
- Frontend audit: `0` ثغرات.
- Backend quality: Composer validate/audit، Pint (`308` ملفات)، Larastan (`266` ملفًا)، ووحدات PHPUnit (`3` اختبارات) ناجحة.
- اختبار PostgreSQL المركز: `PlatformAssetTest` — `3` اختبارات و`62` assertion ناجحة.
- Container integration: `177` اختبارًا و`2022` assertion، migrations 1–16، route cache، HTTP، worker وscheduler ناجحة.
- Docker web build: JavaScript `1,087.11 kB` / `282.04 kB gzip`، وCSS `192.50 kB` / `29.46 kB gzip`، وصورة Hero الحالية `819.42 kB`.
- `git diff --check`: ناجح.

## الأمان ودورة الحفظ

- الرفع يحتاج مصادقة مركزية وصلاحية `platform.settings.manage`، ولا تصبح الصورة عامة قبل ربطها بإعدادات المنصة وحفظ revision جديد.
- JPEG/PNG/WebP تُفحص من المحتوى الفعلي والحجم والأبعاد، ولا تُخزن Base64 أو JSON.
- المسار العام UUID مغلق، وروابط HTTP أو المسارات الداخلية غير المطابقة تُرفض، وأصل المنصة منفصل عن أقراص وجداول المتاجر.
- الأصل المستبدل يأخذ مهلة orphan لمدة 24 ساعة، ثم quarantine قابلًا للاستعادة 30 يومًا. لا يُحذف ملف غير مملوك أو لا يطابق مساره المحسوب.

## الحدود

لا تعديل لملفات Merchant Onboarding أو Domain Setup أو Store Application، ولا للقوالب أو محرراتها، ولا عمل على PR #92، ولا دمج إلى main.

## التراجع

تعطيل واجهة الرفع لا يغيّر العقد القديم. يمكن إعادة الحقول إلى HTTPS/null عبر Revision update. لا تُسقط Migration مع وجود provenance؛ تُعزل الأصول وتُستعاد/تنظف بالأوامر التشغيلية أولًا.

## التسليم

لم يُفتح PR ولم يحدث Merge. يُرفع الفرع إلى Fork المعتمد فقط. لأن هذه الوثيقة جزء من Commit الإغلاق نفسه، يُسجل Head SHA النهائي وحالة Push في تقرير التسليم الخارجي.
