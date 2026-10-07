# PTE Question Bank — Speaking Module: Business Document

What the Speaking question bank is, how each of its 7 question types is created, which fields each
type holds, and what values those fields take. Written from the source code of both repos and the
118 Speaking questions currently on the server.

|                         |                                                                                                                                                                                                                   |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Route (Super Admin)** | `/master/question-management/question-creation/pte-question/speaking`                                                                                                                                             |
| **Route name**          | `master-pte-question.speaking`                                                                                                                                                                                    |
| **Front-end**           | `apical` (Vue 3 + Vuetify + Vuex), branch `AP-3.5v-super-stage`                                                                                                                                                   |
| **Back-end**            | `apical-api` (Laravel 11, PostgreSQL, Passport)                                                                                                                                                                   |
| **Data source**         | `GET https://api.apical.io/api/v1/questions/list?type=question&section=speaking&sort=-created_at`, all 6 pages, plus `GET /questions/{id}?intention=edit` for each of the 118 records. Snapshot taken 2026-10-05. |

> The error traces returned by `api.apical.io` contain `/var/www/stage/...`, so this host is the
> **stage** deployment. That makes it a safe automation target, but the data on it changes.

Test-case documents for this module, in this folder:

| File                                                       | Covers                                                                                                                     |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| [speaking-list.md](speaking-list.md)                       | Access, tabs, list table, filters, search, sort, pagination, permissions                                                   |
| [AP-807-speaking-create.md](../AP-807-speaking-create.md)  | Creating each of the 7 types, common fields, validation, media, keywords, draft vs. publish, create another, sample answer |
| [speaking-edit.md](speaking-edit.md)                       | Loading and updating each type                                                                                             |
| [speaking-delete.md](speaking-delete.md)                   | Delete confirmation, soft delete, list behaviour after delete                                                              |
| [speaking-view-details.md](speaking-view-details.md)       | The eye-icon details dialog, per type                                                                                      |
| [speaking-test-evaluation.md](speaking-test-evaluation.md) | Super Admin "Test Evaluation" (answer a question and receive an AI score)                                                  |

---

## 1. Where the module sits

```
/master/question-management                      master.questionManagement   (RouterView)
  └─ question-creation                           master.questionCreation     (RouterView)
       ├─ ''                                     trainer.questionCreation    question-creation/IndexView.vue
       ├─ pte-question                           trainer.pteQuestion         pte-question/IndexView.vue (tabs + dialogs)
       │    ├─ speaking                          master-pte-question.speaking   SpeakingView.vue   ← this module
       │    │    └─ evaluate/:slug/:id           master-pte-question.speaking.evaluate  ParticipationForm.vue
       │    ├─ writing / reading / listening     (same shape)
       ├─ pte-question/create?type=speaking      master-pte-question.create  CreateView.vue
       └─ pte-question/edit/:id?type=speaking    pte-question.edit           CreateView.vue (edit mode)
```

Source: `apical/src/router/master/index.js:64`, `apical/src/router/master/teacher.js:29-141`.

- `pte-question` redirects to **reading**, not speaking. The PTE Question entry in the master navigation (`masterNavigation`) links straight to speaking.
- `IndexView.vue` renders the tab strip **Speaking · Writing · Reading · Listening** and hosts three dialogs: _QuestionDetails_ (80% width), _QuestionUsedForList_, and _CreatedByProfile_ (700px).
- The same `SpeakingView.vue` is also mounted in the teacher (`router/teacher.js:89`) and coaching-center (`router/coachingCenter.js:83`) portals, under the route name `pte-question.speaking`. With `layout === 'coaching-center'` the page header and its Create button are hidden.
- **Only the evaluate route has a permission guard** (`requirePermission('QUESTION_SHOW')`). The list, create and edit routes have none, so access to them is enforced by the API alone.

## 2. Permissions

The front-end checks permission keys with `can(...)`. The API checks permission strings in each controller's constructor.

| Action                           | Front-end gate                                                               | API permission                                    | Where the API sets it            |
| -------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------- | -------------------------------- |
| See the list                     | none                                                                         | `Question_list Question`                          | QuestionController.php:56-66     |
| Load the question types          | none                                                                         | `Index QuestionType` / `Show QuestionType`        | QuestionTypeController.php:36-39 |
| Create                           | **none** (the Create button always shows outside the coaching-center layout) | `Store Question`                                  |                                  |
| Edit (pencil icon)               | `can('QUESTION_UPDATE')`                                                     | `Update Question`, plus `QuestionPolicy@update`   |                                  |
| Delete (bin icon)                | `can('QUESTION_DESTROY')`                                                    | `Destroy Question`, plus `QuestionPolicy@destroy` |                                  |
| View details (eye icon)          | none                                                                         | `Show Question`                                   |                                  |
| Test Evaluation (clipboard icon) | `layout === 'master' && can('QUESTION_SHOW')`                                | `Show Question` + answer-sheet submit             |                                  |
| Upload a file                    | none                                                                         | `Upload_file Common`                              | CommonController.php:28          |

