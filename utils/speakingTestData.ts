import { DataLoader } from "./dataLoader";
import type {
  SpeakingListEdgeTestData,
  SpeakingListTestData,
  SpeakingTypeData,
} from "./types/speaking/speakingListData.types";
import type { SpeakingTypeCode } from "./types/speaking/speakingList.types";

export const speakingListData = (): SpeakingListTestData =>
  DataLoader.load<SpeakingListTestData>(
    "data/regular/speaking/speakingListRegularTestData.json",
  );

export const speakingListEdgeData = (): SpeakingListEdgeTestData =>
  DataLoader.load<SpeakingListEdgeTestData>(
    "data/edge/speaking/speakingListEdgeTestData.json",
  );

/** One Speaking type from the data file by code. Throws on an unknown code. */
export function speakingType(code: SpeakingTypeCode): SpeakingTypeData {
  const found = speakingListData().types.find((type) => type.code === code);

  if (!found) {
    throw new Error(`No Speaking type "${code}" in the test data.`);
  }

  return found;
}
