#!/usr/bin/env bash
# StarGram — نصب‌کننده تعاملی
# اجرا:  sudo bash setup.sh
# حالت بدون پرسش: PORT=3000 ADMIN_USER=admin ADMIN_PASS=... DB_HOST=... DB_NAME=... DB_USER=... DB_PASS=... NONINTERACTIVE=1 sudo -E bash setup.sh
set -euo pipefail

SERVICE_NAME="stargram"
REPO_URL="${REPO_URL:-https://github.com/arimakomi/StarGram.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/stargram}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_blu=$'\e[34m'; c_off=$'\e[0m'
info() { echo "${c_blu}➜${c_off} $*"; }
ok()   { echo "${c_grn}✔${c_off} $*"; }
warn() { echo "${c_ylw}!${c_off} $*"; }
die()  { echo "${c_red}✘ $*${c_off}" >&2; exit 1; }

NONINTERACTIVE="${NONINTERACTIVE:-0}"

# ───────── نصب با یک خط: اگر کنار سورس پروژه اجرا نشده، اول پروژه را دریافت می‌کنیم ─────────
if ! { [[ -f "$SELF_DIR/server.js" ]] && grep -q '"name": "stargram"' "$SELF_DIR/package.json" 2>/dev/null; }; then
  [[ $EUID -eq 0 ]] || die "این اسکریپت باید با root اجرا شود."
  if ! command -v git >/dev/null 2>&1; then
    info "نصب git…"
    if command -v dnf >/dev/null 2>&1; then dnf install -y git
    elif command -v yum >/dev/null 2>&1; then yum install -y git
    elif command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get install -y git
    else die "git نصب نیست."; fi
  fi
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "به‌روزرسانی سورس در $INSTALL_DIR …"; git -C "$INSTALL_DIR" pull --ff-only
  else
    info "دریافت StarGram در $INSTALL_DIR …"; git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
  if [[ "${NONINTERACTIVE:-0}" != "1" && -r /dev/tty ]]; then exec bash "$INSTALL_DIR/setup.sh" < /dev/tty; fi
  exec bash "$INSTALL_DIR/setup.sh"
fi
APP_DIR="$SELF_DIR"
cd "$APP_DIR"

ask() { # ask VAR "متن" "پیش‌فرض"
  local var="$1" prompt="$2" def="${3:-}" val
  if [[ -n "${!var:-}" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]]; then printf -v "$var" '%s' "$def"; return; fi
  read -r -p "$prompt [${def}]: " val || true
  printf -v "$var" '%s' "${val:-$def}"
}
ask_secret() { # ask_secret VAR "متن"  (خالی = رمز تصادفی)
  local var="$1" prompt="$2" val
  if [[ -n "${!var:-}" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]]; then printf -v "$var" '%s' ""; return; fi
  read -r -s -p "$prompt (خالی = تولید خودکار): " val || true; echo
  printf -v "$var" '%s' "$val"
}
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-16}"; }

[[ $EUID -eq 0 ]] || die "این اسکریپت باید با root اجرا شود (sudo bash setup.sh)."

echo
echo "${c_blu}══════════════ نصب StarGram ══════════════${c_off}"

# ───────── ۱) سیستم‌عامل و پکیج‌منیجر ─────────
if command -v dnf >/dev/null 2>&1; then PM="dnf"
elif command -v yum >/dev/null 2>&1; then PM="yum"
elif command -v apt-get >/dev/null 2>&1; then PM="apt"
else PM=""; fi

# ───────── ۲) Node.js ≥ 18 ─────────
node_ok() { command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]]; }
if ! node_ok; then
  info "Node.js نسخه ۱۸+ پیدا نشد؛ در حال نصب Node.js 20…"
  case "$PM" in
    dnf|yum) curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && "$PM" install -y nodejs ;;
    apt)     curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs ;;
    *)       die "پکیج‌منیجر شناخته نشد؛ Node.js 18+ را دستی نصب کنید." ;;
  esac
fi
node_ok || die "نصب Node.js ناموفق بود."
ok "Node.js $(node -v)"

# ───────── ۳) پرسش تنظیمات ─────────
echo
ask PORT "پورت اجرای برنامه" "3000"
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1 && "$PORT" -le 65535 ]] || die "پورت نامعتبر است."
if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN; then
  if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    warn "پورت $PORT الان توسط برنامه‌ی دیگری استفاده می‌شود."
  fi
fi

