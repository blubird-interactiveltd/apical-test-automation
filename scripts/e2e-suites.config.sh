#!/usr/bin/env bash
# scripts/e2e-suites.config.sh
# ─────────────────────────────────────────────────────────────────────────────
# CI Playwright E2E — suite selection.
#
# Edit this file to control which specs run in CI.
# • Uncomment a line  → spec runs in CI
# • Comment a line    → spec is skipped
# • Add a new line    → new spec runs in CI
#
# Paths are relative to the repo root.
# Supports both smoke/ and regression/ specs.
# ─────────────────────────────────────────────────────────────────────────────

E2E_SPECS=(

  # No specs enabled yet - the four-layer restructure ships an empty skeleton.
  # Uncomment a path here to run it in CI, e.g.:
  # "tests/e2e/smoke/login.e2e.spec.ts"

)
