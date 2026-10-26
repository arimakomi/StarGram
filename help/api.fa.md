# مستندات کامل REST API پیام‌رسان StarGram (نسخه ۱)

این سند راهنمای جامع اتصال، ارسال و دریافت پیام، ساخت کلاینت‌های اختصاصی و ربات‌ها، و مدیریت کامل پیام‌رسان از طریق REST API است.

---

## ۱. اصول اتصال و Base URL

- **آدرس پایه در سرور محلی:** `http://localhost:3000/api/v1`
- **آدرس پایه در سرور اینترنتی:** `https://your-domain.com/api/v1`
- **قالب تبادل داده:** تمام بدنه درخواست‌ها و پاسخ‌ها به صورت `application/json` با کدگذاری UTF-8 ارسال و دریافت می‌شود.

---

## ۲. احراز هویت با کلیدهای امن (Bearer Token)

تمام درخواست‌های نیازمند مجوز باید هدر زیر را ارسال کنند:

```http
Authorization: Bearer <API_TOKEN>
Content-Type: application/json
```

### نحوه ایجاد توکن در پنل ادمین:
1. ورود با حساب کاربری مدیر یا سوپرادمین
2. کلیک روی آیکون منو > **پنل مدیریت سیستم**
3. انتخاب برگه **«مدیریت API و توکن‌ها»**
4. کلیک روی **«تولید توکن امن جدید»**
5. انتخاب نام و برچسب کلید (مثلاً «ربات پشتیبانی») و مشخص کردن زمان انقضا
6. ذخیره کلید ۶۴ کاراکتری `stg_live_...` در جای امن

---

## ۳. جدول کامل مسیرها (Endpoints)

### الف) مدیریت و آمار سیستم
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/v1/admin/stats` | آمار زنده سیستم (تعداد کاربران، چت‌ها، پیام‌ها، آپتایم) |
| `GET` | `/api/v1/admin/config` | دریافت تنظیمات جاری برند، نام، لوگو و محدودیت‌ها |
| `PATCH` | `/api/v1/admin/config` | ویرایش تنظیمات برند (نام برنامه، شعار، لوگوها) |
| `POST` | `/api/v1/admin/broadcast` | ارسال پیام سراسری (اطلاعیه) به تمام کانال‌ها/گروه‌ها |
| `GET` | `/api/v1/admin/tokens` | مشاهده فهرست کلیدهای API فعال |
| `POST` | `/api/v1/admin/tokens` | تولید کلید API جدید |
| `DELETE` | `/api/v1/admin/tokens/:id` | ابطال و حذف توکن API |

### ب) مدیریت کاربران (Users)
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/v1/users` | فهرست کاربران با فیلتر جستجو (`search`, `role`, `limit`, `offset`) |
| `GET` | `/api/v1/users/:id` | دریافت پروفایل عمومی کاربر |
| `POST` | `/api/v1/users` | ساخت مستقیم کاربر توسط ادمین |
| `PATCH` | `/api/v1/users/:id` | ویرایش پروفایل، تغییر نقش، مسدودسازی یا تغییر رمز عبور |
| `DELETE` | `/api/v1/users/:id` | حذف کامل کاربر |

### ج) چت‌ها، گروه‌ها و کانال‌ها (Chats)
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/v1/chats` | فهرست گفتگوها (با فیلتر `type=private/group/channel`) |
| `POST` | `/api/v1/chats` | ساخت چت خصوصی، گروه یا کانال جدید |
| `GET` | `/api/v1/chats/:id` | دریافت اطلاعات گفتگو و لیست اعضا |
| `DELETE` | `/api/v1/chats/:id` | حذف گفتگو یا کانال |

### د) پیام‌ها (Messages)
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/v1/chats/:id/messages` | دریافت پیام‌های یک گفتگو (`limit`, `before`, `after`) |
| `POST` | `/api/v1/chats/:id/messages` | ارسال پیام جدید (متنی، رسانه‌ای، نظرسنجی، ریپلای). در صورت تجاوز حجم مدیا از سقف مجاز سرور (`maxUploadSizeMb`)، خطای `413 Payload Too Large` برمی‌گرداند. |
| `DELETE` | `/api/v1/chats/:id/messages/:msgId` | حذف پیام |
| `POST` | `/api/v1/chats/:id/messages/:msgId/reactions` | ثبت واکنش ایموجی روی پیام |