echo
ask ADMIN_USER "نام کاربری ادمین" "admin"
ADMIN_USER="$(echo "$ADMIN_USER" | tr '[:upper:]' '[:lower:]')"
[[ ${#ADMIN_USER} -ge 3 && ${#ADMIN_USER} -le 32 && ! "$ADMIN_USER" =~ [[:space:]/\\] ]] || die "نام کاربری ادمین باید ۳ تا ۳۲ کاراکتر و بدون فاصله باشد."
ask_secret ADMIN_PASS "رمز عبور ادمین (حداقل ۶ کاراکتر)"
GENERATED_ADMIN=0
if [[ -z "$ADMIN_PASS" ]]; then ADMIN_PASS="$(rand 16)"; GENERATED_ADMIN=1; fi
[[ ${#ADMIN_PASS} -ge 6 ]] || die "رمز ادمین باید حداقل ۶ کاراکتر باشد."

echo
info "انتخاب پایگاه‌داده (Database Engine)"
ask DB_TYPE "نوع دیتابیس (mysql / postgres / local)" "mysql"
DB_TYPE="$(echo "$DB_TYPE" | tr '[:upper:]' '[:lower:]')"

if [[ "$DB_TYPE" == "local" ]]; then
  ok "حالت ذخیره‌سازی محلی (Local JSON Storage) انتخاب شد؛ نیازی به نصب دیتابیس خارجی نیست."
  DB_HOST=""
  DB_PORT=""
  DB_NAME=""
  DB_USER=""
  DB_PASS=""
elif [[ "$DB_TYPE" == "postgres" || "$DB_TYPE" == "pgsql" ]]; then
  info "تنظیمات PostgreSQL"
  ask DB_HOST "آدرس سرور PostgreSQL" "127.0.0.1"
  ask DB_PORT "پورت PostgreSQL" "5432"
  ask DB_NAME "نام دیتابیس" "stargram"
  ask DB_USER "نام کاربری PostgreSQL" "postgres"
  ask_secret DB_PASS "رمز عبور PostgreSQL"
  GENERATED_DB=0
  if [[ -z "$DB_PASS" ]]; then DB_PASS="$(rand 20)"; GENERATED_DB=1; fi
else
  DB_TYPE="mysql"
  info "تنظیمات دیتابیس MySQL / MariaDB"
  ask DB_HOST "آدرس دیتابیس" "127.0.0.1"
  ask DB_PORT "پورت دیتابیس" "3306"
  ask DB_NAME "نام دیتابیس" "stargram"
  ask DB_USER "نام کاربری دیتابیس" "stargram"
  ask_secret DB_PASS "رمز دیتابیس"
  GENERATED_DB=0
  if [[ -z "$DB_PASS" ]]; then DB_PASS="$(rand 20)"; GENERATED_DB=1; fi
fi

info "نصب وابستگی‌ها (npm install)…"
npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund
ok "وابستگی‌ها نصب شد."

# ───────── ۵) فایل .env ─────────
umask 077
cat > "$APP_DIR/.env" <<EOF
PORT=$PORT
DB_TYPE=$DB_TYPE
DB_HOST=$DB_HOST
DB_PORT=$DB_PORT
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_PASS=$DB_PASS
ADMIN_USER=$ADMIN_USER
EOF
chmod 600 "$APP_DIR/.env"
ok "فایل .env ساخته شد (رمز ادمین در آن ذخیره نمی‌شود)."

# ───────── ۶) بیلد + ساخت جدول‌ها و ادمین ─────────
info "ساخت نسخه‌ی پروداکشن (npm run build)…"
npm run build >/dev/null 2>&1 || npm run build
ok "بیلد انجام شد."

info "ساخت جدول‌ها و حساب ادمین…"
ADMIN_PASS="$ADMIN_PASS" node server.js --init

# ───────── ۷) سرویس systemd ─────────
if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  NODE_BIN="$(command -v node)"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=StarGram Messenger
After=network.target mariadb.service mysqld.service

[Service]
Type=simple
WorkingDirectory=$APP_DIR
ExecStart=$NODE_BIN $APP_DIR/server.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF
  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1
  systemctl restart "$SERVICE_NAME"
  sleep 2
  if systemctl is-active --quiet "$SERVICE_NAME"; then ok "سرویس $SERVICE_NAME فعال شد."; else warn "سرویس بالا نیامد؛ لاگ: journalctl -u $SERVICE_NAME -n 50"; fi
else
  warn "systemd یافت نشد. برنامه را دستی اجرا کنید:  cd $APP_DIR && npm start"
fi

# دستور مدیریتی  stargram
chmod +x "$APP_DIR/bin/stargram"
ln -sf "$APP_DIR/bin/stargram" /usr/local/bin/stargram && ok "دستور «stargram» نصب شد (منوی مدیریت)."

# فایروال (اختیاری، بی‌صدا)
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 && ok "پورت $PORT در firewalld باز شد."
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "${c_grn}══════════════ نصب کامل شد ══════════════${c_off}"
echo "  آدرس:           http://${IP:-SERVER_IP}:$PORT"
echo "  ادمین:          $ADMIN_USER"
[[ $GENERATED_ADMIN -eq 1 ]] && echo "  رمز ادمین:      $ADMIN_PASS   ${c_ylw}(همین حالا ذخیره کنید؛ جای دیگری نگه‌داری نمی‌شود)${c_off}"
echo "  دیتابیس:        $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME"
[[ $GENERATED_DB -eq 1 ]] && echo "  رمز دیتابیس:    (در $APP_DIR/.env ذخیره شد)"
echo "  مدیریت:         دستور  stargram  (منو: وضعیت، قطع/وصل، پورت، لاگ، به‌روزرسانی)"
echo "  توصیه:          پشت Nginx/Caddy با HTTPS قرار دهید (راهنما در README)."
echo
