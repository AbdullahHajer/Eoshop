# WP 5.30A — Tenant marketing campaign core

| الحقل | القيمة |
|---|---|
| المرحلة | T2 نواة Backend وقاعدة البيانات — مكتملة ومغلقة بانتظار اعتماد الانتقال إلى T3 |
| Base SHA المدمج | `3d712a153d86615812635b4ffdccf12f7beb8d2c` |
| الفرع | `codex/wp5-30a-marketing-campaign-core` |
| المستودع الفرعي | `AbdullahHajer/Eoshop` |
| القرار | [ADR 0043](../decisions/ADR-0043-server-owned-tenant-marketing-campaign-core.md) |

## 1. الهدف والملكية

تأسيس عقد Campaign Core خادمي ومعزول لكل متجر، يملك تعريف الحملة وروابط القنوات فقط، تمهيدًا للرحلة:

**حملة → رابط قناة موثوق → متجر/تصنيف/منتج → طلب → إيراد مكتمل منسوب.**

لا تملك هذه الحزمة Touch/Attribution أو analytics أو checkout أو الطلب أو الدفع أو المخزون أو `marketingBlocks`. أنجز T2 النواة الداخلية فقط دون Controller أو route أو API عام أو UI.

## 2. Baseline T0/T1

- جرى `fetch upstream --prune`، وتحقق أن `upstream/main` يساوي Base الملزم `74430e5294730620e5f71bf6fe2e101aa22ad852` بعد PR #99.
- أُنشئ الفرع النظيف مباشرة من هذا الأساس.
- الجداول التشغيلية tenant-scoped داخل schema كل متجر؛ حالة النشر والعضوية مركزية وتدخل خدمات المتجر إلى tenant schema بعد التحقق والأقفال.
- الصلاحيتان المعاد استخدامهما: `tenant.store.manage` للإدارة، و`tenant.analytics.view` للتقارير اللاحقة.
- يعاد استخدام `CanonicalPayload`/بصمة SHA-256 ونمط claim/lock/replay الحالي، وRevision المتفائل، دون استخدام عمليات الطلب أو المخزون.
- المنتج UUID وحالته `published` مصدر حقيقة. التصنيف اسم nullable على المنتج وليس كيانًا. الكوبونات `enableCoupons/customCoupons` في `StoreConfig` ويثبت السعر `OrderPricingService` خارج هذا النطاق.
- نشر المتجر وجاهزية runtime مصدرهما الحالة المركزية القائمة. `marketingBlocks` عقد مستقل داخل `StoreConfig` بحد 22 block ولا يتغير هنا.
- tenant migration `_000010` محجوز لـWP 5.28B؛ يحجز هذا التصميم `_000011` فقط ولا ينشئه في T1.

## 3. العقد المغلق

### 3.1 الحملة

| الحقل | النوع/الحد | القاعدة |
|---|---|---|
| `id` | UUID | يولده الخادم ولا يعاد استخدامه |
| `name` | string، 1–120 | trim، مطلوب |
| `objective` | `sales \| traffic` | مغلق |
| `state` | `draft \| active \| paused \| ended \| archived` | محفوظ |
| `effectiveState` | `draft \| scheduled \| active \| paused \| ended \| archived` | مشتق للقراءة، ليس input |
| `startsAt` | RFC3339 UTC أو null | اختياري |
| `endsAt` | RFC3339 UTC أو null | اختياري، وبعد `startsAt` إن وجدا |
| `targetType` | `store \| category \| product` | مغلق |
| `targetValue` | string أو null | null للمتجر، UUID للمنتج، canonical للتصنيف |
| `couponCode` | string 1–50 أو null | مرجع uppercase للكوبون الحالي |
| `revision` | positive integer | يبدأ 1، مستقل عن Workspace/Catalog |
| `healthStatus` | `healthy \| degraded` | مشتق للقراءة |
| `healthReasons` | قائمة مغلقة | `store_unpublished \| target_unavailable \| coupon_invalid` |
| `createdBy/updatedBy` | ULID | هوية داخلية بلا PII |
| تواريخ التدقيق | RFC3339 UTC | created/updated + transition timestamps |

حد المتجر 20 حملة غير مؤرشفة. يُفرض تحت قفل registry tenant-scoped، وليس بعدّ غير محمي.

### 3.2 Canonical التصنيف والوجهة

