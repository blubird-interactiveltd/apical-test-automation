# AP-806 — Speaking Question List Automation: How It Is Implemented

This document explains how the Playwright suite for
[blubird-interactiveltd/apical#806](https://github.com/blubird-interactiveltd/apical/issues/806)
is built: the logic behind each decision, then the code itself, file by file, in the order it was written.

|                             |                                                                                                                                                                                                                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Repo / branch**           | `apical-test-automation`, branch `AP-806` (from `master` @ `3ddc214`)                                                                                                                                                                                                                                        |
| **App under test**          | `apical` Vue 3 app, branch `AP-3.5v-super-stage`, run locally at `http://superadmin.localhost:5173`                                                                                                                                                                                                          |
| **API**                     | stage, `https://api.apical.io` (tenant `superadmin`)                                                                                                                                                                                                                                                         |
| **Page**                    | `/master/question-management/question-creation/pte-question/speaking` → `SpeakingView.vue`                                                                                                                                                                                                                   |
| **Test cases**              | `test-cases/speaking/speaking-list.md` (83 cases, to be renamed `AP-806-TC-NNN`)                                                                                                                                                                                                                             |
| **Status of this document** | Written while the suite is in progress. Steps 1–12 are implemented and typecheck. Step 13 has **one** spec file written so far (navigation). The remaining specs (Step 14) are planned but not yet written, and **nothing has run against stage yet**, because the stage login is still missing from `.env`. |

---

## Part A — Implementation steps

### Step 1. Analyse the page before writing any test

I read the app source, not just the screen. The facts that shaped the suite:

- **Two Vue files make up the list.** `SpeakingView.vue` is the list. `pte-question/IndexView.vue` wraps it with the tab strip and the dialogs.
- **How the list is fetched.** `created()` clears a global query helper, then sets `type=question`, `section=speaking` and `sort=-created_at`, then calls `GET /api/v1/questions/list`. Each filter, search, sort and page action edits that query and calls the API again.
- **The building blocks are native HTML or plain Vuetify.**
  - Both filters are **native `<select>`** elements (`SelectComponent.vue`).
  - The search box is an `<input class="search-box">`.
  - The table is a `VTable` whose rows are `tr.table-row`.
  - The paginator is two mdi chevron icons. An arrow it won't act on gets the class `bg-periwinkle-gray`.
- **Permissions.** `can()` returns `true` for every permission when the role is `SUPER_ADMIN`. So any permission case has to **change the profile** that `/users/profile` returns.
- **Server rules the stubs must copy** (from `apical-api`):
  - Search is a **case-sensitive** PostgreSQL `LIKE` on 7 columns.
  - Sort passes **any** column name straight to `ORDER BY`. That is finding F-03: `sort=sl` returns a raw `SQLSTATE` error.
  - Pages are 20 rows.
- **The API rate-limits at 60 requests a minute per user** (`Too Many Attempts.`). This is finding F-12.

### Step 2. Choose where the suite runs

- **The old setup no longer fits.** The old `.env` pointed at a local mock API used for AP-779/780, and that mock has no Speaking data.
- **Chosen setup: the local app talking to the stage API.** On `localhost`, the app takes the tenant from the sub-domain. So I serve it at **`superadmin.localhost:5173`**, and it sends `X-Tenant: https://superadmin.apical.io`, the same header stage receives.
- **CORS.** I checked from that origin: the stage API answered with a readable 401, so cross-origin calls are allowed.
- **`.env` changes.** `BASE_URL`, `API_URL` and `ORGANIZATION` were switched. The old values are kept as comments, and the old file is backed up. The stage login (`MASTER_EMAIL`/`MASTER_PASSWORD`) is **added by the user**. Tests never type credentials into the page; `ApicalAuthService` logs in through the API.

### Step 3. Branch

`git checkout master && git pull --ff-only && git checkout -b AP-806`. Both earlier suites (AP-779, AP-781) were already merged into `master`.

### Step 4. Record fixtures from stage

- **What was recorded:** the six real pages of the list (118 questions), the Speaking question types, and the status dropdown. They were fetched once, read-only, on 2026-10-05.
- **How the list is stored:** the six pages are kept exactly as the API returned them (`speakingList.page1..6.response.json`). Each is under the repo's 50 KB fixture limit (hook [2e]), which a single merged 109 KB file failed. `utils/speakingFixtures.ts` merges them into one list of 118 items, so stubs serve any page or filter from it instead of replaying fixed pages.

### Step 5. Make the shared list helper generic

`utils/listResponse.ts` (from AP-779) built a Laravel-style page, but only for `OnlineClass`. I made `buildListResponse` and `pageOf` generic (`<T>`) and moved `ListResponse`, `ListMeta` and `StubbedError` into `utils/types/shared/`. The online-class types re-export them, so **AP-779 code is unchanged**, and its unit tests still pass.

### Step 6. Define the Speaking types

`utils/types/speaking/speakingList.types.ts` describes:

- one list row, typed from `QuestionListResource.php`;
- the question-type and status responses;
- the parsed query the oracle works on.

### Step 7. Build the backend oracle (the core logic)

A UI test must not depend on what stage holds today, but its stub must still answer **as the real server would**. Otherwise filter, search and paging tests only test the stub. `utils/speakingListOracle.ts` reproduces the server's behaviour on the 118 recorded questions:

1. **`parseListQuery`** reads `section`, `question_type_id`, `active`, `search`, `sort`, `page` and `per_page` (default 20).
2. **`backendFilter`** copies `Question::scopeOfSearch`:
   - section, type and `active` (`"0"`/`"false"` mean false, `"1"`/`"true"` mean true);
   - a **case-sensitive** substring match on `q_id`, `index` and `title`.
3. **`backendSort`** copies `BaseTrait::scopeOfOrderBy`:
   - a comma list of columns, `-` for descending, default `-created_at`;
   - an unknown column gives the same `SQLSTATE[42703]` error the server returns (F-03);
   - nulls go last when ascending and first when descending, as in PostgreSQL;
   - `created_at` is parsed from the display format (`"02 Oct, 2026 01:07 pm"`), so it sorts by time.
4. **`answerListRequest`** chains parse → filter → sort → `pageOf`.

### Step 8. Unit-test the oracle (Vitest)

The oracle is checked against numbers I **measured on the live API**:

- `RS0001` matches 5;
- ASQ has 10 questions;
- Draft has 8 and Published has 110;
- page 6 holds rows 101–118;
- `question_type_id=<ASQ>&page=5` returns an empty page with a total of 10;
- `sort=sl` fails.

If the oracle drifts from the server, these tests fail before any UI test misleads.

### Step 9. Add a shared GET cache for the app's own calls

Every UI test boots the full app as the same master user: profile, settings, menus and more. With a 60-requests-a-minute limit, a few parallel tests would get `429` on boot calls alone. `services/shared/apiResponseCache.service.ts` handles this:

- **Where it hooks in:** it intercepts every `/api/v1/` **GET**.
- **What it caches:** successful replies, by URL + Authorization header, in memory and on disk under `test-results/.api-cache`, for 30 minutes (the same lifetime as the cached login session).
- **Back-off:** on a `429` it waits for `Retry-After`.
- **Registration order:** it is registered **first**. Playwright tries routes newest first, so the specific stubs added after it win, and a stub's `fallback()` lands in the cache.
- **Opting out:** a test can bypass it for the list endpoint when the test is about what the real server does (the F-03 sorts).

### Step 10. Page object

`pages/speaking/speakingList.page.ts` keeps **every locator in one file**. The app has no `data-testid`, so the locators use the view's own classes, the native selects and the mdi icon classes. It also holds single actions: type a search one character at a time, pick a filter by label, click a sort icon, read a column, and check whether a paginator arrow is greyed.

### Step 11. API stubs + list workflow service

- **`services/speaking/speakingListApiMock.service.ts`** stubs only what the list reads. It records every list request so a test can assert the query parameters:
  - the list, served through the oracle;
  - the question types;
  - the status dropdown;
  - the profile, when a test needs one.

  Everything else goes to the real API through the cache.

- **`services/speaking/speakingList.service.ts`** opens the list in one call, in a fixed order:
  1. log in;
  2. install the cache;
  3. install the stubs;
  4. navigate;
  5. wait for rows.

  The stubs must be in place **before** `goto`, because the first list request fires in `created()`.

  It also provides `settle()` for "nothing was sent" checks, and `withoutPermissions()` to demote SUPER_ADMIN for the permission cases.

### Step 12. Test data

- **Expected values live in JSON, not in specs:** headers, tabs, per-type counts, status labels, search terms, paginator labels and permission ids, in `data/regular/...`; edge inputs in `data/edge/...`.
- **Every number was derived from the recorded fixture with a script.** For example: "April RL Nutrition Science and Food Guidance" is RL00225 and nothing else matches it, and "lecture" among published RL questions matches exactly one.
- **Loading:** `utils/speakingTestData.ts` loads the files with types.

### Step 13. Specs (one file per feature area)

Every test title ends with its case ID. Cases that expose a known defect call `test.fail()`, with a comment naming the finding and source line. Specs run on Chromium only, because what they check (requests, data binding) is browser-independent.

| Spec file                        | Cases                                   | State                  |
| -------------------------------- | --------------------------------------- | ---------------------- |
| `speakingNavigation.spec.ts`     | TC-001 – TC-007                         | **written**            |
| `speakingTable.spec.ts`          | TC-010 – TC-022                         | planned                |
| `speakingRowActions.spec.ts`     | TC-030 – TC-039                         | planned                |
| `speakingFilters.spec.ts`        | TC-040 – TC-055                         | planned                |
| `speakingSearch.spec.ts`         | TC-060 – TC-072                         | planned                |
| `speakingSortPagination.spec.ts` | TC-080 – TC-097                         | planned                |
| `speakingDialogs.spec.ts`        | TC-100 – TC-102                         | planned                |
| `speakingListApi.live.spec.ts`   | TC-110 – TC-116 and the live-only cases | planned (`RUN_LIVE=1`) |

### Step 14. Remaining work (not yet done)

1. Write the 7 planned spec files.
2. Rename `speaking-list.md` → `test-cases/AP-806-speaking-list.md` with IDs `AP-806-TC-NNN`, and add the new finding **F-13**: SL restarts at 1 on every page, because the store numbers rows with `index + 1` (`store/modules/question.js:48-52`).
3. Add `npm run test:speaking-list`.
4. Run everything against stage once the login is in `.env`, and adjust locators to what the real page shows.
5. Run the hooks (TypeScript, Biome/ESLint, module boundaries, Vitest), then commit as `test(speaking): … AP-806`.

### How a stubbed UI test flows at runtime

```
spec ──► SpeakingListService.open(page, options)
           │ 1. ApicalLoginService.ensureLoggedIn   → token into localStorage before the app boots
           │ 2. ApiResponseCache.install            → every other /api/v1 GET: real, cached, 429-safe
           │ 3. SpeakingListApiMock.list/types/...  → list answered by the oracle from 118 recorded rows
           │ 4. SpeakingListPage.goto(path)         → waits for the "Speaking" heading
           │ 5. waitForRows
           ▼
spec acts through SpeakingListPage, then asserts on
  • what the user sees (rows, labels, paginator), and
  • what the app sent (api.listRequests → query parameters)
```

---

## Part B — Code, following the steps

> Each block below is the file as it is on disk. The TypeScript is copied in verbatim. JSON can't carry comments, so data files are shown as annotated `jsonc` copies. The real files are plain JSON with the same values.

### Step 2 — Local app launch config (workspace root, not in either repo)

`C:\Projects\Blubird\Apical\.claude\launch.json` — the new `apical-web-superadmin` entry serves the app on the `superadmin` tenant sub-domain:

```jsonc
{
  "name": "apical-web-superadmin",
  // npm --prefix apical run dev → Vite, from the workspace root
  "runtimeExecutable": "npm",
  "runtimeArgs": ["--prefix", "apical", "run", "dev", "--", "--port", "5173", "--strictPort"],
  "port": 5173,
  // getCurrentSubdomain() on *.localhost returns "superadmin", so the app sends
  // X-Tenant: https://superadmin.apical.io — the same tenant stage uses
  "url": "http://superadmin.localhost:5173",
}
```

`apical-test-automation/.env` (git-ignored). Only the target lines are shown; the credentials are filled in by the user:

```bash
# AP-806: local Vue app (apical AP-3.5v-super-stage, npm run dev) on the superadmin tenant, talking to stage.
BASE_URL=http://superadmin.localhost:5173
# Previous (AP-780 local mock): BASE_URL=http://localhost:5174
API_URL=https://api.apical.io
# Previous (AP-780 local mock): API_URL=http://localhost:8787
ORGANIZATION=superadmin
# Previous (AP-780 local mock): ORGANIZATION=local
MASTER_EMAIL=        # ← stage Super Admin, set by the user
MASTER_PASSWORD=     # ← stage Super Admin, set by the user
```

### Step 3 — Branch

```bash
# start from the latest master, which already holds the AP-779 and AP-781 suites
git checkout master
git pull --ff-only origin master
# one branch per ticket, named after it
git checkout -b AP-806
```

### Step 4 — Recorded fixtures

`fixtures/api/speakingList.page1.response.json` … `page6`: the six pages as recorded (18–24 KB each). Annotated excerpt of page 1:

```jsonc
{
  // 20 of the 118 Speaking questions; pages 2–6 hold the rest
  // (GET /questions/list?type=question&section=speaking&sort=-created_at, 2026-10-05)
  "items": [
    {
      "id": "249fa309-9994-4ba3-94b3-5926fa17322b",
      "q_id": "RS00237", // Q_ID column
      "index": "RS0001-6", // INDEX column
      "title": "[Scientists are hoping] to measure the [basic properties] of black holes by taking photographs.dsdsd",
      // strip_tags(title ?? transcript) — not a column, but searchable
      "item": "RS", // ITEM column (type short_title)
      "question_type_id": "ef4b11a9-8086-4d93-8da7-4e68b60a6a0a",
      "question_type_slug": "repeat-sentence",
      "frequency": "MODERATE", // FREQUENCY icon colour
      "source": "Exam Question",
      "active": true, // STATUS: true = Published, false = Draft
      "approve_status": 0,
      "approve_status_text": "",
      "created_at": "02 Oct, 2026 01:07 pm", // CREATED AT, Asia/Dhaka display format
      "created_by": "Blubird", // CREATED BY (name)
      "creator": null, // creator uuid; null for system rows
      "explanations_count": 0,
      "taken_count": 0,
      "bookmark_list": null,
    },
    // … 19 more on this page
  ],
  // Laravel links/meta as the API sent them; stubs rebuild meta per request with pageOf()
  "links": { "first": "…?page=1", "last": "…?page=6", "prev": null, "next": "…?page=2" },
  "meta": { "current_page": 1, "from": 1, "last_page": 6, "per_page": 20, "to": 20, "total": 118 /* … */ },
}
```

`utils/speakingFixtures.ts`: merges the six pages into the 118-question list that the oracle, the stubs and the unit tests use:

```ts
import { Fixtures } from "./fixtures";
import type { SpeakingListResponse, SpeakingQuestion } from "./types/speaking/speakingList.types";

/** Pages recorded from `GET /questions/list?type=question&section=speaking&sort=-created_at`. */
export const RECORDED_LIST_PAGES = 6;

export const listPageFixture = (page: number): string => `speakingList.page${page}.response.json`;

/**
 * All 118 Speaking questions on stage (2026-10-05), in recorded order.
 *
 * Kept as the six pages the API returned rather than one merged file: each
 * page stays under the repo's 50 KB fixture limit (hook [2e]), and the files
 * are exactly what was recorded. Every call returns fresh clones.
 */
export function recordedSpeakingQuestions(): SpeakingQuestion[] {
  return Array.from({ length: RECORDED_LIST_PAGES }, (_, index) => Fixtures.api<SpeakingListResponse>(listPageFixture(index + 1))).flatMap((page) => page.items);
}
```

`fixtures/api/speakingQuestionTypes.response.json` — `GET /question-types?section=speaking`. Excerpt, one of the 7 types:

```jsonc
{
  "items": [
    {
      "id": "c7b24d80-1143-4ec2-9fb9-821d1b8aeeec",
      "slug": "read-aloud",
      "title": "Read Aloud", // label in the type filter
      "short_title": "RA", // code shown in the ITEM column
      "section": "SPEAKING",
      "display_order": 1, // filter option order
      "is_sample_answer": true,
      "preparation_time": 40,
      "answer_time": 40,
      "prompt": "Look at the text below. In 40 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read aloud.",
      // … more type settings
    },
    // RS, DI, RL, ASQ, SGD, RTAS follow, ordered by display_order
  ],
}
```

`fixtures/api/speakingStatusDropdown.response.json` — `GET /common/dropdowns?status`:

```jsonc
// The status filter shows these, and the store puts { id: "all", name: "All" } in front.
// The view lower-cases the id and sends it as active=0 or active=1.
{
  "status": [
    {
      "id": 0,
      "name": "Draft",
    },
    {
      "id": 1,
      "name": "Published",
    },
  ],
}
```

### Step 5 — Generic list helper (shared with AP-779)

`utils/types/shared/listResponse.types.ts` (new):

```ts
/** Laravel's paginator `meta`, as the Apical list resources send it. */
export interface ListMeta {
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from: number | null;
  to: number | null;
}

/** Laravel resource-collection envelope the list pages read. */
export interface ListResponse<T> {
  items: T[];
  links: { prev: string | null; next: string | null };
  meta: ListMeta;
}

/** A stubbed error reply for a list endpoint. */
export interface StubbedError {
  status: number;
  body?: Record<string, unknown>;
}
```

`utils/types/onlineClass/onlineClass.types.ts` — what changed, so AP-779 code keeps compiling unchanged:

```diff
@@ -1,3 +1,5 @@
+import type { ListResponse } from "../shared/listResponse.types";
+
 /**
  * One row of `GET /api/v1/online-class`, as `OnlineClassListResource` shapes it
  * (apical-api `app/Http/Resources/OnlineClassListResource.php`).
@@ -29,21 +31,10 @@ export interface OnlineClass {
   completion_rate: string;
 }

-export interface ListMeta {
-  current_page: number;
-  last_page: number;
-  per_page: number;
-  total: number;
-  from: number | null;
-  to: number | null;
-}
+export type { ListMeta } from "../shared/listResponse.types";

 /** Laravel resource-collection envelope the list page reads. */
-export interface OnlineClassListResponse {
-  items: OnlineClass[];
-  links: { prev: string | null; next: string | null };
-  meta: ListMeta;
-}
+export type OnlineClassListResponse = ListResponse<OnlineClass>;

 /** `GET /api/v1/online-class/{id}` — the list row plus detail-only fields. */
 export interface OnlineClassDetailResponse {
@@ -55,8 +46,4 @@ export interface OnlineClassDetailResponse {
   };
 }

-/** A stubbed error reply for the list endpoint. */
-export interface StubbedError {
-  status: number;
-  body?: Record<string, unknown>;
-}
+export type { StubbedError } from "../shared/listResponse.types";
```

`utils/listResponse.ts` — what changed: `buildListResponse` and `pageOf` became generic:

```diff
@@ -1,20 +1,18 @@
-import type {
-  OnlineClass,
-  OnlineClassListResponse,
-} from "./types/onlineClass/onlineClass.types";
+import type { OnlineClass } from "./types/onlineClass/onlineClass.types";
+import type { ListResponse } from "./types/shared/listResponse.types";

 /**
- * Builds one page of `GET /api/v1/online-class` the way Laravel paginates it.
+ * Builds one page of a Laravel-paginated list the way the API sends it.
  *
  * `from`/`to` are null on an empty result, as Laravel sends them, because the
- * list page's paginator reads them and an invented `0` would hide that case.
+ * list pages' paginators read them and an invented `0` would hide that case.
  */
-export function buildListResponse(
-  items: OnlineClass[],
+export function buildListResponse<T>(
+  items: T[],
   page = 1,
   perPage = 20,
   total = items.length,
-): OnlineClassListResponse {
+): ListResponse<T> {
   const lastPage = Math.max(1, Math.ceil(total / perPage));
   const from = total ? (page - 1) * perPage + 1 : null;

@@ -54,11 +52,11 @@ export function makeClasses(
 }

 /** Slices `all` into the page a `?page=` request asks for. */
-export function pageOf(
-  all: OnlineClass[],
+export function pageOf<T>(
+  all: T[],
   page: number,
   perPage: number,
-): OnlineClassListResponse {
+): ListResponse<T> {
   const start = (page - 1) * perPage;

   return buildListResponse(
```

The full file after the change:

```ts
import type { OnlineClass } from "./types/onlineClass/onlineClass.types";
import type { ListResponse } from "./types/shared/listResponse.types";

/**
 * Builds one page of a Laravel-paginated list the way the API sends it.
 *
 * `from`/`to` are null on an empty result, as Laravel sends them, because the
 * list pages' paginators read them and an invented `0` would hide that case.
 */
export function buildListResponse<T>(items: T[], page = 1, perPage = 20, total = items.length): ListResponse<T> {
  const lastPage = Math.max(1, Math.ceil(total / perPage));
  const from = total ? (page - 1) * perPage + 1 : null;

  return {
    items,
    links: {
      prev: page > 1 ? `?page=${page - 1}` : null,
      next: page < lastPage ? `?page=${page + 1}` : null,
    },
    meta: {
      current_page: page,
      last_page: lastPage,
      per_page: perPage,
      total,
      from,
      to: from ? from + items.length - 1 : null,
    },
  };
}

/**
 * `count` synthetic classes cloned from `base`, titled `<prefix> 001`…
 *
 * Zero-padded so the titles sort the same way they are numbered, and given
 * v4-shaped ids so the detail route's UUID matcher still accepts them.
 */
export function makeClasses(base: OnlineClass, count: number, prefix: string): OnlineClass[] {
  return Array.from({ length: count }, (_, index) => ({
    ...base,
    id: `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    title: `${prefix} ${String(index + 1).padStart(3, "0")}`,
  }));
}

