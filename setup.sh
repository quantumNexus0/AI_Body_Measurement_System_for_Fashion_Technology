#!/usr/bin/env bash
# =============================================================================
# setup.sh — BodyFit AI first-time project setup
# Usage: bash setup.sh
# =============================================================================

set -euo pipefail   # exit on error, undefined vars, or pipe failures

# ── Colours ──────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'

info()    { echo -e "${GREEN}[setup]${NC} $*"; }
warning() { echo -e "${YELLOW}[warn] ${NC} $*"; }
error()   { echo -e "${RED}[error]${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║        BodyFit AI — Project Setup Script              ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── 1. Root npm install ───────────────────────────────────────────────────────
info "Installing root dependencies (React, Vite, TF.js…)"
npm install
# postinstall in package.json automatically runs: cd server && npm install

# ── 2. Server npm install (explicit fallback if postinstall was skipped) ──────
if [ ! -d "server/node_modules" ]; then
  info "Installing server dependencies (Express, Mongoose, Helmet…)"
  npm install --prefix server
else
  info "server/node_modules already exists — skipping."
fi

# ── 3. Python dependencies ─────────────────────────────────────────────────────
if command -v pip &>/dev/null; then
  info "Installing Python dependencies (FastAPI, Motor, Pydantic…)"
  pip install -r python_backend/requirements.txt
else
  warning "pip not found. Skipping Python install."
  warning "To install manually: pip install -r python_backend/requirements.txt"
fi

# ── 4. Copy .env.example → server/.env (if missing) ──────────────────────────
SERVER_ENV="server/.env"
if [ -f "$SERVER_ENV" ]; then
  warning "$SERVER_ENV already exists — not overwriting."
else
  if [ -f ".env.example" ]; then
    cp .env.example "$SERVER_ENV"
    info "Created $SERVER_ENV from .env.example"
    warning "⚠  IMPORTANT: Open server/.env and fill in MONGODB_URI and any secrets before starting the server."
  else
    warning ".env.example not found — skipping env copy."
  fi
fi

# ── 5. Copy .env.example → python_backend/.env (if missing) ──────────────────
PY_ENV="python_backend/.env"
if [ -f "$PY_ENV" ]; then
  warning "$PY_ENV already exists — not overwriting."
else
  if [ -f ".env.example" ]; then
    cp .env.example "$PY_ENV"
    info "Created $PY_ENV from .env.example"
  fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✅  Setup complete!                                  ║"
echo "║                                                       ║"
echo "║  Next steps:                                          ║"
echo "║  1. Edit server/.env  (set MONGODB_URI etc.)          ║"
echo "║  2. Terminal A: cd python_backend && uvicorn main:app --reload  ║"
echo "║  3. Terminal B: npm run dev                           ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
