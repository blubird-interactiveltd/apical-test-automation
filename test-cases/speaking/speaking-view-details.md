# Speaking Question Details Dialog: Test Cases

These cases cover the 👁 icon on the Speaking list. It opens the _QuestionDetails_ dialog (80% width)
hosted by `pte-question/IndexView.vue`, and loads the question with `GET /api/v1/questions/{id}`
(the `show` intention, which strips the brackets).

Business rules and finding IDs (F-xx) are defined in [speaking-business-document.md](speaking-business-document.md).

**Preconditions:**

- Logged in as Super Admin.
- One test question per type is created through the API with known values.
- The DI case additionally uses a stored image, and the RL cases one audio and one video record.

**ID scheme:** `SPK-VIEW-TC-NNN`.

---

## 1. Common content

| ID              | Feature | Title                                   | Precondition                                          | Steps              | Expected Outcome                                                                                                    | Status                                                |
| --------------- | ------- | --------------------------------------- | ----------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| SPK-VIEW-TC-001 | Dialog  | Opens with a loader                     | Any row                                               | 1. Click 👁        | The skeleton shows, then the content; `GET /questions/<id>` is sent (no `intention=edit`)                           | To automate                                           |
| SPK-VIEW-TC-002 | Dialog  | Header                                  | Index X, q_id Y                                       | 1. Open            | The title shows X; QID = Y; Question Section = "SPEAKING"; Question Category = the type title                       | To automate                                           |
| SPK-VIEW-TC-003 | Dialog  | Prompt                                  | Any type                                              | 1. Open            | Prompt shows the type's default prompt (HTML rendered)                                                              | To automate                                           |
| SPK-VIEW-TC-004 | Dialog  | Source and frequency                    | Source = Practice, Frequency = High                   | 1. Open            | The Source and Frequency values are shown                                                                           | To automate                                           |
| SPK-VIEW-TC-005 | Dialog  | Status chip                             | One published, one draft                              | 1. Open each       | Green "Published" / amber "Draft"                                                                                   | To automate                                           |
| SPK-VIEW-TC-006 | Dialog  | Created by and at                       | –                                                     | 1. Open            | Created By = the creator's name (or "N/A"); Created At is formatted                                                 | To automate                                           |
| SPK-VIEW-TC-007 | Dialog  | Answer time                             | RS                                                    | 1. Open            | Answer Time is shown as mm:ss                                                                                       | To automate                                           |
| SPK-VIEW-TC-008 | Dialog  | Preparing time is the preparation value | RS (prep 4 s, answer 15 s)                            | 1. Open            | Preparing Time differs from Answer Time and shows the prep value                                                    | **Expected to fail** (F-06) — both show `answer_time` |
| SPK-VIEW-TC-009 | Dialog  | Close                                   | Open                                                  | 1. Click close / ✕ | The dialog closes; the list keeps its state                                                                         | To automate                                           |
| SPK-VIEW-TC-010 | Dialog  | Open a second question                  | Closed after viewing A                                | 1. Open B          | B's data is shown, not a flash of A's                                                                               | To automate                                           |
| SPK-VIEW-TC-011 | Dialog  | Brackets stripped                       | RS transcript `[a] b`                                 | 1. Open            | The transcript reads `a b`                                                                                          | To automate                                           |
| SPK-VIEW-TC-012 | Dialog  | Sample answer button                    | RA with a sample answer, RA without                   | 1. Open each       | "Sample Answer" is shown only when one is linked; clicking it opens the sample answer (male and female voice audio) | To automate                                           |
| SPK-VIEW-TC-013 | Dialog  | Explanation button                      | None of the stage speaking questions has explanations | 1. Open any        | No Explanation button                                                                                               | To automate                                           |

## 2. Per type

| ID              | Feature | Title                           | Precondition                         | Steps   | Expected Outcome                                                                                               | Status      |
| --------------- | ------- | ------------------------------- | ------------------------------------ | ------- | -------------------------------------------------------------------------------------------------------------- | ----------- |
| SPK-VIEW-TC-101 | RA      | Read Aloud                      | RA with title                        | 1. Open | The title text is shown (question list block); **no** Transcript section; no audio player                      | To automate |
| SPK-VIEW-TC-201 | RS      | Repeat Sentence                 | RS                                   | 1. Open | "Audio File" player with the stored URL (playable); Transcript shown                                           | To automate |
| SPK-VIEW-TC-301 | DI      | Describe Image                  | DI with an image                     | 1. Open | The "Image" section shows the picture (max height 400); **no** audio player even if `file_type` is `audio`     | To automate |
| SPK-VIEW-TC-302 | DI      | Describe Image without an image | DI117-like record (no `file_path`)   | 1. Open | No image section; the "No transcript available" notice (transcript is shown for non-RA types); no broken image | To automate |
| SPK-VIEW-TC-401 | RL      | Retell Lecture, audio           | RL audio                             | 1. Open | Audio player + Transcript                                                                                      | To automate |
| SPK-VIEW-TC-402 | RL      | Retell Lecture, video           | RL video                             | 1. Open | Video player (not audio) + Transcript                                                                          | To automate |
| SPK-VIEW-TC-501 | ASQ     | Answer Short Question           | ASQ                                  | 1. Open | Audio player + Transcript                                                                                      | To automate |
| SPK-VIEW-TC-601 | SGD     | Summarize Group Discussion      | SGD                                  | 1. Open | Audio player + Transcript                                                                                      | To automate |
| SPK-VIEW-TC-701 | RTAS    | Respond To A Situation          | RTAS                                 | 1. Open | Audio player + Transcript                                                                                      | To automate |
| SPK-VIEW-TC-702 | Any     | Missing transcript              | A non-RA question with no transcript | 1. Open | The "No transcript available" notice                                                                           | To automate |