/** Slices `all` into the page a `?page=` request asks for. */
export function pageOf<T>(all: T[], page: number, perPage: number): ListResponse<T> {
  const start = (page - 1) * perPage;

  return buildListResponse(all.slice(start, start + perPage), page, perPage, all.length);
}
```

### Step 6 — Speaking types

`utils/types/speaking/speakingList.types.ts`:

```ts
import type { ListResponse } from "../shared/listResponse.types";

/** The seven Speaking question-type codes (`question_types.short_title`). */
export type SpeakingTypeCode = "RA" | "RS" | "DI" | "RL" | "ASQ" | "SGD" | "RTAS";

export type Frequency = "HIGH" | "MODERATE" | "LOW";

/**
 * One row of `GET /api/v1/questions/list`, as `QuestionListResource` shapes it
 * (apical-api `app/Http/Resources/QuestionListResource.php:22-55`).
 */
export interface SpeakingQuestion {
  id: string;
  q_id: string;
  index: string;
  /** `strip_tags(title ?? transcript)` — plain text, brackets kept. */
  title: string | null;
  /** The type's short_title, shown in the ITEM column. */
  item: string;
  question_type_id: string;
  question_type_slug: string;
  frequency: Frequency | null;
  /** Display name, e.g. "Exam Question" — not the enum. */
  source: string;
  active: boolean;
  approve_status: number;
  approve_status_text: string;
  /** `d M, Y h:i a` in Asia/Dhaka, e.g. "02 Oct, 2026 01:07 pm". */
  created_at: string;
  created_by: string;
  /** The creator's user id, or null for system-created rows ("Blubird"). */
  creator: string | null;
  explanations_count: number;
  taken_count: number;
  bookmark_list: unknown;
}

