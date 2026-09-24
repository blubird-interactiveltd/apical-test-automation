# AP-781 — Course Creation Wizard: Test Cases

Automated coverage of the teacher course create wizard at `/course/*` (`src/views/courses/`)
and its create API: each step's validation and saved state, the property steps, Review and
Preview, the `POST /api/v1/packages` + `PUT /api/v1/packages/{id}` pair Preview sends, and
the saved-progress behaviour the wizard's localStorage gives it.

The wizard only calls the API once, on Preview's Save, so the bug class this targets is **a value
entered on one step that arrives wrong, or not at all, in that one payload** — a count that is never
written, an id list another step overwrites, a flag derived from the wrong choice. Every UI case
therefore reads either the saved `course-create-info` or the exact body the stubbed API received.

**Applies to:** the Apical Vue front-end (`blubird-interactiveltd/apical`), branch `AP-3.5v-super-stage`
once [#782](https://github.com/blubird-interactiveltd/apical/pull/782) (fix for #780) is merged — before it the wizard renders blank.
**Ticket:** [blubird-interactiveltd/apical#781](https://github.com/blubird-interactiveltd/apical/issues/781).
**Specs:** `tests/tickets/AP-781-course-create/*.spec.ts` (10 files).
**Test data:** `data/regular/course/*RegularTestData.json`, `data/edge/course/*EdgeTestData.json`.
**Fixtures:** `fixtures/api/course*.response.json` — one recorded page per list endpoint the wizard reads, plus the course list.

**Global preconditions for every case below:**

- `.env` is populated (`BASE_URL`, `API_URL`, `ORGANIZATION`, `MASTER_EMAIL`, `MASTER_PASSWORD`).
- The Apical front-end at `BASE_URL` includes the #780 fix and talks to `API_URL`.

**Properties of this suite that are deliberate:**

- **Only the course endpoints are stubbed.** `CourseApiMock` serves the question types, questions,
  practice and mock tests, quiz types, quizzes, materials, the upload and `/packages`; login, profile
  and permissions still reach the real backend. No UI case writes a course.
- **Steps are opened with seeded state.** `CourseWizardService.open` seeds `course-create-info` once per
  page (a sessionStorage flag stops a reload from re-seeding), so a case starts on the step it tests.
  AP-781-TC-044 is the exception on purpose: it fills every step through the UI, from the course list to Save.
- **The live checks write, and clean up.** `courseApi.live.spec.ts` creates real courses; each one is
  deleted in `afterEach` through `DELETE /api/v1/packages/{id}`.
- **Known defects are expected failures, not deletions.** Each case that exposes a finding below calls
  `test.fail()` next to the source line that causes it.
- **Chromium only**, as AP-779: what is verified is saved state and payloads, identical in every engine.

The suite is **not** enrolled in `scripts/e2e-suites.config.sh`: it needs #782 merged and a reachable
environment first.

---

## How the IDs below map to what a run prints

Every test title ends with its case ID, e.g. `a course is created end to end through the wizard (AP-781-TC-044)`.
Where one case holds independent claims the spec splits it into lettered rows — AP-781-TC-011, -011b and
-011c are three name boundaries. The numbers are those of the ticket's test-case list, prefixed with the ticket.

## 1. Access & navigation

`courseNavigation.spec.ts`

| ID            | Feature             | Title                         | Precondition                                     | Steps                                                  | Expected Outcome                                                                          | Status                                      |
| ------------- | ------------------- | ----------------------------- | ------------------------------------------------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-001 | Access & navigation | Open course wizard            | Logged in as teacher                             | 1. Go to the course list<br>2. Click Create New Course | Opens /course/basic-information in the teacher layout; the sidebar lists the wizard steps | Pass                                        |
| AP-781-TC-002 | Access & navigation | Locked steps can't be skipped | Wizard open on Basic information, nothing filled | 1. Click 'Duration & Price' in the sidebar             | Snackbar 'Please complete &lt;step&gt; form first'; stays on the current step             | Pass                                        |
| AP-781-TC-003 | Access & navigation | Go back to a completed step   | Basic information and Course type completed      | 1. Click 'Basic Information' in the sidebar            | Opens the step with the previously entered values pre-filled                              | Pass                                        |
| AP-781-TC-004 | Access & navigation | Edit a course from the list   | At least one course exists                       | 1. On the course list click the edit action on a row   | Opens the wizard with that course loaded                                                  | **Expected to fail** (D-01) — `test.fail()` |

## 2. Basic information

`courseBasicInformation.spec.ts`

| ID             | Feature           | Title                                             | Precondition                 | Steps                                                                                                 | Expected Outcome                                                                                                                                          | Status                                      |
| -------------- | ----------------- | ------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-005  | Basic information | Save valid basic information                      | On /course/basic-information | 1. Enter name 'QA Course 001'<br>2. Upload a PNG thumbnail<br>3. Enter a description<br>4. Click Next | Navigates to /course/type; course-create-info holds name, description, thumbnail, type = COURSE, organization_id                                          | Pass                                        |
| AP-781-TC-006  | Basic information | Name is required                                  | On /course/basic-information | 1. Leave name empty, fill thumbnail and description<br>2. Click Next                                  | 'Field is required' under name; no navigation                                                                                                             | Pass                                        |
| AP-781-TC-007  | Basic information | Thumbnail is required                             | On /course/basic-information | 1. Fill name and description, no thumbnail<br>2. Click Next                                           | 'Field is required' under thumbnail; no navigation                                                                                                        | Pass                                        |
| AP-781-TC-008  | Basic information | Description is required                           | On /course/basic-information | 1. Fill name and thumbnail, empty description<br>2. Click Next                                        | 'Field is required' under description; no navigation                                                                                                      | Pass                                        |
| AP-781-TC-009  | Basic information | Thumbnail is saved as the path the upload returns | On /course/basic-information | 1. Upload 'My-Thumb.PNG'<br>2. Click Next<br>3. Read course-create-info.thumbnail                     | course-create-info.thumbnail is exactly the path POST /common/upload-file returned. (Was 'lower-cased path' before #780; naming is now the server's job.) | Pass                                        |
| AP-781-TC-010  | Basic information | Rich-text description kept                        | On /course/basic-information | 1. Enter description with bold text and a bullet list<br>2. Complete wizard to Review                 | Review renders the formatting (HTML), not raw tags                                                                                                        | Pass                                        |
| AP-781-TC-011  | Basic information | Name boundaries: whitespace only                  | On /course/basic-information | 1. Enter a name of only spaces<br>2. Fill the other fields, click Next                                | 'Field is required' under name; no navigation                                                                                                             | Pass                                        |
| AP-781-TC-011b | Basic information | Name boundaries: unicode kept                     | On /course/basic-information | 1. Enter a name with accents, CJK and symbols<br>2. Complete the step                                 | Saved name is exactly what was typed                                                                                                                      | Pass                                        |
| AP-781-TC-011c | Basic information | Name boundaries: over 255 characters              | On /course/basic-information | 1. Enter a 269-character name<br>2. Complete the step                                                 | The name is refused with a message; no navigation                                                                                                         | **Expected to fail** (D-02) — `test.fail()` |
| AP-781-TC-012  | Basic information | Invalid thumbnail file: not an image              | On /course/basic-information | 1. Choose a .pdf as the thumbnail                                                                     | The file is refused before upload; no thumbnail path saved                                                                                                | Pass                                        |
| AP-781-TC-012b | Basic information | Invalid thumbnail file: upload refused            | Upload stubbed to answer 413 | 1. Choose a thumbnail<br>2. Fill the rest, click Next                                                 | Snackbar shows the server message; 'Field is required' under thumbnail                                                                                    | Pass                                        |

## 3. Course type

`courseType.spec.ts`

| ID            | Feature     | Title                   | Precondition                     | Steps                                                     | Expected Outcome                                                                 | Status                                      |
| ------------- | ----------- | ----------------------- | -------------------------------- | --------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-013 | Course type | Course type is required | On /course/type                  | 1. Click Next without selecting a type                    | 'Field is required'; no navigation                                               | Pass                                        |
| AP-781-TC-014 | Course type | Online course           | On /course/type                  | 1. Select ONLINE<br>2. Enter online link<br>3. Click Next | course_type = ONLINE, is_online = true, is_branch = false; goes to /course/adons | Pass                                        |
| AP-781-TC-015 | Course type | Branch course           | On /course/type                  | 1. Select BRANCH<br>2. Click Next                         | is_branch = true, is_online = false                                              | Pass                                        |
| AP-781-TC-016 | Course type | Both online and branch  | On /course/type                  | 1. Select BOTH<br>2. Click Next                           | is_branch = true, is_online = true                                               | Pass                                        |
| AP-781-TC-017 | Course type | Invalid online link     | On /course/type, ONLINE selected | 1. Enter 'not a url'<br>2. Click Next                     | Link is validated or rejected (currently not validated in UI; record result)     | **Expected to fail** (D-04) — `test.fail()` |

## 4. Add-ons

`courseAddOns.spec.ts`

| ID            | Feature | Title                                   | Precondition                           | Steps                                                            | Expected Outcome                                                                                          | Status |
| ------------- | ------- | --------------------------------------- | -------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | ------ |
| AP-781-TC-018 | Add-ons | All add-ons on by default               | On /course/adons, fresh wizard         | 1. Observe the 8 toggles                                         | PTE practice, practice test, mock test, quiz, materials, live class, webinars, one-to-one are all enabled | Pass   |
| AP-781-TC-019 | Add-ons | Only enabled add-ons become steps       | On /course/adons                       | 1. Disable Mock test, Quiz and Webinars<br>2. Click Next         | Goes to the first enabled property; sidebar hides Mock test, Quiz and Webinars                            | Pass   |
| AP-781-TC-020 | Add-ons | All add-ons disabled                    | On /course/adons                       | 1. Disable all 8 add-ons<br>2. Click Next                        | Skips properties and goes to Duration & Price (or blocks with a message); no dead end                     | Pass   |
| AP-781-TC-021 | Add-ons | Change add-ons after filling properties | Properties completed with Quiz enabled | 1. Return to Add-ons<br>2. Disable Quiz<br>3. Continue to Review | Quiz no longer shown on Review; is_quiz = false in payload                                                | Pass   |

## 5. Properties

`courseProperties.spec.ts`

| ID            | Feature    | Title                               | Precondition                                 | Steps                                                                                   | Expected Outcome                                                                             | Status                                      |
| ------------- | ---------- | ----------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-022 | Properties | PTE practice: select questions      | On /course/properties/pte-practice           | 1. Select 3 questions<br>2. Click Next                                                  | pte_practice_questions has 3 IDs; pte_practice = 3                                           | Pass                                        |
| AP-781-TC-023 | Properties | PTE practice: select all / deselect | On /course/properties/pte-practice           | 1. Tick select-all<br>2. Untick select-all                                              | All listed questions selected, then selection cleared (pte_practice_questions = [])          | Pass                                        |
| AP-781-TC-024 | Properties | Practice test: select tests         | On /course/properties/practice-test          | 1. Select 2 tests<br>2. Click Next                                                      | practice_test_tests has 2 IDs; practice_test = 2                                             | Pass                                        |
| AP-781-TC-025 | Properties | Mock test: select tests             | On /course/properties/mock-test              | 1. Select 1 mock test<br>2. Click Next                                                  | mock_test_tests has 1 ID; mock_test = 1                                                      | Pass                                        |
| AP-781-TC-026 | Properties | Quiz: select quizzes                | On /course/properties/quiz                   | 1. Select 2 quizzes<br>2. Click Next                                                    | quiz_tests has 2 IDs; quiz_test = 2                                                          | Pass                                        |
| AP-781-TC-027 | Properties | Materials: select materials         | On /course/properties/materials              | 1. Select 2 materials<br>2. Click Next                                                  | material_tests has 2 IDs; material_test = 2                                                  | Pass                                        |
| AP-781-TC-028 | Properties | Live class slider                   | On /course/properties/live-class             | 1. Move slider to 3<br>2. Tick all-access<br>3. Untick all-access                       | live_classes = 30, then 'ALL' (slider 100), then 0                                           | Pass                                        |
| AP-781-TC-029 | Properties | Webinars slider                     | On /course/properties/webinars               | 1. Move slider to 2<br>2. Tick all-access                                               | webinars = 20, then 'ALL'                                                                    | Pass                                        |
| AP-781-TC-030 | Properties | One-to-one appointment slider       | On /course/properties/one-to-one-appointment | 1. Move slider to 1<br>2. Tick all-access                                               | OneToOneAppointment = 10, then 'ALL'                                                         | Pass                                        |
| AP-781-TC-031 | Properties | Search and filter item lists        | On any list property step                    | 1. Search by keyword<br>2. Filter by section (Speaking / Writing / Reading / Listening) | List shows only matching items; earlier selections are kept                                  | Pass                                        |
| AP-781-TC-032 | Properties | Continue with nothing selected      | On any list property step                    | 1. Select nothing<br>2. Click Next                                                      | Either blocked with a message, or saved with count 0 and shown as 0 on Review (record which) | **Expected to fail** (D-05) — `test.fail()` |
| AP-781-TC-033 | Properties | Empty item list                     | Teacher has no quizzes                       | 1. Open the Quiz step                                                                   | Empty state shown; user can still continue                                                   | Pass                                        |

## 6. Duration & price

`courseDurationPrice.spec.ts`

| ID            | Feature          | Title                             | Precondition              | Steps                                                                                      | Expected Outcome                                                                                          | Status                                      |
| ------------- | ---------------- | --------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-034 | Duration & price | Duration is required              | On /course/duration-price | 1. Leave duration empty<br>2. Click Next                                                   | 'Field is required'; no navigation                                                                        | Pass                                        |
| AP-781-TC-035 | Duration & price | Save duration and price           | On /course/duration-price | 1. Duration 30, old price 100, new price 80, featured on<br>2. Click Next                  | Goes to /course/review; package_detail has course_duration 30, old_price 100, new_price 80, is_featured 1 | Pass                                        |
| AP-781-TC-036 | Duration & price | Invalid numbers                   | On /course/duration-price | 1. Try duration 0, -5, 'abc', 2.5<br>2. Try negative prices                                | Rejected with a message (only 'required' is validated in UI today; expect a gap)                          | **Expected to fail** (D-06) — `test.fail()` |
| AP-781-TC-037 | Duration & price | New price higher than old price   | On /course/duration-price | 1. Old price 50, new price 100<br>2. Click Next                                            | Warned or blocked per business rule; record result                                                        | `test.fixme` — see Not automated            |
| AP-781-TC-038 | Duration & price | Weekly / monthly prices and dates | On /course/duration-price | 1. Fill weekly and monthly prices, start and end date<br>2. Try end date before start date | Values saved; end-before-start is rejected                                                                | `test.fixme` — see Not automated            |

## 7. Review

`courseReview.spec.ts`

| ID            | Feature | Title                             | Precondition                                | Steps                         | Expected Outcome                                                                                                                       | Status                                      |
| ------------- | ------- | --------------------------------- | ------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-039 | Review  | Review shows all entered data     | All previous steps completed                | 1. Open /course/review        | Shows name, description, course link, each enabled property with its count, 'N Days', Featured / Not Featured, '$old' and '$new' price | Pass                                        |
| AP-781-TC-040 | Review  | Disabled properties hidden        | Mock test and Webinars disabled             | 1. Open /course/review        | No 'Number of Mock Test' or 'Webinars' rows                                                                                            | Pass                                        |
| AP-781-TC-041 | Review  | Empty optional prices             | Old / new price left blank                  | 1. Open /course/review        | No '$undefined' or '$' alone; shows blank or '-'                                                                                       | **Expected to fail** (D-07) — `test.fail()` |
| AP-781-TC-042 | Review  | Open Review directly with no data | localStorage course-create-info cleared     | 1. Open /course/review by URL | Redirects to Basic information or shows an empty state; no JS error (code reads data.package_detail on an empty value)                 | Pass                                        |
| AP-781-TC-043 | Review  | Next goes to Preview              | On /course/review                           | 1. Click Next                 | Navigates to /course/preview                                                                                                           | Pass                                        |
| AP-781-TC-056 | Review  | Script in description (UI)        | Saved description holds &lt;img onerror&gt; | 1. Open /course/review        | The markup renders inert; no script runs                                                                                               | **Expected to fail** (D-08) — `test.fail()` |

## 8. Preview & submit

`courseSubmit.spec.ts`

| ID             | Feature          | Title                             | Precondition                                    | Steps                                                                | Expected Outcome                                                                                                          | Status                                      |
| -------------- | ---------------- | --------------------------------- | ----------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| AP-781-TC-044  | Preview & submit | Create course end to end          | All steps completed                             | 1. On /course/preview click Submit                                   | POST /api/v1/packages carries every value entered, then PUT /api/v1/packages/{id}; success snackbar; redirect to /courses | Pass                                        |
| AP-781-TC-044b | Preview & submit | Payload lists every selected test | As TC-044                                       | 1. Create a course selecting practice, mock, quiz and material items | Top-level `tests` holds every selected practice, mock, quiz and material id                                               | **Expected to fail** (D-11) — `test.fail()` |
| AP-781-TC-045  | Preview & submit | Wizard data cleared after create  | TC-044 passed                                   | 1. Check localStorage<br>2. Open /course again                       | course-create-info and course-create-menu removed; wizard starts blank                                                    | Pass                                        |
| AP-781-TC-046  | Preview & submit | Double-click Submit               | On /course/preview                              | 1. Double-click Submit quickly                                       | Only one course created (button has no loading guard today; expect a gap)                                                 | **Expected to fail** (D-09) — `test.fail()` |
| AP-781-TC-047  | Preview & submit | Create API fails                  | Mock POST /api/v1/packages to return 500 or 422 | 1. Click Submit                                                      | Error message shown; stays on Preview; wizard data kept (no catch in code today; expect a gap)                            | **Expected to fail** (D-10) — `test.fail()` |
| AP-781-TC-048  | Preview & submit | Thumbnail renamed after create    | TC-044 passed                                   | 1. Inspect the PUT request body<br>2. Open the course in the list    | thumbnail = COURSE*thumbnail*{package_id}; image loads in list and detail                                                 | Pass                                        |

## 9. API

`courseApi.live.spec.ts` — runs only with `RUN_LIVE=1` and a master account

| ID             | Feature | Title                               | Precondition        | Steps                                                                                                 | Expected Outcome                                                                       | Status                           |
| -------------- | ------- | ----------------------------------- | ------------------- | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | -------------------------------- |
| AP-781-TC-049  | API     | Create with valid payload           | Valid teacher token | 1. POST /api/v1/packages with the full payload                                                        | 2xx; body has message and package_id                                                   | Live — `RUN_LIVE=1`              |
| AP-781-TC-050  | API     | Create with missing required fields | Valid teacher token | 1. POST without name<br>2. POST without description<br>3. POST without package_detail.course_duration | 422 with a field-level error for each                                                  | Live — `RUN_LIVE=1`              |
| AP-781-TC-051  | API     | Create without token                | None                | 1. POST /api/v1/packages with no Authorization header                                                 | 401; nothing created                                                                   | Live — `RUN_LIVE=1`              |
| AP-781-TC-052  | API     | Create as student                   | Student token       | 1. POST /api/v1/packages                                                                              | 403; nothing created                                                                   | `test.fixme` — see Not automated |
| AP-781-TC-053  | API     | Update thumbnail                    | Course created      | 1. PUT /api/v1/packages/{id} with a new thumbnail                                                     | 2xx; GET returns the new thumbnail                                                     | Live — `RUN_LIVE=1`              |
| AP-781-TC-054  | API     | Update non-existent course          | Valid token         | 1. PUT /api/v1/packages/&lt;random uuid&gt;                                                           | 404                                                                                    | Live — `RUN_LIVE=1`              |
| AP-781-TC-055  | API     | Saved data matches payload          | Course created      | 1. GET the course<br>2. Compare to the payload sent                                                   | course_type, prices, duration, add-on flags and selected test / question IDs all match | Live — `RUN_LIVE=1`              |
| AP-781-TC-056b | API     | Script in description (API)         | Valid token         | 1. Create with description '&lt;img src=x onerror=alert(1)&gt;'<br>2. GET the course                  | The stored description has no onerror attribute                                        | Live — `RUN_LIVE=1`              |
| AP-781-TC-057  | API     | Another organization's ID           | Valid teacher token | 1. POST with an organization_id the teacher doesn't belong to                                         | 403 or the org is ignored; course not created under that org                           | Live — `RUN_LIVE=1`              |

## 10. State & persistence

`courseState.spec.ts`

| ID            | Feature             | Title                           | Precondition                    | Steps                               | Expected Outcome                                                         | Status |
| ------------- | ------------------- | ------------------------------- | ------------------------------- | ----------------------------------- | ------------------------------------------------------------------------ | ------ |
| AP-781-TC-058 | State & persistence | Refresh mid-wizard              | Completed up to Add-ons         | 1. Reload the page                  | Entered data and sidebar progress are kept                               | Pass   |
| AP-781-TC-059 | State & persistence | Clear all                       | Wizard partly filled            | 1. Click Clear all                  | course-create-info removed; back on Basic information with empty fields  | Pass   |
| AP-781-TC-060 | State & persistence | Leftover data from an old draft | Abandoned draft in localStorage | 1. Open /course on the same browser | Draft restored (or discarded) consistently; no mix of old and new values | Pass   |

## 11. Not automated

| ID            | Feature             | Title                             | Why not automated                                                                                                                                                           |
| ------------- | ------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AP-781-TC-037 | Duration & price    | New price higher than old price   | No rule says whether a price rise is an error, a warning or allowed; asserting one would invent it. `test.fixme` until product decides                                      |
| AP-781-TC-038 | Duration & price    | Weekly / monthly prices and dates | The weekly and monthly inputs render only for packages (`v-if="is_package"`) and there are no date inputs at all; `test.fixme` until product says whether courses need them |
| AP-781-TC-052 | API                 | Create as student                 | `ApicalRole` has no student account; add `STUDENT_*` to `.env.example` and the role map to run it                                                                           |
| AP-781-TC-060 | State & persistence | Leftover draft (partial)          | Restoring the draft is automated; whether a stale draft should be offered or dropped is a product question, since the wizard has no "start over" choice                     |

---

## Behaviours confirmed by this suite

Run on 2026-09-24 against the #782 build served locally, with login and the non-course endpoints answered by a
local stand-in API (no shared environment was available). The live checks have not run yet.

- Create New Course opens the wizard; the sidebar lock keeps unfinished steps closed and reopens finished ones with their values.
- Basic Information, Course Type and Duration & Price each refuse to move on with a required field empty, and show the message under that field.
- Course Type derives `is_online` / `is_branch` correctly for ONLINE, BRANCH and BOTH.
- AdOns hides every disabled step from the sidebar and the routing, and goes straight to Duration & Price when all are off.
- Each list step saves exactly the ids selected and their count; All Access selects and clears the whole list; section and search requests carry the right query.
- Each slider step keeps slider and number box in step and saves `ALL` under All Access.
- Review shows every saved value and only the enabled properties; with nothing saved it returns to step 1.
- Save posts one create with every value entered through the UI, renames the thumbnail to `course_thumbnail_{id}` in the update, clears the wizard's storage and returns to the list.
- A reload keeps the data and progress; Clear all empties the step; an old draft is restored.

## Findings raised while building these cases

Each is asserted by the case(s) named, which are expected to fail until the defect is fixed.

| Finding | Severity | Defect                                                                                                                                                                              | Source                                    | Case    |
| ------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------- | ------- |
| D-01    | Medium   | A course cannot be edited: the list's edit button is commented out, its handler pushes `admin.course.create`, which has never existed, and the wizard has no code to load a course. | `views/courses/IndexView.vue:74-83, :159` | TC-004  |
| D-02    | Low      | The course name has no length limit in the UI; an over-long name is only caught, if at all, on the final save.                                                                      | `BasicInformationView.vue` validations    | TC-011c |
| D-03    | Medium   | The thumbnail accepts any file: no `accept` on the input and no type check before upload.                                                                                           | `atom/form/FileUploadComponent.vue:25-30` | TC-012  |
| D-04    | Low      | Online Course Link is not validated; any text is saved as the link.                                                                                                                 | `CourseTypeView.vue:33-37`                | TC-017  |
| D-05    | Medium   | A list step with nothing selected saves no count, so Review shows a blank instead of 0.                                                                                             | `PtePractice.vue` (and siblings) `submit` | TC-032  |
| D-06    | Medium   | Duration and prices accept zero, negative and non-numeric values; only "duration required" is checked.                                                                              | `DurationAndPrice.vue` validations        | TC-036  |
| D-07    | Low      | Blank prices render as a lone "$" on Review.                                                                                                                                        | `Review.vue:121, :130`                    | TC-041  |
| D-08    | High     | The description is rendered with `v-html`, so script in it runs on Review and Preview (stored XSS if the API keeps it — TC-056b).                                                   | `atom/Content.vue:5`                      | TC-056  |
| D-09    | Medium   | Save has no in-flight guard; a double click creates two courses.                                                                                                                    | `Preview.vue:132, :146`                   | TC-046  |
| D-10    | Low      | A failed create is an unhandled promise rejection (the global toast does show the message).                                                                                         | `Preview.vue:146-165`                     | TC-047  |
| D-11    | Medium   | Materials seeds its `tests` list from `questions`, so its submit drops the practice, mock and quiz ids from the payload's `tests`.                                                  | `Materials.vue` `created()`               | TC-044b |
