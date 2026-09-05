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

const discoveryBlock: StorefrontMarketingBlock = {
  ...storyBlock,
  id: "00000000-0000-4000-8000-000000000003",
  placement: "discovery",
  title: "مختار مشترك",
  subtitle: "وصف لا يعرضه شريط الاكتشاف",
  ctaLabel: "زر لا يعرضه شريط الاكتشاف",
  badge: "مميز",
  backgroundColor: "#112233",
  textColor: "#FFFFFF",
  overlayOpacity: 70,
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
      expect.objectContaining({ id: storyBlock.id, targetType: "category", targetValue: "", contentType: "category" }),
    ]);
  });

  it.each([
    ["products", "campaign", "category"],
    ["category", "category", "products"],
    ["product", "product", "products"],
    ["external", "campaign", "products"],
  ] as const)("normalizes %s targets to the matching content type", (targetType, contentType, initialTargetType) => {
    const onChange = vi.fn();
    const initialBlock: StorefrontMarketingBlock = {
      ...storyBlock,
      targetType: initialTargetType,
      targetValue: initialTargetType === "products" ? undefined : "تصنيف قديم",
      contentType: "campaign",
      disclosure: "none",
    };
    renderEditor({ config: { ...ELEGANT_PRESET, marketingBlocks: [techBlock, initialBlock] }, onChange });

    fireEvent.change(screen.getByLabelText("الهدف"), { target: { value: targetType } });

    expect(onChange).toHaveBeenCalledWith("marketingBlocks", [
      techBlock,
      expect.objectContaining({
        id: storyBlock.id,
        targetType,
        targetValue: targetType === "products" ? undefined : "",
        contentType,
        disclosure: targetType === "external" ? "sponsored" : "none",
      }),
    ]);
  });

  it("prevents an external target from using a missing disclosure", () => {
    renderEditor({
      config: {
        ...ELEGANT_PRESET,
        marketingBlocks: [{ ...storyBlock, targetType: "external", targetValue: "https://example.test", contentType: "campaign", disclosure: "sponsored" }],
      },
    });

    const disclosure = screen.getByLabelText("الإفصاح") as HTMLSelectElement;
    expect((disclosure.querySelector('option[value="none"]') as HTMLOptionElement).disabled).toBe(true);
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

  it("keeps upload controls disabled until both tenant and media ownership are known", () => {
    const uploadAsset = vi.fn();
    renderEditor({
      config: { ...ELEGANT_PRESET, marketingBlocks: [storyBlock] },
      mediaOwnerKey: null,
      uploadAsset,
    });

    expect((screen.getByLabelText("رفع الصورة الأساسية") as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText("رفع صورة الجوال") as HTMLInputElement).disabled).toBe(true);
    expect(uploadAsset).not.toHaveBeenCalled();
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

  it("describes Discovery as shared image-led content and only exposes controls consumed by its renderers", () => {
    renderEditor({ config: { ...ELEGANT_PRESET, marketingBlocks: [discoveryBlock] } });

    expect(screen.getByText(/شريط صور مشترك بين Elegant وTech Bento/)).toBeTruthy();
    expect(screen.getByDisplayValue("مختار مشترك")).toBeTruthy();
    expect(screen.getByLabelText("وصف الصورة لذوي الإعاقة")).toBeTruthy();
    expect(screen.getByLabelText("الهدف")).toBeTruthy();
    expect(screen.getByText("الشارة")).toBeTruthy();
    expect(screen.getByText(/موضع أفقي:/)).toBeTruthy();
    expect(screen.queryByText("نص الزر")).toBeNull();
    expect(screen.queryByText("الوصف المساند")).toBeNull();
    expect(screen.queryByLabelText("ألوان ومعاينة مختار مشترك")).toBeNull();
    expect(screen.queryByText(/التعتيم:/)).toBeNull();
  });
});
