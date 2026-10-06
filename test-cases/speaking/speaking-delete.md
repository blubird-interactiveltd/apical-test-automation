# Speaking Question Delete: Test Cases

These cases cover deleting a Speaking question from the list. The bin icon opens `ConfirmDialog`, and
confirming calls `actDeleteQuestion`, which sends `DELETE /api/v1/questions/{id}`.

Business rules and finding IDs (F-xx) are defined in [speaking-business-document.md](speaking-business-document.md).

**Global preconditions:**

- Logged in as Super Admin with QUESTION_DESTROY.
- **Fresh question per case.** Each case creates the question it deletes through the API, with index `QA-AUTO-SPK-DEL-<type>-<ts>`. Recorded stage questions are never deleted.
- **What each case checks.** Every case confirms the outcome from both sides: the row disappearing from the list, and the API (`GET /questions/{id}` returns 404 after a delete).

**ID scheme:** `SPK-DEL-TC-NNN`.

---

## 1. Confirmation dialog

| ID             | Feature | Title                          | Precondition                | Steps                          | Expected Outcome                                                | Status      |
| -------------- | ------- | ------------------------------ | --------------------------- | ------------------------------ | --------------------------------------------------------------- | ----------- |
| SPK-DEL-TC-001 | Confirm | Dialog opens                   | A test question in the list | 1. Click 🗑 on its row         | A confirmation dialog opens; no DELETE has been sent yet        | To automate |
| SPK-DEL-TC-002 | Confirm | Cancel                         | Dialog open                 | 1. Click Cancel / close        | The dialog closes; no DELETE; the row is still listed           | To automate |
| SPK-DEL-TC-003 | Confirm | Escape or outside click        | Dialog open                 | 1. Press Esc                   | Same as Cancel                                                  | To automate |
| SPK-DEL-TC-004 | Confirm | Confirm deletes the right row  | Two test questions A and B  | 1. Delete B and confirm        | DELETE is sent for B's id only; A stays                         | To automate |
| SPK-DEL-TC-005 | Confirm | Dialog after an earlier cancel | Cancelled the dialog for A  | 1. Click 🗑 on B<br>2. Confirm | B is deleted (not A); `questionId` is taken from the last click | To automate |

## 2. Outcome

| ID             | Feature | Title                       | Precondition                  | Steps                                     | Expected Outcome                                                                                      | Status                                                             |
| -------------- | ------- | --------------------------- | ----------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| SPK-DEL-TC-010 | Outcome | Row removed                 | Test question listed          | 1. Delete and confirm                     | DELETE 200 `{ message: "Successfully Deleted" }`; the row disappears without a reload                 | To automate                                                        |
| SPK-DEL-TC-011 | Outcome | Success message             | Same                          | 1. Delete and confirm                     | A snackbar confirms the delete                                                                        | **Expected to fail** (F-05) — there is no snackbar                 |
| SPK-DEL-TC-012 | Outcome | Paginator updated           | Total N before                | 1. Delete one                             | The paginator shows N−1 and the range adjusts                                                         | **Expected to fail** (F-05) — the total still shows N until reload |
| SPK-DEL-TC-013 | Outcome | Gone after reload           | After delete                  | 1. Reload the list<br>2. Search its index | Not found; total = N−1                                                                                | To automate                                                        |
| SPK-DEL-TC-014 | Outcome | API returns 404             | After delete                  | 1. `GET /questions/<id>`                  | 404                                                                                                   | To automate                                                        |
| SPK-DEL-TC-015 | Outcome | Soft delete frees the index | After deleting index X        | 1. Create a new question with index X     | 201 (uniqueness ignores soft-deleted rows)                                                            | To automate                                                        |
| SPK-DEL-TC-016 | Outcome | Each type deletable         | One test question per type    | 1. Delete each                            | All 7 delete with 200                                                                                 | To automate                                                        |
| SPK-DEL-TC-017 | Outcome | Delete a draft              | Draft test question           | 1. Delete it                              | Deleted; the Draft filter count drops by 1                                                            | To automate                                                        |
| SPK-DEL-TC-018 | Outcome | Delete under a filter       | Type = RTAS, search active    | 1. Delete a row                           | The filters and search stay applied; the remaining rows still match                                   | To automate                                                        |
| SPK-DEL-TC-019 | Outcome | Last row on a page          | The only row on the last page | 1. Delete it                              | The list moves to the previous page or shows the empty state, not a blank page with a stale paginator | To automate                                                        |

## 3. Guards & errors

| ID             | Feature | Title                           | Precondition                                                                                       | Steps                        | Expected Outcome                                                         | Status                                                                         |
| -------------- | ------- | ------------------------------- | -------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| SPK-DEL-TC-020 | Guard   | Question used in a test or mock | A test question attached to a PTE practice or mock test (`GET /questions/used-for/<id>` not empty) | 1. Delete it                 | The user is warned that the question is in use, or the delete is refused | **Expected to fail** (F-05) — it is deleted without warning                    |
| SPK-DEL-TC-021 | Guard   | Server error                    | DELETE stubbed with 500                                                                            | 1. Confirm                   | An error snackbar; the row stays                                         | **Expected to fail** (F-05) — the rejection is unhandled and gives no feedback |
| SPK-DEL-TC-022 | Guard   | Already deleted elsewhere       | Deleted through the API while the list is open                                                     | 1. Delete it from the UI     | 404 handled gracefully; the row is removed or the user is told           | To automate                                                                    |
| SPK-DEL-TC-023 | Guard   | No permission (UI)              | Without QUESTION_DESTROY                                                                           | 1. View rows                 | No bin icon                                                              | To automate                                                                    |
| SPK-DEL-TC-024 | Guard   | No permission (API)             | Token without "Destroy Question"                                                                   | 1. `DELETE /questions/<id>`  | Refused; the question still exists                                       | To automate                                                                    |
| SPK-DEL-TC-025 | Guard   | q_id not reused                 | Questions Q1, Q2                                                                                   | 1. Delete Q1<br>2. Create Q3 | Q3's q_id ≠ any existing q_id                                            | **Expected to fail** (F-08)                                                    |
