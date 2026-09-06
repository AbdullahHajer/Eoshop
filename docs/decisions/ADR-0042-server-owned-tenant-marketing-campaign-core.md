# ADR 0042 — Server-owned tenant marketing campaign core

## الحالة

مقبول تصميميًا لـWP 5.30A / T1 بتاريخ 2026-09-06. لا يجيز هذا القرار إنشاء Migration أو API أو كود منتج قبل اعتماد الانتقال إلى T2.

## السياق

تحتاج المنصة إلى تعريف حملة تسويقية وروابط قنوات موثوقة لكل متجر، تمهيدًا لرحلة لاحقة تربط الزيارة والطلب والإيراد. العقود الحالية توفر عزل schema لكل Tenant، وصلاحيات التاجر، وRevision متفائل، وIdempotency ببصمة Canonical، وحقيقة خادمية لنشر المتجر والمنتجات والكوبونات. في المقابل، التصنيف الحالي مجرد اسم على المنتج وليس كيانًا مستقلًا، و`marketingBlocks` جزء من `StoreConfig` وتملكها Workspace revision.

يجب ألا يحول Campaign Core رابطًا أو UTM أو قيمة أرسلها العميل إلى مصدر حقيقة، وألا يربط دورة حياة الحملة ذريًا بالطلب أو الدفع أو المخزون أو مساحات الترويج داخل المتجر.

## القرار

### 1. الملكية والعزل

1. تُخزن الحملات وروابطها وإيصالات Idempotency وأحداثها داخل schema المتجر نفسه. لا يوجد جدول حملات مركزي ولا اعتماد على `tenant_id` وحده.
2. كل mutation إدارية تعمل من سياق المتجر المركزي الحالي، وتتحقق من العضوية وصلاحية `tenant.store.manage`، ثم تدخل tenant schema بالترتيب المعتمد للأقفال.
3. التقارير اللاحقة فقط تستخدم `tenant.analytics.view`. لا تُضاف صلاحية أو Role أو Seeder جديد ضمن WP 5.30A.
4. لا تحتوي الجداول على PII عميل أو أسرار دفع. هوية المنفذ هي ULID داخلي فقط.
5. `marketingBlocks` تبقى عقدًا مستقلًا مملوكًا لـ`StoreConfig` وWorkspace revision. لا يضاف إليها `campaignId` ولا تنشأ كتابة مزدوجة أو cascade بين العقدين.

### 2. هوية الحملة وحالتها

1. هوية الحملة UUID غير قابلة لإعادة الاستخدام، والاسم بطول 1–120، والهدف مغلق على `sales | traffic`.
2. الحالة المحفوظة `state` مغلقة على `draft | active | paused | ended | archived`.
3. تعيد القراءة `effectiveState` مشتقة دون كتابة:
   - `archived` إذا كانت الحالة المحفوظة `archived`.
   - `ended` إذا كانت محفوظة `ended`، أو انتهى `endsAt` لحملة محفوظة `active` أو `paused`.
   - `paused` إذا كانت محفوظة `paused` ولم ينته وقتها.
   - `scheduled` إذا كانت محفوظة `active` و`startsAt` في المستقبل.
   - `active` إذا كانت محفوظة `active` والنافذة الزمنية جارية.
   - `draft` في غير ذلك للحالة المحفوظة `draft`.
4. لا يكتب GET ولا يعتمد على Scheduler. أي mutation تقفل سجل الحملة، تعيد اشتقاق الحالة الزمنية، ثم تتحقق من الانتقال والصلاحية والهدف والكوبون قبل الكتابة.
5. الانتقالات المغلقة:
   - `draft → active | archived`.
   - `active/scheduled → paused | ended`.
   - `paused → active | ended | archived` ما لم تكن `effectiveState=ended`.
   - `ended → archived`.
   - `archived` نهائية.
6. تعديل الاسم أو الهدف أو الكوبون أو الجدولة أو objective مسموح في `draft` و`paused` فقط. الأرشفة لا تحذف السجل أو روابطه أو أحداثه.
7. `startsAt` و`endsAt` اختياريان بصيغة UTC/RFC3339، ويجب أن يكون `startsAt < endsAt` عند وجودهما. التفعيل المستقبلي يحفظ `state=active` ويظهر `effectiveState=scheduled`.

### 3. الوجهة والكوبون والصحة

1. الوجهة مغلقة على:
   - `store`: مسار `/` و`targetValue=null`.
   - `product`: UUID منتج منشور ومسار `/products/{uuid}`.
   - `category`: اسم canonical ومسار `/products?category={canonical}` بعد URL encoding.