تطبيع التصنيف خادمي: trim → دمج Unicode whitespace إلى مسافة ASCII واحدة → lowercase Unicode، بحد 255 حرفًا، دون slug أو transliteration. يصبح صالحًا إذا وجد منتج `published` واحد على الأقل يعطي القيمة نفسها بعد التطبيع.

| الهدف | المسار الداخلي |
|---|---|
| متجر | `/` |
| منتج | `/products/{uuid}` |
| تصنيف | `/products?category={canonical}` مع URL encoding |

لا يقبل العميل URL. لا رابط خارجي ولا open redirect.

### 3.3 lifecycle والجدولة

| الحالة الفعلية | العمليات المسموحة |
|---|---|
| `draft` | update، activate، archive |
| `scheduled/active` | pause، end |
| `paused` | update، resume، end، archive |
| `ended`، بما فيها المنتهية زمنيًا | archive فقط |
| `archived` | قراءة فقط |

- activate/resume يعيدان التحقق تحت القفل من نشر المتجر والهدف وصلاحية الكوبون.
- `state=active` قبل `startsAt` تظهر `scheduled`؛ وبعد `endsAt` تظهر `ended` دون كتابة.
- GET لا يكتب ولا يحتاج Scheduler. أي mutation تعيد الاشتقاق تحت القفل قبل القرار.
- إلغاء نشر الهدف/المتجر أو تعطيل الكوبون ينتج `degraded`. زيارة رابط معروف تهبط إلى `/` دون UTM أو كوبون أو attribution ودون 500.

### 3.4 رابط القناة

| الحقل | النوع/الحد | المصدر |
|---|---|---|
| `id` | UUID | الخادم |
| `campaignId` | UUID | حملة في tenant schema نفسه |
| `channel` | `instagram \| facebook \| whatsapp \| google \| email \| other` | client allowlist |
| `url` | HTTPS على نطاق المتجر `/c/{token}` | الخادم، output فقط |
| `utmSource/utmMedium` | خريطة القنوات في ADR 0043 | الخادم |
| `utmCampaign` | `cmp_{campaignUuid}` | الخادم، ثابت |
| `utmContent` | `lnk_{linkUuid}` | الخادم، ثابت |
| `createdBy/createdAt` | ULID/UTC | الخادم |

الحد 8 روابط طوال عمر الحملة، ولا حذف في V1. token هو 256-bit عشوائي، Base64URL في الرابط، SHA-256 للبحث، وciphertext مشفر لإعادة العرض. التخزين يحمل `kid` ويدعم current/previous keys وإعادة تشفير آمنة. يمنع token من logs والأحداث والأخطاء.

## 4. تصميم Schema لـT2

الاسم المحجوز للمهاجرة: `backend/database/migrations/tenant/*_000011_create_marketing_campaign_core.php`. يعاد فحص الرقم قبل إنشائها.

### `marketing_campaign_registry`

- `id smallint primary key` بقيمة وحيدة 1.
- `created_at`, `updated_at`.
- يقفل `FOR UPDATE` قبل حساب/حجز حد 20 بالتزامن.

### `marketing_campaigns`

- `id uuid primary key`.
- `name varchar(120)`, `objective varchar(16)`, `state varchar(16)`.
- `starts_at timestamptz nullable`, `ends_at timestamptz nullable`.
- `target_type varchar(16)`, `target_value varchar(255) nullable`.
- `coupon_code varchar(50) nullable`.
- `revision bigint default 1` مع check أن القيمة موجبة.
- `created_by_ulid char(26)`, `updated_by_ulid char(26)`.
- `activated_at`, `paused_at`, `ended_at`, `archived_at` كـ`timestamptz nullable`.
- `created_at`, `updated_at`، وفهارس `state`, `ends_at`, `created_at`.
- Check constraints مغلقة للـobjective/state/target وشكل target nullable وجدولة الوقت.

### `marketing_channel_links`

- `id uuid primary key`, و`campaign_id uuid` مع FK `restrict`.
- `channel varchar(24)` مع check مغلق.
- `token_hash char(64) unique`, `token_ciphertext text`, `token_key_id varchar(32)`.
- حقول UTM الخادمية bounded: source/medium حتى 32، campaign/content حتى 64.
- `created_by_ulid char(26)`, `created_at`, `updated_at`.
- index على `(campaign_id, created_at)`؛ لا soft/hard delete في V1.

