import type { Locator, Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";
import { PTE_QUESTION_PATHS } from "./speakingList.page";

/** The rich-text sections a type form can carry, by their `<h2>` heading. */
export type RichTextField = "title" | "transcript";

/** The file pickers on the form, by the `accept` each renders. */
export type MediaInput = "audio" | "image" | "video";

const ACCEPT: Record<MediaInput, string> = {
  audio: "audio/*",
  image: "image/*",
  video: "video/*",
};

/** CKEditor 5 puts its instance on the editable element (`TextEditor.vue`). */
interface EditableElement extends HTMLElement {
  ckeditorInstance?: { setData: (html: string) => void; getData: () => string };
}

/**
 * The PTE question create form — `pte-question/CreateView.vue` with one type
 * component from `molecule/question/items/` below the common fields.
 *
 * The app ships no `data-testid`. Selects and inputs are found through their
 * label (`SelectComponent` renders `<label for="<label text>">`), the type
 * sections through their `<h2>` heading, and pickers through `accept`. Every
 * locator is scoped to the create `<form>`: the sample-answer dialog is
 * teleported outside it and has file inputs of its own.
 */
export class SpeakingCreatePage {
  readonly form: Locator;
  readonly heading: Locator;
  readonly headingSection: Locator;
  readonly backButton: Locator;
  readonly skeleton: Locator;
  readonly typeSelect: Locator;
  readonly sampleAnswerButton: Locator;
  readonly prompt: Locator;
  readonly promptOr: Locator;
  readonly indexInput: Locator;
  readonly indexError: Locator;
  readonly sourceSelect: Locator;
  readonly sourceError: Locator;
  readonly frequencySelect: Locator;
  readonly createAnother: Locator;
  readonly publishButton: Locator;
  readonly draftButton: Locator;
  readonly keywordBox: Locator;
  readonly keywordInfoIcon: Locator;
  readonly tooltip: Locator;
  readonly bracketHints: Locator;
  readonly sectionHeadings: Locator;
  readonly fileInputs: Locator;
  readonly audioPlayer: Locator;
  readonly audioDuration: Locator;
  readonly audioError: Locator;
  readonly recordTab: Locator;
  readonly imagePreview: Locator;
  readonly videoPreview: Locator;
  readonly mediaCard: Locator;
  readonly audioTab: Locator;
  readonly videoTab: Locator;
  readonly groupDiscussionTitle: Locator;
  readonly groupDiscussionIcon: Locator;
  readonly groupDiscussionImage: Locator;
  readonly groupDiscussionCaption: Locator;

  constructor(private readonly page: Page) {
    this.form = page
      .locator("form")
      .filter({ has: page.locator('label[for="Choose Question Type"]') });
    this.heading = this.form.locator("h2").first();
    this.headingSection = this.heading.locator("small");
    this.backButton = this.form.getByRole("button", {
      name: /back to question list/i,
    });
    this.skeleton = page.locator(".v-skeleton-loader");
    this.typeSelect = this.selectLabelled("Choose Question Type");
    this.sampleAnswerButton = this.form.getByRole("button", {
      name: "Choose Sample Answer",
    });
    // "Prompt" label, then the grey box holding the prompt and, for RL, "OR" + the video prompt.
    this.prompt = this.form
      .locator("label", { hasText: /^\s*Prompt\s*$/ })
      .locator("xpath=following-sibling::div[1]");
    this.promptOr = this.prompt.locator("b", { hasText: "OR" });
    const indexField = this.form.locator("div.flex").filter({
      has: page.locator(":scope > label", { hasText: "Question Index" }),
    });
    this.indexInput = indexField.locator("input");
    this.indexError = indexField.locator("b.text-danger");
    this.sourceSelect = this.selectLabelled("Source");
    this.sourceError = this.fieldOf("Source").locator("b.text-danger");
    this.frequencySelect = this.selectLabelled("FREQUENCY");
    this.createAnother = this.form.getByRole("checkbox", {
      name: "Create another",
    });
    this.publishButton = this.form.locator('button[type="submit"]').last();
    this.draftButton = this.form.locator('button[type="submit"]').first();
    const keywordField = this.form.locator("div.d-flex").filter({
      has: page.locator(":scope > label", { hasText: /^\s*Keyword\s*$/ }),
    });
    this.keywordBox = keywordField.locator("textarea").first();
    this.keywordInfoIcon = keywordField.locator("i.mdi-information-outline");
    this.tooltip = page.locator(".v-tooltip > .v-overlay__content");
    this.bracketHints = this.form.locator("h4", {
      hasText: "Use brackets to mark keywords",
    });
    this.sectionHeadings = this.form.locator("h2.text-primary");
    this.fileInputs = this.form.locator('input[type="file"]');
    this.audioPlayer = this.form.locator(".custom-audio-player");
    this.audioDuration = this.audioPlayer.locator(".time-display").nth(1);
    // AudioUploader's own message: the server's `errors.file[0]`.
    this.audioError = this.form.locator(".outline-gray-400 > b.text-danger");
    this.recordTab = this.form.getByText("Record", { exact: true });
    this.imagePreview = this.form.locator("img.md-upload__image");
    this.videoPreview = this.form.locator("video");
    this.mediaCard = this.form.locator(".v-card", { hasText: "Media Content" });
    this.audioTab = this.form.getByRole("tab", { name: /audio/i });
    this.videoTab = this.form.getByRole("tab", { name: /video/i });
    this.groupDiscussionTitle = this.form.locator("h3", {
      hasText: "Group Discussion",
    });
    this.groupDiscussionIcon = this.form.locator("i.mdi-account-group");
    this.groupDiscussionImage = this.form.locator(
      'img[alt="Group Discussion Preview"]',
    );
    this.groupDiscussionCaption = this.form.getByText(
      "Group discussion scenario",
      { exact: true },
    );
  }

  /** The `SelectComponent` wrapper whose label reads `label`. */
  private fieldOf(label: string): Locator {
    return this.form
      .locator("div.inline-flex")
      .filter({ has: this.page.locator(`:scope > label[for="${label}"]`) });
  }

  private selectLabelled(label: string): Locator {
    return this.fieldOf(label).locator("select");
  }

  /** Opens the form by URL (`query` defaults to the Speaking section). */
  async goto(query = "type=speaking"): Promise<void> {
    const path = query
      ? `${PTE_QUESTION_PATHS.create}?${query}`
      : PTE_QUESTION_PATHS.create;
    await this.page.goto(path, { waitUntil: "domcontentloaded" });
  }

  /**
   * Waits until the form can be used: the heading is shown and the type
   * details have arrived, which is when the Prompt banner appears.
   */
  async waitForReady(): Promise<void> {
    await this.heading.waitFor({ timeout: timeouts.uiRenderTimeout });
    await this.prompt.waitFor({ timeout: timeouts.uiRenderTimeout });
  }

  async optionLabels(select: Locator): Promise<string[]> {
    const labels = await select
      .locator("option:not([disabled])")
      .allInnerTexts();

    return labels.map((label) => label.trim());
  }

  /** The label of the option a select currently shows. */
  async selectedLabel(select: Locator): Promise<string> {
    return (
      await select.evaluate(
        (node: HTMLSelectElement) => node.selectedOptions[0]?.textContent ?? "",
      )
    ).trim();
  }

  async selectType(title: string): Promise<void> {
    await this.typeSelect.selectOption({ label: title });
  }

  async chooseSource(label: string): Promise<void> {
    await this.sourceSelect.selectOption({ label });
  }

  async chooseFrequency(label: string): Promise<void> {
    await this.frequencySelect.selectOption({ label });
  }

  async fillIndex(value: string): Promise<void> {
    await this.indexInput.fill(value);
  }

  /** The `<h2>` heading of a rich-text section ("TITLE" / "TRANSCRIPT"; uppercase is CSS). */
  sectionHeading(field: RichTextField): Locator {
    return this.form.locator("h2", {
      hasText: new RegExp(`^\\s*${field}\\s*$`, "i"),
    });
  }

  /** The CKEditor editable under a section heading. */
  editor(field: RichTextField): Locator {
    return this.sectionHeading(field)
      .locator("xpath=following-sibling::div[1]")
      .locator(".ck-editor__editable");
  }

  /**
   * Puts `html` into a rich-text field the way a paste does: one change that
   * CKEditor reports through `change:data`, so `TextEditor` emits `input` and
   * the keyword sync runs on the whole text at once. Typing it would also
   * run the sync on every half-typed bracket, e.g. `[[content]` before its
   * last `]`.
   */
  async setRichText(field: RichTextField, html: string): Promise<void> {
    const editable = this.editor(field);
    await editable.waitFor();
    await editable.evaluate((node: EditableElement, value) => {
      if (!node.ckeditorInstance) {
        throw new Error("No CKEditor instance on the editable.");
      }
      node.ckeditorInstance.setData(value);
    }, html);
  }

  /** What CKEditor holds for a field, as HTML. */
  async richText(field: RichTextField): Promise<string> {
    return this.editor(field).evaluate(
      (node: EditableElement) => node.ckeditorInstance?.getData() ?? "",
    );
  }

  async setKeywords(value: string): Promise<void> {
    await this.keywordBox.fill(value);
  }

  /** The `<input type=file>` of a picker on the form. */
  fileInput(kind: MediaInput): Locator {
    return this.fileInputs
      .and(this.page.locator(`[accept="${ACCEPT[kind]}"]`))
      .first();
  }

  /** A field error or message anywhere on the form, by its text. */
  message(text: string): Locator {
    return this.form.locator(".text-danger", { hasText: text });
  }
}