- **API responses when access is refused:** a missing permission aborts with 403 and the message `Permission is inactive or does not exist.` or `Unauthorized: Role or Permission is inactive.`. A policy denial returns `This action is unauthorized.`.
- **`QuestionPolicy`:** it refuses only when tenancy is initialised and the tenant's organisation is not the question's `created_by_organization`. Super Admin works on the central (non-tenant) context, so it is always allowed.
- **Roles that only see published questions:** the list and show endpoints force `active = true` for students, coaching-center owners/admins, and trainers.

## 3. The 7 Speaking question types

These come from `GET /api/v1/question-types?section=speaking`, ordered by `display_order`. The **component** column is the front-end form, mapped by slug in `apical/src/data/cms.js` (`questionTypes`).

| #   | Title                      | short_title / q_id prefix | slug                         | Form component                 | Skill                | Count on server |
| --- | -------------------------- | ------------------------- | ---------------------------- | ------------------------------ | -------------------- | --------------- |
| 1   | Read Aloud                 | **RA**                    | `read-aloud`                 | `ReadAloud.vue`                | SPEAKING             | 37              |
| 2   | Repeat Sentence            | **RS**                    | `repeat-sentence`            | `RepeatSentence.vue`           | LISTENING & SPEAKING | 21              |
| 3   | Describe Image             | **DI**                    | `describe-image`             | `DescribeImage.vue`            | SPEAKING             | 17              |
| 4   | Retell Lecture             | **RL**                    | `retell-lecture`             | `RetellLecture.vue`            | LISTENING & SPEAKING | 16              |
| 5   | Answer Short Question      | **ASQ**                   | `answer-short-question`      | `AnswerShortQuestion.vue`      | LISTENING            | 10              |
| 6   | Summarize Group Discussion | **SGD**                   | `summarize-group-discussion` | `SummarizeGroupDiscussion.vue` | LISTENING & SPEAKING | 9               |
| 7   | Respond To A Situation     | **RTAS**                  | `respond-to-a-situation`     | `RespondToASituation.vue`      | SPEAKING             | 8               |
|     |                            |                           |                              |                                | **Total**            | **118**         |

### 3.1 Type-level settings

These are fixed on the question type, not entered on the question.

| Type | Prep time (s) | Pre-audio wait (s) | Answer time (s) | Beep   | Answer-time calculation            | Sample answer allowed | Sample-answer format | Default prompt                                                                                                                                                                                                              |
| ---- | ------------- | ------------------ | --------------- | ------ | ---------------------------------- | --------------------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RA   | 40            | 0                  | 40              | yes    | `pre_post_answer_time`             | **yes**               | audio                | "Look at the text below. In 40 seconds, you must read this text aloud as naturally and clearly as possible. You have 40 seconds to read aloud."                                                                             |
| RS   | 4             | 3                  | 15              | yes    | `pre_post_file_length_answer_time` | no                    | –                    | "You will hear a sentence. Please repeat the sentence exactly as you hear it. You will hear the sentence only once."                                                                                                        |
| DI   | 25            | 0                  | 40              | yes    | `pre_post_answer_time`             | **yes**               | audio, text          | "Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing. You will have 40 seconds to give your response."                                                |
| RL   | 10            | 3                  | 40              | yes    | `pre_post_file_length_answer_time` | **yes**               | audio, text          | "You will hear a lecture. After listening to the lecture, in 10 seconds, please speak into the microphone and retell…" — **plus a video prompt**: "You will see a video. After watching the video…"                         |
| ASQ  | 3             | 3                  | 15              | **no** | `pre_post_file_length_answer_time` | no                    | –                    | "You will hear a question. Please give a simple and short answer. Often just one or a few words is enough."                                                                                                                 |
| SGD  | 10            | 3                  | 120             | yes    | `pre_post_file_length_answer_time` | **yes**               | audio, text          | "You will hear three people having a discussion. When you hear the beep, summarize the whole discussion. You will have 10 seconds to prepare and 2 minutes to give your response."                                          |
| RTAS | 10            | 3                  | 40              | yes    | `pre_post_file_length_answer_time` | **yes**               | audio, text          | "Listen to and read a description of a situation. You will have 10 seconds to think about your answer. Then you will hear a beep. You will have 40 seconds to answer the question. Please answer as completely as you can." |

**How the time columns are used:**

- **`total_answer_time`** is computed by the server.
  - Types using `pre_post_answer_time` have a fixed total: RA is always **81**, DI is always **66**.
  - Types using `pre_post_file_length_answer_time` add the length of the uploaded media, so the total varies by question:

    | Type | Totals seen on the server |
    | ---- | ------------------------- |
    | RS   | 23 – 32                   |
    | ASQ  | 21 – 29                   |
    | RTAS | 54 – 78                   |
    | RL   | 54 – 188                  |
    | SGD  | 138 – 352                 |

