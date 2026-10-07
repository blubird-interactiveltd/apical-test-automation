import { expect, type Page } from "@playwright/test";
import { timeouts } from "../../config/timeouts.config";
import { SampleAnswerDialog } from "../../pages/speaking/sampleAnswerDialog.component";
import {
  type MediaInput,
  SpeakingCreatePage,
} from "../../pages/speaking/speakingCreate.page";
import {
  PTE_QUESTION_PATHS,
  SPEAKING_LIST_PATHS,
  SpeakingListPage,
} from "../../pages/speaking/speakingList.page";
import { type InMemoryFile, mediaFile } from "../../utils/speakingMedia";
import { createType } from "../../utils/speakingTestData";
import type { ApicalRole } from "../../utils/types/auth/auth.types";
import type { StubbedError } from "../../utils/types/shared/listResponse.types";
import type { SpeakingMediaName } from "../../utils/types/speaking/speakingCreate.types";
import type { SpeakingTypeCode } from "../../utils/types/speaking/speakingList.types";
import { ApicalLoginService } from "../auth/apicalLogin.service";
import { ApiResponseCache } from "../shared/apiResponseCache.service";
import {
  type CapturedPost,
  type CapturedUpload,
  SpeakingCreateApiMock,
  type UploadBehaviour,
} from "./speakingCreateApiMock.service";

/** How long a create or upload may take on stage, 429 back-off included. */
export const WRITE_TIMEOUT_MS = 90_000;

export interface OpenCreateFormOptions {
  role?: ApicalRole;
  /** Picks this type after the form opens. Default: the form's own default, RA. */
  type?: SpeakingTypeCode;
  /**
   * Opens the form from the list's Create button, as every case's
   * precondition says, so `router.back()` has somewhere to return to.
   * `false` opens the create URL directly with `query`.
   */
  viaList?: boolean;
  /** The create URL's query when not opened from the list; `""` for none. */
  query?: string;
  /** Stubs the reply to `POST /questions` instead of saving. */
  postReply?: StubbedError;
  uploads?: UploadBehaviour;
  /**
   * Serves the Speaking list live, uncached, for cases that check the list
   * after saving. Off by default: every other case only needs the list to
   * reach the Create button, and a cached list keeps stage under its rate limit.
   */
  liveList?: boolean;
  /** Waits for the type details (the Prompt banner). Off for broken URLs. */
  waitForReady?: boolean;
}

export interface OpenedCreateForm {
  form: SpeakingCreatePage;
  api: SpeakingCreateApiMock;
  listPage: SpeakingListPage;
}

/** What to put in the form. Labels for selects; HTML for rich text. */
export interface QuestionContent {
  index?: string;
  sourceLabel?: string;
  frequencyLabel?: string;
  title?: string;
  transcript?: string;
  keywords?: string;
  media?: SpeakingMediaName | InMemoryFile;
  /** RL only: which Media Content tab the file goes in. Default audio. */
  mediaTab?: "audio" | "video";
}

/** The picker each type's media goes into. */
const MEDIA_INPUT: Record<SpeakingTypeCode, MediaInput | null> = {
  RA: null,
  RS: "audio",
  DI: "image",
  RL: "audio",
  ASQ: "audio",
  SGD: "audio",
  RTAS: "audio",
};

/** Workflows over the PTE Speaking create form that more than one spec needs. */
export class SpeakingCreateService {
  /**
   * Signs in, installs the cache and the write recorders, and opens the form.
   *
   * Routes go in before navigating: the type requests fire on mount. With
   * `liveList` the Speaking list is served uncached, so a question a case
   * creates is on it when the form returns there.
   */
  static async open(
    page: Page,
    options: OpenCreateFormOptions = {},
  ): Promise<OpenedCreateForm> {
    const api = new SpeakingCreateApiMock(page);
    const form = new SpeakingCreatePage(page);
    const listPage = new SpeakingListPage(page);

    await ApicalLoginService.ensureLoggedIn(page, options.role ?? "master");
    await ApiResponseCache.install(page);
    if (options.liveList) await api.liveList();
    await api.questionPosts(options.postReply);
    await api.uploadRequests(options.uploads);

    if (options.viaList ?? true) {
      // The app renders nothing until its boot calls answer, and a throttled
      // call can sit in back-off (F-12) longer than a normal render wait.
      await listPage.goto(SPEAKING_LIST_PATHS.master, WRITE_TIMEOUT_MS);
      await listPage.waitForRows();
      await listPage.createButton.click();
      await expect(page).toHaveURL(
        new RegExp(`${PTE_QUESTION_PATHS.create}\\?type=speaking$`),
      );
    } else {
      await form.goto(options.query ?? "type=speaking");
    }

    if (options.waitForReady ?? true) {
      await form.waitForReady();
    }

    if (options.type && options.type !== "RA") {
      await SpeakingCreateService.selectType(form, options.type);
    }

    return { form, api, listPage };
  }

