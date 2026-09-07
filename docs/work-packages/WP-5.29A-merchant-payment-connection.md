# WP 5.29A — Merchant payment connection

| الحقل | القيمة |
|---|---|
| الهدف | ربط حساب BasGate مستقل لكل متجر، مع حفظ الأسرار مركزيًا بصورة مشفرة وعرض حالة اتصال منقحة، تمهيدًا لدورة الدفع في WP 5.29B |
| الحالة | T2 مكتمل محليًا: اتصال التاجر المشفر وواجهته المنقحة ناجحان في جميع البوابات؛ تفعيل الدفع الفعلي ما زال محجوبًا بملحق المزود المتبقي |
| Base SHA | `3d712a153d86615812635b4ffdccf12f7beb8d2c` |
| الفرع | `codex/wp5-29a-payment-connection` |
| التاريخ | 2026-09-07 |
| المسار الموازي | مستقل عن WP 5.30A Marketing Campaign Core |

## 1. نتيجة T0

يثبت خط الأساس الحالي أن Eoshop يملك بالفعل:

- طلبًا خادميًا يثبت السعر والعملة والخصم والشحن والضريبة من إعدادات المتجر المنشورة.
- عملية إنشاء idempotent، وحجز مخزون ذريًا، وانتهاءً آمنًا للحجز.
- دورة طلب وتنفيذ مستقلة، ورابط تتبع ضيف خاصًا لا يكشف بيانات العميل.
- عزل schema لكل متجر، وصلاحيات تاجر مركزية، وتشفيرًا مستخدمًا للبيانات الحساسة.
- kill switch عامًا لإنشاء الطلبات عبر `ORDER_CHECKOUT_ENABLED` مع بقاء التصفح متاحًا.

أما الدفع الحالي فهو يدوي فقط:

- `cod` ينتج `due_on_delivery`.
- التحويل البنكي والمحفظة اليدوية ينتجان `transfer_submitted_unverified` مع مرجع يقدمه العميل ولا تدعي المنصة التحقق منه.
- الـBackend لا يقبل `online_gateway`، ولا توجد payment intent أو transaction أو webhook inbox أو reconciliation.
- `payment_attempts` الحالية snapshot واحدة مرتبطة بالطلب ومقيدة بالحالتين اليدويتين؛ لا يجوز تحويلها إلى سجل mutable لدورة المزود.
- حقول `enableOnlineCard` و`enableApplePay` و`enableStcPay` القديمة لا تمثل تكاملًا حقيقيًا، ومحرر التاجر لا يعرض لها مفاتيح تفعيل ويصرح بأنها غير متاحة حتى ربط بوابة فعلية.
- عامل Docker الحالي مخصص لطابور `provisioning`؛ دورة الدفع تحتاج عاملًا/طابورًا مستقلًا واختبارات readiness خاصة بها.

## 2. القرار التجاري المثبت

- لكل متجر حساب مستقل لدى المزود، والمنصة منسق تقني فقط ولا تجمع أموال المتاجر في حسابها.
- لا تستقبل Eoshop بيانات بطاقة أو PIN أو OTP أو سر محفظة.
- تجربة V1 تستخدم صفحة دفع مستضافة أو QR/deep link يقدمه المزود.
- نجاح المتصفح لا يثبت الدفع؛ المصدر الموثوق webhook موقع أو reconciliation موثق مع المزود.
- COD يبقى مسارًا مستقلاً، ولا تحذف هذه الحزمة التحويلات اليدوية القائمة.
- refunds والـchargebacks والتسوية المحاسبية وتعدد المزودين خارج V1، إلا بقدر لازم لمعالجة نجاح متأخر أو منع إلغاء مالي غير آمن.

## 3. حدود ملكية البيانات المقترحة لاعتماد T1

### Central database

تحجز الحزمة central migration رقم `000017` لسجل BasGate واحد لكل متجر في V1، مرتبط صراحة بالمتجر ويحتوي فقط على:

