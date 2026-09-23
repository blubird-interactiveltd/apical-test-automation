import { ConfigLoader } from "../utils/configLoader";
import type { TimeoutConfig } from "../utils/types/timeouts.types";

const timeouts = ConfigLoader.load<TimeoutConfig>("config/timeouts.json");

if (!timeouts) {
  throw new Error("Timeout configuration is missing.");
}

export { timeouts };