- **`file_duration`:** whenever `file_type` is `audio` or `video` and `file_path` is set, the server fills it with `S3Helper::getMediaDuration`.
- **"Choose Sample Answer" button:** it appears on the create form only for the 5 types where `is_sample_answer = true`: RA, DI, RL, SGD, RTAS.

---

## 4. How a question is created

### 4.1 Flow

1. On the Speaking list, click **Create** in the page header. This opens `master-pte-question.create?type=speaking`.
2. `CreateView` loads the Speaking types and pre-selects the first one, **Read Aloud**. It then loads that type's details to show its **Prompt**, and its video prompt where there is one (RL).
3. The author picks a type in **Choose Question Type**. The type-specific form below it is replaced by that type's component.
4. The author fills the common fields (§4.2) and the type fields (§5).
5. The author clicks one of two buttons:
   - **Save as Draft** → `active: false`, which the list shows as **Draft**.
   - **Publish** → `active: true`, which the list shows as **Published**.
6. The front-end sends `POST /api/v1/questions`.
   - **On success** the snackbar shows `Question created successfully`, and the page goes back to the list (`router.back()`).
   - **If "Create another" is ticked**, the form is cleared instead and the page stays put.
7. On a 422, the field errors are written into `formErrors` and the page scrolls to the first error. Only the **Index** field renders its server error (`formErrors.index[0]`).

### 4.2 Common fields — every Speaking type

| UI label             | Payload key                                 | Control                       | Values                                                          | Default                | Front-end rule                           | API rule (store)                                                                                                             |
| -------------------- | ------------------------------------------- | ----------------------------- | --------------------------------------------------------------- | ---------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Choose Question Type | `question_type_id`                          | Select (disabled on edit)     | one of the 7 type UUIDs                                         | first type (RA)        | –                                        | `required, uuid, exists`                                                                                                     |
| Prompt (read-only)   | `prompt` / `prompt_type`                    | Text banner                   | type's default prompt                                           | `prompt_type: DEFAULT` | –                                        | `prompt_type in:DEFAULT,CUSTOM` (required). With `DEFAULT` the server copies the type's prompt.                              |
| Question Index       | `index`                                     | Text                          | free text, e.g. `RS0001-6`, `April RL Nutrition…`               | empty                  | **required** → `Index Field is required` | `required, string, max:255, unique` across **all** non-deleted questions of every type → `The index has already been taken.` |
| Source               | `source`                                    | Select                        | `EXAM_QUESTION` (Exam Question), `PRACTICE` (Practice)          | `EXAM_QUESTION`        | **required** → `Field is required`       | `nullable, in:EXAM_QUESTION,PRACTICE`                                                                                        |
| FREQUENCY            | `frequency`                                 | Select                        | `HIGH` (High), `MODERATE` (Moderate), `LOW` (low)               | `MODERATE`             | –                                        | `nullable, in:HIGH,MODERATE,LOW`                                                                                             |
| (button)             | `active`                                    | Save as Draft / Publish       | `false` / `true`                                                | –                      | –                                        | `required, boolean`                                                                                                          |
| (hidden)             | `type`                                      | –                             | `QUESTION`                                                      | `QUESTION`             | –                                        | `required, in:QUESTION`                                                                                                      |
| (hidden)             | `answer_time_type`, `preparation_time_type` | –                             | `DEFAULT`                                                       | `DEFAULT`              | –                                        | `required, in:DEFAULT,CUSTOM`. With `DEFAULT` the server stores 0 and the timing comes from the type.                        |
| (hidden)             | `answer_time`, `preparation_time`           | –                             | seconds converted from the type's times                         | from the type          | –                                        | `required, numeric`                                                                                                          |
| (hidden)             | `is_requested`                              | –                             | `false`                                                         | `false`                | –                                        | `required, boolean`                                                                                                          |
| Create another       | –                                           | Checkbox (create only)        | on / off                                                        | off                    | –                                        | –                                                                                                                            |
| Choose Sample Answer | `sample_answers`                            | Dialog, for RA/DI/RL/SGD/RTAS | `{ "<sampleAnswerId>": { is_default, selected_from_archive } }` | none                   | –                                        | each key must be a real SampleAnswer id → `Invalid Sample Answer ID: <id>`                                                   |

Before sending, `cleanPayload` removes every `null`, `undefined`, empty array and empty object. As a result, `question_options`, `explanations`, and an unset `sample_answers` never reach the API.

**What the server sets itself on create:**

| Field                                            | Value set by the server                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `q_id`                                           | type acronym + zero-padded (count of all non-deleted questions + 1), e.g. `RS00237` |
| `created_by`                                     | the logged-in user                                                                  |
| `approve_status`                                 | `1` (Approved)                                                                      |
| `prompt`                                         | the type's default prompt                                                           |
| `file_duration`                                  | the media length                                                                    |
| `reading` / `writing` / `speaking` / `listening` | from the type's skill contribution                                                  |

The response is **201** `{ question_id, message: "Successfully Saved" }`.

### 4.3 Media uploads