- هوية المزود وحساب التاجر لدى المزود.
- lifecycle اتصال مغلق هو `draft | verification_pending | active | verification_failed | disabled`، مع `unconfigured` كحالة API مشتقة عند غياب السجل.
- مواد المصادقة/التوقيع/التوجيه اللازمة مشفرة، مع نسخة مفتاح أو metadata تدوير غير سرية.
- revision ونتيجة آخر تحقق منقحة وتوقيته، دون حفظ payload سري في audit أو logs.
- قفل uniqueness يمنع ربط حساب المزود نفسه بمتجرين عندما يفرض المزود ذلك.

لا تدخل هذه البيانات في `StoreConfig` أو storefront projection أو onboarding snapshot.

### Tenant schema

يبقى tenant migration رقم `000011` محجوزًا لـWP 5.30A، وتحجز دورة الدفع اللاحقة رقم `000012`. لا تنشئ WP 5.29A معاملات دفع قبل اعتماد عقد المزود. التصميم اللاحق يجب أن يفصل:

- payment sessions/intents المرتبطة بالطلب.
- transactions أو attempts دون قيد محاولة واحدة لكل طلب.
- webhook inbox/event ledger append-only مع event ID فريد.
- الحالة المالية المشتقة من أحداث موثوقة، دون جعل snapshot الطلب القديمة مصدرًا mutable.

## 4. قواعد الأمان وعدم التداخل

1. كل قراءة أو mutation لاتصال الدفع تتطلب عضوية المتجر وصلاحية الإدارة المناسبة، وتعيد إسقاطًا منقحًا لا يحتوي أسرارًا.
2. متجر A لا يستطيع التحقق أو التعطيل أو استخدام اعتماد متجر B، حتى إذا عرف المعرف المركزي.
3. الأسرار مشفرة at rest ولا تظهر في API أو exception أو queue payload أو audit أو log أو evidence.
4. لا تتم أي مكالمة شبكة مع المزود داخل معاملة إنشاء الطلب أو أثناء أقفال المخزون.
5. create-payment يبدأ بعد commit الطلب والحجز. عند timeout يستخدم مرجعًا حتميًا ثم status lookup قبل إنشاء محاولة جديدة.
6. webhook يدخل أولًا inbox durable، يتحقق من التوقيع والزمن وإعادة الإرسال، ثم يعالجه worker مستقل idempotently.
7. مبلغ webhook وعملته وهوية حساب المزود والطلب تطابق خادميًا قبل إعلان `paid`.
8. duplicate وout-of-order وlate events لا تعيد طلبًا ملغيًا أو منتهيًا للحياة، وتدخل الحالة المتأخرة في مسار مراجعة آمن.
9. تعطل المزود لا يعطل تصفح المتجر ولا COD؛ يظهر خيار الدفع الإلكتروني فقط إذا كان الاتصال فعالًا وجاهزًا.
10. لا تعديل لملفات أو جداول WP 5.30A، ولا attribution أو marketing wiring في هذه الحزمة.

## 5. تقييم عقد BasGate المستلم

### 5.1 ما أصبح مثبتًا

- المصادقة خادمية عبر `POST /api/v1/auth/token` باستخدام OAuth `client_credentials`، ثم Bearer token قصير العمر؛ المثال يوثق `expires_in=3600`. لا تستدعي الواجهة هذا المسار ولا ترى `client_secret`.
- بدء العملية عبر `POST /api/v1/merchant/sdk-payment/initiate-transaction` داخل envelope يحتوي `head.signature` و`head.requestTimestamp` و`body` يضم `appId` و`orderId` و`amount` و`ordertype`، ويعيد `trxId` و`trxToken`.
- فحص الحقيقة المالية عبر `POST /api/v1/merchant/sdk-payment/get-transaction-status` باستخدام `orderId`. لا يعتبر الطلب مدفوعًا إلا إذا كان `paymentStatus=1202` و`paymentStatusName=processed`؛ `status=1` أو رجوع SDK وحدهما لا يكفيان.
- التوقيع الموثق يجمع payload مع salt من أربعة محارف، ثم SHA-256، ثم AES-256-CBC/PKCS7 بمفتاح مشتق وIV ثابت يحدده BasGate. يلزم تثبيت test vectors قبل إعادة تنفيذه.
- حزمة Laravel الرسمية تعلن `https://api-tst.basgate.com` للـstaging و`https://api.basgate.com` للإنتاج، وتعرض مسار Refund افتراضيًا هو `POST /api/v1/merchant/sdk-payment/reverse-payment/execute`. تظل هذه المعلومات بحاجة تجربة staging لأن صفحة API التفاعلية تستخدم mock URLs ولا توثق Refund كعملية مستقلة.
- التدفق المعلن هو: ينشئ Backend المعاملة، تسلم الواجهة `trxToken` إلى Bas SDK، ثم يعيد Backend فحص الحالة Server-to-Server.

