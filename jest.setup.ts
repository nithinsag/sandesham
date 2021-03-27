jest.mock("./src/asyncJobs", () => ({
  __esModule: true, // this property makes it work
  default: "mockedDefaultExport",
  addJobs: jest.fn(),
}));
