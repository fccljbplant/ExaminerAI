import { describe, expect, it } from "vitest";
import { CsvParseError, parseCsv, parseMemberRows } from "../csv-parse";

describe("parseCsv", () => {
  it("parses simple comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  it("handles quoted fields containing commas", () => {
    expect(parseCsv('"Doe, Jane",member,true')).toEqual([["Doe, Jane", "member", "true"]]);
  });

  it("handles quoted fields containing newlines", () => {
    expect(parseCsv('"line one\nline two",x')).toEqual([["line one\nline two", "x"]]);
  });

  it("handles escaped double quotes inside quoted fields", () => {
    expect(parseCsv('"She said ""hi""",x')).toEqual([['She said "hi"', "x"]]);
  });

  it("handles CRLF line endings", () => {
    expect(parseCsv("a,b\r\n1,2\r\n")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("keeps the trailing row without a final newline", () => {
    expect(parseCsv("a,b\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(parseCsv("")).toEqual([]);
    expect(parseCsv("   ")).toEqual([["   "]]);
  });

  it("handles rows with ragged column counts", () => {
    expect(parseCsv("a,b,c\n1\n2,3,4,5")).toEqual([
      ["a", "b", "c"],
      ["1"],
      ["2", "3", "4", "5"],
    ]);
  });
});

describe("parseMemberRows", () => {
  it("maps headers in any order and skips blank rows", () => {
    const csv = ["email,role,seat,department", "a@x.com,admin,true,Engineering", "", "b@x.com,member,no,Sales"].join("\n");
    expect(parseMemberRows(csv)).toEqual([
      { email: "a@x.com", role: "admin", seat: true, department: "Engineering" },
      { email: "b@x.com", role: "member", seat: false, department: "Sales" },
    ]);
  });

  it("defaults role to member when missing or unknown", () => {
    const csv = ["email,seat", "a@x.com,yes", "b@x.com,false"].join("\n");
    expect(parseMemberRows(csv)).toEqual([
      { email: "a@x.com", role: "member", seat: true, department: undefined },
      { email: "b@x.com", role: "member", seat: false, department: undefined },
    ]);
    const withBadRole = ["email,role", "a@x.com,supervisor"].join("\n");
    expect(parseMemberRows(withBadRole)[0].role).toBe("member");
  });

  it("normalizes role casing and header casing", () => {
    const csv = ["EMAIL,Role,SEAT", "a@x.com,ADMIN,TRUE"].join("\n");
    expect(parseMemberRows(csv)).toEqual([
      { email: "a@x.com", role: "admin", seat: true, department: undefined },
    ]);
  });

  it("accepts 1 as a truthy seat value", () => {
    const csv = ["email,seat", "a@x.com,1"].join("\n");
    expect(parseMemberRows(csv)[0].seat).toBe(true);
  });

  it("parses quoted emails with embedded commas and newlines", () => {
    const csv = ['email,department\n"doe, jane@x.com","S,\\nR&D"'].join("\n");
    // Note: "S,\\nR&D" is a literal backslash-n in this fixture; quoted
    // newlines are covered by the raw parseCsv test above.
    const rows = parseMemberRows(csv);
    expect(rows[0].email).toBe("doe, jane@x.com");
    expect(rows[0].department).toBe("S,\\nR&D");
  });

  it("throws a CsvParseError when the email column is missing", () => {
    expect(() => parseMemberRows("name,role\nJane,member")).toThrow(CsvParseError);
  });

  it("returns an empty list for a header-only CSV", () => {
    expect(parseMemberRows("email,role,seat,department")).toEqual([]);
  });
});