The audio and image pickers upload the file as soon as it is chosen, before the question is saved:
`POST /api/v1/common/upload-file` (multipart `file` + `type`). The returned full URL, e.g.
`https://kazi-blubird.sfo2.digitaloceanspaces.com/apical/question/audio/2026/…`, becomes `file_path`.

| Media      | Picker `accept` | `type` sent         | Server checks                                                                                                                                             |
| ---------- | --------------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Audio      | `audio/*`       | `question_audio`    | mp3 / wav / aac / flac; ≤ 100 MB → `The file must be a valid audio type (mp3, wav, aac, flac).` / `The audio must not be greater than 100 MB.`            |
| Image (DI) | `image/*`       | (component default) | jpeg / png / jpg / gif / webp; ≤ 10 MB → `The file must be a valid image type (jpeg, png, jpg, gif, webp).` / `The image must not be greater than 10 MB.` |
| Video (RL) | `video/*`       | (component prop)    | mp4 / webm / avi / mov / flv / 3gp / m4v; ≤ 2048 MB → `The file must be a valid video type (…)` / `The video must not be greater than 2048 MB.`           |

- **When an upload fails**, the snackbar shows the server message, or `Request Entity Too Large`.
- **Recording is off on the create form.** All uploaders run with `disableRecording`, so media can only be uploaded, never recorded live.
- **Extensions in the data are wider than the rules above.** Existing records include `.webm` audio (RS, RL); the RS and RL pickers can produce these.

### 4.4 Keywords — the `[bracket]` convention

Every text-bearing type (RA title; RS/RL/ASQ/SGD/RTAS transcript) shows the hint
**"Use brackets to mark keywords: [word] = Keywords"** and a **Keyword** box with the hint _"Separate the keywords with semicolons (;)."_

The behaviour comes from `useKeywordSync` and `extractBracketContent`:

- **Typing `[word]` in the text adds `word` to Keywords.** Special characters inside the brackets are stripped. Duplicates are dropped, and manually typed keywords are kept.
- **Removing a keyword from the Keywords box un-brackets it in the text** (`[word]` → `word`, and `[[word]]` → `word`).
- **Removing the brackets from the text does not remove the keyword.** The sync is add-only in that direction.
- **`[[double]]` brackets are "content", not vocabulary.** They are not added to Keywords.
- **DI has no text field**, so its keywords are typed by hand. Its Keyword box has no sync handler.
- **The API saves `keywords` exactly as sent** (a text column). It does not parse it.
- **The scorer splits on `;`** (`SpeakingScoreEvaluationService.php:162`). The keyword string is therefore part of how a spoken answer is scored.
- **Display strips the brackets.** On `show` and `evaluation` reads, `Question::sanitizeText` removes `[` and `]` from the transcript (RS, SGD, ASQ, RTAS, RL) and from the title (RA). DI is not sanitised. The `edit` read keeps the brackets.

---

## 5. Field matrix per question type

✔ = the form shows it and sends it · – = not part of this type · "API" = the server rule (create).

| Field (payload key)                      | RA                                                                        | RS                             | DI                                                            | RL                                              | ASQ                          | SGD                                                                    | RTAS                             |
| ---------------------------------------- | ------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------- | ----------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------- | -------------------------------- |
| **Title** (`title`, rich text)           | ✔ text to read aloud. UI marks it required, but the check is dead (F-01). | –                              | –                                                             | –                                               | –                            | –                                                                      | –                                |
| **Transcript** (`transcript`, rich text) | –                                                                         | ✔ (F-01)                       | –                                                             | ✔ (F-01)                                        | ✔ (F-01)                     | ✔ (F-01)                                                               | ✔ (F-01)                         |
| **Audio** (`file_path`)                  | –                                                                         | ✔ upload                       | –                                                             | ✔ via **Audio** tab                             | ✔ upload                     | ✔ upload                                                               | ✔ upload                         |
| **Video** (`file_path`)                  | –                                                                         | –                              | –                                                             | ✔ via **Video** tab                             | –                            | –                                                                      | –                                |
| **Image** (`file_path`)                  | –                                                                         | –                              | ✔ upload. UI marks it required, but the check is dead (F-01). | –                                               | –                            | –                                                                      | –                                |
| `file_type` sent                         | – (DB default `audio`)                                                    | – (DB default `audio`)         | `image`                                                       | `audio` or `video`                              | – (default `audio`)          | – (default `audio`)                                                    | – (default `audio`)              |
| **Keyword** (`keywords`)                 | ✔ synced from `[ ]` in Title                                              | ✔ synced from Transcript       | ✔ manual only                                                 | ✔ synced                                        | ✔ synced                     | ✔ synced                                                               | ✔ synced                         |
| Sample answer                            | ✔                                                                         | –                              | ✔                                                             | ✔                                               | –                            | ✔                                                                      | ✔                                |
| API: required media                      | no                                                                        | no                             | no                                                            | **`file_path` required** (store only)           | no                           | no                                                                     | no                               |
| API: required text                       | no                                                                        | no                             | –                                                             | no                                              | no                           | no                                                                     | no                               |
| Form order                               | Title → Keyword                                                           | Audio → Transcript → Keyword   | Image → Keyword                                               | Media (Audio/Video tabs) → Transcript → Keyword | Audio → Transcript → Keyword | "Group Discussion" card (preview image + Audio) → Transcript → Keyword | Transcript → Audio → Keyword     |
| Evaluation-time behaviour                | reads Title aloud                                                         | plays audio once, then records | shows the image                                               | plays audio or video                            | plays audio, no beep         | plays audio, 2-min answer                                              | shows transcript and plays audio |

