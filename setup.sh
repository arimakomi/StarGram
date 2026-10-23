#!/usr/bin/env bash
# StarGram — Interactive VPS & Server Installer
# Usage: sudo bash setup.sh
# Non-interactive mode:
#   PORT=3000 ADMIN_USER=admin ADMIN_PASS=... DB_TYPE=local NONINTERACTIVE=1 sudo -E bash setup.sh
set -euo pipefail

SERVICE_NAME="stargram"
REPO_URL="${REPO_URL:-https://github.com/arimakomi/starchat.git}"
INSTALL_DIR="${INSTALL_DIR:-/opt/stargram}"
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || pwd)"

c_red=$'\e[31m'; c_grn=$'\e[32m'; c_ylw=$'\e[33m'; c_blu=$'\e[34m'; c_off=$'\e[0m'
info() { echo "${c_blu}➜${c_off} $*"; }
ok()   { echo "${c_grn}✔${c_off} $*"; }
warn() { echo "${c_ylw}!${c_off} $*"; }
die()  { echo "${c_red}✘ $*${c_off}" >&2; exit 1; }

NONINTERACTIVE="${NONINTERACTIVE:-0}"

# ───────── 1) One-line installer bootstrap ─────────
if ! { [[ -f "$SELF_DIR/server.js" ]] && grep -q '"name": "stargram"' "$SELF_DIR/package.json" 2>/dev/null; }; then
  [[ $EUID -eq 0 ]] || die "This script must be run as root (sudo bash setup.sh)."
  if ! command -v git >/dev/null 2>&1; then
    info "Installing git..."
    if command -v dnf >/dev/null 2>&1; then dnf install -y git
    elif command -v yum >/dev/null 2>&1; then yum install -y git
    elif command -v apt-get >/dev/null 2>&1; then apt-get update -qq && apt-get install -y git
    else die "git is not installed. Please install git and try again."; fi
  fi
  if [[ -d "$INSTALL_DIR/.git" ]]; then
    info "Synchronizing existing repository in $INSTALL_DIR with upstream..."
    git -C "$INSTALL_DIR" fetch --all --prune >/dev/null 2>&1 || true
    local_b="$(git -C "$INSTALL_DIR" rev-parse --abbrev-ref HEAD 2>/dev/null || echo "main")"
    [[ "$local_b" == "HEAD" || -z "$local_b" ]] && local_b="main"
    git -C "$INSTALL_DIR" reset --hard "origin/${local_b}" >/dev/null 2>&1 || git -C "$INSTALL_DIR" reset --hard origin/main >/dev/null 2>&1 || git -C "$INSTALL_DIR" pull --ff-only || true
    git -C "$INSTALL_DIR" clean -fd -e data -e "data/*" -e backups -e "backups/*" -e ".env" -e ".env.*" >/dev/null 2>&1 || true
  else
    info "Cloning StarGram into $INSTALL_DIR ..."; git clone --depth 1 "$REPO_URL" "$INSTALL_DIR"
  fi
  if [[ "${NONINTERACTIVE:-0}" != "1" && -r /dev/tty ]]; then exec bash "$INSTALL_DIR/setup.sh" < /dev/tty; fi
  exec bash "$INSTALL_DIR/setup.sh"
fi
APP_DIR="$SELF_DIR"
cd "$APP_DIR"

ask() { # ask VAR "Prompt" "Default"
  local var="$1" prompt="$2" def="${3:-}" val
  if [[ -n "${!var:-}" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]]; then printf -v "$var" '%s' "$def"; return; fi
  read -r -p "$prompt [${def}]: " val || true
  printf -v "$var" '%s' "${val:-$def}"
}
ask_secret() { # ask_secret VAR "Prompt" (empty = auto-generate)
  local var="$1" prompt="$2" val
  if [[ -n "${!var:-}" ]]; then return; fi
  if [[ "$NONINTERACTIVE" == "1" ]]; then printf -v "$var" '%s' ""; return; fi
  read -r -s -p "$prompt (leave empty to auto-generate): " val || true; echo
  printf -v "$var" '%s' "$val"
}
rand() { head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c "${1:-16}"; }

[[ $EUID -eq 0 ]] || die "This script must be run as root: sudo bash setup.sh"

echo
echo "${c_blu}══════════════ StarGram Setup ══════════════${c_off}"

# ───────── 2) OS and Package Manager Detection ─────────
if command -v dnf >/dev/null 2>&1; then PM="dnf"
elif command -v yum >/dev/null 2>&1; then PM="yum"
elif command -v apt-get >/dev/null 2>&1; then PM="apt"
else PM=""; fi

# ───────── 3) Node.js ≥ 18 Check & Install ─────────
node_ok() { command -v node >/dev/null 2>&1 && [[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ]]; }
if ! node_ok; then
  info "Node.js 18+ not found; installing Node.js 20 LTS..."
  case "$PM" in
    dnf|yum) curl -fsSL https://rpm.nodesource.com/setup_20.x | bash - && "$PM" install -y nodejs ;;
    apt)     curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs ;;
    *)       die "Package manager not recognized; please install Node.js 18+ manually." ;;
  esac
fi
node_ok || die "Node.js installation failed."
ok "Node.js runtime $(node -v) is active."

# ───────── 4) Configuration Prompts ─────────
echo
ask PORT "Application HTTP port" "3000"
[[ "$PORT" =~ ^[0-9]+$ && "$PORT" -ge 1 && "$PORT" -le 65535 ]] || die "Invalid HTTP port number (must be 1-65535)."
if command -v ss >/dev/null 2>&1 && ss -ltn "( sport = :$PORT )" 2>/dev/null | grep -q LISTEN; then
  if ! systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    warn "Port $PORT is currently in use by another running process."
  fi
