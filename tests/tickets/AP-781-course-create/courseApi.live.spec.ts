import { expect, test } from "@playwright/test";
import { ApicalAuthService } from "../../../services/auth/apicalAuth.service";
import { CourseApiService } from "../../../services/course/courseApi.service";
import { DataLoader } from "../../../utils/dataLoader";
import type {
  CourseCreateInfo,
  CreatePackageResponse,
} from "../../../utils/types/course/course.types";
import type {
  CourseApiEdgeTestData,
  CourseApiTestData,
} from "../../../utils/types/course/courseWizard.types";

const data = DataLoader.load<CourseApiTestData>(
  "data/regular/course/courseApiRegularTestData.json",
);
const edge = DataLoader.load<CourseApiEdgeTestData>(
  "data/edge/course/courseApiEdgeTestData.json",
);

/** A fresh copy of the base payload, optionally with fields replaced. */
const payload = (overrides: CourseCreateInfo = {}): CourseCreateInfo => ({
  ...structuredClone(data.payload),
  ...overrides,
});

/** The payload with the field at `path` removed. */
function without(path: string[]): CourseCreateInfo {
  const body = payload() as Record<string, unknown>;
  const parents = path.slice(0, -1);
  const leaf = path.at(-1) ?? "";
  let node = body;
  for (const key of parents) node = node[key] as Record<string, unknown>;
  delete node[leaf];
  return body as CourseCreateInfo;
}

// Real backend. Unlike the AP-779 live checks these write: every course a
// case creates is registered in `created` and deleted after the test.
test.skip(
  process.env.RUN_LIVE !== "1",
  "Set RUN_LIVE=1 to run live backend checks.",
);
test.skip(
  ({ browserName }) => browserName !== "chromium",
  "API checks do not depend on a browser; one project is enough.",
);

test.describe("AP-781 packages API", () => {
  let token = "";
  const created: string[] = [];

  test.beforeEach(async ({ request }) => {
    token = await ApicalAuthService.getToken(request, "master");
  });

  test.afterEach(async ({ request }) => {
    for (const id of created.splice(0)) {
      await CourseApiService.remove(request, token, id);
    }
  });

  /** Creates a course, registers it for deletion, and returns its id. */
  const create = async (
    request: Parameters<typeof CourseApiService.create>[0],
    body: CourseCreateInfo,
  ) => {
    const response = await CourseApiService.create(request, token, body);
    const json = (await response
      .json()
      .catch(() => ({}))) as Partial<CreatePackageResponse>;
    if (json.package_id) created.push(json.package_id);
    return { response, json };
  };

  test("a valid payload creates a course (AP-781-TC-049)", async ({
    request,
  }) => {
    const { response, json } = await create(request, payload());

    expect(response.ok(), await response.text()).toBe(true);
    expect(json.package_id).toEqual(expect.any(String));
    expect(json.message).toEqual(expect.any(String));
  });

  for (const scenario of edge.missingFields) {
    test(`create ${scenario.scenario} is refused with 422 (${scenario.id})`, async ({
      request,
    }) => {
      const { response } = await create(request, without(scenario.path));

      expect(response.status()).toBe(422);
    });
  }

  test("create without a token is refused with 401 (AP-781-TC-051)", async ({
    request,
  }) => {
    const response = await CourseApiService.create(request, null, payload());

    expect(response.status()).toBe(401);
  });

  test("create as a student is refused (AP-781-TC-052)", () => {
    // ApicalRole has no student account yet; add STUDENT_* to .env.example and
    // the role map to run it.
    test.fixme(true, "Needs a student account.");
  });

  test("an update replaces the thumbnail (AP-781-TC-053)", async ({
    request,
  }) => {
    const { json } = await create(request, payload());
    const id = json.package_id ?? "";

    const update = await CourseApiService.update(
      request,
      token,
      id,
      payload({ thumbnail: data.updatedThumbnail }),
    );
    expect(update.ok(), await update.text()).toBe(true);

    const fetched = await CourseApiService.fetch(request, token, id);
    const body = (await fetched.json()) as { items: CourseCreateInfo };
    expect(body.items.thumbnail).toBe(data.updatedThumbnail);
  });

  test("updating a course that does not exist answers 404 (AP-781-TC-054)", async ({
    request,
  }) => {
    const response = await CourseApiService.update(
      request,
      token,
      edge.unknownPackageId,
      payload(),
    );

    expect(response.status()).toBe(404);
  });

  test("the saved course matches the payload (AP-781-TC-055)", async ({
    request,
  }) => {
    const body = payload();
    const { json } = await create(request, body);

    const fetched = await CourseApiService.fetch(
      request,
      token,
      json.package_id ?? "",
    );
    const saved = ((await fetched.json()) as { items: CourseCreateInfo }).items;

    expect(saved).toMatchObject({
      name: body.name,
      course_type: body.course_type,
      online_link: body.online_link,
    });
    // Compared as strings: the API may return the numbers it was sent as text.
    const detail = body.package_detail ?? {};
    expect(String(saved.package_detail?.course_duration)).toBe(
      String(detail.course_duration),
    );
    expect(String(saved.package_detail?.new_price)).toBe(
      String(detail.new_price),
    );
    expect(String(saved.package_detail?.old_price)).toBe(
      String(detail.old_price),
    );
  });

  test("markup in the description is stored without script (AP-781-TC-056b)", async ({
    request,
  }) => {
    const { json } = await create(
      request,
      payload({ description: edge.scriptDescription }),
    );

    const fetched = await CourseApiService.fetch(
      request,
      token,
      json.package_id ?? "",
    );
    const saved = ((await fetched.json()) as { items: CourseCreateInfo }).items;

    expect(saved.description ?? "").not.toMatch(/onerror/i);
  });

  test("another organisation's id is not accepted (AP-781-TC-057)", async ({
    request,
  }) => {
    const { response, json } = await create(
      request,
      payload({
        organization_id: edge.foreignOrganizationId,
        organizations: [edge.foreignOrganizationId],
      }),
    );

    if (!response.ok()) {
      expect([403, 422]).toContain(response.status());
      return;
    }
    const fetched = await CourseApiService.fetch(
      request,
      token,
      json.package_id ?? "",
    );
    const saved = ((await fetched.json()) as { items: CourseCreateInfo }).items;
    expect(saved.organization_id).not.toBe(edge.foreignOrganizationId);
  });
});