export type SpeakingListResponse = ListResponse<SpeakingQuestion>;

/** One entry of `GET /api/v1/question-types?section=speaking`. */
export interface SpeakingQuestionType {
  id: string;
  slug: string;
  title: string;
  short_title: SpeakingTypeCode;
  section: string;
  display_order: number;
  [field: string]: unknown;
}

export interface SpeakingQuestionTypesResponse {
  items: SpeakingQuestionType[];
}

/** `GET /api/v1/common/dropdowns?status`. */
export interface StatusDropdownResponse {
  status: { id: number; name: string }[];
}

/** The filters the oracle reads off a list request. */
export interface SpeakingListQuery {
  section: string;
  questionTypeId: string | null;
  /** `active` exactly as sent: "0", "1", "true", "false" or null. */
  active: string | null;
  search: string;
  sort: string;
  page: number;
  perPage: number;
}
```

### Step 7 — Backend oracle

`utils/speakingListOracle.ts`:

```ts
import { pageOf } from "./listResponse";
import type { StubbedError } from "./types/shared/listResponse.types";
import type { SpeakingListQuery, SpeakingListResponse, SpeakingQuestion } from "./types/speaking/speakingList.types";

/** `config/settings.php` `pagination.per_page`. */
export const DEFAULT_PER_PAGE = 20;

/**
 * Columns of `questions` that `ORDER BY` accepts, mapped to the list field that
 * carries the same value. `created_by` holds the creator's uuid, which the list
 * resource sends as `creator` and replaces `created_by` with a display name.
 */