### 5.1 What a stored question of each type looks like (from the 118 records)

| Type | n   | title filled | transcript filled | file_path filled | file_type values          | file extensions     | keywords filled | HTML (`<p>`) in text | `[brackets]` in text | sample answer | Draft |
| ---- | --- | ------------ | ----------------- | ---------------- | ------------------------- | ------------------- | --------------- | -------------------- | -------------------- | ------------- | ----- |
| RA   | 37  | 33           | 3 (legacy)        | 0                | audio (default)           | –                   | 30              | 28                   | 9                    | 1             | 0     |
| RS   | 21  | 0            | 21                | 21               | audio                     | mp3, webm           | 16              | 16                   | 6                    | 0             | **7** |
| DI   | 17  | 0            | 0                 | 16               | image (10), **audio (7)** | png, jpeg           | 17              | –                    | –                    | 0             | 1     |
| RL   | 16  | 0            | 16                | 16               | audio (14), video (2)     | mp3, webm, wav, mp4 | 14              | 12                   | 3                    | 0             | 0     |
| ASQ  | 10  | 0            | 10                | 10               | audio                     | mp3                 | 9               | 7                    | 1                    | 0             | 0     |
| SGD  | 9   | 0            | 9                 | 9                | audio                     | mp3                 | 8               | 5                    | 3                    | 0             | 0     |
| RTAS | 8   | 0            | 8                 | 8                | audio                     | mp3                 | 8               | 5                    | 1                    | 0             | 0     |

**Other values seen across all 118:**

| Field                  | Values                                                                                            |
| ---------------------- | ------------------------------------------------------------------------------------------------- |
| `source`               | EXAM_QUESTION 48, PRACTICE 70                                                                     |
| `frequency`            | MODERATE 76, HIGH 42. `LOW` was never used.                                                       |
| `approve_status`       | 1 (Approved) 92, 0 (Pending) 26                                                                   |
| `created_by`           | "Apical" 92, "Blubird" 26                                                                         |
| Explanations           | none on any record                                                                                |
| Study guide            | none on any record                                                                                |
| `additional_file_path` | 1 SGD record (`SGD00204`), an image. It is not settable from the form; it comes from bulk import. |
| Creation dates         | 17 Sep 2025 → 02 Oct 2026                                                                         |

**Real records that show the defects in §8:**

- **4 Read Aloud questions with no title:** `RA118`, `RA119`, `RA121`, `RA122`. These are published questions with nothing to read (F-01).
- **1 Describe Image question with no image:** `DI117`, index "test image" (F-01).
- **7 Describe Image questions stored with `file_type = audio`** although `file_path` is a PNG: DI021, DI024, DI032, DI057, DI058, DI090, DI117 (F-07).
- **q_ids use two different number widths:** `RA119`, `DI021`, `RS089` are 3-digit, while `RS00237`, `SGD00204` are 5-digit (F-08).
- **Drafts are approved:** all 8 drafts (RS083 – RS089, DI090) have `approve_status = 1`.

### 5.2 Example create payloads (what the front-end sends)

```jsonc
// Read Aloud — Publish
{ "index": "QA-RA-001", "prompt_type": "DEFAULT", "prompt": "", "preparation_time_type": "DEFAULT",
  "preparation_time": 40, "answer_time_type": "DEFAULT", "answer_time": 40, "source": "EXAM_QUESTION",
  "frequency": "MODERATE", "active": true, "type": "QUESTION", "is_requested": false,
  "title": "<p>[Domestication] is an [evolutionary] process…</p>", "keywords": "Domestication;evolutionary",
  "question_type_id": "c7b24d80-1143-4ec2-9fb9-821d1b8aeeec", "study_guide_id": "" }

// Repeat Sentence / ASQ / SGD / RTAS — type fields
{ "title": "", "transcript": "<p>The [government] is taking steps…</p>", "keywords": "government",
  "file_path": "https://…/apical/question/audio/2026/12345-…-rs.mp3" }

// Describe Image — type fields
{ "title": "", "file_path": "https://…/describe-image.png", "file_type": "image", "keywords": "graph;proportion" }

// Retell Lecture — type fields
{ "title": "", "transcript": "<p>…</p>", "keywords": "…", "file_path": "https://…/lecture.mp4", "file_type": "video" }
```

