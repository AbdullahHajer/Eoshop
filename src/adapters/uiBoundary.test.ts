import { readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sourceRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function componentSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return componentSources(path);
    if (![".ts", ".tsx"].includes(extname(entry.name)) || entry.name.includes(".test.")) return [];
    return [path];
  });
}

describe("UI adapter architecture boundary", () => {
  it("keeps App and screen components behind the adapter layer", () => {
    const sources = [
      join(sourceRoot, "App.tsx"),
      ...componentSources(join(sourceRoot, "app")),
      ...componentSources(join(sourceRoot, "components")),
      ...componentSources(join(sourceRoot, "features")),
      ...componentSources(join(sourceRoot, "workflows")),
    ];
    const violations = sources.flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const importsService = /from\s+["'][^"']*services\//.test(source);
      const callsFetch = /\bfetch\s*\(/.test(source);
      return importsService || callsFetch ? [path.slice(sourceRoot.length + 1)] : [];
    });

    expect(violations).toEqual([]);
  });

  it("keeps extracted feature panels dependent on leaf props rather than the coordinator or adapters", () => {
    const violations = componentSources(join(sourceRoot, "features")).flatMap((path) => {
      const source = readFileSync(path, "utf8");
      const importsAdapterContext = /UiAdaptersContext|\buseUiAdapters\b/.test(source);
      const importsCoordinator = /from\s+["'][^"']*components\/ControlPanel["']/.test(source);
      return importsAdapterContext || importsCoordinator ? [path.slice(sourceRoot.length + 1)] : [];
    });

    expect(violations).toEqual([]);
  });
});