const SORTABLE: Record<string, keyof SpeakingQuestion> = {
  q_id: "q_id",
  index: "index",
  title: "title",
  frequency: "frequency",
  active: "active",
  approve_status: "approve_status",
  created_at: "created_at",
  created_by: "creator",
  question_type_id: "question_type_id",
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Reads the filters a list request carries, defaulting as the API does. */
export function parseListQuery(url: URL): SpeakingListQuery {
  const params = url.searchParams;

  return {
    section: (params.get("section") ?? "").toLowerCase(),
    questionTypeId: params.get("question_type_id"),
    active: params.get("active"),
    search: params.get("search") ?? "",
    sort: params.get("sort") ?? "",
    page: Number(params.get("page") ?? 1) || 1,
    perPage: Number(params.get("per_page") ?? DEFAULT_PER_PAGE),
  };
}

/** "02 Oct, 2026 01:07 pm" → epoch ms, so `created_at` sorts by time. */
export function createdAtMs(value: string): number {
  const match = /^(\d{2}) (\w{3}), (\d{4}) (\d{2}):(\d{2}) (am|pm)$/.exec(value);

  if (!match) {
    throw new Error(`Unrecognised created_at "${value}".`);
  }

  const [, day, month, year, hour, minute, half] = match;
  const hour24 = (Number(hour) % 12) + (half === "pm" ? 12 : 0);

  return Date.UTC(Number(year), MONTHS.indexOf(month ?? ""), Number(day), hour24, Number(minute));
}

/**
 * `active` as `Question::scopeOfSearch` applies it: present means filter, and
 * PostgreSQL reads "1"/"true" as true and "0"/"false" as false.
 */
function activeFilter(value: string | null): boolean | null {
  if (value === null) return null;

  return value === "1" || value === "true";
}

/**
 * The backend's filters, reproduced so a stub answers as the server would.
 *
 * Mirrors apical-api `Question::scopeOfSearch`: section, question_type_id,
 * active, and a **case-sensitive** `LIKE %term%` (PostgreSQL). Of the seven
 * columns the API searches, the list fixture carries three — q_id, index and
 * title — so a term that only appears in prompt, transcript, keywords or
 * file_path matches nothing here. The live spec covers those.
 */
export function backendFilter(items: SpeakingQuestion[], query: SpeakingListQuery): SpeakingQuestion[] {
  // The recorded fixture holds only Speaking questions.
  if (query.section && query.section !== "speaking") {
    return [];
  }

  const active = activeFilter(query.active);
  const term = query.search;

  return items.filter((item) => (query.questionTypeId === null || item.question_type_id === query.questionTypeId) && (active === null || item.active === active) && (term === "" || item.q_id.includes(term) || item.index.includes(term) || (item.title ?? "").includes(term)));
}

function compareValues(a: unknown, b: unknown, column: keyof SpeakingQuestion): number {
  if (column === "created_at") {
    return createdAtMs(String(a)) - createdAtMs(String(b));
  }
  if (typeof a === "boolean" || typeof a === "number") {
    return Number(a) - Number(b);
  }

  return String(a) < String(b) ? -1 : String(a) > String(b) ? 1 : 0;
}

/**
 * `BaseTrait::scopeOfOrderBy`: a comma list of columns, `-` for descending,
 * default `created_at desc`. Any name is passed to `ORDER BY` unchecked, so a
 * name that is not a column fails the query (finding F-03) — reproduced here
 * as the error the API returns. Nulls sort last ascending and first
 * descending, as in PostgreSQL.
 */
export function backendSort(items: SpeakingQuestion[], sort: string): SpeakingQuestion[] | StubbedError {
  const keys = (sort || "-created_at")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean);

  for (const key of keys) {
    const name = key.replace(/^-/, "");
    if (!(name in SORTABLE)) {
      return {
        status: 404,
        body: {
          message: `SQLSTATE[42703]: Undefined column: 7 ERROR:  column "${name}" does not exist`,
        },
      };
    }
  }

  return [...items].sort((left, right) => {
    for (const key of keys) {
      const descending = key.startsWith("-");
      const column = SORTABLE[key.replace(/^-/, "")] as keyof SpeakingQuestion;
      const a = left[column];
      const b = right[column];

      if (a === b) continue;
      if (a === null) return descending ? -1 : 1;
      if (b === null) return descending ? 1 : -1;

      const order = compareValues(a, b, column);
      if (order !== 0) return descending ? -order : order;
    }

    return 0;
  });
}

/** One list response for `url`, answered from `items` as the API would. */
export function answerListRequest(items: SpeakingQuestion[], url: URL): SpeakingListResponse | StubbedError {
  const query = parseListQuery(url);
  const sorted = backendSort(backendFilter(items, query), query.sort);

  if (!Array.isArray(sorted)) {
    return sorted;
  }

  return pageOf(sorted, query.page, query.perPage);
}
```

### Step 8 — Oracle unit tests

`tests/unitTest/utils/speakingListOracle.test.ts`. All 12 tests pass (`npx vitest run tests/unitTest/utils/speakingListOracle.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { answerListRequest, backendFilter, backendSort, createdAtMs, parseListQuery } from "../../../utils/speakingListOracle";
import { recordedSpeakingQuestions } from "../../../utils/speakingFixtures";

const all = recordedSpeakingQuestions();
const ASQ = "d95558f1-5063-4a3e-8980-ab2a8f632063";

const url = (query: string) => new URL(`https://api.test/api/v1/questions/list?${query}`);

describe("parseListQuery", () => {
  it("reads the filters and defaults page and per_page", () => {
    expect(parseListQuery(url("type=question&section=speaking&sort=-created_at"))).toEqual({
      section: "speaking",
      questionTypeId: null,
      active: null,
      search: "",
      sort: "-created_at",
      page: 1,
      perPage: 20,
    });
  });
});

describe("createdAtMs", () => {
  it("orders the API's display dates by time, 12 pm before 1 pm", () => {
    expect(createdAtMs("02 Oct, 2026 12:30 pm")).toBeLessThan(createdAtMs("02 Oct, 2026 01:07 pm"));
    expect(createdAtMs("02 Oct, 2026 12:30 am")).toBeLessThan(createdAtMs("02 Oct, 2026 01:07 am"));
  });

  it("refuses a format it does not know", () => {
    expect(() => createdAtMs("2026-10-02")).toThrow();
  });
});

describe("backendFilter", () => {
  const base = parseListQuery(url("section=speaking"));

  it("returns every recorded question with no filter", () => {
    expect(backendFilter(all, base)).toHaveLength(118);
  });

  it("filters by type and by active, as the recorded counts say", () => {
    expect(backendFilter(all, { ...base, questionTypeId: ASQ })).toHaveLength(10);
    expect(backendFilter(all, { ...base, active: "0" })).toHaveLength(8);
    expect(backendFilter(all, { ...base, active: "1" })).toHaveLength(110);
  });

  it("searches case-sensitively, like PostgreSQL LIKE", () => {
    expect(backendFilter(all, { ...base, search: "RS0001" }).length).toBe(5);
    expect(backendFilter(all, { ...base, search: "rs0001" })).toEqual([]);
  });

  it("returns nothing for another section", () => {
    expect(backendFilter(all, { ...base, section: "reading" })).toEqual([]);
  });
});

describe("backendSort", () => {
  it("defaults to newest first", () => {
    const sorted = backendSort(all, "");

    expect(Array.isArray(sorted) && sorted[0]?.q_id).toBe("RS00237");
  });

  it("sorts ascending and descending by a column", () => {
    const up = backendSort(all, "q_id");
    const down = backendSort(all, "-q_id");

    expect(Array.isArray(up) && up.map((item) => item.q_id)).toEqual([...all.map((item) => item.q_id)].sort());
    expect(Array.isArray(down) && down[0]?.q_id).toBe([...all.map((item) => item.q_id)].sort().at(-1));
  });

  it("fails a column that does not exist, as the API does (F-03)", () => {
    expect(backendSort(all, "sl")).toMatchObject({ status: 404 });
    expect(backendSort(all, "-item")).toMatchObject({ status: 404 });
  });
});

describe("answerListRequest", () => {
  it("pages the filtered result", () => {
    const reply = answerListRequest(all, url("section=speaking&page=6"));

    expect("meta" in reply && reply.meta).toMatchObject({
      current_page: 6,
      from: 101,
      to: 118,
      total: 118,
    });
  });

  it("sends an empty page past the end, as the API does", () => {
    const reply = answerListRequest(all, url(`section=speaking&question_type_id=${ASQ}&page=5`));

    expect("items" in reply && reply.items).toEqual([]);
    expect("meta" in reply && reply.meta.total).toBe(10);
  });
});
```

### Step 9 — Shared GET cache

`services/shared/apiResponseCache.service.ts`:

```ts
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import type { APIResponse, Page, Route } from "@playwright/test";
import { STATE_MAX_AGE_MS, isStateFresh } from "../../utils/storageState";

/** Every Apical API call the app makes, whatever the API host. */
const API_RE = /\/api\/v1\//;
const CACHE_DIR = path.resolve(process.cwd(), "test-results/.api-cache");
const MAX_ATTEMPTS = 6;
const DEFAULT_BACKOFF_MS = 10_000;

