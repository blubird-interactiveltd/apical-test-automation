import type { APIRequestContext, APIResponse } from "@playwright/test";
import { ApiHeaders } from "../../utils/apiHeaders";
import { EnvLoader } from "../../utils/envLoader";
import type { CourseCreateInfo } from "../../utils/types/course/course.types";

const PACKAGES_PATH = "/api/v1/packages";

/**
 * Calls to the real packages API.
 *
 * These write: every spec that creates a course must `remove` it again.
 */
export class CourseApiService {
  static async create(
    request: APIRequestContext,
    token: string | null,
    payload: CourseCreateInfo,
  ): Promise<APIResponse> {
    return request.post(`${EnvLoader.get("API_URL")}${PACKAGES_PATH}`, {
      headers: token ? ApiHeaders.tenant(token) : ApiHeaders.tenant(),
      data: payload,
    });
  }

  static async update(
    request: APIRequestContext,
    token: string,
    id: string,
    payload: CourseCreateInfo,
  ): Promise<APIResponse> {
    return request.put(`${EnvLoader.get("API_URL")}${PACKAGES_PATH}/${id}`, {
      headers: ApiHeaders.tenant(token),
      data: payload,
    });
  }

  static async fetch(
    request: APIRequestContext,
    token: string,
    id: string,
  ): Promise<APIResponse> {
    return request.get(`${EnvLoader.get("API_URL")}${PACKAGES_PATH}/${id}`, {
      headers: ApiHeaders.tenant(token),
    });
  }

  static async remove(
    request: APIRequestContext,
    token: string,
    id: string,
  ): Promise<APIResponse> {
    return request.delete(`${EnvLoader.get("API_URL")}${PACKAGES_PATH}/${id}`, {
      headers: ApiHeaders.tenant(token),
    });
  }
}