2. Canonical التصنيف هو: trim، ثم دمج أي تتابع whitespace إلى مسافة ASCII واحدة، ثم lowercase بـUnicode. لا slug ولا transliteration. يتحقق الخادم من وجود منتج منشور واحد على الأقل يتطابق اسم تصنيفه بعد التطبيع نفسه. لا ينشأ كيان تصنيف أو جدول جديد.
3. `couponCode` مرجع اختياري لعقد `customCoupons` الحالي: uppercase canonical، موجود، فعال، و`enableCoupons=true` عند activate/resume. لا ينشأ نظام كوبونات جديد ولا FK إلى JSON.
4. activate/resume يتطلبان متجرًا منشورًا وجاهزًا للتشغيل، ووجهة منشورة، وكوبونًا صالحًا إن وجد، ويعيدان التحقق تحت القفل.
5. القراءة تعيد `healthStatus: healthy | degraded` و`healthReasons` مغلقة على `store_unpublished | target_unavailable | coupon_invalid`. هذه قيم مشتقة ولا تغير Revision.
6. إذا أُلغي نشر المتجر/المنتج، اختفى التصنيف المنشور، أو تعطل الكوبون بعد التفعيل، فلا يقبل الرابط Touch جديدًا. يعيد resolver تحويلًا داخليًا آمنًا إلى `/` بلا UTM أو كوبون أو attribution، ولا يعيد 500. تظهر الأسباب نفسها للتاجر كي يصلحها.

### 4. روابط القنوات والثقة

1. القنوات مغلقة على `instagram | facebook | whatsapp | google | email | other`، والحد ثمانية روابط طوال عمر الحملة، بما فيها روابط حملة مؤرشفة. لا حذف ولا إعادة استخدام للهوية في V1.
2. يولد الخادم token من 32 byte عشوائية تشفيريًا (256-bit)، ويعرضه Base64URL دون padding داخل `https://{store-domain}/c/{opaqueToken}`.
3. يخزن الخادم `SHA-256(token)` للبحث وciphertext مشفرًا لإعادة بناء الرابط للتاجر. لا يخزن token خامًا في قاعدة البيانات أو logs أو أحداث التدقيق أو رسائل الخطأ.
4. يحمل ciphertext معرّف المفتاح `kid`. تقبل القراءة المفتاح الحالي والسابق فقط، وتعيد عملية صيانة لاحقة التشفير تحت قفل السجل إلى المفتاح الحالي. يبقى hash ثابتًا ولا تتغير الروابط عند تدوير المفتاح. إزالة المفتاح السابق ممنوعة قبل اكتمال إعادة التشفير والتحقق.
5. القيم التحليلية يولدها الخادم من خريطة مغلقة:

| channel | utm_source | utm_medium |
|---|---|---|
| `instagram` | `instagram` | `social` |
| `facebook` | `facebook` | `social` |
| `whatsapp` | `whatsapp` | `messaging` |
| `google` | `google` | `search` |
| `email` | `email` | `email` |
| `other` | `other` | `referral` |

`utm_campaign=cmp_{campaignUuid}` هوية حملة مستقرة، و`utm_content=lnk_{linkUuid}` هوية رابط مستقرة. لا يقبل API أي UTM موثوقة من العميل، وتبقى UTM للعرض والتوافق وليست مصدر attribution.
6. لا وجهة خارجية ولا open redirect. عند أهلية الرابط يضيف resolver قيم UTM الخادمية، ويضيف `coupon` فقط إذا بقي مرجع الكوبون صالحًا؛ لا تُعد قيمة query مصدرًا موثوقًا عند Checkout. token غير صحيح أو غير موجود يعيد 404 عامة؛ الرابط المعروف لكن غير المؤهل يعيد Redirect داخليًا إلى `/` بلا UTM أو كوبون أو attribution.

### 5. Revision وIdempotency والحدود