Speaking type ids on stage: RA `c7b24d80-1143-4ec2-9fb9-821d1b8aeeec` · RS `ef4b11a9-8086-4d93-8da7-4e68b60a6a0a` ·
DI `7b0940dc-2d64-48dc-a9e1-b22de427e63e` · RL `306d2f79-720e-4b12-acf2-439436844c67` ·
ASQ `d95558f1-5063-4a3e-8980-ab2a8f632063` · SGD `b48d6205-99b8-4200-92a2-c40ce1ba8ce7` ·
RTAS `fe321f11-df80-435b-927b-87608890db49`.

---

## 6. Edit, delete, details, evaluation

### Edit

- **Opening it:** the pencil icon opens `pte-question/edit/:id?type=speaking`. That is the same `CreateView` form, loaded with `GET /questions/{id}?intention=edit`, which keeps the raw `[brackets]`.
- **What is locked:** the type select is disabled, and "Create another" is hidden.
- **Saving:** both buttons send `PUT /api/v1/questions/{id}`. On success the snackbar shows `Question updated successfully`.
- **Update API rules differ from store:**
  - `index` must be unique, ignoring the question itself.
  - The RL `file_path` requirement does not apply.
  - `active` is `sometimes`.
  - In a tenant context, an update resets `approve_status = 0` and `active = 0`.
  - `q_id` is never regenerated.
  - Options and reorder pairs are deleted and re-created. Sample answers are re-synced.
- **Response:** 200 `{ message: "Successfully Updated" }`.

### Delete

- **Front-end:** the bin icon opens a `ConfirmDialog`. Confirming sends `DELETE /api/v1/questions/{id}`, and the row is removed from the store.
- **No feedback on the outcome:** there is no success snackbar, and an error is not handled.
- **API:** a **soft delete**, never blocked, even when the question is used in a test, mock or practice set (`GET /questions/used-for/{id}` exists but is not called). Returns 200 `{ message: "Successfully Deleted" }`.

### Details (eye icon)

Opens the _QuestionDetails_ dialog (`GET /questions/{id}`, sanitised). It shows, in order:

| Section       | Content                                                                                         |
| ------------- | ----------------------------------------------------------------------------------------------- |
| Header        | Index, QID, Section, Category (type title)                                                      |
| Prompt        | the type's prompt                                                                               |
| Audio / Video | the media player. Not shown for DI.                                                             |
| Transcript    | shown for every type except RA. When there is no transcript it shows "No transcript available". |
| Image         | DI only                                                                                         |
| Question list | the title, for RA                                                                               |
| Times         | Preparing Time, Answer Time                                                                     |
| Metadata      | Source, Frequency, Status (Published/Draft chip), Created By, Created At                        |
| Buttons       | Sample Answer and Explanation, each shown only when one exists                                  |

### Test Evaluation (clipboard icon)

- **Who sees it:** Super Admin only.
- **What it opens:** `speaking/evaluate/:slug/:id?section=speaking`, a dialog over the list, using the student `ParticipationForm` in `evaluation: 'master'` mode.
- **What the admin does:** either records live, or attaches a prepared audio file (**"Attach answer recording (optional)"**). An attached file replaces the recording and skips preparation time.
- **Submitting:** sends a multipart answer sheet: `type=PTE_PRACTICE`, `file[<question_id>]`, `items=[{question_id}]`. It then navigates to `master.evaluation` (`type: pte-practice`) to show the AI score.
- **Speaking with nothing recorded or attached:** it shows a confirm warning ("You are about to finish this question…") rather than an error.

---

## 7. List behaviour

| Element                | Behaviour                                                                                                                                                                                                  |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Initial request        | `?type=question&section=speaking&sort=-created_at`, 20 per page. Total today: **118**, 6 pages.                                                                                                            |
| Columns                | SL · Q_ID · INDEX · ITEM · FREQUENCY · CREATED AT · CREATED BY · STATUS · ACTIONS                                                                                                                          |
| ITEM                   | the type `short_title` (RA, RS, DI, RL, ASQ, SGD, RTAS)                                                                                                                                                    |
| INDEX / title          | `title` in the response is `strip_tags(title ?? transcript)`. It is not a column but is searchable.                                                                                                        |
| FREQUENCY              | a ✔ icon coloured by value: HIGH green (`text-success`), MODERATE orange (`text-tahiti-gold`), LOW grey. The tooltip shows the raw value.                                                                  |
| CREATED AT             | `d M, Y h:i a`, Asia/Dhaka, e.g. `02 Oct, 2026 01:07 pm`                                                                                                                                                   |
| CREATED BY             | the creator's name. Clicking it opens the _CreatedByProfile_ dialog.                                                                                                                                       |
| STATUS                 | **Published** (green) when `active = 1`, **Draft** (red) otherwise                                                                                                                                         |
| ACTIONS                | 👁 details · 📋 Test Evaluation (master + QUESTION_SHOW) · ✏ edit (QUESTION_UPDATE) · 🗑 delete (QUESTION_DESTROY)                                                                                         |
| Type filter            | "All Type" + the 7 types → `question_type_id=<uuid>`, or the param is removed for All                                                                                                                      |
| Status filter          | from `GET /common/dropdowns?status`: **All**, **Draft** (`active=0`), **Published** (`active=1`)                                                                                                           |
| Search                 | placeholder "Search speaking questions". Fires on Enter, automatically at ≥ 3 characters, and when cleared to empty. Matches LIKE `%term%` on q_id, prompt, title, file_path, transcript, keywords, index. |
| Sort                   | clicking a sortable header sends `sort=<col>` or `sort=-<col>`. Sortable headers: SL, Q_ID, INDEX, ITEM, CREATED AT, CREATED BY, STATUS.                                                                   |
| Pagination             | the _Paginate_ component, showing from–to of total, with previous/next                                                                                                                                     |
| Counts by filter today | RA 37 · RS 21 · DI 17 · RL 16 · ASQ 10 · SGD 9 · RTAS 8. Draft 8, Published 110.                                                                                                                           |

