import type { APIRequestContext, APIResponse } from "@playwright/test";
import { ApiHeaders } from "../../utils/apiHeaders";
import { EnvLoader } from "../../utils/envLoader";
import type { OnlineClassListResponse } from "../../utils/types/onlineClass/onlineClass.types";

const LIST_PATH = "/api/v1/online-class";

/**
 * Read-only calls to the real online-class API.
 *
 * Nothing here writes, so the live checks can run against a shared environment
 * without teardown.
 */
export class OnlineClassApiService {
  static async search(
    request: APIRequestContext,
    token: string,
    term: string,
  ): Promise<APIResponse> {
    return request.get(`${EnvLoader.get("API_URL")}${LIST_PATH}`, {
      headers: ApiHeaders.tenant(token),
      params: { page: 1, search: term },
    });
  }

  static async searchTitles(
    request: APIRequestContext,
    token: string,
    term: string,
  ): Promise<string[]> {
    const response = await OnlineClassApiService.search(request, token, term);

    if (!response.ok()) {
      throw new Error(
        `Search "${term}" failed: ${response.status()} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as OnlineClassListResponse;

    return body.items.map((item) => item.title);
  }

  /** Every class id the token can list, across all pages. */
  static async allIds(
    request: APIRequestContext,
    token: string,
  ): Promise<string[]> {
    const ids: string[] = [];

    for (let page = 1; ; page++) {
      const response = await request.get(
        `${EnvLoader.get("API_URL")}${LIST_PATH}`,
        { headers: ApiHeaders.tenant(token), params: { page } },
      );

      if (!response.ok()) {
        throw new Error(`List page ${page} failed: ${response.status()}`);
      }

      const body = (await response.json()) as OnlineClassListResponse;
      ids.push(...body.items.map((item) => item.id));

      if (page >= body.meta.last_page) {
        return ids;
      }
    }
  }

  static async fetchById(
    request: APIRequestContext,
    token: string,
    id: string,
  ): Promise<APIResponse> {
    return request.get(`${EnvLoader.get("API_URL")}${LIST_PATH}/${id}`, {
      headers: ApiHeaders.tenant(token),
    });
  }
}