### هـ) ورود و ثبت‌نام کاربران برای اپ‌های جانبی (Auth)
| متد | مسیر | توضیحات |
|---|---|---|
| `POST` | `/api/v1/auth/login` | ورود کاربر با نام کاربری و رمزعبور و دریافت توکن کلاینت |
| `POST` | `/api/v1/auth/register` | ثبت‌نام کاربر جدید |
| `GET` | `/api/v1/auth/me` | دریافت اطلاعات حساب کاربری وارد شده |

### و) مدیریت دستگاه‌ها، نشست‌ها و اعلان‌ها (Sessions & Devices)
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/v1/sessions` | فهرست نشست‌های فعال کاربر (با متادیتای سیستم‌عامل، مرورگر، وضعیت آنلاین و دسترسی اعلان) |
| `GET` | `/api/v1/sessions/:id` | دریافت جزئیات و متادیتای یک نشست مشخص |
| `PATCH` | `/api/v1/sessions/:id/notifications` | ویرایش دسترسی اعلان هر دستگاه (`enabled`، `previewText`، `sound`، `muteUntil`) |
| `DELETE` | `/api/v1/sessions/:id` | خاتمه دادن به یک نشست مشخص و لغو دسترسی دستگاه |
| `POST` | `/api/v1/sessions/terminate-others` | خاتمه دادن به تمام نشست‌های دیگر کاربر به جز نشست جاری |

### ز) سامانه پیامک، اعتبارسنجی شماره همراه و ورود OTP (Iran Payamak)
| متد | مسیر | توضیحات |
|---|---|---|
| `GET` | `/api/users/check-phone/:phone` | بررسی یکتا و آزاد بودن شماره همراه جهت ثبت |
| `POST` | `/api/v1/sms/send-otp` | ارسال کد تایید یکبار مصرف (`phone`, `purpose: 'login'\|'verify'`) |
| `POST` | `/api/v1/sms/verify-otp` | بررسی صحت کد OTP، تایید شماره یا لاگین و ثبت‌نام خودکار |
| `POST` | `/api/v1/admin/sms/test` | تست زنده ارسال پیامک درگاه ایران پیامک (مخصوص مدیر) |

---

## ۴. ساختار شیء تنظیمات اعلان نشست (SessionNotificationSettings)

```json
{
  "enabled": true,        // فعال یا غیرفعال بودن کلی اعلان‌ها
  "previewText": true,    // نمایش متن پیام در کادر اعلان
  "sound": true,          // پخش صدای زنگ
  "muteUntil": 1740000000 // زمان پایان بی‌صدا موقت (میلی‌ثانیه) یا null
}
```

---

## ۵. راهنمای کار با وب‌سرویس پیامک و ورود با OTP (Iran Payamak)

### ۱. ارسال کد تایید یکبار مصرف (`POST /api/v1/sms/send-otp`)
```json
// Request Body
{
  "phone": "09121234567",
  "purpose": "login", // یا "verify" برای تایید شماره در پروفایل
  "userId": "optional_user_id" // در حالت verify الزامی است
}

// Response
{
  "success": true,
  "message": "کد تایید ارسال شد.",
  "simulated": false, // اگر در حالت fallback باشد true برمی‌گرداند
  "expiresInSeconds": 120
}
```

### ۲. اعتبارسنجی کد و ورود / ثبت‌نام (`POST /api/v1/sms/verify-otp`)
```json
// Request Body
{
  "phone": "09121234567",
  "code": "123456",
  "purpose": "login", // یا "verify"
  "username": "my_new_username", // اختیاری؛ فقط در صورت ثبت‌نام کاربر جدید
  "displayName": "نام و نام خانوادگی" // اختیاری؛ برای کاربر جدید
}

