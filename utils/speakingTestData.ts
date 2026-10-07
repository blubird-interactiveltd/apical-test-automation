import { DataLoader } from "./dataLoader";
import type {
  SpeakingCreateEdgeTestData,
  SpeakingCreateTestData,
  SpeakingCreateType,
} from "./types/speaking/speakingCreateData.types";
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

export const speakingCreateData = (): SpeakingCreateTestData =>
  DataLoader.load<SpeakingCreateTestData>(
    "data/regular/speaking/speakingCreateRegularTestData.json",
  );

export const speakingCreateEdgeData = (): SpeakingCreateEdgeTestData =>
  DataLoader.load<SpeakingCreateEdgeTestData>(
    "data/edge/speaking/speakingCreateEdgeTestData.json",
  );

/** One Speaking type from the data file by code. Throws on an unknown code. */
export function speakingType(code: SpeakingTypeCode): SpeakingTypeData {
  const found = speakingListData().types.find((type) => type.code === code);

  if (!found) {
    throw new Error(`No Speaking type "${code}" in the test data.`);
  }

  return found;
}

/** One Speaking type as the create suite describes it. Throws on an unknown code. */
export function createType(code: SpeakingTypeCode): SpeakingCreateType {
  const found = speakingCreateData().types.find((type) => type.code === code);

  if (!found) {
    throw new Error(`No Speaking type "${code}" in the create test data.`);
  }

  return found;
}
