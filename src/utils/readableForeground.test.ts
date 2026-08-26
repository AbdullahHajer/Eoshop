import { describe, expect, it } from "vitest";
import { contrastRatio, readableAccent, readableForeground } from "./readableForeground";

describe("readableForeground", () => {
  it("chooses the strongest black or white foreground", () => {
    expect(readableForeground("#facc15")).toBe("#000000");
    expect(readableForeground("#fff")).toBe("#000000");
    expect(readableForeground("#0f172a")).toBe("#FFFFFF");
    expect(readableForeground("not-a-color")).toBe("#FFFFFF");
  });

  it.each(["#7c7c7c", "#facc15", "#38bdf8", "#ffffff", "#111827"])("guarantees AA foreground contrast for %s", (background) => {
    expect(contrastRatio(readableForeground(background), background)).toBeGreaterThanOrEqual(4.5);
  });

  it("preserves a readable accent and adjusts light or midtone accent text", () => {
    expect(readableAccent("#0369a1", "#ffffff")).toBe("#0369A1");
    expect(contrastRatio(readableAccent("#facc15", "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(readableAccent("#7c7c7c", "#ffffff"), "#ffffff")).toBeGreaterThanOrEqual(4.5);
  });
});
