#!/usr/bin/env bash
# scripts/diff-aware-check.sh
# Pre-commit diff-aware quality checks.
#
# Usage:
#   diff-aware-check.sh <subcommand>
#
# Subcommands:
#   gitleaks           Secret/credential scan
#   no-debug           Block console.log / debugger
#   no-ts-suppress     Block @ts-ignore / @ts-nocheck / @ts-expect-error
#   no-explicit-any    Block explicit 'any' type
#   no-nolint          Block nolint comments
#   no-todo            Block TODO/FIXME without ticket ref
#   prettier           Format with Prettier
#   eslint             Lint with ESLint
#   license            License compliance check
#   deps               Duplicate dep version check
#   biome              Biome lint/format check
#   circular-deps      Circular dependency detection
#   boundaries         Module boundary enforcement
#   vitest             Vitest unit tests
#   commit-msg         Commit message ticket ref check
#
# Environment:
#   FULL_SCAN — true|false (default: false)
#
# Behaviour:
#   FULL_SCAN=false → staged files only  (git diff --cached)
#   FULL_SCAN=true  → all tracked files  (git ls-files)

set -euo pipefail

# Set to "true" for full-repo scan, "false" for staged-only (default)
FULL_SCAN="${FULL_SCAN:-false}"
EXCLUDE_PATTERN="^(node_modules/|dist/|\.gitnexus/|\.claude/)"

# ── File helpers ───────────────────────────────────────────────────────────────

_staged_files() {
  git diff --cached --name-only --diff-filter=ACM \
    | grep -E "$1" \
    | grep -vE "$EXCLUDE_PATTERN" \
    || true
}

_all_files() {
  git ls-files \
    | grep -E "$1" \
    | grep -vE "$EXCLUDE_PATTERN" \
    || true
}

_is_full_scan() { [ "${FULL_SCAN}" = "true" ]; }

_get_files() {
  if _is_full_scan; then _all_files "$1"; else _staged_files "$1"; fi
}

# ── Subcommand: tsc ───────────────────────────────────────────────────────────

cmd_tsc() {
  npx tsc --noEmit
}

# ── Internal grep helper ───────────────────────────────────────────────────────

_grep_check() {
  local pattern="$1" ext="$2" desc="$3" extra_excl="${4:-}"
  local files; files=$(_get_files "$ext")
  [ -n "$extra_excl" ] && files=$(echo "$files" | grep -vE "$extra_excl" || true)
  [ -z "$files" ] && exit 0
  local bad; bad=$(echo "$files" | xargs grep -nP "$pattern" 2>/dev/null || true)
  if [ -n "$bad" ]; then echo "$desc:"; echo "$bad"; exit 1; fi
}

# ── Subcommand: no-debug ──────────────────────────────────────────────────────

cmd_no_debug() {
  _grep_check \
    'console\.(log|warn|error|debug|info)\s*\(|\bdebugger\b' \
    '\.(ts|js)$' \
    'debug statements' \
    'playwright\.config\.(ts|js)$|eslint\.config\.(ts|js)$'
}

# ── Subcommand: no-ts-suppress ────────────────────────────────────────────────

cmd_no_ts_suppress() {
  _grep_check \
    '@ts-ignore|@ts-nocheck|@ts-expect-error' \
    '\.ts$' \
    'TypeScript suppression directives' \
    'playwright\.config\.(ts|js)$|eslint\.config\.(ts|js)$'
}

# ── Subcommand: no-explicit-any ───────────────────────────────────────────────

cmd_no_explicit_any() {
  _grep_check \
    ':\s*any\b|as\s+any\b|<any>' \
    '\.ts$' \
    'explicit any type' \
    'playwright\.config\.(ts|js)$|eslint\.config\.(ts|js)$'
}

# ── Subcommand: no-nolint ─────────────────────────────────────────────────────

cmd_no_nolint() {
  _grep_check \
    '//\s*nolint' \
    '\.(ts|js)$' \
    'nolint comments' \
    '\.pre-commit-config\.yaml$|^docs/|\.md$'
}

