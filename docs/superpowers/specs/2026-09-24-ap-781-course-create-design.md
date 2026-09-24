# AP-781 — Course creation wizard automation

**Date:** 2026-09-24
**Ticket:** AP-781 ([blubird-interactiveltd/apical#781](https://github.com/blubird-interactiveltd/apical/issues/781))
**Branch:** `AP-781-course-create-playwright`
**Status:** implemented; UI specs run green locally against the #780 fix (PR #782); live checks not yet run

## Goal

Automate the 60 cases of the course create wizard (`/course/*`, `src/views/courses/`)
listed on #781, and keep the defects found while writing them visible as expected
failures.

## Approach

**Assert on the one payload.** The wizard keeps everything in localStorage
`course-create-info` and calls the API only on Preview's Save
(`POST /api/v1/packages`, then `PUT /api/v1/packages/{id}`). Step cases read the
saved state; the create cases read the exact bodies `CourseApiMock` received.

**Stub the data, keep the session real.** As in AP-779: the course endpoints are
served from `fixtures/api/course*.response.json`, and login, profile and
permissions reach the real backend. No UI case writes a course.

**Seed, don't replay.** `CourseWizardService.open` seeds the saved state once per
page so a case starts on the step it tests. A sessionStorage flag stops a reload
from re-seeding, which TC-058 depends on. AP-781-TC-044 alone walks every step
through the UI, so there is still one case that proves the steps hand over to each other.

**Live checks clean up.** Unlike AP-779 these write; every course a case creates
is deleted in `afterEach`.

## Alternatives considered

- **Walk the UI to every step.** Rejected: 60 cases would each repeat several
  steps, and a regression on step 2 would fail every case after it, hiding where it is.
- **Assert against live data.** Rejected: courses would accumulate in a shared
  environment, and the wizard's list steps would depend on whatever items it holds.

## Layout

| Layer                     | Files                                                                                                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `data/`                   | `regular/course/*` (basic information, type, add-ons, properties, sliders, duration & price, submit, API) · `edge/course/*` (basic information, duration & price, API) |
| `fixtures/api/`           | `course{QuestionTypes,Questions,PracticeTests,MockTests,QuizTypes,Quizzes,Materials,List}.response.json`                                                               |
| `pages/course/`           | wizard shell, one page per step, the item-list and slider step pages shared by five and three steps, review/preview, course list                                       |
| `services/course/`        | `courseApiMock` (stubs + recorded bodies), `courseWizard` (open, seed, step workflows), `courseApi` (live)                                                             |
| `tests/tickets/AP-781-*/` | 10 specs, one per area                                                                                                                                                 |

## Verification so far

Run on 2026-09-24 against the #782 build on a local dev server, with login and
the endpoints the suite does not stub answered by a local stand-in API: 71 tests —
43 pass, 15 expected failures, 13 skipped (11 live, 2 `fixme`). Each expected failure was
checked to fail on its intended assertion.

## Open items

- Run `courseApi.live.spec.ts` with `RUN_LIVE=1` against stage once #782 is merged.
- TC-037, TC-038 need product decisions; TC-052 needs a student account.
- Not enrolled in `scripts/e2e-suites.config.sh` until #782 is merged and an
  environment and secrets are agreed.
