import { EnvLoader } from "./envLoader";

/**
 * Header helpers for the multi-tenant Apical API.
 *
 * The API resolves the organisation from `X-Tenant`, which the front-end sets
 * to `https://<subdomain>.apical.io` (apical `src/store/api.js`). Without it the
 * login call cannot find the account.
 */
export class ApiHeaders {
  static tenant(token?: string): Record<string, string> {
    const headers: Record<string, string> = {
      Accept: "application/json",
      "X-Tenant": `https://${EnvLoader.get("ORGANIZATION")}.apical.io`,
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }
}
