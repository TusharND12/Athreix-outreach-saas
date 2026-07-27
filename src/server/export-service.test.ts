import { describe, expect, it } from "vitest";
import {
  excelColumnName,
  explicitNullForMissingValue,
  exportColumns,
  neutralizeSpreadsheetFormula,
} from "@/server/export-service";
import { LEAD_COLUMN_KEYS } from "@/lib/leads/columns";

describe("export safety", () => {
  it.each(["=1+1", "+SUM(A1:A2)", "-2+3", "@IMPORTXML(A1)", "  =cmd"])(
    "neutralizes spreadsheet formula input %s",
    (value) => {
      expect(neutralizeSpreadsheetFormula(value)).toBe(`'${value}`);
    },
  );

  it("leaves ordinary values and non-string values unchanged", () => {
    expect(neutralizeSpreadsheetFormula("Acme + Co")).toBe("Acme + Co");
    expect(neutralizeSpreadsheetFormula(42)).toBe(42);
  });

  it("keeps missing export columns explicit", () => {
    expect(explicitNullForMissingValue(undefined)).toBeNull();
    expect(explicitNullForMissingValue(null)).toBeNull();
    expect(explicitNullForMissingValue("")).toBeNull();
    expect(explicitNullForMissingValue(0)).toBe(0);
  });

  it("includes only explicitly selected export groups", () => {
    expect(exportColumns(["PROFILE", "AI_ANALYSIS"])).toEqual([
      "name",
      "subjectType",
      "title",
      "location",
      "score",
      "buyingIntent",
      "summary",
    ]);
    expect(exportColumns(["CONTACT"])).toEqual(["email", "phone", "linkedin"]);
  });

  it("exports the exact 36-field Leads Finder schema", () => {
    expect(exportColumns(["LEAD_DATA"])).toEqual(LEAD_COLUMN_KEYS);
    expect(exportColumns(["LEAD_DATA"])).toHaveLength(36);
  });

  it("supports Excel auto-filters beyond column Z", () => {
    expect(excelColumnName(26)).toBe("Z");
    expect(excelColumnName(27)).toBe("AA");
    expect(excelColumnName(52)).toBe("AZ");
  });
});
