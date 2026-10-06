# Speaking Test Evaluation (Super Admin): Test Cases

These cases cover the 📋 "Test Evaluation" icon on the Speaking list. It opens the nested route
`…/pte-question/speaking/evaluate/:slug/:id?section=speaking` (`master-pte-question.speaking.evaluate`).
That route renders the student `ParticipationForm.vue` in `evaluation: 'master'` mode, as a dialog over the list.
On submit, the answer goes to the answer-sheet API and the page navigates to the AI score (`master.evaluation`).

Business rules and finding IDs (F-xx) are defined in [speaking-business-document.md](speaking-business-document.md).

**Preconditions:**

- Logged in as Super Admin with QUESTION_SHOW.
- One **published** test question per type.
- Chromium is launched with a fake microphone: `--use-fake-ui-for-media-stream --use-fake-device-for-media-stream --use-file-for-fake-audio-capture=fixtures/media/answer.wav`.
- Answer fixture `answer.wav` (≈10 s of speech).
- The scoring call is stubbed in UI runs, and called live only in `@live` runs.

**ID scheme:** `SPK-EVAL-TC-NNN`.

---

## 1. Entry & navigation

| ID              | Feature | Title                             | Precondition                                           | Steps                            | Expected Outcome                                                                                                         | Status      |
| --------------- | ------- | --------------------------------- | ------------------------------------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ----------- |
| SPK-EVAL-TC-001 | Entry   | Open evaluation                   | A row with index "RS0001-6"                            | 1. Click 📋                      | URL `…/speaking/evaluate/rs0001-6/<id>?section=speaking`; the evaluation dialog opens; the list stays rendered behind it | To automate |
| SPK-EVAL-TC-002 | Entry   | Slug never empty                  | A question whose index slugifies to empty (e.g. "!!!") | 1. Click 📋                      | The URL uses the slug `question`; the route resolves                                                                     | To automate |
| SPK-EVAL-TC-003 | Entry   | Tooltip                           | –                                                      | 1. Hover 📋                      | Tooltip "Test Evaluation"                                                                                                | To automate |
| SPK-EVAL-TC-004 | Entry   | Permission guard on direct URL    | Without QUESTION_SHOW                                  | 1. Open an evaluate URL directly | Blocked by `requirePermission('QUESTION_SHOW')`                                                                          | To automate |
| SPK-EVAL-TC-005 | Entry   | Back or close returns to the list | Dialog open, list on RS page 2                         | 1. Close or go back              | `master-pte-question.speaking` with the list state intact                                                                | To automate |

## 2. Question rendering per type

| ID              | Feature | Title                           | Precondition       | Steps              | Expected Outcome                                                                                                | Status      |
| --------------- | ------- | ------------------------------- | ------------------ | ------------------ | --------------------------------------------------------------------------------------------------------------- | ----------- |
| SPK-EVAL-TC-101 | RA      | Read Aloud                      | RA                 | 1. Open evaluation | The passage is shown without brackets; preparation countdown 40 s, then recording 40 s with a beep              | To automate |
| SPK-EVAL-TC-201 | RS      | Repeat Sentence                 | RS                 | 1. Open            | The audio plays once after a 3 s pre-audio wait; recording starts after the beep; no transcript is shown        | To automate |
| SPK-EVAL-TC-301 | DI      | Describe Image                  | DI                 | 1. Open            | The image is shown; 25 s preparation, then 40 s recording                                                       | To automate |
| SPK-EVAL-TC-401 | RL      | Retell Lecture, audio and video | RL audio, RL video | 1. Open each       | Audio or video plays; then 10 s preparation and 40 s recording; the video prompt is used for the video question | To automate |
| SPK-EVAL-TC-501 | ASQ     | Answer Short Question           | ASQ                | 1. Open            | The audio plays; recording starts **without** a beep (`is_beep: false`)                                         | To automate |
| SPK-EVAL-TC-601 | SGD     | Summarize Group Discussion      | SGD                | 1. Open            | The audio plays; 10 s preparation; 120 s recording                                                              | To automate |
| SPK-EVAL-TC-701 | RTAS    | Respond To A Situation          | RTAS               | 1. Open            | The situation is shown and the audio plays; 10 s preparation; 40 s recording                                    | To automate |
| SPK-EVAL-TC-702 | Draft   | Draft question                  | A draft question   | 1. Click 📋        | Either it is evaluable for the admin, or a clear message is shown; there is no blank dialog                     | To automate |

## 3. Answering & submit

| ID              | Feature       | Title                                | Precondition                                                                | Steps                                                          | Expected Outcome                                                                                                                                                                                             | Status             |
| --------------- | ------------- | ------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------ |
| SPK-EVAL-TC-010 | Upload answer | Attach a prepared recording          | Any type                                                                    | 1. In "Attach answer recording (optional)" choose `answer.wav` | The text "This file will be submitted instead of the recording." shows; preparation time is skipped                                                                                                          | To automate        |
| SPK-EVAL-TC-011 | Upload answer | Uploaded file is submitted as binary | After TC-010                                                                | 1. Submit and confirm<br>2. Capture the answer-sheet request   | Multipart body: `question_id`, `type=PTE_PRACTICE`, `file[<question_id>]` = the chosen file (its original name), `items=[{"question_id":"<id>"}]`; the file is **not** pre-uploaded to `/common/upload-file` | To automate        |
| SPK-EVAL-TC-012 | Record answer | Live recording submitted             | Fake microphone                                                             | 1. Let preparation finish<br>2. Record<br>3. Submit            | `file[<question_id>]` = `recording_<question_id>.wav`                                                                                                                                                        | To automate        |
| SPK-EVAL-TC-013 | Submit        | Confirmation dialog                  | An answer recorded or attached                                              | 1. Click Submit                                                | The dialog "You are about to finish this question. Your response will be submitted for AI evaluation…" with **Proceed**                                                                                      | To automate        |
| SPK-EVAL-TC-014 | Submit        | Nothing recorded                     | No recording, no file                                                       | 1. Click Submit                                                | A warning dialog is shown and recording stops; no request is sent until the user confirms                                                                                                                    | To automate        |
| SPK-EVAL-TC-015 | Submit        | Result page                          | Answer-sheet stubbed with `{ data: { evaluation_id: "E1" }, message: "…" }` | 1. Proceed                                                     | Snackbar shows the message; navigates to `master.evaluation` with `type=pte-practice`, `id=E1`; localStorage `answer_sheet_id=E1`                                                                            | To automate        |
| SPK-EVAL-TC-016 | Submit        | Live AI score                        | `@live`, RS with `answer.wav`                                               | 1. Attach `answer.wav`<br>2. Submit and Proceed                | The result page shows a score breakdown for the speaking skill; there is no error                                                                                                                            | To automate (live) |
| SPK-EVAL-TC-017 | Submit        | Unreadable attached file             | The file handle cleared after attaching                                     | 1. Submit                                                      | Snackbar "Could not read the uploaded answer file. Please re-attach it."; no request                                                                                                                         | To automate        |
| SPK-EVAL-TC-018 | Submit        | Server error                         | Answer-sheet stubbed with 500                                               | 1. Submit                                                      | The loading state ends; an error is shown; the dialog stays open                                                                                                                                             | To automate        |
| SPK-EVAL-TC-019 | Submit        | Keywords drive scoring               | `@live`, ASQ with keyword `dice`; two answers: one saying "dice", one not   | 1. Evaluate each                                               | The content score is higher for the answer containing the keyword                                                                                                                                            | To automate (live) |
