export interface PaginationStep {
  action: "next" | "prev";
  expectFirstTitle: string;
  expectRows: number;
}

/** Contents of data/regular/onlineClass/onlineClassPaginationRegularTestData.json. */
export interface OnlineClassPaginationTestData {
  type: string;
  singlePage: { id: string; expectedLabel: string; finding: string };
  multiPage: {
    id: string;
    totalClasses: number;
    perPage: number;
    titlePrefix: string;
    steps: PaginationStep[];
    finding: string;
  };
  searchResetsPage: { id: string; term: string };
  searchKeptWhenPaging: { id: string; term: string };
}
