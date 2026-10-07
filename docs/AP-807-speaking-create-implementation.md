# AP-807 — Speaking Question Create Automation: How It Is Implemented

How the Playwright suite for
[blubird-interactiveltd/apical#807](https://github.com/blubird-interactiveltd/apical/issues/807)
is built, and why. The cases themselves are in
[test-cases/AP-807-speaking-create.md](../test-cases/AP-807-speaking-create.md).

|                    |                                                                                                                                        |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Repo / branch**  | `apical-test-automation`, branch `AP-807`, from `AP-806` (it shares the `speaking` module, which is not on `master` yet)               |
| **App under test** | `apical` Vue 3 app, branch `AP-3.5v-super-stage`, served at `http://superadmin.localhost:5173` (launch config `apical-web-superadmin`) |
| **API**            | stage, `https://api.apical.io` (tenant `superadmin`)                                                                                   |
| **Page**           | `/master/question-management/question-creation/pte-question/create?type=speaking` → `pte-question/CreateView.vue`                      |
| **Cases**          | 124 (`AP-807-TC-001` … `AP-807-TC-906`), 19 written as expected failures                                                               |
| **Status**         | Run on stage 2026-10-07: 124 tests — 102 passed, 19 failed as expected (confirmed defects), 3 skipped.                                 |

---

## 1. What the source showed before any test was written

- **One form, seven bodies.** `CreateView.vue` holds the common fields and swaps a type component from
  `molecule/question/items/` below them. On submit it copies the child's `form` into its own
  (`Object.assign(form, childComponent.value.form)`) and posts `cleanPayload(form)`.
- **The type validation is dead (F-01).** `onSubmit` checks `childComponent.value.$v`; the children expose only
  `{ form, clearData }`. So the per-type "required" messages never show, and the API has no title/transcript rule.
- **No `data-testid`.** `SelectComponent` renders `<label for="<label text>">` beside a native `<select>`;
  rich text is CKEditor 5; pickers are hidden `<input type=file accept=…>`. The page object keys off those.
- **Uploads happen on pick, not on save.** `POST /common/upload-file` returns `data.filepath`, which becomes
  `file_path`. Audio sends `type=question_audio`, images `question_images`, and the RL video tab
  `online_class_video` (the `VideoRecordAndUploader` default).
- **`total_answer_time`** is computed by `QuestionService::prepareAnswerTime`: pre-audio + preparation +
  answer (+ media length for the file-length types) + 1 s when the type beeps. `utils/speakingCreate.ts`
  mirrors it, and its unit test pins RA = 81 and DI = 66, the values on stage.
- **Reading the source was not enough.** It suggested the type rules never run (the issue's F-01) and three new
  defects (F-14, F-15, F-16). Stage showed otherwise: Vuelidate collects the child rules, Save as Draft sends one
  request, and the RL 422 message is shown. Only F-15 held. Every expected failure in the suite is now one observed on
  stage (F-01 audio, F-02, F-08, F-15, F-17 – F-21).

## 2. Design

```
spec ──► SpeakingCreateService.open(page, { type, postReply, uploads })
           │ 1. ApicalLoginService.ensureLoggedIn     token in localStorage before boot
           │ 2. ApiResponseCache.install              boot GETs cached, 429-safe
           │ 3. SpeakingCreateApiMock                 routes for the writes:
           │      liveList        list served live (uncached), so a new row is visible
           │      questionPosts   records payload + real reply; tracks 201 ids for cleanup
           │      uploadRequests  records type/file name + reply; can stub or delay
           │ 4. list page → Create button             the cases' precondition (router.back() target)
           │ 5. pick the type, wait for its prompt
           ▼
spec fills through SpeakingCreateService.fill (each type in its own field order),
submits with SpeakingCreateService.submit, then asserts on
  • the payload the front-end sent         (api.posts[n].payload)
  • the server's reply                     (api.posts[n].status / body)
  • the record read back                   (SpeakingQuestionApi.get(id, "edit"))
afterEach ──► CreatedQuestions.deleteAll  deletes every id this worker created, nothing else
```

| Layer    | Files                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------- |
| data     | `data/regular/speaking/speakingCreateRegularTestData.json`, `data/edge/speaking/speakingCreateEdgeTestData.json`             |
| pages    | `pages/speaking/speakingCreate.page.ts`, `pages/speaking/sampleAnswerDialog.component.ts`                                    |
| services | `services/speaking/speakingCreate.service.ts`, `speakingCreateApiMock.service.ts`, `speakingQuestionApi.service.ts`          |
| utils    | `utils/speakingCreate.ts`, `utils/speakingMedia.ts`, `utils/rateLimiter.ts`, `utils/types/speaking/speakingCreate*.types.ts` |
| specs    | `tests/tickets/AP-807-speaking-create/*.spec.ts` — 14 files, one per section of the test-case document                       |
| unit     | `tests/unitTest/utils/speakingCreate.test.ts`, `tests/unitTest/utils/rateLimiter.test.ts`                                    |
| fixtures | `fixtures/media/` — small committed media; see its README                                                                    |

Shared code that changed: `ApicalLoginService.token()` (API helpers reuse the cached session instead of logging in
per test) and `fetchThrottled` in `apiResponseCache.service.ts`, now exported for the write routes.

## 3. Decisions

- **Real writes, then cleanup.** Every create case checks the stored record, so the suite writes to stage. Indexes
  are `QA-AUTO-SPK-<TYPE>-<timestamp>-<rand>`. Only ids returned by a create the suite made are ever deleted.
  The whole suite is gated behind `RUN_LIVE=1`, like the AP-781 API checks.
- **Rate limit (F-12).** The API allows 60 requests a minute per user. API helpers run through a per-worker
  sliding-window limiter (20 a minute) and retry 429s after `Retry-After`; the routes the app uses do the same
  through `fetchThrottled`. The npm script runs one worker. No test waits on a fixed sleep; the only timed wait is
  the quiet window before asserting that a request was _not_ sent.
- **Rich text is set like a paste.** `setRichText` calls CKEditor's `setData`, one change event. Typing character by
  character would run the keyword sync on half-typed brackets (`[[content]` before its last `]`) and add keywords a
  paste never would.
- **Stubs only where the case calls for one:** a 500 on create (TC-039), slow/403/oversized uploads (TC-074, 078,
  080, 081), and "Save & SET" of a new sample answer (TC-802, so no sample answer is left on stage).
- **Media without a GPL dependency.** Hook [2e] caps committed files at 50 KB and hook [12] forbids GPL packages
  (the npm FFmpeg builds are GPL). The small files are committed in `fixtures/media/`; the MP3s (5 s to 3 min) are
  built at run time as constant-bitrate silence, which Chromium reads at the exact length.
- **Parallel-safe list checks.** Cases that check the list after saving search for their own unique index instead
  of reading "the first row", which another worker's question could take.

## 4. What the first stage runs changed

- **The role in localStorage.** The API returns `user_type: SUPER_ADMIN`; `Login.vue` stores `MASTER`
  (`data/enum.js` `userTypeMap`), and the router sends any `/master/…` URL elsewhere unless they match. The login
  helper stored the raw value, so every master page was a 404. `ApicalLoginService` now maps it the same way.
- **Uploads pass through.** `route.fetch()` cannot re-send a request with a file part; the API got an empty file.
  Real uploads now go on with `route.continue()` and are recorded from their response.
- **Throttling is a 404 too.** Stage answers a rate-limited call with `404 {"message":"Too Many Attempts."}`.
  `isThrottled` treats it like 429 in both retry paths, the Speaking list is fetched live only by the 7 cases that read
  it after saving, and the npm script runs one worker.
- **Abandoned GETs.** When the app navigates away mid-request, Playwright disposes the response; the cache route now
  leaves such a request unanswered instead of failing the test.

## 5. Running it

```bash
# unit tests for the new helpers (no browser, no network)
npx vitest run tests/unitTest/utils/speakingCreate.test.ts tests/unitTest/utils/rateLimiter.test.ts

# the suite — needs the local app (launch config "apical-web-superadmin") and a valid stage login in .env
npm run test:speaking-create
```

## 6. Left to do

1. Add a `COACHING_*` login without Store Question to run TC-905.
2. Archive an SGD and an RTAS sample answer on stage to run TC-607 and TC-706.
3. Raise F-15 and F-17 – F-21 as bugs on the apical board.
