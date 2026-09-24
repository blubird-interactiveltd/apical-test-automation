import { DataLoader } from "./dataLoader";

export class ConfigLoader {
  static load<T>(fileName: string): T {
    return DataLoader.load<T>(fileName);
  }
}