  /** Picks a type and waits for its prompt, i.e. for its details to load. */
  static async selectType(
    form: SpeakingCreatePage,
    code: SpeakingTypeCode,
  ): Promise<void> {
    const type = createType(code);

    await form.selectType(type.title);
    await expect(form.prompt).toContainText(type.prompt);
  }

  /** Chooses a file in a picker and waits for its upload to be answered. */
  static async upload(
    form: SpeakingCreatePage,
    api: SpeakingCreateApiMock,
    kind: MediaInput,
    media: SpeakingMediaName | InMemoryFile,
  ): Promise<CapturedUpload> {
    const count = api.uploads.length + 1;

    await form
      .fileInput(kind)
      .setInputFiles(typeof media === "string" ? mediaFile(media) : media);

    return api.upload(count, WRITE_TIMEOUT_MS);
  }

  /**
   * Fills the common fields and one type's fields, in the order that type's
   * form shows them (business doc §5): RTAS has its transcript above the
   * audio, every other audio type the other way round.
   */
  static async fill(
    form: SpeakingCreatePage,
    api: SpeakingCreateApiMock,
    code: SpeakingTypeCode,
    content: QuestionContent,
  ): Promise<void> {
    if (content.index !== undefined) await form.fillIndex(content.index);
    if (content.sourceLabel) await form.chooseSource(content.sourceLabel);
    if (content.frequencyLabel)
      await form.chooseFrequency(content.frequencyLabel);

    const mediaInput: MediaInput | null =
      code === "RL" && content.mediaTab === "video"
        ? "video"
        : MEDIA_INPUT[code];
    const uploadMedia = async () => {
      if (!content.media || !mediaInput) return;
      if (code === "RL") {
        await (
          content.mediaTab === "video" ? form.videoTab : form.audioTab
        ).click();
      }
      await SpeakingCreateService.upload(form, api, mediaInput, content.media);
    };
    const text = code === "RA" ? content.title : content.transcript;
    const field = code === "RA" ? "title" : "transcript";
    const fillText = async () => {
      if (text !== undefined) await form.setRichText(field, text);
    };

    if (code === "RTAS") {
      await fillText();
      await uploadMedia();
    } else {
      await uploadMedia();
      await fillText();
    }

    if (content.keywords !== undefined)
      await form.setKeywords(content.keywords);
  }

  /** Opens "Choose Sample Answer", picks the first archived answer and sets it. */
  static async attachFromArchive(
    page: Page,
    form: SpeakingCreatePage,
  ): Promise<void> {
    const dialog = new SampleAnswerDialog(page);

    await form.sampleAnswerButton.click();
    await dialog.archiveRadio.check();
    await dialog.archiveItems.first().click();
    await dialog.setButton.click();
    await expect(dialog.heading).toBeHidden();
  }

  /**
   * Clicks Publish (or Save as Draft) and returns the request it sent,
   * once the API has answered it.
   */
  static async submit(
    form: SpeakingCreatePage,
    api: SpeakingCreateApiMock,
    button: "publish" | "draft" = "publish",
  ): Promise<CapturedPost> {
    const count = api.posts.length + 1;

    await (
      button === "publish" ? form.publishButton : form.draftButton
    ).click();

    return api.post(count, WRITE_TIMEOUT_MS);
  }

  /**
   * Waits out the quiet window, then returns.
   *
   * For cases that assert a request was *not* sent: absence cannot be
   * awaited, only observed after a window in which it would have happened.
   */
  static async settle(page: Page): Promise<void> {
    await page.waitForTimeout(timeouts.quietWindow);
  }
}