### `marketing_campaign_operations`

- `id uuid primary key`.
- `operation_kind varchar(32)`: `campaign.create | channel_link.create`.
- `scope_id uuid not null`: UUID الصفر `00000000-0000-0000-0000-000000000000` لنطاق tenant create، وcampaign UUID للرابط.
- `idempotency_key uuid`, `request_fingerprint char(64)`.
- `resource_type varchar(24)`, `resource_id uuid`, `completed_at timestamptz`, timestamps.
- unique على `(operation_kind, scope_id, idempotency_key)`.
- لا URL ولا token ولا response خام. يبقى السجل حتى Retention لاحقة.

### `marketing_campaign_events`

- `id uuid primary key`, `campaign_id uuid` مع FK `restrict`.
- `event_type varchar(24)`: created/updated/activated/paused/resumed/ended/archived.
- `from_state varchar(16) nullable`, `to_state varchar(16)`, `campaign_revision bigint`.
- `actor_user_ulid char(26)`, `reason_code varchar(64) nullable`.
- `metadata jsonb` مغلقة ومحدودة وبلا PII/token/URL، و`occurred_at timestamptz`.
- append-only؛ لا update/delete في V1، وفهرس `(campaign_id, occurred_at)`.

كل الجداول داخل tenant schema ولا تحمل `tenant_id`.

## 5. تصميم API لـT3

هذه المسارات عقد تصميمي فقط، ولا تُعدل routes في T1:

| Method | path | الغرض |
|---|---|---|
| GET | `/api/merchant/stores/{tenant}/marketing/campaigns` | قائمة مع effective state/health |
| POST | `/api/merchant/stores/{tenant}/marketing/campaigns` | إنشاء؛ `Idempotency-Key` مطلوب |
| GET | `/api/merchant/stores/{tenant}/marketing/campaigns/{campaign}` | التفاصيل |
| PATCH | `/api/merchant/stores/{tenant}/marketing/campaigns/{campaign}` | تعديل draft/paused مع revision |
| POST | `.../{campaign}/activate` | revision مطلوب |
| POST | `.../{campaign}/pause` | revision مطلوب |
| POST | `.../{campaign}/resume` | revision مطلوب |
| POST | `.../{campaign}/end` | revision مطلوب |
| POST | `.../{campaign}/archive` | revision مطلوب |
| GET | `.../{campaign}/channel-links` | روابط التاجر المصرح بها |
| POST | `.../{campaign}/channel-links` | إنشاء؛ `Idempotency-Key` مطلوب |
| GET | `https://{store-domain}/c/{opaqueToken}` | resolver عام؛ يضيف UTM الخادمية والكوبون الصالح فقط |

### أمثلة JSON

طلب إنشاء حملة:

```json
{
  "name": "عودة المدارس",
  "objective": "sales",
  "startsAt": "2026-09-10T06:00:00Z",
  "endsAt": "2026-09-30T20:59:59Z",
  "target": {
    "type": "category",
    "value": "أجهزة لوحية"
  },
  "couponCode": "SCHOOL10"
}
```

استجابة الحملة:

```json
{
  "id": "018f8a79-8c5d-7f40-b5a2-43cc7b8f8f50",
  "name": "عودة المدارس",
  "objective": "sales",
  "state": "active",
  "effectiveState": "scheduled",
  "startsAt": "2026-09-10T06:00:00Z",
  "endsAt": "2026-09-30T20:59:59Z",
  "target": { "type": "category", "value": "أجهزة لوحية" },
  "couponCode": "SCHOOL10",
  "revision": 2,
  "healthStatus": "healthy",
  "healthReasons": []
}
```

طلب إنشاء رابط لا يحتوي UTM أو URL:

```json
{ "channel": "instagram" }
```

استجابة الرابط:

```json
{
  "id": "018f8a7d-df4d-7e20-a37c-a142fb8c58a4",
  "campaignId": "018f8a79-8c5d-7f40-b5a2-43cc7b8f8f50",
  "channel": "instagram",
  "url": "https://shop.example/c/opaque-token-redacted-in-logs",
  "utm": {
    "source": "instagram",
    "medium": "social",
    "campaign": "cmp_018f8a79-8c5d-7f40-b5a2-43cc7b8f8f50",
    "content": "lnk_018f8a7d-df4d-7e20-a37c-a142fb8c58a4"
  }
}
```