// Response (در صورت ورود موفق)
{
  "success": true,
  "message": "ورود با موفقیت انجام شد.",
  "token": "stg_sess_...",
  "user": {
    "id": "my_username",
    "username": "my_username",
    "displayName": "...",
    "phone": "09121234567",
    "isPhoneVerified": true
  }
}
```

### ۳. فیلدهای پیکربندی پیامک در `PATCH /api/v1/admin/config`
- `smsOtpEnabled` (Boolean): فعال یا غیرفعال بودن کل سیستم تایید پیامکی و لاگین با شماره (پیش‌فرض true).
- `smsFallbackEnabled` (Boolean): فعال یا غیرفعال بودن حالت شبیه‌سازی اضطراری در زمان قطعی یا عدم شارژ درگاه (پیش‌فرض true).
- `smsApiKey` (String): توکن وب‌سرویس پنل ایران پیامک.
- `smsLineNumber` (String): خط اختصاصی ارسال پیامک.
- `smsSendMode` ('pattern' | 'standard'): ارسال با پترن خدماتی پرسرعت یا خط عادی.
- `smsPatternCode` (String): کد قالب پترن تایید شده در ایران پیامک.
- `smsPatternVarName` (String): نام متغیر در الگو (پیش‌فرض code).
- `otpExpiresInMinutes` (Number): زمان اعتبار کد (۱ تا ۵ دقیقه).
- `otpCodeLength` (Number): طول کد تایید (۵ یا ۶ رقم).
- `requireVerifiedPhoneForMessaging` (Boolean): محدودیت ارسال پیام فقط برای کاربران با شماره تایید شده.
- `maxUploadSizeMb` (Number): حداکثر سقف مجاز حجم فایل‌ها و رسانه‌های ارسالی کاربران به مگابایت (پیش‌فرض ۱۵ مگابایت؛ گزینه‌های ۵، ۱۰، ۱۵، ۲۵ یا ۵۰ مگابایت). در صورت تجاوز حجم فایل، خطای HTTP `413 Payload Too Large` صادر می‌گردد.

---

## ۶. کدهای خطای مهم سرور (Error Codes)
- **`400 Bad Request`**: نقص در پارامترهای ارسالی یا فرمت نامعتبر شماره همراه / نام کاربری.
- **`401 Unauthorized`**: نیاز به توکن Bearer یا انقضای نشست.
- **`403 Forbidden`**: عدم برخورداری از دسترسی مدیر یا الزام به شماره همراه تایید شده (`requireVerifiedPhoneForMessaging`).
- **`404 Not Found`**: منبع مورد نظر (چت، کاربر، پیام یا نشست) یافت نشد.
- **`409 Conflict`**: شماره همراه یا نام کاربری تکراری است.
- **`413 Payload Too Large`**: حجم رسانه یا فایل ارسالی بیشتر از سقف مجاز تعریف‌شده توسط مدیریت (`maxUploadSizeMb`) است.
- **`429 Too Many Requests`**: بیش از حد مجاز بودن تعداد درخواست‌های ارسال OTP یا ورود ناموفق.

---

## ۶. نمونه کدهای عملی

### ۱. جاوااسکریپت / Node.js
```javascript
const TOKEN = "stg_live_YOUR_TOKEN";
const BASE_URL = "http://localhost:3000/api/v1";

// ارسال پیام به چت
async function postMessage(chatId, messageText) {
  const res = await fetch(`${BASE_URL}/chats/${chatId}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ text: messageText })
  });
  return await res.json();
}
```

### ۲. پایتون (Python)
```python
import requests

TOKEN = "stg_live_YOUR_TOKEN"
headers = {
    "Authorization": f"Bearer {TOKEN}",
    "Content-Type": "application/json"
}

# دریافت آمار سرور
stats = requests.get("http://localhost:3000/api/v1/admin/stats", headers=headers).json()
print("تعداد پیام‌ها:", stats["stats"]["totalMessages"])
```

### ۳. cURL در ترمینال لینوکس
```bash
curl -X GET "http://localhost:3000/api/v1/admin/stats" \
  -H "Authorization: Bearer stg_live_YOUR_TOKEN"
```