fi

echo
ask ADMIN_USER "Administrator username" "admin"
ADMIN_USER="$(echo "$ADMIN_USER" | tr '[:upper:]' '[:lower:]')"
[[ ${#ADMIN_USER} -ge 3 && ${#ADMIN_USER} -le 32 && ! "$ADMIN_USER" =~ [[:space:]/\\] ]] || die "Admin username must be 3-32 characters without spaces or slashes."
ask_secret ADMIN_PASS "Administrator password (min 6 characters)"
GENERATED_ADMIN=0
if [[ -z "$ADMIN_PASS" ]]; then ADMIN_PASS="$(rand 16)"; GENERATED_ADMIN=1; fi
[[ ${#ADMIN_PASS} -ge 6 ]] || die "Admin password must be at least 6 characters."

echo
info "Database Engine Selection"
ask DB_TYPE "Database type (mysql / postgres / local)" "mysql"
DB_TYPE="$(echo "$DB_TYPE" | tr '[:upper:]' '[:lower:]')"

GENERATED_DB=0
if [[ "$DB_TYPE" == "local" ]]; then
  ok "Local JSON Storage engine selected (no external SQL server required)."
  DB_HOST=""
  DB_PORT=""
  DB_NAME=""
  DB_USER=""
  DB_PASS=""
elif [[ "$DB_TYPE" == "postgres" || "$DB_TYPE" == "pgsql" ]]; then
  DB_TYPE="postgres"
  info "PostgreSQL Configuration"
  ask DB_HOST "PostgreSQL server host" "127.0.0.1"
  ask DB_PORT "PostgreSQL port" "5432"
  ask DB_NAME "PostgreSQL database name" "stargram"
  ask DB_USER "PostgreSQL username" "postgres"
  ask_secret DB_PASS "PostgreSQL password"
  if [[ -z "$DB_PASS" ]]; then DB_PASS="$(rand 20)"; GENERATED_DB=1; fi
else
  DB_TYPE="mysql"
  info "MySQL / MariaDB Configuration"
  ask DB_HOST "MySQL database host" "127.0.0.1"
  ask DB_PORT "MySQL port" "3306"
  ask DB_NAME "MySQL database name" "stargram"
  ask DB_USER "MySQL username" "stargram"
  ask_secret DB_PASS "MySQL password"
  if [[ -z "$DB_PASS" ]]; then DB_PASS="$(rand 20)"; GENERATED_DB=1; fi
fi

# ───────── 5) Dependencies Installation ─────────
info "Installing dependencies (npm install)..."
npm install --no-audit --no-fund >/dev/null 2>&1 || npm install --no-audit --no-fund
ok "Dependencies installed successfully."

# ───────── 6) .env Configuration File ─────────
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
ok "Created $APP_DIR/.env configuration file (admin password is encrypted and not stored in plaintext)."

# ───────── 7) Production Build & Database Setup ─────────
info "Building production frontend bundle (npm run build)..."
npm run build >/dev/null 2>&1 || npm run build
ok "Production build completed."

info "Initializing database schema and administrator account..."
ADMIN_PASS="$ADMIN_PASS" node server.js --init

# ───────── 8) systemd Service Setup ─────────
if command -v systemctl >/dev/null 2>&1 && [[ -d /run/systemd/system ]]; then
  NODE_BIN="$(command -v node)"
  cat > "/etc/systemd/system/${SERVICE_NAME}.service" <<EOF
[Unit]
Description=StarGram Messenger
After=network.target mariadb.service mysqld.service postgresql.service

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
  if systemctl is-active --quiet "$SERVICE_NAME"; then
    ok "StarGram service ($SERVICE_NAME) is active and running."
  else
    warn "Service failed to start automatically; inspect logs with: journalctl -u $SERVICE_NAME -n 50"
  fi
else
  warn "systemd not detected. Run StarGram manually with: cd $APP_DIR && npm start"
fi

# ───────── 9) CLI Command Link ─────────
chmod +x "$APP_DIR/bin/stargram"
ln -sf "$APP_DIR/bin/stargram" /usr/local/bin/stargram && ok "CLI tool 'stargram' installed to /usr/local/bin/stargram."

# ───────── 10) Firewalld (Optional) ─────────
if command -v firewall-cmd >/dev/null 2>&1 && firewall-cmd --state >/dev/null 2>&1; then
  firewall-cmd --permanent --add-port="${PORT}/tcp" >/dev/null 2>&1 && firewall-cmd --reload >/dev/null 2>&1 && ok "Port $PORT opened in firewalld."
fi

IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo
echo "${c_grn}══════════════ Installation Complete ══════════════${c_off}"
echo "  Access URL:     http://${IP:-SERVER_IP}:$PORT"
echo "  Admin User:     $ADMIN_USER"
[[ $GENERATED_ADMIN -eq 1 ]] && echo "  Admin Pass:     $ADMIN_PASS   ${c_ylw}(Save this now; not stored in plaintext)${c_off}"
if [[ "$DB_TYPE" == "local" ]]; then
  echo "  Database:       Local JSON Storage ($APP_DIR/data/stargram_db.json)"
else
  echo "  Database:       $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME ($DB_TYPE)"
  [[ $GENERATED_DB -eq 1 ]] && echo "  Database Pass:  (Saved in $APP_DIR/.env)"
fi
echo "  Management:     Run 'sudo stargram' (interactive menu: status, port, backup, update, uninstall)"
echo "  Production Tip: Recommend placing behind Nginx or Caddy with SSL/TLS reverse proxy."
echo