### 5.2 قرار استخدام SDK الرسمي

لا تضاف `basgate/laravel-payment-sdk` كاعتماد للمنتج في T1 بصورتها الحالية، وتستخدم مصدرًا مرجعيًا فقط، للأسباب التالية:

- تبني الخدمة من `config/.env` اعتمادًا واحدًا عامًا، بينما قرار Eoshop هو اعتماد مستقل ومشفّر لكل متجر يختار في نطاق الطلب.
- تسجل الحزمة جسم الطلب والاستجابة كاملين في debug logs، بما قد يكشف `trxToken` وبيانات العملية.
- تطلب access token جديدًا داخل كل نداء محمي بدل cache منضبط حسب `expires_in`.
- تقبل المبلغ كـ`float|int`، بينما Eoshop يجب أن يحافظ على تمثيل نقدي دقيق ويتحقق من وحدة المبلغ مع المزود.
- لا توفر webhook inbox أو idempotency أو reconciliation أو lifecycle متعدد المستأجرين.
- مثال README يفحص `transaction_status=SUCCESS`، بينما عقد API الأحدث يشترط `paymentStatus=1202`. نعتمد الشرط الأخير حتى يثبت staging خلافه.

سيبنى BasGate adapter صغير ومملوك للمشروع بعد إغلاق الموانع، مع HTTP fake واختبارات test vectors واستبدال المزود مستقبلًا دون تسريب تفاصيله إلى الطلبات أو الواجهة.

### 5.3 النواقص المانعة للتنفيذ الإنتاجي

1. وصل Hosted Checkout للويب، لكن عقد العودة والإلغاء وrequired query parameters وorigin الآمن لـ`postMessage` لم يصل؛ لذلك لا نربط نتيجته بحالة الطلب بعد.
2. لا يوجد Webhook contract: payload وheaders وevent ID والتوقيع والنافذة الزمنية وإعادة المحاولة وترتيب الأحداث وعناوين المصدر غير موثقة.
3. تأكد الحساب المستقل وحقول الاعتماد الأربعة، لكن المعرف القانوني الفريد للحساب والتحقق غير المالي والتدوير والإلغاء غير موثقة.
4. لا توجد semantics موثقة لإعادة `orderId` نفسه بعد timeout، ولا Idempotency-Key، ولا مدة صلاحية `trxToken`.
5. لا توجد قائمة حالات كاملة أو جدول يحدد final/pending/failed/expired/cancelled/refunded، ولا توثيق كافٍ لاستجابة Refund أو idempotency الخاصة بها.
6. لا توجد قائمة رسمية للعملات، precision/min/max، وحدة `amount.value`، الرسوم، الحدود، أو rate limits.
7. قواعد تسجيل `callBackUrl` و`redirectUrl` و`cancelUrl` وHTTPS/allowlist غير واضحة، كما أن العلاقة بينها وبين Webhook غير محددة.
8. توجد فروق بين وصف التوقيع، README الحزمة، والـcharset المنفذ في كود الحزمة؛ نحتاج test vectors رسمية للطلب والاستجابة.
9. معنى `forceVerifySignature`، tolerance لـ`requestTimestamp`، والتحقق من signature الاستجابة غير موثقين بما يكفي.

### 5.4 الملحق الجزئي المستلم في 2026-09-07

