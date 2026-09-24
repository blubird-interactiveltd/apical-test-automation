import fs from "node:fs";
import path from "node:path";
import { DataLoader } from "./dataLoader";

const API_DIR = path.join("fixtures", "api");

/**
 * Resolves committed test fixtures.
 *
 * `fixtures/api/` holds recorded API responses used as stub bodies. They differ
 * from `data/`: a data file describes a scenario and its expected outcome, a
 * fixture is the raw payload the application is fed.
 */
export class Fixtures {
  /**
   * Loads one recorded API response as a fresh copy.
   *
   * Cloned because DataLoader caches by path, and a spec that overrides a field
   * on the cached object would change the fixture for every spec after it.
   */
  static api<T>(fileName: string): T {
    const filePath = path.join(API_DIR, fileName);

    if (!fs.existsSync(path.resolve(process.cwd(), filePath))) {
      throw new Error(`API fixture not found: ${filePath}`);
    }

    return structuredClone(DataLoader.load<T>(filePath));
  }
}
