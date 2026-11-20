import { describe, expect, it } from "vitest";
import { parseCsv } from "../../../lib/csv";

describe("parseCsv", () => {
  it("preserves embedded commas, line breaks, quotes and trailing fields", () => {
    expect(
      parseCsv(
        '\uFEFFName,Notes,Phone\r\n\r\n"River, Alex","Line one\r\nSaid ""hi""",\r\n',
      ),
    ).toEqual([
      ["Name", "Notes", "Phone"],
      ["River, Alex", 'Line one\r\nSaid "hi"', ""],
    ]);
  });

  it("rejects an incomplete quoted field", () => {
    expect(() => parseCsv('Name\n"Alex')).toThrow(/unclosed quoted field/);
  });
});