- ثُبت عنوان API الخاص بالـSandbox، ويترجم إليه الـAdapter من القيمة الداخلية `sandbox`؛ لا يقبل الخادم base URL من التاجر.
- ثُبت وجود Hosted Checkout للويب على origin مستقل تابع للمزود. فحصنا الصفحة العامة دون `trxToken` حقيقي، وأعادت HTTPS 200 وتطبيق Flutter Web.
- تقرأ الصفحة `trxToken` و`language`، وتعرض أمثلة المزود `userIdentifier` و`fullName`. وفق وثائق SDK المنشورة هذان الحقلان اختياريان، لذلك لا ترسلهما Eoshop في URL لتقليل تسرب PII.
- بيانات الاعتماد الأربعة المطلوبة للإصدار الأول من bundle أصبحت: `appId` و`merchantKey` و`clientId` و`clientSecret`. لا تسجل قيم Sandbox المستلمة في Git أو fixtures أو الأوامر أو evidence، وتدور قبل الإنتاج.
- أكد مالك المشروع أن لكل متجر حساب مزود مستقل. ما زلنا نحتاج من BasGate تحديد المعرف القانوني للحساب، والتحقق غير المالي، والتدوير والتعطيل.
- ظهور `callBackUrl` و`redirectUrl` و`postMessage` داخل تطبيق الويب العام ليس عقدًا موثقًا نعتمد عليه. نطلب مواصفة العودة، ونستخدم Hosted Checkout كتنقل top-level لا iframe، ثم نثبت النتيجة server-to-server.

بذلك أُغلق مانع وجود مسار دفع Web، لكن لا يجوز بعد ربط نجاح الصفحة بحالة `paid` أو إظهار الدفع الإلكتروني للعملاء.

## 6. الرسالة الجاهزة لفريق BasGate

نحتاج استكمال النقاط التالية قبل دمج بوابة الدفع في بيئة الإنتاج، ويكفي إرسال قيم Sandbox منقحة بلا أي مفاتيح إنتاج:

1. أكدوا أن القيم الأربع مستقلة لكل متجر، وحددوا أي حقل يمثل هوية حساب التاجر قانونيًا، وطريقة تحقق غير مالية من كامل الاعتماد، والتعطيل وتدوير المفاتيح.
2. أكدوا الصيغة الرسمية لرابط Hosted Checkout: الحقول الإلزامية فقط، وطريقة success/cancel/return، وقواعد allowed origins. إذا كان `postMessage` عقدًا عامًا فنحتاج origin وpayload موثقين؛ وإلا سنستخدم تنقل top-level ثم تحققًا خادميًا.
3. أرسلوا Webhook specification كاملًا: URL method، payload، headers، event ID، أنواع الأحداث، خوارزمية التحقق، timestamp tolerance، retries، response timeout، وترتيب/تكرار الأحداث.
4. ثبتوا production base URL، وهل `redirect_uri` مطلوب في `client_credentials`، وقواعد تسجيل callback/redirect/cancel URLs وIP allowlist.
5. ما ضمان تكرار `orderId` بعد timeout؟ هل يعيد العملية نفسها، يرفض duplicate، أم ينشئ عملية ثانية؟ وهل يوجد Idempotency-Key رسمي؟
6. ما مدة صلاحية `trxToken` وجلسة الدفع، وجميع `trxStatus/paymentStatus` codes، وما الحالة النهائية الوحيدة للنجاح؟
7. أرسلوا العملات المدعومة ووحدة/دقة `amount.value` والحد الأدنى/الأقصى والرسوم والـrate limits.
8. أرسلوا test vectors رسمية للتوقيع والتحقق من الاستجابة، وحددوا charset الـsalt، `forceVerifySignature` في الإنتاج، وترتيب/serialization الحقول بدقة.
9. أرسلوا عقد Refund/void/cancel كاملًا، بما فيه full/partial refund والحالات والاستعلام والتكرار الآمن.
10. وضحوا أقل بيانات عميل إلزامية؛ لن نرسل اسمًا أو هاتفًا أو أي PII اختياريًا دون ضرورة موثقة.

## 7. بوابة T1

تم إنتاج [ADR 0044](../decisions/ADR-0044-per-merchant-basgate-connection-boundary.md) وتحديث عقد T1 بالملحق الجزئي. سمح تأكيد الحساب المستقل وحقول الاعتماد ببدء شريحة اتصال مركزية لا تنفذ دفعًا: تخزين مشفر، resource منقح وواجهة إعداد write-only. لا يبدأ Adapter دفع أو transaction أو Webhook أو إظهار خيار الدفع حتى تجيب BasGate عن دورة الحقيقة المالية ودقة المبلغ والتوقيع.

ثبت T1 محليًا ما يلي:

