#!/usr/bin/env bash
# scripts/run-playwright-e2e.sh
# Playwright E2E runner for CI.
# Specs to run are defined in scripts/e2e-suites.config.sh.
# Called by the [F] Playwright E2E job in .github/workflows/ci.yml.
#
# Required env vars (injected by CI):
#   BASE_URL, API_URL, ORGANIZATION, MASTER_EMAIL, MASTER_PASSWORD
# Optional (specs that need them skip themselves when absent):
#   COACHING_EMAIL, COACHING_PASSWORD, TEACHER_EMAIL, TEACHER_PASSWORD, RUN_LIVE
set -euo pipefail

# ── 1. Check required config ──────────────────────────────────────────────────
MISSING=""
[ -z "${BASE_URL:-}" ]        && MISSING="$MISSING BASE_URL"
[ -z "${API_URL:-}" ]         && MISSING="$MISSING API_URL"
[ -z "${ORGANIZATION:-}" ]    && MISSING="$MISSING ORGANIZATION"
[ -z "${MASTER_EMAIL:-}" ]    && MISSING="$MISSING MASTER_EMAIL"
[ -z "${MASTER_PASSWORD:-}" ] && MISSING="$MISSING MASTER_PASSWORD"

if [ -n "$MISSING" ]; then
  echo "::notice::Required config not set ($MISSING) — skipping E2E tests"
  exit 0
fi

# ── 2. Write .env from injected secrets ───────────────────────────────────────
cat > .env <<EOF
BASE_URL=$BASE_URL
API_URL=$API_URL
ORGANIZATION=$ORGANIZATION
MASTER_EMAIL=$MASTER_EMAIL
MASTER_PASSWORD=$MASTER_PASSWORD
COACHING_EMAIL=${COACHING_EMAIL:-}
COACHING_PASSWORD=${COACHING_PASSWORD:-}
TEACHER_EMAIL=${TEACHER_EMAIL:-}
TEACHER_PASSWORD=${TEACHER_PASSWORD:-}
RUN_LIVE=${RUN_LIVE:-0}
EOF

# ── 3. Load suite selection ───────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=scripts/e2e-suites.config.sh
source "$SCRIPT_DIR/e2e-suites.config.sh"

# ── 4. Check at least one spec is enabled ─────────────────────────────────────
if [ "${#E2E_SPECS[@]}" -eq 0 ]; then
  echo "::notice::No specs enabled in scripts/e2e-suites.config.sh — skipping E2E tests"
  exit 0
fi

echo "Running ${#E2E_SPECS[@]} spec(s):"
for spec in "${E2E_SPECS[@]}"; do
  echo "  - $spec"
done

# ── 5. Run selected specs ─────────────────────────────────────────────────────
npx playwright test \
  "${E2E_SPECS[@]}" \
  --project=chromium