1. لكل حملة Revision مستقل يبدأ من 1. لا تغير الحملة Workspace revision أو Catalog revision.
2. PATCH وانتقالات lifecycle تتطلب Revision الحالي وتعمل تحت `lockForUpdate`. التعارض يعيد `campaign_revision_conflict` دون كتابة جزئية.
3. إنشاء الحملة وإنشاء رابط يتطلبان `Idempotency-Key` من نوع UUID. النطاق هو `(operation_kind, scope_id, key)`؛ scope إنشاء الحملة هو UUID الصفر الثابت داخل tenant schema، ونطاق إنشاء الرابط هو campaign UUID.
4. بصمة الطلب تستخدم الـCanonical payload الخادمي فقط. إعادة المفتاح والبصمة تعيد المورد نفسه، وإعادة المفتاح بحمولة مختلفة تعيد `campaign_idempotency_conflict`.
5. الإيصال لا يخزن URL أو token خامًا؛ يخزن resource UUID، ثم يعاد بناء DTO المصرح به من السجل المشفر. تبقى الإيصالات بلا حذف حتى اعتماد سياسة Retention لاحقة.
6. قفل registry singleton داخل tenant schema يسبق عد حملات المتجر وحجز الحصة، فيمنع تجاوز حد 20 حملة غير مؤرشفة بالتزامن. إنشاء الرابط يقفل الحملة ثم يعد كل روابطها، فيمنع تجاوز حد 8 طوال العمر.

### 6. سجل الأحداث

1. يسجل `marketing_campaign_events` أحداث `created | updated | activated | paused | resumed | ended | archived` كسجل append-only tenant-scoped.
2. الحدث يحمل UUID الحملة، نوع الحدث، الحالة السابقة/اللاحقة، Revision الناتج، ULID المنفذ، وقت UTC، وmetadata مغلقة ومحدودة بلا PII أو token أو URL.
3. لا توجد update/delete لهذا السجل في V1. الفشل أو replay الذي لا ينشئ تغييرًا جديدًا لا يولد حدثًا مكررًا.

### 7. Migration والتوافق والتراجع

1. الرقم المحجوز هو tenant migration `_000011`؛ الرقم `_000010` محجوز لـWP 5.28B. لا تنشأ Migration في T1، ويعاد التحقق من الرقم عند بدء T2.
2. المتجر الذي لم تصله schema الجديدة يعيد للإدارة `marketing_campaigns_not_ready`، بينما يبقى storefront وcheckout دون تغيير. resolver يفشل بأمان إلى `/` للروابط المعروفة تشغيليًا ولا يسمح باستثناء قاعدة بيانات أن يصبح 500.
3. لا حذف في V1. الحملات المؤرشفة والروابط والإيصالات والأحداث تبقى حتى سياسة Retention مستقلة لاحقة.
4. التراجع الإنتاجي roll-forward: يمكن تعطيل endpoints/resolver مع إبقاء الجداول والبيانات. لا تُسقط الجداول التي تحتوي تاريخًا؛ down migration مسموحة في بيئة غير إنتاجية فقط إذا كانت الجداول فارغة.

## النتائج

- تصبح هوية الحملة والرابط خادمية ومعزولة وقابلة لإعادة البناء دون جعل UTM مصدر حقيقة.
- يظل انتهاء الجدولة صحيحًا دون write-on-read أو Scheduler، مع تكلفة إعادة اشتقاق وفحص الصحة عند القراءة/الطفرة.
- اسم التصنيف يلائم نموذج V1 الحالي، لكنه لا يضمن ثبات الوجهة إذا أعاد التاجر تسمية التصنيف؛ يظهر ذلك كحالة قابلة للإصلاح.
- عدم الحذف يحافظ على التاريخ ويبسط الثقة، لكنه يؤجل سياسة Retention وحجم الجداول إلى قرار مستقل.

## البدائل المرفوضة

- كيان تصنيف جديد: مرفوض في V1 لأن الكتالوج الحالي يملك اسم تصنيف فقط.
- قبول URL أو UTM من العميل: مرفوض لمنع open redirect وتزوير attribution.
- token خام أو قابل للتخمين: مرفوض أمنيًا.
- اشتقاق `ended` بكتابة داخل GET أو Scheduler إلزامي: مرفوض لتجنب side effects وفجوة تشغيلية.
- ربط الحملة بـ`marketingBlocks` أو الطلب والدفع الآن: مرفوض لاختلاف الملكية والنطاق.
- حذف المؤرشف أو الروابط القديمة: مرفوض حتى وجود سياسة Retention معتمدة.

## التحقق المطلوب لاحقًا

- عزل متجرين، permissions، Revision، replay/mismatch، وتزامن quotas 20/8.
- مصفوفة lifecycle والجدولة واشتقاق `effectiveState` دون كتابة.
- نشر المتجر والمنتج، Canonical التصنيف، وتعطيل الكوبون بعد التفعيل.
- 256-bit token، hash lookup، current/previous keys، إعادة التشفير، ومنع التسريب في logs.
- الوجهات الداخلية الثلاث، UTM المغلقة، 404 للتزوير، وfallback `/` بلا معلمات.
- append-only events وعدم تأثير Campaign Core في Workspace أو الطلب أو الدفع أو المخزون.