# ── Subcommand: no-todo ───────────────────────────────────────────────────────

cmd_no_todo() {
  _grep_check \
    '(TODO|FIXME)(?!.*?(AP-[0-9]+|#[0-9]+))' \
    '\.(ts|js)$' \
    'TODO/FIXME without ticket ref'
}

# ── Subcommand: prettier ───────────────────────────────────────────────────────

cmd_prettier() {
  local files; files=$(_get_files '\.(ts|js|json|md)$' | grep -v "package-lock\.json" || true)
  [ -z "$files" ] && exit 0
  echo "$files" | xargs -n 50 npx --yes --package prettier@3.8.3 -- prettier --write
  _is_full_scan || echo "$files" | xargs git add
}

# ── Subcommand: eslint ─────────────────────────────────────────────────────────

cmd_eslint() {
  [ -x "node_modules/.bin/eslint" ] || { echo "ESLint not found — run npm install"; exit 1; }
  local files; files=$(_get_files '\.ts$')
  [ -z "$files" ] && { echo "No files — skipping ESLint."; exit 0; }
  if _is_full_scan; then
    echo "$files" | xargs -n 50 ./node_modules/.bin/eslint --max-warnings=0 --no-warn-ignored
  else
    echo "$files" | xargs -n 50 ./node_modules/.bin/eslint --fix --max-warnings=0 --no-warn-ignored
    echo "$files" | xargs git add
  fi
}

# ── Subcommand: gitleaks ───────────────────────────────────────────────────────

cmd_gitleaks() {
  if _is_full_scan; then
    gitleaks detect -v
  else
    gitleaks protect --staged -v
  fi
}

# ── Subcommand: license ────────────────────────────────────────────────────────

cmd_license() {
  local files; files=$(_get_files 'package(-lock)?\.json$')
  [ -z "$files" ] && { echo "No package files staged — skipping license check."; exit 0; }
  npx --yes --package license-checker@25 -- license-checker \
    --failOn "GPL-3.0;LGPL-2.1;LGPL-3.0;AGPL-3.0" \
    --excludePrivatePackages 2>&1 \
    | grep -E "^(FAIL|ERROR)" && exit 1 || true
}

# ── Subcommand: deps ───────────────────────────────────────────────────────────

cmd_deps() {
  local files; files=$(_get_files 'package(-lock)?\.json$')
  [ -z "$files" ] && { echo "No package files staged — skipping dep check."; exit 0; }
  local dups; dups=$(npm ls --depth=1 2>&1 | grep -E "UNMET PEER|invalid" | head -5 || true)
  if [ -n "$dups" ]; then echo "$dups"; exit 1; fi
  echo "Dep versions OK"
}

# ── Subcommand: biome ──────────────────────────────────────────────────────────

cmd_biome() {
  if [ ! -f "biome.json" ] && [ ! -f "biome.jsonc" ]; then
    echo "No biome.json — skipping Biome."
    exit 0
  fi
  if _is_full_scan; then
    npx @biomejs/biome check --diagnostic-level=error .
  else
    local files; files=$(_get_files '\.(ts|js|json)$')
    [ -z "$files" ] && { echo "No staged TS/JS/JSON files — skipping Biome."; exit 0; }
    npx @biomejs/biome check --diagnostic-level=error --staged
  fi
}

# ── Subcommand: circular-deps ──────────────────────────────────────────────────

cmd_circular_deps() {
  local files; files=$(_staged_files '\.ts$')
  [ -z "$files" ] && { echo "No staged TS files — skipping circular-deps."; exit 0; }

  local failed=0
  for dir in pages services utils config; do
    [ -d "$dir" ] || continue
    ! echo "$files" | grep -q "^${dir}/" && continue
    local result exit_code
    result=$(npx --yes --package madge@8 -- madge --circular --extensions ts "$dir" 2>&1) && exit_code=0 || exit_code=$?
    echo "Circular deps in $dir:"
    echo "$result"
    [ "$exit_code" -ne 0 ] && failed=1
  done
  exit $failed
}

