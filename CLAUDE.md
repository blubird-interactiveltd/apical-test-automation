# Apical Test Automation — Project Context

Playwright + TypeScript E2E and unit test automation for the Apical platform
(master, teacher and coaching-center portals of the Vue front-end).

## Architecture

Four core layers plus two supporting ones. Imports must only flow in the
allowed directions:

| Layer       | Directory    | Responsibility                                            |
| ----------- | ------------ | --------------------------------------------------------- |
| `data/`     | Test data    | Pure JSON scenarios (regular / edge)                      |
| `pages/`    | Page Objects | UI locators and single actions only — no business logic   |
| `services/` | Services     | Multi-step business logic workflows, API stubs            |
| `utils/`    | Utilities    | Cross-cutting helpers and types                           |
| `config/`   | Config       | Shared constants (timeouts)                               |
| `tests/`    | Specs        | Orchestrate data + pages + services into executable tests |

Supporting: `fixtures/` holds recorded API responses used as stub bodies
(`fixtures/api/`), and `test-cases/` holds one document per ticket listing every
case, its expected outcome and the findings raised.

Legal flow: `tests → services → pages → utils/config`.

| Layer       | May NOT import from          |
| ----------- | ---------------------------- |
| `pages/`    | `tests`, `services`          |
| `services/` | `tests`                      |
| `utils/`    | `tests`                      |
| `config/`   | `tests`, `pages`, `services` |

Boundary violations are blocked by pre-commit hook [17] and enforced in CI.

## Modules

`auth`, `onlineClass`. Add a module by creating the same-named folder under
`data/regular`, `data/edge`, `pages`, `services` and `utils/types`.

## Key Commands

```bash
npm run test:smoke          # Smoke suite
npm run test:regression     # Full regression
npm run test:unit           # Vitest unit tests
npm run test:online-class   # AP-779 only
npx playwright test tests/tickets/AP-XXX-*/   # Run a single ticket in isolation
```

`tests/unitTest/` belongs to Vitest and is excluded from Playwright via
`testIgnore` in `playwright.config.ts`. The Playwright scripts pass
`--pass-with-no-tests` so an empty suite is not an error.

## Development Workflow

- New work lives in `tests/tickets/AP-XXX-feature/` until integration.
- Build order: **data → page → service → spec**.
- Each ticket gets `test-cases/AP-XXX-feature.md`; every test title ends with a
  case ID from it, e.g. `(AP-779-TC-027)`.
- A case that exposes a known defect calls `test.fail()` beside a comment naming
  the finding and the source line. Never delete it to make a run green.
- Commit messages follow Conventional Commits and include a ticket ref:
  `test(onlineClass): cover list pagination AP-779`.

## Authentication

`ApicalLoginService.ensureLoggedIn(page, role)` logs in through
`POST /api/v1/login` and replays the session into localStorage with
`addInitScript`, before the app's first script runs (the axios instance reads
the token once, at creation). Sessions are cached per role in
`test-results/.auth/<role>.json` for 30 minutes. Roles: `master` (required),
`coaching` and `teacher` (optional; their specs skip without credentials).

## Pre-Commit Hooks (18 numbered checks, `fail_fast: true`)

Notable: [1] Gitleaks · [2a-2i] File hygiene · [3] Branch guard (blocks commits
to master/stage) · [4] TypeScript · [5] No debug · [6] No TS suppress ·
[7] No explicit `any` · [10] Commit message must include ticket ref ·
[16] Circular deps · [17] Module boundaries · [18] Vitest on staged test files.

Install once:

```bash
pip install pre-commit
pre-commit install
pre-commit install --hook-type commit-msg
```

## CI Pipeline

AI Guard → PR Size Check → File Hygiene + Security → Static Checks → Vitest →
Playwright. The Playwright job runs but skips install and execution when no
specs are enabled in `scripts/e2e-suites.config.sh`.

## Environment Variables

Copy `.env.example` to `.env`. Key vars: `BASE_URL`, `API_URL`,
`ORGANIZATION`, `MASTER_EMAIL`, `MASTER_PASSWORD`; optional `COACHING_*`,
`TEACHER_*` and `RUN_LIVE`.
