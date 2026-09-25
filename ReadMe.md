# Apical Test Automation

Playwright + TypeScript test automation for the Apical master, teacher and
coaching-center portals.

## Setup

```bash
npm install
npx playwright install
cp .env.example .env      # then fill in the values
```

Install the git hooks (requires Python):

```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg
```

## Running tests

```bash
npm run test:smoke          # Smoke suite
npm run test:regression     # Full regression
npm run test:unit           # Vitest unit tests
npm run test:online-class   # AP-779 online class list
npm run test:course         # AP-781 course create wizard
npm test                    # Everything under tests/
```

## Structure

```
config/      Shared constants (timeouts)
data/        JSON scenarios — regular/<module>/, edge/<module>/
fixtures/    Recorded API responses used as stub bodies — api/
pages/       Page objects — locators and single actions only
services/    Multi-step business workflows and API stubs
utils/       Cross-cutting helpers and types
tests/       Specs — e2e/smoke, e2e/regression, unitTest, tickets
test-cases/  One document per ticket: every case, expected outcome, findings
```

Imports flow one way: `tests → services → pages → utils/config`. See
[`CLAUDE.md`](./CLAUDE.md) for the full architecture and import rules.
