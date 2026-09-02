// @vitest-environment jsdom

import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import TechCategoryRail from "./TechCategoryRail";

afterEach(cleanup);

describe("TechCategoryRail", () => {
  it("renders real categories as RTL keyboard-focusable actions", () => {
    const onSelectCategory = vi.fn();
    const view = render(
      <div dir="rtl">
        <TechCategoryRail categories={["إلكترونيات", "المنزل", "الألعاب"]} onSelectCategory={onSelectCategory} />
      </div>,
    );

    const rail = view.container.querySelector("[data-tech-category-rail]");
    expect(rail?.closest('[dir="rtl"]')).not.toBeNull();
    expect(withinRoles(view.container, "listitem")).toHaveLength(3);
    const categoryButton = screen.getByRole("button", { name: "المنزل" });
    categoryButton.focus();
    expect(document.activeElement).toBe(categoryButton);
    fireEvent.click(categoryButton);
    expect(onSelectCategory).toHaveBeenCalledWith("المنزل");
  });

  it("shows a truthful empty state without placeholder categories", () => {
    const view = render(<TechCategoryRail categories={[]} onSelectCategory={vi.fn()} />);
    expect(screen.getByText("لا توجد تصنيفات منشورة حاليًا.")).toBeTruthy();
    expect(view.container.querySelectorAll('[role="listitem"]')).toHaveLength(0);
  });

  it("keeps desktop placement, mobile horizontal flow, focus and reduced-motion rules", () => {
    const techBentoCss = readFileSync("src/features/storefront/tech-bento/techBento.css", "utf8");
    expect(techBentoCss).toContain('grid-template-areas: "categories showcase ads"');
    expect(techBentoCss).toContain('@media (max-width: 1199px)');
    expect(techBentoCss).toContain('grid-template-areas: "categories" "showcase" "ads"');
    expect(techBentoCss).toContain("grid-auto-flow: column");
    expect(techBentoCss).toContain(".tech-category-rail__item > button:focus-visible");
    expect(techBentoCss).toContain("@media (prefers-reduced-motion: reduce)");
  });
});

function withinRoles(container: HTMLElement, role: string): Element[] {
  return Array.from(container.querySelectorAll(`[role="${role}"]`));
}