# ── Subcommand: boundaries ─────────────────────────────────────────────────────
# Allowed import directions (POM architecture):
#   tests/    → pages/, services/, utils/, config/
#   services/ → pages/, utils/, config/
#   pages/    → utils/, config/
#   utils/    → pages/, services/, config/
#   config/   → utils/

_scan_boundary_file() {
  local file="$1" forbidden_list="$2"
  local pattern; pattern=$(echo "$forbidden_list" | tr ' ' '|')
  grep -nE \
    "from[[:space:]]*['\"][^'\"]*/(${pattern})/\
|require\(['\"][^'\"]*/(${pattern})/\
|import\(['\"][^'\"]*/(${pattern})/" \
    "$file" 2>/dev/null || true
}

cmd_boundaries() {
  declare -A RULES=(
    ["pages"]="tests services"
    ["services"]="tests"
    ["utils"]="tests"
    ["config"]="tests pages services"
  )

  local files; files=$(_get_files '\.ts$')
  [ -z "$files" ] && { echo "Module boundaries OK"; exit 0; }

  local failed=0
  for layer in "${!RULES[@]}"; do
    local forbidden="${RULES[$layer]}"
    local layer_files; layer_files=$(echo "$files" | grep "^${layer}/" || true)
    [ -z "$layer_files" ] && continue

    while IFS= read -r file; do
      [ -f "$file" ] || continue
      local hits; hits=$(_scan_boundary_file "$file" "$forbidden")
      [ -z "$hits" ] && continue
      echo "BOUNDARY VIOLATION in $file (${layer} → [${forbidden// /, }] is forbidden):"
      echo "$hits"
      failed=1
    done <<< "$layer_files"
  done

  if [ "$failed" -eq 1 ]; then
    echo ""
    echo "Fix boundary violations before committing."
    echo "Allowed: tests→all, services→pages/utils/config, pages→utils/config, utils→pages/services/config, config→utils"
    exit 1
  fi

  echo "Module boundaries OK"
}

# ── Subcommand: vitest ─────────────────────────────────────────────────────────

cmd_vitest() {
  local files; files=$(_get_files 'tests/unitTest/.*\.test\.ts$')
  [ -z "$files" ] && { echo "No unit test files staged — skipping Vitest."; exit 0; }
  npx vitest run
}

# ── Subcommand: commit-msg ─────────────────────────────────────────────────────

cmd_commit_msg() {
  local msg_file="$1"
  if ! grep -qE "(AP-[0-9]+|#[0-9]+)" "$msg_file"; then
    echo "FAILED - commit message must include a ticket ref (AP-123 or #123)"
    exit 1
  fi
}

# ── Dispatch ───────────────────────────────────────────────────────────────────

[ $# -lt 1 ] && { echo "Usage: $0 <subcommand> — see script header for list"; exit 2; }
mode="$1"; shift
case "$mode" in
  tsc)             cmd_tsc             "$@" ;;
  no-debug)        cmd_no_debug        "$@" ;;
  no-ts-suppress)  cmd_no_ts_suppress  "$@" ;;
  no-explicit-any) cmd_no_explicit_any "$@" ;;
  no-nolint)       cmd_no_nolint       "$@" ;;
  no-todo)         cmd_no_todo         "$@" ;;
  prettier)        cmd_prettier        "$@" ;;
  eslint)          cmd_eslint          "$@" ;;
  gitleaks)        cmd_gitleaks        "$@" ;;
  license)         cmd_license         "$@" ;;
  deps)            cmd_deps            "$@" ;;
  biome)           cmd_biome           "$@" ;;
  circular-deps)   cmd_circular_deps   "$@" ;;
  boundaries)      cmd_boundaries      "$@" ;;
  vitest)          cmd_vitest          "$@" ;;
  commit-msg)      cmd_commit_msg      "$@" ;;
  *)               echo "Unknown subcommand: $mode"; exit 2 ;;
esac