---

## 8. Findings (defects and risks)

Each test case that exposes one of these cites its ID and is written to **fail until it is fixed** (`test.fail()`).

| ID       | Severity | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Evidence                                                                                                                                                         |
| -------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **F-01** | High     | **None of the type-specific validation runs.** `CreateView.onSubmit` touches and checks `childComponent.value.$v`, but every type component is `<script setup>` and exposes only `{ form, clearData }`. So `$v` is always `undefined`. "Title Field is required" (RA), "Transcript Field is required" (RS/RL/ASQ/SGD/RTAS) and "Image Field is required" (DI) can never appear. The API has no rule for `title` or `transcript`, and none for `file_path` outside RL, so the question is saved without its content.                                         | `CreateView.vue:406-411`. Every `items/*.vue` ends with `defineExpose({ form, clearData })`. On the server: RA118/119/121/122 have no title, DI117 has no image. |
| **F-02** | Medium   | **Even if F-01 were fixed, two of the messages still could not show.** The RS and ASQ error messages test `!v$.value.transcript.required`. In Vuelidate 2 that is a rule object, so it is always truthy and the message is always null.                                                                                                                                                                                                                                                                                                                     | `RepeatSentence.vue:103`, `AnswerShortQuestion.vue:104`                                                                                                          |
| **F-03** | High     | **Sorting by the SL or ITEM column breaks the list.** The front-end sends `sort=sl` or `sort=item`, columns that do not exist. The API answers with the raw PostgreSQL error (`SQLSTATE[42703]: Undefined column … "sl"`). That leaks SQL and leaves the list in an error state. Sorting by CREATED BY sorts by the creator's UUID, not their name.                                                                                                                                                                                                         | Probed live: `sort=sl` and `sort=item` both return a SQL error. `BaseTrait.php:37-65` has no allow-list of sortable columns.                                     |
| **F-04** | Medium   | **Filters, search and sort do not return to page 1.** `onChangeQuestionComponent` and `getStatus` call the API first and set `page=1` only afterwards. The search watcher and sort never reset the page. On page 5, picking "Answer Short Question" (10 rows) requests `page=5` and shows an empty table.                                                                                                                                                                                                                                                   | `SpeakingView.vue:273-345, 399`. Probed live: `question_type_id=<ASQ>&page=5` gives total 10, items 0.                                                           |
| **F-05** | Medium   | **Delete gives no feedback and no warning.** There is no success snackbar and no error handling (`actDeleteQuestion` is not chained). The paginator's total and range keep the old numbers. A question in use by tests or mocks is deleted without warning, because `used-for` is not called and the API never blocks.                                                                                                                                                                                                                                      | `SpeakingView.vue:167`, `question.js:143`, `QuestionController@destroy`                                                                                          |
| **F-06** | Low      | **The details dialog shows the wrong value for Preparing Time.** It shows `answer_time`, the same value as Answer Time.                                                                                                                                                                                                                                                                                                                                                                                                                                     | `QuestionDetails.vue:170`                                                                                                                                        |
| **F-07** | Low      | **7 Describe Image questions are stored with `file_type = audio`** although their file is a PNG. The details dialog and the evaluation screen branch on `file_type`.                                                                                                                                                                                                                                                                                                                                                                                        | Stage data, §5.1                                                                                                                                                 |
| **F-08** | Medium   | **`q_id` is not reliably unique.** It is built as type acronym + (count of non-deleted questions + 1). After a soft delete the count goes down, so the next new question can get a q_id that already exists. The stored q_ids also use mixed widths (3-digit and 5-digit).                                                                                                                                                                                                                                                                                  | `QuestionService::prepareInput` lines 45-49                                                                                                                      |
| **F-09** | Medium   | **Editing can open with the wrong type's settings.** On mount, the edit page dispatches `actGetQuestionTypes`, which commits `setSelectedQuestionType(items[0] = RA)`, and also `fetchQuestionDetails`, which commits the question's real type. Whichever response arrives last wins. If the types response is last, the Prompt banner shows Read Aloud's prompt, and on save `question_type_id` is taken from `getSelectedQuestionType`, which would turn the question into RA. The prompt banner is never set from the question in edit mode in any case. | `CreateView.vue:413, 532-585, 590-602`                                                                                                                           |
| **F-10** | Low      | **Create and edit have no front-end permission check.** The routes have no guard, and the Create button has no `can('QUESTION_STORE')`. A user without the permission can open the form and is only stopped by the API.                                                                                                                                                                                                                                                                                                                                     | `router/master/teacher.js:124-141`, `SpeakingView.vue:5-12`                                                                                                      |
| **F-11** | Low      | **The edit route name is defined twice.** `pte-question.edit` exists in both `router/teacher.js:118` and `router/master/teacher.js:135`. With vue-router, the route registered later replaces the earlier one, so the master edit icon can resolve to the wrong portal path. The fallback in `goBackOrRedirect` also pushes the teacher route name `pte-question.speaking`.                                                                                                                                                                                 | router files                                                                                                                                                     |
| **F-12** | Info     | **The API rate-limits at 60 requests a minute** (`Too Many Attempts.`, HTTP 429). Suites that seed data through the API must throttle.                                                                                                                                                                                                                                                                                                                                                                                                                      | Seen while collecting this data                                                                                                                                  |
| **F-15** | Medium   | **Retell Lecture loses its keywords after a media upload** (AP-807, confirmed on stage). The keyword sync is bound to the first `form` object, which `VideoAndAudio`'s `v-model` replaces on every upload, so `keywords: ""` is sent.                                                                                                                                                                                                                                                                                                                       | `RetellLecture.vue:84`, `VideoAndAudio.vue:79-86`                                                                                                                |
| **F-17** | Medium   | **The create URL without `?type` crashes** (AP-807). `setSelectedQuestionType` throws `Cannot destructure property 'component' of 'find(...)'`.                                                                                                                                                                                                                                                                                                                                                                                                             | `store/modules/question.js:110`, `CreateView.vue:591`                                                                                                            |
| **F-18** | High     | **`total_answer_time` leaves out the audio for RS, ASQ, SGD and RTAS** (AP-807). Their forms send no `file_type`, and the server stores `file_duration` only when `file_type` is sent. RL sends it and is timed correctly.                                                                                                                                                                                                                                                                                                                                  | type components' `form`; `QuestionService`                                                                                                                       |
| **F-19** | Medium   | **AAC uploads are refused** (AP-807). An ADTS `.aac` is sniffed as `audio/x-hx-aac-adts`, which is not in the allow-list, although the message says AAC is accepted.                                                                                                                                                                                                                                                                                                                                                                                        | `FileUploadRequest.php:48-50`                                                                                                                                    |
| **F-20** | Medium   | **The details dialog never shows a Read Aloud passage** (AP-807). The title is rendered only when `section !== 'SPEAKING'`.                                                                                                                                                                                                                                                                                                                                                                                                                                 | `molecule/question/questionList.vue:3-6`                                                                                                                         |
| **F-21** | Low      | **Image and video upload errors are hidden** (AP-807). The global 422 handler's "File: Unsupported file type." is replaced at once by the picker's "The given data was invalid.".                                                                                                                                                                                                                                                                                                                                                                           | `validation/backendMessages.js:63`, `ImageUploader.vue:111-114`                                                                                                  |