- ملكية الاتصال في قاعدة البيانات المركزية، وعدم دخوله إلى `StoreConfig` أو tenant schema أو public projection.
- حجز central migration `000017`، مع إبقاء tenant `000011` للتسويق و`000012` لدورة الدفع اللاحقة.
- اتصال BasGate واحد لكل متجر في V1، ببيئة داخلية `sandbox | production` يترجمها الـAdapter إلى تسمية وعنوان المزود المؤكدين.
- الحالات المخزنة `draft | verification_pending | active | verification_failed | disabled`، والحالة المشتقة `unconfigured`؛ الحفظ وحده ينتج `draft` ولا يدعي أن تحققًا جارٍ.
- resource قراءة منقح، وأكواد أخطاء مغلقة، وحدود revision وIdempotency والتدقيق وعدم تسريب الأسرار.
- سجل عمليات مركزي دائم للـIdempotency، ببصمة HMAC keyed للطلبات المحتوية على أسرار واستجابة replay منقحة فقط.
- حفظ key version مع ciphertext وبصمة كل receipt؛ لا يزال المفتاح القديم متاحًا حتى إعادة لف كل صف أو انتهاء/ترحيل كل receipt مرتبط به، ولا يوجد fallback إلى `APP_KEY`.
- عدم استخدام SDK الرسمي كاعتماد مباشر، وفصل `PaymentConnectionVerifier` عن session/event/refund capabilities.
- منع `active` قبل إجراء تحقق غير مالي يثبته المزود، ومنع تفعيل الدفع الإلكتروني لمجرد حفظ الاعتماد.

ثبت شكل `PUT` لحفظ bundle ذي الحقول الأربعة وإرجاع `draft`. لم يثبت endpoint التحقق أو account blind-index source؛ هذان يعتمدان مباشرة على جواب التحقق والمعرف القانوني من BasGate.

بعد وصول الإجابات تطابق الوثائق الفعلية مع القرارات التالية:

- lifecycle اتصال الحساب وأكواد الأخطاء.
- استراتيجية تخزين/تدوير الاعتماد.
- طريقة callback/webhook وربط الحدث بالمتجر بأمان.
- semantics إنشاء العملية، timeout، replay وreconciliation.
- علاقة `paid` بحالة الطلب وحجز المخزون.
- سياسة الإلغاء بعد الدفع أو المعالجة اليدوية الصريحة إن لم يدعم المزود void/refund آمنًا.

بعد اكتمال الملحق يحدث ADR 0044 وعقد دورة الدفع، ثم يتوقف للاعتماد قبل كود المعاملات والـHosted Checkout الفعلي.

## 8. مصفوفة الاختبار المطلوبة

- عزل متجرين واعتمادين مختلفين، وصلاحيات owner/staff/outsider.
- إنشاء اتصال وإعادة المحاولة بنفس Idempotency-Key وتعارض fingerprint.
- revision conflict وعدم الكتابة الجزئية.
- تشفير الأسرار ومنع ظهورها في JSON/log/audit/job/failure output.
- verify/disable/re-enable وفق lifecycle المغلق.
- فشل الشبكة وtimeout و429 و5xx دون تكرار اتصال أو تعطيل COD والتصفح.
- create-payment replay، duplicate webhook، out-of-order event، توقيع مزور، timestamp قديم وunknown merchant.
- mismatch في المبلغ/العملة/الطلب/حساب التاجر يفشل مغلقًا.
- reconciliation يعالج الحدث المفقود مرة واحدة.
- انتهاء العملية يحرر الحجز مرة واحدة، والنجاح المتأخر لا يغير طلبًا نهائيًا بصمت.
- schema جديد وقائم، وغياب جداول الدفع في tenant قديم لا يأخذ storefront offline.
- boابات Repository وFrontend وBackend وContainer و`git diff --check` على Head واحد.

## 9. الملفات المتوقعة بعد اعتماد T1

يمتلك مسار الدفع مبدئيًا:

- `backend/app/Services/Payments/*`
- `backend/app/Http/Controllers/Payments/*`
- `backend/app/Http/Requests/Payments/*`
- `backend/app/Models/*Payment*`
- `backend/app/Jobs/Payments/*`
- `backend/config/payments.php`
- central migration `000017` وtenant migration `000012`
- `src/features/payments/*`
- `src/services/paymentConnectionApi.ts` في 5.29A، ثم `paymentApi.ts` لدورة 5.29B
- `src/contracts/payments.ts`
- اختبارات الدفع وWP/ADR الخاصة به

