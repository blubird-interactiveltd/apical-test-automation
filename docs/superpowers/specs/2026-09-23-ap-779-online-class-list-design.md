# AP-779 — Online Class List automation

**Date:** 2026-09-23
**Ticket:** AP-779 ([blubird-interactiveltd/apical#779](https://github.com/blubird-interactiveltd/apical/issues/779))
**Branch:** `AP-779-online-class-list-playwright`
**Status:** implemented; not yet run against an environment

## Goal

Automate the 73 automatable cases of the online class list
(`/master/online-class/online-class-list`, `TeacherOnlineClassView.vue`) defined
in `automation_document/online-class-list/online-class-list-test-cases.html`,
and keep the 23 code-review findings visible as expected failures.

## Approach

**Stub the data, keep the session real.** The list's three endpoints are served
by `OnlineClassApiMock` from a recorded response; login and every other call
reach the real backend. That makes each UI assertion exact — the same 20 rows
every run — without writing to the database, and without mocking the app's
whole API surface, which would test the stubs rather than the page.

**Reproduce the backend search.** `utils/onlineClassSearch.ts` mirrors
`OnlineClass::scopeOfSearch`, so a search stub answers as the server would. The
read-only `onlineClassApi.live.spec.ts` checks the real backend separately when
`RUN_LIVE=1`.

**Log in by API, replay by init script.** `src/store/api.js` reads the token
once, when the axios instance is created, so the session must be in
localStorage before the first app script runs. `addInitScript` guarantees that;
setting it after `goto` would be one load too late.

## Alternatives considered

- **Assert against live data only.** Rejected: results would depend on whatever
  the environment holds, and duplicate/edit would write to shared data.
- **Stub every API call.** Rejected: large, brittle, and it would stop exercising
  the real session and permission calls the page depends on.

## Layout

| Layer                     | Files                                                                                                                |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `data/`                   | `regular/onlineClass/*` (table, search, pagination, row actions, UI) · `edge/onlineClass/*` (loading, table, search) |
| `fixtures/api/`           | `onlineClassList.response.json`                                                                                      |
| `pages/onlineClass/`      | list page, detail / duplicate / share dialogs, class-information page                                                |
| `services/`               | `auth/apicalAuth`, `auth/apicalLogin`, `onlineClass/onlineClassApiMock`, `onlineClassList`, `onlineClassApi`         |
| `utils/`                  | `apiHeaders`, `storageState`, `listResponse`, `onlineClassSearch`, `duration`, `testData`, `fixtures`, types         |
| `tests/tickets/AP-779-*/` | 8 specs, one per area                                                                                                |
| `tests/unitTest/utils/`   | unit tests for every pure util                                                                                       |

## Open items

- TC-004, TC-007 need extra accounts; TC-122 needs a coaching-center page object.
- Not enrolled in `scripts/e2e-suites.config.sh` until an environment and
  secrets are agreed.
