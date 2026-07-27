import { describe, expect, it } from "vitest";
import {
  displayLeadValue,
  isMaskedContactValue,
  LEAD_COLUMN_GROUPS,
  LEAD_COLUMN_KEYS,
} from "@/lib/leads/columns";

describe("lead column presentation", () => {
  it("shows every missing value explicitly as null", () => {
    expect(displayLeadValue(undefined)).toBe("null");
    expect(displayLeadValue(null)).toBe("null");
    expect(displayLeadValue("")).toBe("null");
    expect(displayLeadValue(0)).toBe("0");
    expect(displayLeadValue("founder@example.com")).toBe("founder@example.com");
  });

  it("recognizes masked contact tokens without hiding full emails", () => {
    expect(isMaskedContactValue("fo••••@example.com")).toBe(true);
    expect(isMaskedContactValue("fo\u00e2\u0080\u00a2@example.com")).toBe(true);
    expect(isMaskedContactValue("f****r@example.com")).toBe(true);
    expect(isMaskedContactValue("founder@example.com")).toBe(false);
  });

  it("groups all 36 columns exactly once", () => {
    const groupedKeys = LEAD_COLUMN_GROUPS.flatMap((group) => [...group.keys]);
    expect(groupedKeys).toHaveLength(36);
    expect(new Set(groupedKeys).size).toBe(36);
    expect(new Set(groupedKeys)).toEqual(new Set(LEAD_COLUMN_KEYS));
  });
});
