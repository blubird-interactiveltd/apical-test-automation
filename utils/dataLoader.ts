import fs from "node:fs";
import path from "node:path";

export class DataLoader {
  private static cache = new Map<string, unknown>();

  static load<T>(fileName: string): T {
    const filePath = path.resolve(process.cwd(), fileName);

    if (DataLoader.cache.has(filePath)) {
      return DataLoader.cache.get(filePath) as T;
    }

    if (!fs.existsSync(filePath)) {
      throw new Error(`Data file not found: ${filePath}`);
    }

    try {
      const rawData = fs.readFileSync(filePath, "utf-8");
      const parsedData = JSON.parse(rawData) as T;
      DataLoader.cache.set(filePath, parsedData);
      return parsedData;
    } catch (error) {
      throw new Error(
        `Failed to parse JSON file: ${filePath}\nError: ${error}`,
      );
    }
  }
}