interface CachedReply {
  savedAt: number;
  status: number;
  contentType: string;
  body: string;
}

const memory = new Map<string, CachedReply>();

const sleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/** Seconds from `Retry-After`, else the default back-off. */
export function backoffMs(retryAfter: string | undefined): number {
  const seconds = Number(retryAfter);

  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : DEFAULT_BACKOFF_MS;
}

function keyOf(route: Route): string {
  const request = route.request();

  return createHash("sha1")
    .update(`${request.url()}\n${request.headers().authorization ?? ""}`)
    .digest("hex");
}

function fromDisk(key: string): CachedReply | null {
  try {
    const reply = JSON.parse(fs.readFileSync(path.join(CACHE_DIR, `${key}.json`), "utf-8")) as CachedReply;

    return isStateFresh(reply.savedAt, STATE_MAX_AGE_MS) ? reply : null;
  } catch {
    return null;
  }
}

function toDisk(key: string, reply: CachedReply): void {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  // Written then renamed, so a parallel worker never reads half a file.
  const target = path.join(CACHE_DIR, `${key}.json`);
  const temp = `${target}.${process.pid}.tmp`;
  fs.writeFileSync(temp, JSON.stringify(reply));
  fs.renameSync(temp, target);
}

/** `route.fetch()`, waiting out the API's 60/min throttle (finding F-12). */
async function fetchThrottled(route: Route): Promise<APIResponse> {
  for (let attempt = 1; ; attempt++) {
    const response = await route.fetch();

    if (response.status() !== 429 || attempt === MAX_ATTEMPTS) {
      return response;
    }

    await sleep(backoffMs(response.headers()["retry-after"]));
  }
}

/**
 * Serves repeat GETs to the real API from a short-lived cache.
 *
 * The API throttles each user to 60 requests a minute (F-12), and every test
 * boots the whole app — profile, settings, menus — under the same master
 * account. Without this, a few parallel specs exhaust the quota on boot calls
 * alone. Only successful GETs are cached, keyed by URL and Authorization, for
 * as long as a cached session is trusted; the responses are still the real
 * server's, recorded on first use in the run.
 *
 * Install it before any stub: Playwright tries routes newest first, so the
 * specific stubs registered after it win, and their `fallback()` lands here.
 */
export class ApiResponseCache {
  static async install(page: Page, options: { bypass?: RegExp[] } = {}): Promise<void> {
    const bypass = options.bypass ?? [];

    await page.route(API_RE, async (route) => {
      const request = route.request();

      if (request.method() !== "GET" || bypass.some((pattern) => pattern.test(request.url()))) {
        return route.continue();
      }

      const reply = await ApiResponseCache.get(route);

      return route.fulfill({
        status: reply.status,
        contentType: reply.contentType,
        body: reply.body,
      });
    });
  }

  /** The cached or freshly fetched reply for `route`'s request. */
  static async get(route: Route): Promise<CachedReply> {
    const key = keyOf(route);
    const cached = memory.get(key) ?? fromDisk(key);

    if (cached) {
      memory.set(key, cached);
      return cached;
    }

    const response = await fetchThrottled(route);
    const reply: CachedReply = {
      savedAt: Date.now(),
      status: response.status(),
      contentType: response.headers()["content-type"] ?? "application/json",
      body: await response.text(),
    };

    if (response.ok()) {
      memory.set(key, reply);
      toDisk(key, reply);
    }

    return reply;
  }

  /** The reply parsed as JSON — for stubs that edit a real response. */
  static async json<T>(route: Route): Promise<T> {
    return JSON.parse((await ApiResponseCache.get(route)).body) as T;
  }
}
```

### Step 10 — Page object

`pages/speaking/speakingList.page.ts`:

```ts
import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";

/** Where each portal mounts `SpeakingView.vue`. */
export const SPEAKING_LIST_PATHS = {
  master: "/master/question-management/question-creation/pte-question/speaking",
  teacher: "/teacher/question-creation/pte-question/speaking",
  coaching: "/coaching-owner/test/test-list/pte-question/speaking",
} as const;

/** The master section routes around the Speaking list. */
export const PTE_QUESTION_PATHS = {
  parent: "/master/question-management/question-creation/pte-question",
  questionManagement: "/master/question-management",
  create: "/master/question-management/question-creation/pte-question/create",
  edit: "/master/question-management/question-creation/pte-question/edit",
} as const;

/** Column order, from the `headers` data in `SpeakingView.vue:225-256`. */
const COLUMN = {
  sl: 0,
  qId: 1,
  index: 2,
  item: 3,
  frequency: 4,
  createdAt: 5,
  createdBy: 6,
  status: 7,
  actions: 8,
} as const;

export type SpeakingColumn = keyof typeof COLUMN;

/** Row actions by the mdi icon each renders (`SpeakingView.vue:106-141`). */
const ACTION_ICON = {
  details: "mdi-eye",
  evaluate: "mdi-clipboard-text-play",
  edit: "mdi-pencil",
  delete: "mdi-delete",
} as const;

export type SpeakingRowAction = keyof typeof ACTION_ICON;

/** `Paginate.vue` greys an arrow it will not act on with this class. */
const DISABLED_ARROW = "bg-periwinkle-gray";

/**
 * The Speaking question list — `SpeakingView.vue` inside the PTE-question tab
 * shell (`pte-question/IndexView.vue`), shared by the master, teacher and
 * coaching-center portals.
 *
 * The app ships no `data-testid`, so locators key off the view's own classes,
 * native `<select>`s and mdi icon classes. They all live here so a markup
 * change is a one-file fix.
 */
export class SpeakingListPage {
  readonly heading: Locator;
  readonly headerIcon: Locator;
  readonly tabs: Locator;
  readonly activeTab: Locator;
  readonly typeFilter: Locator;
  readonly statusFilter: Locator;
  readonly search: Locator;
  readonly createButton: Locator;
  readonly skeleton: Locator;
  readonly headerCells: Locator;
  readonly rows: Locator;
  readonly emptyAlert: Locator;
  readonly paginator: Locator;
  readonly prevArrow: Locator;
  readonly nextArrow: Locator;
  readonly tooltip: Locator;
  private readonly table: Locator;

  constructor(private readonly page: Page) {
    // PageTopOuter renders the label in an <h3>; uppercase is CSS only.
    this.heading = page.locator("h3", { hasText: /^\s*speaking\s*$/i });
    this.headerIcon = page.locator(".mdi-microphone").first();
    this.tabs = page.locator(".tab-component a");
    this.activeTab = page.locator(".tab-component a.active");
    // The view's two native selects: question type, then status.
    this.typeFilter = page.locator("select.select-component").nth(0);
    this.statusFilter = page.locator("select.select-component").nth(1);
    this.search = page.getByPlaceholder("Search speaking questions");
    this.createButton = page.getByRole("button", { name: /create new/i });
    this.skeleton = page.locator(".v-skeleton-loader");
    this.table = page.locator("table").first();
    // Hidden columns keep their <th hidden> (`atom/table/Index.vue:11`).
    this.headerCells = this.table.locator("thead th:not([hidden])");
    this.rows = this.table.locator("tbody tr.table-row");
    // `atom/table/Index.vue:49` renders "Records not found" after the table.
    this.emptyAlert = page.locator(".v-alert", { hasText: "not found" });
    this.paginator = page.locator("div.center:has(.mdi-chevron-right)");
    this.prevArrow = this.paginator.locator("i.mdi-chevron-left");
    this.nextArrow = this.paginator.locator("i.mdi-chevron-right");
    this.tooltip = page.locator(".v-tooltip > .v-overlay__content");
  }

