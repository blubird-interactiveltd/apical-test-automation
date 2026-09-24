import * as dotenv from "dotenv";

dotenv.config();

export class EnvLoader {
  static get(key: string): string {
    const value = process.env[key];

    if (!value) {
      throw new Error(`Environment variable "${key}" is not defined.`);
    }

    return value;
  }

  static getNumber(key: string): number {
    const value = EnvLoader.get(key);
    const parsed = Number(value);

    if (Number.isNaN(parsed)) {
      throw new Error(`Environment variable "${key}" must be a number.`);
    }

    return parsed;
  }
}