### TypeScript المقترح داخل العقد فقط

```ts
type CampaignObjective = 'sales' | 'traffic';
type CampaignState = 'draft' | 'active' | 'paused' | 'ended' | 'archived';
type CampaignEffectiveState = CampaignState | 'scheduled';
type CampaignTarget =
  | { type: 'store'; value: null }
  | { type: 'category'; value: string }
  | { type: 'product'; value: string };
type CampaignChannel =
  | 'instagram' | 'facebook' | 'whatsapp' | 'google' | 'email' | 'other';
type CampaignHealthReason =
  | 'store_unpublished' | 'target_unavailable' | 'coupon_invalid';

interface MarketingCampaign {
  id: string;
  name: string;
  objective: CampaignObjective;
  state: CampaignState;
  effectiveState: CampaignEffectiveState;
  startsAt: string | null;
  endsAt: string | null;
  target: CampaignTarget;
  couponCode: string | null;
  revision: number;
  healthStatus: 'healthy' | 'degraded';
  healthReasons: CampaignHealthReason[];
}
```

### PHP المقترح داخل العقد فقط

```php
enum CampaignState: string
{
    case Draft = 'draft';
    case Active = 'active';
    case Paused = 'paused';
    case Ended = 'ended';
    case Archived = 'archived';
}

enum CampaignTargetType: string
{
    case Store = 'store';
    case Category = 'category';
    case Product = 'product';
}

enum CampaignChannel: string
{
    case Instagram = 'instagram';
    case Facebook = 'facebook';
    case WhatsApp = 'whatsapp';
    case Google = 'google';
    case Email = 'email';
    case Other = 'other';
}
```

## 6. HTTP وError codes

| الحالة | code | HTTP |
|---|---|---|
| schema غير جاهزة | `marketing_campaigns_not_ready` | 409 |
| حملة غير موجودة/خارج tenant | `campaign_not_found` | 404 |
| رابط إداري غير موجود | `campaign_link_not_found` | 404 |
| Revision قديم | `campaign_revision_conflict` | 409 |
| مفتاح Idempotency بحمولة مختلفة | `campaign_idempotency_conflict` | 409 |
| حد 20 | `campaign_quota_exceeded` | 422 |
| حد 8 طوال العمر | `campaign_link_quota_exceeded` | 422 |
| انتقال غير مسموح | `campaign_state_transition_invalid` | 409 |
| متجر غير منشور عند activate/resume | `campaign_store_unpublished` | 422 |
| هدف غير متاح | `campaign_target_unavailable` | 422 |
| كوبون غير صالح | `campaign_coupon_invalid` | 422 |
| جدول زمني غير صالح | `campaign_schedule_invalid` | 422 |
| قناة غير مدعومة | `campaign_channel_invalid` | 422 |

تستخدم المصادقة والصلاحيات والعقد العام 401/403/422 القائم. token العام غير الصحيح يعيد 404 عامة بلا كشف وجود حملة. الرابط المعروف غير المؤهل يعيد redirect إلى `/` بلا UTM أو كوبون أو attribution، لا خطأ JSON. الرابط المؤهل يبني المسار الداخلي ثم يضيف UTM الخادمية و`coupon` إن بقي صالحًا؛ ويظل Checkout ملزمًا بالتحقق الخادمي ولا يثق بالـquery.

## 7. Idempotency والتزامن

- create campaign: scope UUID الصفر الثابت داخل tenant schema + operation kind + UUID key + Canonical fingerprint.
- create link: scope campaign UUID + operation kind + UUID key + Canonical fingerprint.
- claim والإدخال والمورد والإيصال في معاملة واحدة. replay مطابق يعيد المورد نفسه مع دلالة replay؛ mismatch لا يكتب.
- الإيصال يشير إلى resource ID فقط؛ يعاد فك ciphertext للرابط عند استجابة تاجر مخول ولا يخزن token في الإيصال.
- registry lock يسبق حساب حد 20. قفل الحملة يسبق حساب حد 8، ثم insert. لا يسمح لطلبين متزامنين بتجاوز الحد.
- PATCH/lifecycle تقفل الحملة، تشتق الوقت والصحة، تتحقق من Revision والانتقال، تكتب الحالة والحدث معًا أو لا تكتب شيئًا.

