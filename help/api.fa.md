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
| `POST` | `/api/v1/chats/:id/messages` | ارسال پیام جدید (متنی، رسانه‌ای، نظرسنجی، ریپلای) |
| `DELETE` | `/api/v1/chats/:id/messages/:msgId` | حذف پیام |
| `POST` | `/api/v1/chats/:id/messages/:msgId/reactions` | ثبت واکنش ایموجی روی پیام |

### هـ) ورود و ثبت‌نام کاربران برای اپ‌های جانبی (Auth)
| متد | مسیر | توضیحات |
|---|---|---|
| `POST` | `/api/v1/auth/login` | ورود کاربر با نام کاربری و رمزعبور و دریافت توکن کلاینت |
| `POST` | `/api/v1/auth/register` | ثبت‌نام کاربر جدید |
| `GET` | `/api/v1/auth/me` | دریافت اطلاعات حساب کاربری وارد شده |

---

## ۴. نمونه کدهای عملی

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