  /** Opens a list path and waits for its heading. */
  async goto(path: string): Promise<void> {
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
    await this.heading.waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  async waitForRows(): Promise<void> {
    await this.rows.first().waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  /** The row whose Q_ID cell reads exactly `qId`. */
  row(qId: string): Locator {
    return this.rows.filter({
      has: this.page.locator(`td:nth-child(${COLUMN.qId + 1})`).getByText(qId, { exact: true }),
    });
  }

  cell(row: Locator, column: SpeakingColumn): Locator {
    return row.locator("td").nth(COLUMN[column]);
  }

  action(row: Locator, name: SpeakingRowAction): Locator {
    return this.cell(row, "actions").locator(`i.${ACTION_ICON[name]}`);
  }

  /** The row-action names a row renders, in order. */
  async actionsOf(row: Locator): Promise<SpeakingRowAction[]> {
    const icons = await this.cell(row, "actions")
      .locator("i")
      .evaluateAll((nodes) => nodes.map((node) => [...node.classList]));
    const names = Object.entries(ACTION_ICON);

    return icons.flatMap((classes) => names.filter(([, icon]) => classes.includes(icon)).map(([name]) => name as SpeakingRowAction));
  }

  /** The trimmed text of one column for every row on screen. */
  async columnTexts(column: SpeakingColumn): Promise<string[]> {
    const texts = await this.rows.locator(`td:nth-child(${COLUMN[column] + 1})`).allInnerTexts();

    return texts.map((text) => text.trim());
  }

  /** The visible option labels of a filter select. */
  async optionLabels(select: Locator): Promise<string[]> {
    const labels = await select.locator("option").allInnerTexts();

    return labels.map((label) => label.trim());
  }

  /** Picks a filter option by its label. */
  async choose(select: Locator, label: string): Promise<void> {
    await select.selectOption({ label });
  }

  /**
   * Types one character at a time.
   *
   * Character by character on purpose: the view's `watch(keyword)` fires on
   * each change and only searches from the third character, which a single
   * `fill` would skip straight past.
   */
  async typeSearch(text: string): Promise<void> {
    await this.search.click();
    await this.search.pressSequentially(text, { delay: 60 });
  }

  async clearSearch(): Promise<void> {
    await this.search.fill("");
  }

  async submitSearch(): Promise<void> {
    await this.search.press("Enter");
  }

  async next(): Promise<void> {
    await this.nextArrow.click();
  }

  async previous(): Promise<void> {
    await this.prevArrow.click();
  }

  /** Whether `Paginate.vue` has greyed an arrow out. */
  async isArrowDisabled(arrow: Locator): Promise<boolean> {
    return (await arrow.getAttribute("class"))?.includes(DISABLED_ARROW) ?? false;
  }

  /** A header cell by its label. */
  header(label: string): Locator {
    return this.headerCells.filter({
      hasText: new RegExp(`^\\s*${label}\\s*$`),
    });
  }

  /** Clicks the sort icon of the column headed `label`. */
  async sortBy(label: string): Promise<void> {
    await this.header(label).locator(".mdi-swap-vertical").click();
  }

  /** The mdi colour class `getIconColor` put on a row's FREQUENCY icon. */
  async frequencyIconClasses(row: Locator): Promise<string[]> {
    const icon = this.cell(row, "frequency").locator("i.v-icon");

    return ((await icon.getAttribute("class")) ?? "").split(/\s+/);
  }

  /** The clickable creator name in the CREATED BY cell. */
  creatorLink(row: Locator): Locator {
    return this.cell(row, "createdBy").locator(".table-cell-link");
  }

  /** The coloured label in the STATUS cell. */
  statusLabel(row: Locator): Locator {
    return this.cell(row, "status").locator("span");
  }
}
```

### Step 11 — API stubs and list workflow

`services/speaking/speakingListApiMock.service.ts`:

```ts
import type { Page, Route } from "@playwright/test";
import { Fixtures } from "../../utils/fixtures";
import { recordedSpeakingQuestions } from "../../utils/speakingFixtures";
import { answerListRequest } from "../../utils/speakingListOracle";
import type { StubbedError } from "../../utils/types/shared/listResponse.types";
import type { SpeakingListResponse, SpeakingQuestion, SpeakingQuestionTypesResponse, StatusDropdownResponse } from "../../utils/types/speaking/speakingList.types";
import { ApiResponseCache } from "../shared/apiResponseCache.service";

export const TYPES_FIXTURE = "speakingQuestionTypes.response.json";
export const STATUS_FIXTURE = "speakingStatusDropdown.response.json";

/** `GET /api/v1/questions/list[?query]` — not `/questions/{id}`. */
export const LIST_RE = /\/api\/v1\/questions\/list(\?.*)?$/;
const TYPES_RE = /\/api\/v1\/question-types\?section=speaking$/;
const STATUS_RE = /\/api\/v1\/common\/dropdowns\?status$/;
const PROFILE_RE = /\/api\/v1\/users\/profile(\?.*)?$/;

export type ListHandler = (url: URL) => SpeakingListResponse | StubbedError | Promise<SpeakingListResponse | StubbedError>;

/** A profile as `/users/profile` returns it, as far as `can()` reads it. */
export interface ProfileReply {
  data: { role?: string; permissions?: string[]; [field: string]: unknown };
  [field: string]: unknown;
}

const isError = (reply: SpeakingListResponse | StubbedError): reply is StubbedError => "status" in reply;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Every recorded Speaking question (118, stage, 2026-10-05), freshly cloned.
 * Stubs page and filter them with the backend oracle.
 */
export function sampleQuestions(): SpeakingQuestion[] {
  return recordedSpeakingQuestions();
}

/** One recorded question by q_id, optionally with fields replaced. */
export function sampleQuestion(qId: string, override: Partial<SpeakingQuestion> = {}): SpeakingQuestion {
  const found = sampleQuestions().find((item) => item.q_id === qId);

  if (!found) {
    throw new Error(`The recorded list has no question ${qId}.`);
  }

  return { ...found, ...override };
}

export function sampleTypes(): SpeakingQuestionTypesResponse {
  return Fixtures.api<SpeakingQuestionTypesResponse>(TYPES_FIXTURE);
}

/** Answers every list request from `items` the way the API would. */
export function oracle(items: SpeakingQuestion[] = sampleQuestions()) {
  return (url: URL) => answerListRequest(items, url);
}

/**
 * Stubs the endpoints the Speaking list reads, and records what it asked.
 *
 * Only these are stubbed. Everything else — login, settings, menus — reaches
 * the real backend through `ApiResponseCache`, so the list renders inside a
 * genuine session and only its data is controlled.
 */
export class SpeakingListApiMock {
  readonly listRequests: URL[] = [];

  constructor(private readonly page: Page) {}

  /** Serves the list. Default: the recorded questions through the oracle. */
  async list(handler: ListHandler = oracle(), options: { delayMs?: number } = {}): Promise<void> {
    await this.page.unroute(LIST_RE);
    await this.page.route(LIST_RE, async (route: Route) => {
      if (route.request().method() !== "GET") {
        return route.fallback();
      }

      const url = new URL(route.request().url());
      this.listRequests.push(url);

      if (options.delayMs) await delay(options.delayMs);

      const reply = await handler(url);

      if (isError(reply)) {
        return route.fulfill({
          status: reply.status,
          json: reply.body ?? { message: "error" },
        });
      }

      return route.fulfill({ json: reply });
    });
  }

  /** Serves the recorded Speaking question types. */
  async questionTypes(): Promise<void> {
    await this.page.route(TYPES_RE, (route) => route.fulfill({ json: sampleTypes() }));
  }

  /** Serves the recorded status dropdown (Draft / Published). */
  async statuses(): Promise<void> {
    await this.page.route(STATUS_RE, (route) =>
      route.fulfill({
        json: Fixtures.api<StatusDropdownResponse>(STATUS_FIXTURE),
      }),
    );
  }

  /**
   * Serves the signed-in user's real profile, edited by `edit`.
   *
   * `can()` lets a SUPER_ADMIN through every check, so a permission case has to
   * demote the role and choose the permission ids itself.
   */
  async profile(edit: (profile: ProfileReply) => ProfileReply): Promise<void> {
    await this.page.route(PROFILE_RE, async (route) => {
      const real = await ApiResponseCache.json<ProfileReply>(route);

      return route.fulfill({ json: edit(real) });
    });
  }

  lastListRequest(): URL | null {
    return this.listRequests.at(-1) ?? null;
  }

  /** Values of one query parameter across every list request, in order. */
  paramHistory(name: string): (string | null)[] {
    return this.listRequests.map((url) => url.searchParams.get(name));
  }
}
```

`services/speaking/speakingList.service.ts`:

```ts
import type { Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";
import { SPEAKING_LIST_PATHS, SpeakingListPage } from "../../pages/speaking/speakingList.page";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import { ApiResponseCache } from "../shared/apiResponseCache.service";
import { LIST_RE, type ListHandler, type ProfileReply, SpeakingListApiMock } from "./speakingListApiMock.service";

export interface OpenSpeakingListOptions {
  role?: ApicalRole;
  /** Defaults to the role's own portal path. */
  path?: string;
  /** Serves the list; defaults to the recorded questions through the oracle. */
  list?: ListHandler;
  /** Slows every list reply, to observe the loading state. */
  listDelayMs?: number;
  /**
   * Leaves the list to the real API. For cases whose point is what the server
   * does with a request — the F-03 sorts — where a stub would only replay the
   * oracle's guess.
   */
  liveList?: boolean;
  /** Edits the real `/users/profile` reply, to choose roles and permissions. */
  profile?: (profile: ProfileReply) => ProfileReply;
  /** Waits for the first row. Off for cases that expect no rows. */
  waitForRows?: boolean;
  /**
   * Waits for the Speaking heading. Off for paths that are not the list,
   * such as a parent route that redirects elsewhere.
   */
  waitForList?: boolean;
}

export interface OpenedSpeakingList {
  listPage: SpeakingListPage;
  api: SpeakingListApiMock;
}

/** Workflows over the Speaking question list that more than one spec needs. */
export class SpeakingListService {
  /**
   * Signs in, installs the cache and stubs, opens the list.
   *
   * Stubs go in before navigating: the list request fires from `created()`,
   * so a route added after `goto` would miss it.
   */
  static async open(page: Page, options: OpenSpeakingListOptions = {}): Promise<OpenedSpeakingList> {
    const role = options.role ?? "master";
    const api = new SpeakingListApiMock(page);

    await ApicalLoginService.ensureLoggedIn(page, role);
    await ApiResponseCache.install(page, {
      bypass: options.liveList ? [LIST_RE] : [],
    });

    if (!options.liveList) {
      await api.list(options.list, { delayMs: options.listDelayMs ?? 0 });
    }
    await api.questionTypes();
    await api.statuses();
    if (options.profile) {
      await api.profile(options.profile);
    }

    const listPage = new SpeakingListPage(page);
    const path = options.path ?? SPEAKING_LIST_PATHS[role];

    if (options.waitForList === false) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      return { listPage, api };
    }

    await listPage.goto(path);

    if (options.waitForRows ?? true) {
      await listPage.waitForRows();
    }

    return { listPage, api };
  }

  /**
   * Waits out the quiet window, then returns.
   *
   * For negative cases that assert a request was *not* sent: absence cannot be
   * awaited, only observed, so requests are counted after this window.
   */
  static async settle(page: Page): Promise<void> {
    await page.waitForTimeout(timeouts.quietWindow);
  }

  /**
   * A profile reply demoted from SUPER_ADMIN, holding the real permission ids
   * minus `without`.
   */
  static withoutPermissions(...without: number[]) {
    return (profile: ProfileReply): ProfileReply => ({
      ...profile,
      data: {
        ...profile.data,
        role: "QA_RESTRICTED_ADMIN",
        permissions: (profile.data.permissions ?? []).filter((id) => !without.includes(Number(id))),
      },
    });
  }
}
```

### Step 12 — Test data

`data/regular/speaking/speakingListRegularTestData.json`, annotated:

```jsonc
{
  // which data set this is: "regular" (expected behaviour) or "edge" (boundaries)
  "type": "regular",
  // date the fixtures were recorded on stage; counts below are as of that day
  "recordedOn": "2026-10-05",
  // all Speaking questions in the fixture → paginator total (TC-090)
  "total": 118,
  // rows per page, from config/settings.php pagination.per_page
  "perPage": 20,
  // column headers in order, from SpeakingView.vue headers (TC-010)
  "headers": ["SL", "Q_ID", "INDEX", "ITEM", "FREQUENCY", "CREATED AT", "CREATED BY", "STATUS", "ACTIONS"],
  // tab strip labels in order, from pte-question/IndexView.vue (TC-004)
  "tabs": ["Speaking", "Writing", "Reading", "Listening"],
  // query the first list request must carry, exactly (TC-006)
  "initialQuery": {
    "type": "question",
    "section": "speaking",
    "sort": "-created_at",
  },
  // the 7 types: filter label, ITEM code, uuid, and how many the fixture holds (TC-040/042)
  "types": [
    {
      "code": "RA",
      "title": "Read Aloud",
      "id": "c7b24d80-1143-4ec2-9fb9-821d1b8aeeec",
      "count": 37,
    },
    {
      "code": "RS",
      "title": "Repeat Sentence",
      "id": "ef4b11a9-8086-4d93-8da7-4e68b60a6a0a",
      "count": 21,
    },
    {
      "code": "DI",
      "title": "Describe Image",
      "id": "7b0940dc-2d64-48dc-a9e1-b22de427e63e",
      "count": 17,
    },
    {
      "code": "RL",
      "title": "Retell Lecture",
      "id": "306d2f79-720e-4b12-acf2-439436844c67",
      "count": 16,
    },
    {
      "code": "ASQ",
      "title": "Answer Short Question",
      "id": "d95558f1-5063-4a3e-8980-ab2a8f632063",
      "count": 10,
    },
    {
      "code": "SGD",
      "title": "Summarize Group Discussion",
      "id": "b48d6205-99b8-4200-92a2-c40ce1ba8ce7",
      "count": 9,
    },
    {
      "code": "RTAS",
      "title": "Respond To A Situation",
      "id": "fe321f11-df80-435b-927b-87608890db49",
      "count": 8,
    },
  ],
  // first option of the type filter (TC-041)
  "allTypeLabel": "All Type",
  // status filter options: "All" from the store + the dropdown fixture (TC-050)
  "statuses": ["All", "Draft", "Published"],
  // drafts in the fixture: RS083–RS089 and DI090 (TC-051)
  "draftCount": 8,
  // drafts that are Repeat Sentence, for the combined filter (TC-054)
  "repeatSentenceDraftCount": 7,
  // first row under the default -created_at sort (TC-011)
  "newest": {
    "qId": "RS00237",
    "index": "RS0001-6",
    "createdAt": "02 Oct, 2026 01:07 pm",
  },
  // first row once CREATED AT is sorted ascending (TC-082)
  "oldest": { "qId": "DI011", "createdAt": "17 Sep, 2025 09:28 pm" },
  // a row whose creator uuid opens a profile (TC-018)
  "withCreator": {
    "qId": "RA00236",
    "creator": "a64412c0-1dc8-4f70-a4ef-20f53363bbac",
  },
  // a system row with creator null (TC-019)
  "withoutCreator": { "qId": "RS00237", "createdBy": "Blubird" },
  // icon class getIconColor() applies per frequency (cms.frequency) (TC-016)
  "frequencyColour": {
    "HIGH": "text-success",
    "MODERATE": "text-tahiti-gold",
    "LOW": "text-gray-500",
  },
  // STATUS cell text and colour class per active flag (TC-015)
  "statusLabel": {
    "published": { "text": "Published", "class": "text-green" },
    "draft": { "text": "Draft", "class": "text-red" },
  },
  // search cases: terms and match counts the oracle returns from the fixture (TC-060–072)
  "search": {
    "placeholder": "Search speaking questions",
    "qIdTerm": "RS0001",
    "qIdTermMatches": 5,
    "fullIndex": {
      "term": "April RL Nutrition Science and Food Guidance",
      "qId": "RL00225",
    },
    "shortTerms": ["R", "S"],
    "noMatch": "zz-no-such-question-zz",
    "combined": {
      "typeCode": "RL",
      "status": "Published",
      "term": "lecture",
      "matches": 1,
    },
    "pageResetTerm": "RS0001",
  },
  // paginator labels "<from> - <to> Of <total>" and page facts (TC-090–097)
  "pagination": {
    "firstLabel": "1 - 20 Of 118",
    "secondLabel": "21 - 40 Of 118",
    "lastLabel": "101 - 118 Of 118",
    "lastPage": 6,
    "lastPageRows": 18,
    "singlePageType": "RTAS",
    "singlePageLabel": "1 - 8 Of 8",
    "emptyLabel": "0 - 0 Of 0",
  },
  // ids from apical src/config/permissions.ts, removed from the profile to hide actions (TC-031–036)
  "permissionIds": {
    "QUESTION_STORE": 101205,
    "QUESTION_SHOW": 101206,
    "QUESTION_UPDATE": 101207,
    "QUESTION_DESTROY": 101208,
  },
}
```

`data/edge/speaking/speakingListEdgeTestData.json`, annotated:

```jsonc
{
  // which data set this is: "regular" (expected behaviour) or "edge" (boundaries)
  "type": "edge",
  // index length at the API maximum (max:255) for the layout case (TC-020)
  "longIndexLength": 255,
  // title with markup; the list must never show raw tags (TC-020, TC-113)
  "htmlTitle": "<p><strong>Bold</strong> transcript with <em>markup</em></p>",
  // row forced to LOW, a value no stage question uses (TC-016)
  "lowFrequency": { "qId": "RS00237", "frequency": "LOW" },
  // row forced to frequency null — no icon, no tooltip (TC-017)
  "nullFrequency": { "qId": "RS00237" },
  // LIKE wildcards and quote/bracket; must not cause 500 or SQL errors (TC-070)
  "specialSearchTerms": ["%", "'", "["],
  // lower-case term; LIKE in PostgreSQL is case-sensitive, so it finds nothing
  "caseSearch": { "term": "rs0001", "matchesWhenInsensitive": 5 },
  // a column that does not exist; the API must not leak SQLSTATE (TC-089, F-03)
  "unknownSortColumn": "not_a_column",
  // stubbed failure of the list request (TC-022)
  "listError": { "status": 500, "message": "Server Error" },
  // delay on the list reply, long enough to observe the skeleton (TC-007)
  "slowListMs": 2000,
}
```

`utils/types/speaking/speakingListData.types.ts` — the shape of both data files:

```ts
import type { SpeakingTypeCode } from "./speakingList.types";

export interface SpeakingTypeData {
  code: SpeakingTypeCode;
  title: string;
  id: string;
  /** Questions of this type in the recorded fixture. */
  count: number;
}

/** Contents of data/regular/speaking/speakingListRegularTestData.json. */
export interface SpeakingListTestData {
  type: string;
  recordedOn: string;
  total: number;
  perPage: number;
  headers: string[];
  tabs: string[];
  initialQuery: Record<string, string>;
  types: SpeakingTypeData[];
  allTypeLabel: string;
  statuses: string[];
  draftCount: number;
  repeatSentenceDraftCount: number;
  newest: { qId: string; index: string; createdAt: string };
  oldest: { qId: string; createdAt: string };
  withCreator: { qId: string; creator: string };
  withoutCreator: { qId: string; createdBy: string };
  frequencyColour: Record<"HIGH" | "MODERATE" | "LOW", string>;
  statusLabel: Record<"published" | "draft", { text: string; class: string }>;
  search: {
    placeholder: string;
    qIdTerm: string;
    qIdTermMatches: number;
    fullIndex: { term: string; qId: string };
    shortTerms: string[];
    noMatch: string;
    combined: {
      typeCode: SpeakingTypeCode;
      status: string;
      term: string;
      matches: number;
    };
    pageResetTerm: string;
  };
  pagination: {
    firstLabel: string;
    secondLabel: string;
    lastLabel: string;
    lastPage: number;
    lastPageRows: number;
    singlePageType: SpeakingTypeCode;
    singlePageLabel: string;
    emptyLabel: string;
  };
  permissionIds: Record<"QUESTION_STORE" | "QUESTION_SHOW" | "QUESTION_UPDATE" | "QUESTION_DESTROY", number>;
}

/** Contents of data/edge/speaking/speakingListEdgeTestData.json. */
export interface SpeakingListEdgeTestData {
  type: string;
  longIndexLength: number;
  htmlTitle: string;
  lowFrequency: { qId: string; frequency: "LOW" };
  nullFrequency: { qId: string };
  specialSearchTerms: string[];
  caseSearch: { term: string; matchesWhenInsensitive: number };
  unknownSortColumn: string;
  listError: { status: number; message: string };
  slowListMs: number;
}
```

`utils/speakingTestData.ts` — typed loaders for the specs:

```ts
import { DataLoader } from "./dataLoader";
import type { SpeakingListEdgeTestData, SpeakingListTestData, SpeakingTypeData } from "./types/speaking/speakingListData.types";
import type { SpeakingTypeCode } from "./types/speaking/speakingList.types";

export const speakingListData = (): SpeakingListTestData => DataLoader.load<SpeakingListTestData>("data/regular/speaking/speakingListRegularTestData.json");

export const speakingListEdgeData = (): SpeakingListEdgeTestData => DataLoader.load<SpeakingListEdgeTestData>("data/edge/speaking/speakingListEdgeTestData.json");

/** One Speaking type from the data file by code. Throws on an unknown code. */
export function speakingType(code: SpeakingTypeCode): SpeakingTypeData {
  const found = speakingListData().types.find((type) => type.code === code);

  if (!found) {
    throw new Error(`No Speaking type "${code}" in the test data.`);
  }

  return found;
}
```

### Step 13 — First spec: access & navigation (TC-001 – TC-007)

`tests/tickets/AP-806-speaking-list/speakingNavigation.spec.ts`:

```ts
import { expect, test } from "@playwright/test";
import { PTE_QUESTION_PATHS, SPEAKING_LIST_PATHS, SpeakingListPage } from "../../../pages/speaking/speakingList.page";
import { SpeakingListService } from "../../../services/speaking/speakingList.service";
import { LIST_RE } from "../../../services/speaking/speakingListApiMock.service";
import { speakingListData, speakingListEdgeData } from "../../../utils/speakingTestData";

const data = speakingListData();
const edge = speakingListEdgeData();

test.skip(({ browserName }) => browserName !== "chromium", "AP-806 asserts routing and request behaviour, which is browser-independent.");

test.describe("AP-806 speaking list access & navigation", () => {
  test("opens the Speaking list by URL (AP-806-TC-001)", async ({ page }) => {
    const { listPage } = await SpeakingListService.open(page);

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await expect(listPage.heading).toBeVisible();
    await expect(listPage.headerIcon).toBeVisible();
    await expect(listPage.activeTab).toHaveText(/speaking/i);
    await expect(listPage.rows).toHaveCount(data.perPage);
  });

  test("Question Management → PTE Question lands on Speaking (AP-806-TC-002)", async ({ page }) => {
    // The sidebar's Question Management entry is `master.questionManagement`,
    // which redirects to the question-creation cards; "PTE Question" links to
    // `master-pte-question.speaking` (data/question-creation/data.js:186).
    await SpeakingListService.open(page, {
      path: PTE_QUESTION_PATHS.questionManagement,
      waitForList: false,
    });
    const listPage = new SpeakingListPage(page);

    await page.getByText("PTE Question", { exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await listPage.waitForRows();
  });

  test("pte-question without a section redirects to Reading (AP-806-TC-003)", async ({ page }) => {
    await SpeakingListService.open(page, {
      path: PTE_QUESTION_PATHS.parent,
      waitForList: false,
    });

    await expect(page).toHaveURL(new RegExp(`${PTE_QUESTION_PATHS.parent}/reading$`));
  });

  test("tabs read Speaking · Writing · Reading · Listening and switch sections (AP-806-TC-004)", async ({ page }) => {
    const { listPage, api } = await SpeakingListService.open(page);

    await expect(listPage.tabs).toHaveText(data.tabs);

    await listPage.tabs.filter({ hasText: "Writing" }).click();
    await expect(page).toHaveURL(new RegExp(`${PTE_QUESTION_PATHS.parent}/writing$`));
    await expect.poll(() => api.lastListRequest()?.searchParams.get("section")).toBe("writing");

    await listPage.tabs.filter({ hasText: "Speaking" }).click();
    await expect(page).toHaveURL(new RegExp(`${SPEAKING_LIST_PATHS.master}$`));
    await expect.poll(() => api.lastListRequest()?.searchParams.get("section")).toBe("speaking");
  });

  test("an unauthenticated visitor is sent to login (AP-806-TC-005)", async ({ page }) => {
    const listRequests: string[] = [];
    page.on("request", (request) => {
      if (LIST_RE.test(request.url())) listRequests.push(request.url());
    });

    await page.goto(SPEAKING_LIST_PATHS.master, {
      waitUntil: "domcontentloaded",
    });

    await expect(page).toHaveURL(/\/login$/);
    expect(listRequests).toEqual([]);
  });

  test("first load sends type, section and sort, and loads types and statuses (AP-806-TC-006)", async ({ page }) => {
    const typeRequests: string[] = [];
    const statusRequests: string[] = [];
    page.on("request", (request) => {
      const url = request.url();
      if (url.includes("/api/v1/question-types?")) typeRequests.push(url);
      if (url.includes("/api/v1/common/dropdowns?")) statusRequests.push(url);
    });

    const { api } = await SpeakingListService.open(page);
    const first = api.listRequests[0];

    expect(first && Object.fromEntries(first.searchParams)).toEqual(data.initialQuery);
    expect(typeRequests.some((url) => url.endsWith("?section=speaking"))).toBe(true);
    expect(statusRequests.some((url) => url.endsWith("?status"))).toBe(true);
  });

  test("a skeleton shows while the list loads (AP-806-TC-007)", async ({ page }) => {
    const { listPage } = await SpeakingListService.open(page, {
      listDelayMs: edge.slowListMs,
      waitForRows: false,
    });

    await expect(listPage.skeleton).toBeVisible();
    await listPage.waitForRows();
    await expect(listPage.skeleton).toBeHidden();
  });
});
```

### Step 14 — Commands

```bash
# oracle + shared-helper unit tests (no browser, no network)
npx vitest run tests/unitTest/utils/speakingListOracle.test.ts tests/unitTest/utils/listResponse.test.ts

# type check the whole repo
npx tsc --noEmit -p .

# the AP-806 suite (needs the local app running and the stage login in .env)
npx playwright test --project=chromium tests/tickets/AP-806-speaking-list

# plus the read-only live API checks
RUN_LIVE=1 npx playwright test --project=chromium tests/tickets/AP-806-speaking-list
```
