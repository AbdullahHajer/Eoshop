// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontMarketingBlock } from "../../contracts/storefrontMarketingBlocks";
import { ELEGANT_PRESET } from "../../types";
import MerchantTechBentoBlocksEditor from "./MerchantTechBentoBlocksEditor";

afterEach(cleanup);

function block(
  id: string,
  placement: StorefrontMarketingBlock["placement"],
  title: string,
  position = 1,
): StorefrontMarketingBlock {
  return {
    id,
    placement,
    position,
    enabled: true,
    contentType: "campaign",
    title,
    ctaLabel: "استكشف",
    imageUrl: `/api/store-assets/tenant-a/${id}`,
    altText: `صورة ${title}`,
    backgroundColor: "#1473E6",
    textColor: "#FFFFFF",
    targetType: "products",
    disclosure: "none",
  };
}

const heroOne = block("00000000-0000-4000-8000-000000000001", "hero_bento", "تقنية اليوم");
const heroTwo = block("00000000-0000-4000-8000-000000000002", "hero_bento", "المنزل الذكي", 2);
const sideAd = block("00000000-0000-4000-8000-000000000003", "side_ad", "إعلان الألعاب");
const discovery = block("00000000-0000-4000-8000-000000000004", "discovery", "سماعات");
const elegantStory = block("00000000-0000-4000-8000-000000000005", "editorial_story", "قصة Elegant");

function renderEditor(overrides: Partial<React.ComponentProps<typeof MerchantTechBentoBlocksEditor>> = {}) {
  const props: React.ComponentProps<typeof MerchantTechBentoBlocksEditor> = {
    config: {
      ...ELEGANT_PRESET,
      themeStyle: "tech",
      marketingBlocks: [heroOne, sideAd, discovery, elegantStory],
    },
    activeTenantId: "tenant-a",
    mediaOwnerKey: "account-a",
    onChange: vi.fn(),
    uploadAsset: vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000099",
      url: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000099",
      mimeType: "image/webp" as const,
      byteSize: 128,
    })),
    ...overrides,
  };

  return { ...render(<MerchantTechBentoBlocksEditor {...props} />), props };
}

describe("MerchantTechBentoBlocksEditor", () => {
  it("exposes every Tech placement while retaining Elegant blocks outside the editor", () => {
    renderEditor();

    expect(screen.getByRole("heading", { name: "مساحات Tech Bento" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "مربعات Bento الرئيسية" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "الإعلانات الجانبية" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "دوائر الاكتشاف" })).toBeTruthy();
    expect(screen.getByText("تقنية اليوم")).toBeTruthy();
    expect(screen.queryByText("قصة Elegant")).toBeNull();
  });

  it("edits a Bento block and preserves the other Tech and Elegant placements", () => {
    const onChange = vi.fn();
    renderEditor({ onChange });

    fireEvent.change(screen.getByDisplayValue("تقنية اليوم"), { target: { value: "اكتشف المستقبل" } });

    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      sideAd,
      discovery,
      elegantStory,
      expect.objectContaining({ id: heroOne.id, placement: "hero_bento", position: 1, title: "اكتشف المستقبل" }),
    ]);
  });

  it("keeps positions contiguous when a Bento block is reordered", () => {
    const onChange = vi.fn();
    renderEditor({
      config: {
        ...ELEGANT_PRESET,
        themeStyle: "tech",
        marketingBlocks: [heroOne, heroTwo, elegantStory],
      },
      onChange,
    });

    fireEvent.click(screen.getByRole("button", { name: "نقل تقنية اليوم للأسفل" }));

    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      elegantStory,
      expect.objectContaining({ id: heroTwo.id, position: 1 }),
      expect.objectContaining({ id: heroOne.id, position: 2 }),
    ]);
  });

  it("enforces the two-ad limit and uploads only into the selected managed slot", async () => {
    const secondAd = block("00000000-0000-4000-8000-000000000006", "side_ad", "إعلان الأناقة", 2);
    const onChange = vi.fn();
    const uploadAsset = vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000099",
      url: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000099",
      mimeType: "image/webp" as const,
      byteSize: 128,
    }));
    const view = renderEditor({
      config: {
        ...ELEGANT_PRESET,
        themeStyle: "tech",
        marketingBlocks: [sideAd, secondAd, elegantStory],
      },
      onChange,
      uploadAsset,
    });
    const adsSection = screen.getByRole("heading", { name: "الإعلانات الجانبية" }).closest("section");
    expect(adsSection).not.toBeNull();
    expect(within(adsSection as HTMLElement).getByRole("button", { name: "إضافة" })).toHaveProperty("disabled", true);

    const files = view.container.querySelectorAll<HTMLInputElement>('input[type="file"]');
    fireEvent.change(files[0], {
      target: { files: [new File(["image"], "ad.webp", { type: "image/webp" })] },
    });

    await waitFor(() => expect(uploadAsset).toHaveBeenCalledWith("tenant-a", expect.any(File), expect.any(AbortSignal)));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      elegantStory,
      expect.objectContaining({ id: sideAd.id, imageUrl: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000099" }),
      secondAd,
    ]));
  });

  it("does not expose Tech controls while another theme is selected", () => {
    renderEditor({ config: { ...ELEGANT_PRESET, themeStyle: "elegant", marketingBlocks: [heroOne] } });

    expect(screen.getByText(/محتوى Tech Bento محفوظ ولن يُحذف/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "إضافة" })).toBeNull();
  });
});