> **F-01, as observed on stage (AP-807, 2026-10-07):** the type rules do run — Vuelidate gathers each child
> component's rules into CreateView's `v$` — so a missing RA title, DI image or RL/SGD/RTAS transcript blocks the save.
> F-01 still holds for **audio** (RS, ASQ, SGD and RTAS save without it). RS/ASQ transcript and DI image block the save
> without a message (F-02). The questions on stage without content (RA118 …, DI117) predate this behaviour or came
> from another path.

---

## 9. Test-data conventions for the automation suite

- **Index prefix.** Create every automation question with an index starting `QA-AUTO-SPK-<TYPE>-<timestamp>`. That keeps it unique across all types and makes it findable by search.
- **Clean up.** Delete what each spec creates in `afterEach` (`DELETE /api/v1/questions/{id}`), so the stage total of 118 and the per-type counts stay comparable between runs.
- **Media fixtures.** Keep them in the automation repo:

  | Fixture                        | Used for               |
  | ------------------------------ | ---------------------- |
  | `speaking-short.mp3` (≈5 s)    | RS, ASQ                |
  | `speaking-lecture.mp3` (≈60 s) | RL, SGD, RTAS          |
  | `speaking-lecture.mp4`         | RL video               |
  | `describe-image.png`           | DI                     |
  | `invalid.pdf`                  | wrong-type upload      |
  | `answer.wav`                   | Test Evaluation answer |

- **Stub or record the read endpoints** that list and filter tests rely on: `questions/list`, `question-types`, `common/dropdowns`. Recorded responses are not affected by other people's data changes.
