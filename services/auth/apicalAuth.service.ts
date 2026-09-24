import type { APIRequestContext } from "@playwright/test";
import { ApiHeaders } from "../../utils/apiHeaders";
import { EnvLoader } from "../../utils/envLoader";
import type {
  ApicalLoginResponse,
  ApicalRole,
  ApicalSession,
} from "../../utils/types/auth/auth.types";

/** The env vars that hold each role's credentials. */
const CREDENTIALS: Record<ApicalRole, { email: string; password: string }> = {
  master: { email: "MASTER_EMAIL", password: "MASTER_PASSWORD" },
  coaching: { email: "COACHING_EMAIL", password: "COACHING_PASSWORD" },
  teacher: { email: "TEACHER_EMAIL", password: "TEACHER_PASSWORD" },
};

/**
 * Authenticates against the Apical API.
 *
 * `POST /api/v1/login` takes email, password and organisation in one call and
 * returns everything `Login.vue` stores, so tests never drive the login form.
 */
export class ApicalAuthService {
  /** Whether `.env` carries credentials for `role` — optional roles skip without. */
  static hasCredentials(role: ApicalRole): boolean {
    const keys = CREDENTIALS[role];

    return !!process.env[keys.email] && !!process.env[keys.password];
  }

  static async getSession(
    request: APIRequestContext,
    role: ApicalRole,
  ): Promise<ApicalSession> {
    const keys = CREDENTIALS[role];
    const response = await request.post(
      `${EnvLoader.get("API_URL")}/api/v1/login`,
      {
        headers: ApiHeaders.tenant(),
        data: {
          email: EnvLoader.get(keys.email),
          password: EnvLoader.get(keys.password),
          organization: EnvLoader.get("ORGANIZATION"),
        },
      },
    );

    if (!response.ok()) {
      throw new Error(
        `${role} login failed: ${response.status()} ${await response.text()}`,
      );
    }

    const body = (await response.json()) as ApicalLoginResponse;
    // The API has returned both shapes; normalise as apical/e2e/auth.setup.ts does.
    const session = body.data ?? body;

    if (!session.token) {
      throw new Error(`${role} login succeeded but returned no token.`);
    }

    return session as ApicalSession;
  }

  static async getToken(
    request: APIRequestContext,
    role: ApicalRole,
  ): Promise<string> {
    return (await ApicalAuthService.getSession(request, role)).token;
  }
}