بعد وجود مورد القراءة الخادمي، تعرض الواجهة بطاقة BasGate مستقلة داخل تبويب «الدفع والتوصيل» الحالي، دون تبويب أو route جديد ودون إدخال الحالة في `StoreConfig` أو `workspaceApi`. عمليات الربط والتحقق والتعطيل تبقى server actions مستقلة عن زر حفظ إعدادات المتجر، ولا تُبنى حقولها قبل جواب المزود.

تظل ملفات wiring المشتركة مثل routes و`MerchantStoreOperations.tsx` وDocker وintegration gate ملكًا لخطوة دمج قصيرة بعد بناء الوحدات واختبارها، ولا يعدلها مسار التسويق بالتوازي.

## 10. حالة Git ونتيجة T2

- أُنشئ Worktree مستقل من أحدث `origin/main` المعتمد.
- اكتملت شريحة T2 محليًا دون استعمال بيانات Sandbox الحقيقية ودون نداء مصادقة أو معاملة أو صفحة Hosted Checkout.
- أضيف central migration `000017` لسجل اتصال واحد لكل متجر وسجل عمليات Idempotency دائم، مع rollback يرفض حذف بيانات قائمة.
- أضيف `GET` منقح و`PUT` write-only تحت عضوية المتجر وصلاحية `tenant.store.manage` وإعادة تحقق داخل أقفال قاعدة البيانات.
- يحفظ `PUT` اتصالًا في `draft` فقط ويعيد دائمًا `canAcceptOnlinePayments=false`؛ لا يغيّر الطلب أو المخزون أو أي حالة دفع.
- تستخدم الخزنة AES-256-GCM مع AAD مرتبط بالمتجر والمزود والبيئة ونسخة الاعتماد، ومفاتيح تشفير وHMAC مستقلة ذات إصدارات وبدون fallback إلى `APP_KEY`.
- تمنع الواجهة حفظ الأسرار في React state أو `StoreConfig` أو التخزين المحلي، وتمسح الحقول بعد النجاح والفشل وتبديل المتجر وإلغاء التركيب.
- يعامل `merchantKey` و`clientSecret` حرفيًا ويرفض المسافات ومحارف Unicode الخفية بدل قصها أو تعديلها قبل التشفير.
- لا يوجد Commit أو Push أو PR أو Merge حتى نقطة التوقف هذه.

### نتائج البوابات على رأس العمل نفسه

| البوابة | النتيجة |
|---|---|
| Repository safety | ناجحة |
| Secret scan | ناجح على كامل الشجرة الجديدة؛ لا تسرب |
| Frontend | TypeScript وVite ناجحان؛ 89 ملفًا و518 اختبارًا؛ `npm audit` صفر ثغرات |
| Backend quality | Composer validate/audit، Pint لـ331 ملفًا، Larastan لـ284/284، وPHPUnit ‏9 اختبارات/48 assertion |
| Container integration | ناجحة على PostgreSQL بصور Backend وWeb من الرأس نفسه؛ 198 اختبارًا و2,546 assertion، ثم migrations وHTTP وworker وscheduler |
| `git diff --check` | ناجح |

بناء Docker النهائي أنتج JavaScript بحجم 1,141.56 kB ‏(295.02 kB gzip) وCSS بحجم 194.98 kB ‏(29.99 kB gzip). يبقى تحذير chunk الأكبر من 500 kB دين أداء معروفًا لم تُوسعه الحزمة باعتماد جديد.

### نقطة التوقف

هذه النقطة جاهزة للمراجعة كحزمة اتصال فقط. لا يبدأ WP 5.29B ولا تظهر وسيلة دفع إلكترونية للعميل حتى يصل ملحق BasGate المتبقي وتُعتمد دورة الحقيقة المالية والتوقيع والـWebhook ودقة المبلغ والحالات والتكرار الآمن. تشغيليًا لا يحذف أي KID قديم قبل إعادة تغليف كل صف مرتبط به، ولا يحذف مفتاح بصمة قبل ترحيل أو انتهاء إيصالاته.