## 8. مفاتيح token والتسجيل

- توليد 32 bytes عبر CSPRNG، Base64URL دون padding.
- hash ثنائي/hex ثابت لـSHA-256 وفهرس unique.
- ciphertext authenticated مع `kid` من إعدادات تشغيل مستقلة تمامًا عن `APP_KEY`. يلزم `MARKETING_LINK_TOKEN_KEY_CURRENT_ID` و`MARKETING_LINK_TOKEN_KEY_CURRENT` لإنشاء الروابط أو قراءتها، ويغلق المسار بالفشل عند غيابهما أو فساد المفتاح.
- التدوير: انقل قيم current القديمة إلى `MARKETING_LINK_TOKEN_KEY_PREVIOUS_ID` و`MARKETING_LINK_TOKEN_KEY_PREVIOUS`، وانشر current جديدًا، ثم أعد تشفير batches تحت قفل السجل. بعد قياس عدم بقاء أي صف يحمل previous `kid` يمكن حذف متغيرَي previous؛ لا يزال current مستقلًا ومطلوبًا.
- يمنع token/URL الكامل من application logs، query logging، audit metadata، exception context وanalytics. يسمح بتسجيل link UUID وآخر 8 أحرف من hash فقط عند الحاجة التشغيلية.

## 9. سجل الأحداث وRetention

- events append-only وtenant-scoped وبلا PII: created/updated/activated/paused/resumed/ended/archived.
- لا حدث جديد عند replay مطابق أو semantic no-op.
- لا حذف في V1 للحملة المؤرشفة أو الرابط أو الإيصال أو الحدث.
- سياسة Retention والتصدير والحذف التشغيلي قرار لاحق مستقل؛ لا يُبنى cleanup مخفي في WP 5.30A.

## 10. نقاط التكامل المسموح بها لاحقًا

- central Tenant/membership/publication locks للتحقق من المتجر والصلاحية.
- tenant products و`status=published` للتحقق من المنتج والتصنيف المطبّع.
- `StoreConfig.enableCoupons/customCoupons` للقراءة والتحقق فقط.
- `CanonicalPayload` ونمط Idempotency الحالي دون إعادة استخدام جداول order/inventory operations.
- domain tenancy لمسار `/c/{opaqueToken}`، وresolver داخلي فقط.
- لا كتابة في `marketingBlocks`، ولا Workspace/Catalog revision، ولا الطلب/الدفع/المخزون.

## 11. مصفوفة الاختبارات المطلوبة لـT2–T4

| المجال | السيناريو | النتيجة المطلوبة |
|---|---|---|
| العزل | Merchant A يقرأ/يعدل UUID من B | 404 ولا query/write في schema B |
| الصلاحية | staff بلا `tenant.store.manage` | 403؛ صاحب الصلاحية ينجح |
| التقارير | عقد مستقبلي | `tenant.analytics.view` فقط، لا توسيع صلاحيات الآن |
| Revision | طلبان بنفس revision | واحد ينجح والآخر `campaign_revision_conflict` بلا كتابة جزئية |
| Idempotency | create/link replay مطابق | المورد نفسه، بلا صف/حدث إضافي |
| Idempotency | المفتاح نفسه وحمولة مختلفة | `campaign_idempotency_conflict` |
| تزامن الحملات | مديرَان عند 19 | لا يتجاوز العدد 20 |
| تزامن الروابط | طلبان عند 7 | لا يتجاوز العدد 8 طوال العمر |
| lifecycle | كل انتقال مسموح/مرفوض | يطابق المصفوفة ويزيد revision مرة واحدة |
| الجدولة | قبل البداية/داخلها/بعد النهاية | scheduled/active/ended دون كتابة GET |
| pause/time | paused ثم يتجاوز endsAt | effective ended، ولا resume |
| نشر المتجر | activate على unpublished | رفض typed؛ تعطيله لاحقًا يظهر degraded |
| المنتج | UUID غير موجود/draft/archived | رفض أو degraded حسب توقيت التغيير |
| التصنيف | اختلاف whitespace/case | canonical واحد؛ يلزم منتج منشور |
| الكوبون | disabled/unknown/inactive | رفض activate/resume؛ fallback لاحقًا |
| resolver | store/product/category | المسارات الثلاثة الداخلية فقط |
| UTM | العميل يرسل UTM مزورة | تُرفض/تُهمل حسب Request المغلق، والقيم خادمية |
| token | 256-bit، forged، unknown | entropy مثبتة؛ 404 عامة ولا 500 |
| fallback | رابط معروف بحملة غير مؤهلة | `/` دون UTM/coupon/attribution |
| التشفير | current/previous وإعادة التشفير | الرابط ثابت، ciphertext يتغير، لا فقد |
| logging | success/failure/exception | لا token أو URL كامل أو PII |
| الأحداث | mutations/replay/archive | append-only، بلا duplicate replay أو delete |
| legacy | tenant بلا migration 11 | API typed not-ready؛ storefront/checkout سليم |
| عدم التأثير | حملة كاملة | لا تغيير للسعر/الطلب/المخزون/Workspace revision |
| البوابات | Repository/Frontend/Backend/Container | كلها خضراء و`git diff --check` ناجح |

