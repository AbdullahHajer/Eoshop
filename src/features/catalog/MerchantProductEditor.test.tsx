// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import { ELEGANT_PRESET, type Product } from "../../types";
import MerchantProductEditor from "./MerchantProductEditor";

afterEach(cleanup);

const persistedProduct: Product = {
  ...ELEGANT_PRESET.products[0],
  id: "11111111-1111-4111-8111-111111111111",
  name: "منتج محفوظ",
  status: "published",
  basePrice: 100,
  salePrice: null,
  price: 100,
};

const draftProduct: Product = {
  ...ELEGANT_PRESET.products[1],
  id: "draft:22222222-2222-4222-8222-222222222222",
  name: "منتج مسودة",
  status: "draft",
};

function renderEditor(overrides: Partial<React.ComponentProps<typeof MerchantProductEditor>> = {}) {
  const props: React.ComponentProps<typeof MerchantProductEditor> = {
    products: [persistedProduct, draftProduct],
    currency: "YER",
    activeTenantId: "tenant-a",
    mediaOwnerKey: "account-a",
    canViewInventory: false,
    onProductChange: vi.fn(),
    onProductMediaChange: vi.fn(),
    uploadMedia: createFakeUiAdapters().catalog.uploadMedia,
    onAddProduct: vi.fn(),
    onArchiveProduct: vi.fn(),
    ...overrides,
  };
  const view = render(
    <UiAdaptersProvider adapters={createFakeUiAdapters()}>
      <MerchantProductEditor {...props} />
    </UiAdaptersProvider>,
  );
  return { ...view, props };
}

describe("MerchantProductEditor", () => {
  it("binds edits to the product id and emits atomic price patches", async () => {
    const onProductChange = vi.fn();
    const user = userEvent.setup();
    renderEditor({ onProductChange });

    await user.type(screen.getByPlaceholderText("ابحث بالاسم أو SKU أو التصنيف"), "محفوظ");
    expect(screen.queryByText("منتج مسودة")).toBeNull();
    await user.click(screen.getByRole("button", { name: /منتج محفوظ/ }));
    fireEvent.change(screen.getByLabelText("اسم المنتج"), { target: { value: "اسم محدث" } });
    fireEvent.change(screen.getByLabelText("السعر الأساسي"), { target: { value: "200" } });
    fireEvent.change(screen.getByLabelText("سعر العرض (اختياري)"), { target: { value: "150" } });

    expect(onProductChange).toHaveBeenNthCalledWith(1, persistedProduct.id, { name: "اسم محدث" });
    expect(onProductChange).toHaveBeenNthCalledWith(2, persistedProduct.id, { basePrice: 200, price: 200 });
    expect(onProductChange).toHaveBeenNthCalledWith(3, persistedProduct.id, { salePrice: 150, price: 150 });
  });

  it("distinguishes a persisted archive intent from removing a local draft", async () => {
    const onArchiveProduct = vi.fn();
    const user = userEvent.setup();
    const view = renderEditor({ onArchiveProduct });

    await user.click(screen.getByRole("button", { name: /منتج محفوظ/ }));
    await user.click(screen.getByRole("button", { name: "أرشفة المنتج عند الحفظ" }));
    expect(screen.getByText(/لن يحدث أي تغيير في الخادم قبل الحفظ/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(onArchiveProduct).toHaveBeenCalledWith(persistedProduct.id);

    view.rerender(
      <UiAdaptersProvider adapters={createFakeUiAdapters()}>
        <MerchantProductEditor
          products={[draftProduct]}
          currency="YER"
          activeTenantId="tenant-a"
          mediaOwnerKey="account-a"
          canViewInventory={false}
          onProductChange={vi.fn()}
          onProductMediaChange={vi.fn()}
          uploadMedia={createFakeUiAdapters().catalog.uploadMedia}
          onAddProduct={vi.fn()}
          onArchiveProduct={onArchiveProduct}
        />
      </UiAdaptersProvider>,
    );
    await user.click(screen.getByRole("button", { name: /منتج مسودة/ }));
    await user.click(screen.getByRole("button", { name: "إزالة مسودة المنتج" }));
    await user.click(screen.getByRole("button", { name: "تأكيد" }));
    expect(onArchiveProduct).toHaveBeenLastCalledWith(draftProduct.id);
  });

  it("keeps inventory private without permission and delegates management when allowed", async () => {
    const onOpenInventory = vi.fn();
    const user = userEvent.setup();
    const inventoryProduct: Product = {
      ...persistedProduct,
      inventoryRevision: 2,
      manageStock: true,
      stockQuantity: 7,
      availableQuantity: 4,
      reservedQuantity: 3,
    };
    const view = renderEditor({ products: [inventoryProduct], onOpenInventory });
    expect(screen.queryByText(/متاح 4/)).toBeNull();
    expect(screen.queryByText(/فتح المخزون/)).toBeNull();

    view.rerender(
      <UiAdaptersProvider adapters={createFakeUiAdapters()}>
        <MerchantProductEditor
          products={[inventoryProduct]}
          currency="YER"
          activeTenantId="tenant-a"
          mediaOwnerKey="account-a"
          canViewInventory
          onProductChange={vi.fn()}
          onProductMediaChange={vi.fn()}
          uploadMedia={createFakeUiAdapters().catalog.uploadMedia}
          onAddProduct={vi.fn()}
          onArchiveProduct={vi.fn()}
          onOpenInventory={onOpenInventory}
        />
      </UiAdaptersProvider>,
    );
    expect(screen.getByText(/متاح 4/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: /فتح المخزون/ }));
    expect(onOpenInventory).toHaveBeenCalledTimes(1);
  });

  it("fails closed for an incomplete inventory projection", async () => {
    const user = userEvent.setup();
    const incompleteProduct: Product = {
      ...persistedProduct,
      inventoryRevision: 2,
      manageStock: true,
      stockQuantity: 7,
      availableQuantity: 4,
      reservedQuantity: undefined,
    };
    renderEditor({ products: [incompleteProduct], canViewInventory: true });
    await user.click(screen.getByRole("button", { name: /منتج محفوظ/ }));
    expect(screen.getAllByText(/بيانات المخزون غير مكتملة/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/محجوز 0/)).toBeNull();
  });

  it("rejects a deferred media result after the account identity changes", async () => {
    let resolveUpload!: (value: { url: string }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadMedia = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<{ url: string }>((resolve) => { resolveUpload = resolve; });
    });
    const onProductMediaChange = vi.fn();
    const user = userEvent.setup();
    const view = renderEditor({
      products: [persistedProduct],
      mediaOwnerKey: "account-a",
      uploadMedia,
      onProductMediaChange,
    });
    await user.click(screen.getByRole("button", { name: /منتج محفوظ/ }));
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));

    view.rerender(
      <UiAdaptersProvider adapters={createFakeUiAdapters()}>
        <MerchantProductEditor {...view.props} mediaOwnerKey="account-b" />
      </UiAdaptersProvider>,
    );
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({ url: "/api/catalog-media/account-a/stale" });
    await Promise.resolve();
    expect(onProductMediaChange).not.toHaveBeenCalled();
  });

  it("delegates creation without inventing a persisted identifier", async () => {
    const onAddProduct = vi.fn();
    const user = userEvent.setup();
    renderEditor({ products: [], onAddProduct });
    await user.click(screen.getByRole("button", { name: "إضافة منتج" }));
    expect(onAddProduct).toHaveBeenCalledTimes(1);
  });
});
