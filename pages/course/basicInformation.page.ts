import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/** Basic Information, `views/courses/BasicInformationView.vue`. */
export class BasicInformationPage extends CourseWizardPage {
  readonly name: Locator;
  readonly nameField: Locator;
  readonly thumbnailInput: Locator;
  readonly thumbnailField: Locator;
  readonly thumbnailLabel: Locator;
  readonly description: Locator;
  readonly descriptionField: Locator;

  constructor(page: Page) {
    super(page);
    // InputFieldComponent renders <label> then the <input> inside one root div.
    this.nameField = page
      .locator("label", { hasText: /^\s*Name of the course/i })
      .locator("xpath=..");
    this.name = this.nameField.locator("input");
    this.thumbnailField = page
      .locator("label", { hasText: /upload thumbnail image/i })
      .locator("xpath=..");
    // Hidden <input type=file>; setInputFiles works on it directly.
    this.thumbnailInput = this.thumbnailField.locator("input[type=file]");
    // FileUploadComponent shows the stored path, or the picked file's name.
    this.thumbnailLabel = this.thumbnailField.locator("p").first();
    // TextEditor labels itself with an <h4>, not a <label>.
    this.descriptionField = page
      .locator("h4", { hasText: /course description/i })
      .locator("xpath=..");
    this.description = page.locator(".ck-editor__editable").first();
  }

  async fillName(value: string): Promise<void> {
    await this.name.fill(value);
  }

  async chooseThumbnail(
    fileName: string,
    mimeType = "image/png",
    body: Buffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]),
  ): Promise<void> {
    await this.thumbnailInput.setInputFiles({
      name: fileName,
      mimeType,
      buffer: body,
    });
  }

  /** Types plain text into CKEditor. */
  async fillDescription(text: string): Promise<void> {
    await this.description.click();
    await this.description.fill(text);
  }

  /**
   * Sets formatted HTML through the editor instance, as a paste would.
   *
   * CKEditor 5 exposes its instance on the editable element; typing markup with
   * the keyboard would insert it as literal text.
   */
  async setDescriptionHtml(html: string): Promise<void> {
    await this.description.evaluate((element, value) => {
      const editor = (
        element as HTMLElement & {
          ckeditorInstance: { setData(data: string): void };
        }
      ).ckeditorInstance;
      editor.setData(value);
    }, html);
  }

  fieldError(field: "name" | "thumbnail" | "description"): Locator {
    const root = {
      name: this.nameField,
      thumbnail: this.thumbnailField,
      description: this.descriptionField,
    }[field];

    return root.locator(".text-danger");
  }
}