## 12. التراجع والفشل الآمن

- T1 توثيق فقط؛ التراجع هو Revert لملفي الوثائق ولا توجد بيانات أو schema.
- بعد T2 يكون التراجع الإنتاجي بتعطيل surface الجديد مع إبقاء الجداول، لا إسقاط تاريخ الحملة.
- غياب schema أو تعطل اتصال/استعلام tenant المتوقع لا يعطل storefront أو checkout؛ resolver يحوله إلى `/` دون معلمات أو attribution بدل 500. يبقى token غير الصحيح والنطاق غير المطابق 404.
- لا إعادة توجيه خارجي في أي حالة، وfallback الوحيد `/`.

## 13. خارج النطاق والملفات المحمية

خارج النطاق: Touch/cookies/consent، attribution، order/payment/inventory، analytics/revenue، builders/forms/CRM، منصات Meta/Google، pixels، spend/ROAS، محررات القوالب، أصول المتجر، ونظام كوبونات جديد.

ظلّت الملفات المحمية خارج T2: لم تتغير Controllers أو UI أو routes أو providers أو permissions/seeders أو الوثائق المشتركة، ولا ملفات الطلب والدفع والمخزون و`StorePreview.tsx` و`marketingBlocks`.

## 14. مراحل العمل ونقطة التوقف

- **T1 (مكتمل):** WP + ADR 0043 + أمثلة عقود + مصفوفة اختبارات؛ ثبت تصحيح ترقيم ADR في Commit مستقل عادي.
- **T2 (الحالي، مكتمل بانتظار الاعتماد):** migration `_000011`، العقد المغلق، services/state machine/idempotency/events/token resolver واختبارات PostgreSQL المركزة. لا توجد routes أو API عام في هذه المرحلة.
- **T3 بعد اعتماد صريح:** Controllers/contracts/API client وresolver ضمن حدود تكامل معتمدة؛ واجهة المركز في WP 5.30B.
- **T4:** عزل وصلاحيات وتزامن وبوابات كاملة.
- **T5:** أدلة وPR Ready وCI؛ لا Merge دون أمر المالك.

## 15. قرارات T1 المثبتة

1. category اسم canonical مشتق من منتجات منشورة، لا كيان جديد.
2. الوجهات الداخلية فقط: `/` و`/products/{uuid}` و`/products?category={canonical}`.
3. `state` محفوظ و`effectiveState` مشتقة؛ لا write-on-read ولا Scheduler إلزامي.
4. فساد النشر/الهدف/الكوبون يمنع Touch ويهبط `/` ويظهر health قابلًا للإصلاح.
5. UTM خادمية مغلقة؛ campaign/link UUID هويتا campaign/content، وليست UTM مصدر حقيقة.
6. token عشوائي 256-bit، hash للبحث وciphertext للاستعادة مع current/previous وإعادة تشفير.
7. سجل أحداث append-only tenant-scoped بلا PII.
8. حجز `_000011` وترك `_000010` لـWP 5.28B؛ لا Migration في T1.
9. `/c/{opaqueToken}` على نطاق المتجر وfallback `/`.
10. لا حذف في V1، وحدود 20 غير مؤرشفة و8 روابط طوال العمر.
11. `tenant.store.manage` للإدارة و`tenant.analytics.view` للتقارير اللاحقة.

## 16. دليل إغلاق T2

### التنفيذ الفعلي

