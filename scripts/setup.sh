#!/usr/bin/env bash
set -euo pipefail

# ── Flyx 3.0 — Setup (macOS / Linux) ─────────────────────────────
# This script does everything up to 'flyx setup'.
# You'll only need to answer the config wizard's questions.

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BOLD='\033[1m'
NC='\033[0m' # No Color

echo ""
echo -e "  ${BOLD}=========================================="
echo -e "       Flyx 3.0 — Setup (macOS / Linux)"
echo -e "  ==========================================${NC}"
echo ""
echo "  This script does everything up to 'flyx setup'."
echo "  You'll only need to answer the config wizard's questions."
echo ""

# ── Check prerequisites ────────────────────────────────────────────

echo -e "  [1/4] Checking prerequisites..."

# Node.js
if ! command -v node &>/dev/null; then
    echo -e "  ${RED}X${NC}  Node.js not found."
    echo "      Install it: https://nodejs.org (v20+)"
    echo ""
    echo "      macOS (Homebrew):  brew install node"
    echo "      Linux (snap):      sudo snap install node --classic"
    exit 1
fi

NODE_MAJOR=$(node -v 2>/dev/null | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 20 ]; then
    echo -e "  ${RED}X${NC}  Node.js $NODE_MAJOR found. Flyx requires Node.js 20+."
    echo "      Update at https://nodejs.org"
    exit 1
fi
echo -e "  ${GREEN}✓${NC}  Node.js $NODE_MAJOR detected"

# Git
if ! command -v git &>/dev/null; then
    echo -e "  ${RED}X${NC}  Git not found."
    echo "      macOS:  xcode-select --install"
    echo "      Linux:  sudo apt install git  (or your distro's equivalent)"
    exit 1
fi
echo -e "  ${GREEN}✓${NC}  Git detected"

# ── Determine directory ────────────────────────────────────────────

REPO_DIR="$(pwd)"

# Check if we're already inside the Flyx repo
if [ -f "package.json" ] && grep -q '"name": "flyx"' package.json 2>/dev/null; then
    echo -e "  ${GREEN}✓${NC}  Already in Flyx repo: $REPO_DIR"
else
    echo ""
    echo -e "  Where should Flyx be installed?"
    echo "    Default: $HOME/Flyx"
    echo ""
    read -r -p "  Folder path (press Enter for default): " INSTALL_DIR
    INSTALL_DIR="${INSTALL_DIR:-$HOME/Flyx}"

    # ── Clone repo ─────────────────────────────────────────────────

    echo ""
    echo -e "  [2/4] Cloning Flyx..."

    if [ -d "$INSTALL_DIR" ]; then
        echo -e "  ${YELLOW}!${NC}  Directory already exists: $INSTALL_DIR"
        read -r -p "  Delete and re-clone? [y/N]: " OVERWRITE
        if [ "$OVERWRITE" = "y" ] || [ "$OVERWRITE" = "Y" ]; then
            rm -rf "$INSTALL_DIR"
        else
            REPO_DIR="$INSTALL_DIR"
            cd "$REPO_DIR"
        fi
    fi

    if [ ! -d "$INSTALL_DIR" ]; then
        git clone https://github.com/Vynx-Velvet/Flyx-main.git "$INSTALL_DIR"
        REPO_DIR="$INSTALL_DIR"
        cd "$REPO_DIR"
    fi
fi

# ── Install dependencies ───────────────────────────────────────────

echo ""
echo -e "  [3/4] Installing dependencies (this may take a minute)..."

# npm ci installs exactly what package-lock.json pins (no silent upgrades).
npm ci

# The lockfile is generated on Windows, so npm omits this platform's
# Tailwind/lightningcss native binaries. Install them at the lockfile's
# versions (same workaround as .github/workflows/desktop-build.yml).
NATIVE_SPECS=$(node -e 'const p=require("./package-lock.json").packages||{};const out=[];for(const n of ["lightningcss","@tailwindcss/oxide"]){const e=p["node_modules/"+n];if(e&&/^[0-9A-Za-z.+-]+$/.test(e.version||""))out.push(n+"@"+e.version)}console.log(out.join(" "))')
if [ -n "$NATIVE_SPECS" ]; then
    # shellcheck disable=SC2086
    npm install --no-save --ignore-scripts $NATIVE_SPECS
fi
echo -e "  ${GREEN}✓${NC}  Dependencies installed"

# ── Link CLI ───────────────────────────────────────────────────────

echo ""
echo -e "  [4/4] Linking 'flyx' command..."

# A git clone on macOS/Linux does not always keep the executable bit on the
# CLI entry point; without it the linked `flyx` command fails with EACCES.
chmod +x packages/cli/cli.js 2>/dev/null || true
npm run cli:link
echo -e "  ${GREEN}✓${NC}  'flyx' command linked"

# ── Done ───────────────────────────────────────────────────────────

echo ""
echo -e "  ${BOLD}==========================================${NC}"
echo -e "  ${BOLD}      Setup complete! Next step:${NC}"
echo -e "  ${BOLD}${NC}"
echo -e "  ${BOLD}      flyx setup${NC}"
echo -e "  ${BOLD}${NC}"
echo -e "  ${BOLD}  This runs the guided config wizard.${NC}"
echo -e "  ${BOLD}  It asks 4-5 questions, then builds +${NC}"
echo -e "  ${BOLD}  launches your private streaming hub.${NC}"
echo -e "  ${BOLD}==========================================${NC}"
echo ""
