import type { Locator, Page } from "@playwright/test";
import { CourseWizardPage } from "./courseWizard.page";

/**
 * Live Class, Webinars and One To One Appointment
 * (`views/courses/{LiveClass,Webinars,OneToOneAppointment}.vue`): a range slider
 * in steps of ten, a number box, and All Access.
 */
export class SliderStepPage extends CourseWizardPage {
  readonly slider: Locator;
  readonly count: Locator;
  readonly allAccess: Locator;

  constructor(page: Page) {
    super(page);
    this.slider = page.locator("input[type=range]");
    this.count = page.locator("input[type=number]");
    this.allAccess = page
      .locator(".v-checkbox")
      .filter({ hasText: "All Access" })
      .locator("input[type=checkbox]");
  }

  /** Range inputs cannot be typed into; set the value and fire `input`. */
  async setSlider(value: number): Promise<void> {
    await this.slider.fill(String(value));
  }

  async typeCount(value: number): Promise<void> {
    await this.count.fill(String(value));
  }
}