- أنشأت migration tenant رقم `_000011` سجل قفل الحصة والجداول الأربعة: `marketing_campaigns` و`marketing_channel_links` و`marketing_campaign_operations` و`marketing_campaign_events`، مع checks وقيود الاحتفاظ ومنع تعديل سجل الأحداث. يقفل `down()` كل الجداول الموجودة بترتيب ثابت عبر `ACCESS EXCLUSIVE` داخل transaction قبل فحص البيانات أو الإسقاط، ويرفض التراجع عند وجود أي تاريخ محتفظ به.
- أضيفت Enums وعقد تطبيع مغلق للحالة والهدف والقناة والجدولة والكوبون، مع `effectiveState` مشتقة زمنيًا بلا كتابة عند القراءة.
- تنفذ `MarketingTenantAccess` التحقق من العضوية النشطة و`tenant.store.manage` وقفل المستأجر قبل الدخول إلى schema الخاصة به.
- تنفذ الخدمات create/update ودورة الحياة وrevision conflict وidempotency receipts وحد 20 حملة غير مؤرشفة و8 روابط طوال عمر الحملة تحت الأقفال.
- الرابط يستخدم token عشوائي 256-bit؛ يخزن SHA-256 للبحث وciphertext مع `key id`، ويدعم current/previous keys وإعادة التشفير. لا يوجد fallback إلى `APP_KEY`، وغياب مفتاح التسويق المستقل أو فساده يفشل مغلقًا بلا رابط أو إيصال جزئي.
- `MarketingCampaignResolver` خدمة داخلية غير موصولة بمسار HTTP في T2. تقبل نطاق المتجر والوجهات الداخلية فقط، وتعيد 404 للرمز غير الصحيح أو غير المعروف وللنطاق غير المطابق. أعطال اتصال/مخطط/استعلام tenant المتوقعة وفقد الأهلية تهبط إلى `/` بلا UTM أو كوبون أو معرفات attribution، ودون تسجيل token.
- غياب migration يعيد `marketing_campaigns_not_ready` من الإدارة، بينما يبقى المتجر وcheckout خارج التأثير. rollback الفارغ يحافظ على جداول التجارة، ويرفض إسقاط أي تاريخ حملات موجود.

### الملفات المشتركة والنطاق

- لم تتغير `docs/README.md` أو `docs/current-state.md` أو routes/providers أو Frontend أو `marketingBlocks`.
- لم تتغير ملفات الطلبات أو الدفع أو المخزون، ولا أضيف Controller أو API عام.
- ملفات التنفيذ محصورة في migration `_000011` وEnums/Exception وSupport وخدمات `App\\Services\\Marketing` و`config/marketing_campaigns.php` واختبار التكامل المركّز، إضافة إلى `backend/.env.example` بأسماء متغيرات المفاتيح فقط وتحديث وثيقتي WP/ADR.

### تحقق نقطة التوقف

- PostgreSQL الحقيقي المركّز: 11 اختبار تكامل ناجحًا و104 assertions تغطي العزل والصلاحيات، lifecycle/revision/idempotency، الاشتقاق الزمني، سلامة الهدف والكوبون، fallback لأعطال tenant المتوقعة، استقلال مفتاح التشفير وفشله المغلق، retention/rollback، وقفل `ACCESS EXCLUSIVE` المتزامن.
- Repository safety: ناجحة عبر `scripts/ci/repository-gate.ps1`.
- Frontend quality: ناجحة على Node 22.23.1 المطابق لـCI؛ TypeScript و501/501 اختبارًا والبناء الإنتاجي ناجحة، و`npm audit` أعاد صفر ثغرات.
- Backend quality: Composer validate/audit ناجحان، وPint ناجح على 336 ملفًا، وLarastan ناجح على 291 ملفًا بلا أخطاء، واختبار Composer الأساسي ناجح (3 اختبارات و6 assertions).
- Container integration: ناجحة كاملة؛ مجموعة PostgreSQL شملت 198 اختبارًا و2515 assertions، مع نجاح migration `_000011` واختبارات التبني والعزل وHTTP/worker/scheduler.
- `git diff --check`: ناجح، ويثبت SHA النهائي في تقرير نقطة التوقف بعد Commit الإغلاق.
- التوقف بعد Commit وPush إلى `AbdullahHajer/Eoshop` فقط؛ لا PR ولا Merge ولا بدء T3.
