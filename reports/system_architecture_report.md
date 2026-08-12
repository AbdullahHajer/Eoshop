# وثيقة المعمارية الفنية ودليل إطلاق المنصة
## Mobtaker E-Commerce Multi-Tenant SaaS Platform

---

### 1. إجابة الأسئلة واكتمال البنية الحالية

نعم، النظام **مكتمل تماماً، متناسق، وجاهز للإطلاق والنشر على سيرفر VPS**:

1. **البنية الخلفية الجديدة (Backend):**
   - تعمل بإطار عمل **Laravel 11 (PHP 8.4)** داخل حاوية Docker مخصصة.
2. **قواعد البيانات (PostgreSQL 16):**
   - متصلة وجاهزة، وتم إعداد قاعدة البيانات المركزية `platform_main` وإنشاء جدول المتاجر والنطاقات (`tenants`, `domains`).
3. **الفصل بين المستأجرين (Tenant Isolation):**
   - نمط **Database-per-Tenant** ينشئ قاعدة بيانات معزولة كلياً لكل متجر ببادئة `tenant_` لمنع أي اختلاط بين بيانات التجار.
4. **الدومين الفرعي (Subdomain Routing):**
   - مدعوم من خلال Nginx وحزمة `stancl/tenancy` v3 (`subdomain.domain.com`).
5. **الذكاء الاصطناعي (Google Gemini API):**
   - مدمج بكلاس خدمة مخصص `GeminiStoreGeneratorService` بالـ Laravel لتوليد أفكار وهويات المتاجر والمنتجات باللغة العربية.
6. **الجاهزية للنشر (VPS Readiness):**
   - البيئة محزومة كلياً بـ **Docker Compose**، مما يعني أن الرفع على الـ VPS لا يطلب سوى أمر واحد `docker compose up -d` بعد توجيه الـ DNS.

---

### 2. ملخص القرارات والتعديلات المعمارية المعتمدة

| المجال | الوضع السابق | الوضع المعماري المعتمد |
| :--- | :--- | :--- |
| **إطار عمل الـ Backend** | Express.js بسيط | **Laravel 11 (PHP 8.4) API** مع `stancl/tenancy` v3 |
| **قواعد البيانات والعزل** | `localStorage` في متصفح العميل | **PostgreSQL 16 + Database-per-Tenant** |
| **توجيه النطاقات** | غير متاح | **Subdomain Routing** عبر Nginx و Stancl Tenancy |
| **خدمة الذكاء الاصطناعي** | Node.js SDK | **Gemini Store Generator Service** بـ Laravel |
| **بيئة التشغيل والنشر** | تشغيل يدوي | **Docker Compose** موحد (Nginx, PHP 8.4, Postgres, PgBouncer) |

---

### 3. دليل الخطوات للتشغيل المحلي والنشر الإنتاجي (Step-by-Step Guide)

#### أ. التشغيل المحلي (Local Development)
1. تشغيل البيئة:
   ```bash
   docker compose up -d
   ```
2. تطبيق الميغريشن الرئيسي:
   ```bash
   docker compose exec backend php artisan migrate --path=database/migrations/system
   ```
3. رابط المعاينة المحلي: `http://localhost:8000`

#### ب. الرفع والنشر على سيرفر الـ VPS (Production VPS Launch)
1. ضبط سجلات الـ DNS في مزود النطاق:
   - `A Record`: `*` -> `IP_VPS`
   - `A Record`: `@` -> `IP_VPS`
2. تشغيل الحاويات والميغريشن على الـ VPS:
   ```bash
   docker compose up -d --build
   docker compose exec backend php artisan migrate --path=database/migrations/system
   ```

---

### 4. دليل ملفات التقرير والمشروع

- **تقرير الـ HTML التفاعلي المنسق:** [system_architecture_report.html](file:///d:/Travel-X%20COMPANY/TX-SaaS/Devops-moh/onlineshop-main/reports/system_architecture_report.html)
- **ملف تركيب Docker:** [docker-compose.yml](file:///d:/Travel-X%20COMPANY/TX-SaaS/Devops-moh/onlineshop-main/docker-compose.yml)
- **ملف Nginx:** [default.conf](file:///d:/Travel-X%20COMPANY/TX-SaaS/Devops-moh/onlineshop-main/docker/nginx/default.conf)
