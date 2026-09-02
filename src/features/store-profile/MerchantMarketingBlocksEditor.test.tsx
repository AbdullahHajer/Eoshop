// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StorefrontMarketingBlock } from "../../contracts/storefrontMarketingBlocks";
import { ELEGANT_PRESET } from "../../types";
import MerchantMarketingBlocksEditor from "./MerchantMarketingBlocksEditor";

afterEach(cleanup);

const techBlock: StorefrontMarketingBlock = {
  id: "00000000-0000-4000-8000-000000000001",
  placement: "hero_bento",
  position: 1,
  enabled: true,
  contentType: "campaign",
  title: "مساحة Tech",
  ctaLabel: "اكتشف",
  imageUrl: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000011",
  altText: "صورة مساحة Tech",
  targetType: "products",
  disclosure: "none",
};

const storyBlock: StorefrontMarketingBlock = {
  ...techBlock,
  id: "00000000-0000-4000-8000-000000000002",
  placement: "editorial_story",
  title: "قصة الموسم",
  imageUrl: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000012",
  altText: "صورة قصة الموسم",
};

function renderEditor(overrides: Partial<React.ComponentProps<typeof MerchantMarketingBlocksEditor>> = {}) {
  const props: React.ComponentProps<typeof MerchantMarketingBlocksEditor> = {
    config: { ...ELEGANT_PRESET, marketingBlocks: [techBlock] },
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
  return { ...render(<MerchantMarketingBlocksEditor {...props} />), props };
}

describe("MerchantMarketingBlocksEditor", () => {
  it("adds a disabled Elegant story without deleting another theme placement", () => {
    const onChange = vi.fn();
    renderEditor({ onChange });
    fireEvent.click(screen.getAllByRole("button", { name: /إضافة/ })[0]);

    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      techBlock,
      expect.objectContaining({ placement: "editorial_story", position: 1, enabled: false, targetType: "products" }),
    ]);
  });

  it("edits a story target through published catalog values and preserves contiguous order", () => {
    const onChange = vi.fn();
    renderEditor({
      config: { ...ELEGANT_PRESET, marketingBlocks: [techBlock, storyBlock] },
      onChange,
    });

    fireEvent.change(screen.getByDisplayValue("قصة الموسم"), { target: { value: "إطلاق جديد" } });
    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      techBlock,
      expect.objectContaining({ id: storyBlock.id, title: "إطلاق جديد", placement: "editorial_story", position: 1 }),
    ]);

    fireEvent.change(screen.getByDisplayValue("كل المنتجات"), { target: { value: "category" } });
    expect(onChange).toHaveBeenLastCalledWith("marketingBlocks", [
      techBlock,
      expect.objectContaining({ id: storyBlock.id, targetType: "category", targetValue: "" }),
    ]);
  });

  it("uploads a bounded managed story image and binds only its slot", async () => {
    const onChange = vi.fn();
    const uploadAsset = vi.fn(async () => ({
      id: "00000000-0000-4000-8000-000000000099",
      url: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000099",
      mimeType: "image/webp" as const,
      byteSize: 128,
    }));
    const view = renderEditor({ config: { ...ELEGANT_PRESET, marketingBlocks: [storyBlock] }, onChange, uploadAsset });
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "story.webp", { type: "image/webp" })] },
    });

    await waitFor(() => expect(uploadAsset).toHaveBeenCalledWith("tenant-a", expect.any(File), expect.any(AbortSignal)));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      expect.objectContaining({ id: storyBlock.id, imageUrl: "/api/store-assets/tenant-a/00000000-0000-4000-8000-000000000099" }),
    ]));
  });

  it("edits independent story colors and previews unsafe fallback contrast", () => {
    const onChange = vi.fn();
    const coloredStory = { ...storyBlock, backgroundColor: "#FFFFFF", textColor: "#FFFFFF" };
    renderEditor({ config: { ...ELEGANT_PRESET, marketingBlocks: [coloredStory] }, onChange });

    const preview = screen.getByTestId(`marketing-appearance-preview-${coloredStory.id}`);
    expect(preview.getAttribute("style")).toContain("background-color: rgb(255, 255, 255)");
    expect(screen.getByText(/تباين اللون الاحتياطي: 1.00:1/)).toBeTruthy();
    expect(screen.getByText(/يحتاج لونًا أوضح/)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("لون الخلفية قصة الموسم"), { target: { value: "#112233" } });
    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      expect.objectContaining({ id: coloredStory.id, backgroundColor: "#112233" }),
    ]);

    fireEvent.click(screen.getByRole("button", { name: "اختيار لون نص تلقائي" }));
    expect(onChange).toHaveBeenLastCalledWith("marketingBlocks", [
      expect.objectContaining({ id: coloredStory.id, textColor: "#000000" }),
    ]);
  });

  it("retains Elegant content while the Tech theme is selected", () => {
    renderEditor({ config: { ...ELEGANT_PRESET, themeStyle: "tech", marketingBlocks: [storyBlock] } });
    expect(screen.getByText(/محتوى Elegant محفوظ ولن يُحذف/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /إضافة/ })).toBeNull();
  });
});
