// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "../App";
import { UiAdaptersProvider } from "../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../adapters/testing/fakeUiAdapters";
import {
  UiAdapterError,
  type PlatformStore,
  type StoreSubmission,
  type StoreWorkspace,
  type UiAdapters,
  type UserProfile,
} from "../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../types";
import AdminDashboard from "./AdminDashboard";
import ControlPanel from "./ControlPanel";
import ResetPasswordGateway from "./ResetPasswordGateway";

const merchant: UserProfile = {
  id: "01MERCHANT",
  fullName: "تاجر تجريبي",
  email: "merchant@example.com",
  phone: "+967700000000",
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const submission: StoreSubmission = {
  id: "01STORE",
  storeName: "متجر الخادم",
  businessType: "تجزئة",
  verificationStatus: "approved",
  provisioningStatus: "active",
  publicationStatus: "requested",
  reviewFeedback: null,
  capabilities: { workspaceManage: true, catalogManage: true, inventoryView: true, inventoryManage: true, ordersView: true, ordersManage: true },
  internalDomain: "store-01.eoshop.local",
  requestedDomain: "merchant.eoshop.local",
  publicDomain: null,
  plan: { key: "starter", name: "البداية", activationMode: "automatic" },
  subscriptionStatus: "active",
  publicationBlockers: [],
  createdAt: null,
  activeAt: null,
  publishedAt: null,
};

const workspace: StoreWorkspace = {
  tenantId: submission.id,
  revision: 7,
  catalogRevision: 3,
  capabilities: { inventoryView: true, inventoryManage: true },
  config: { ...ELEGANT_PRESET, storeName: "متجر الخادم" },
  updatedAt: null,
};

const platformStore: PlatformStore = {
  id: submission.id,
  storeName: submission.storeName,
  ownerName: merchant.fullName,
  ownerEmail: merchant.email,
  ownerPhone: merchant.phone,
  businessType: submission.businessType,
  verificationStatus: "pending",
  provisioningStatus: "active",
  publicationStatus: "requested",
  rejectionReason: null,
  themeStyle: "elegant",
  domains: ["store-01.eoshop.local"],
  requestedDomain: "merchant.eoshop.local",
  publicDomain: null,
  publicationBlockers: [],
  subscription: {
    id: "01SUBSCRIPTION",
    status: "active",
    endsAt: null,
    plan: { key: "starter", name: "البداية", activationMode: "automatic" },
  },
  createdAt: null,
  activeAt: null,
  latestProvisioningRun: null,
};

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

function renderInterface(node: React.ReactElement, adapters: UiAdapters) {
  return render(<UiAdaptersProvider adapters={adapters}>{node}</UiAdaptersProvider>);
}

function appAdapters(save: UiAdapters["workspace"]["save"]): UiAdapters {
  return createFakeUiAdapters({
    auth: { session: vi.fn().mockResolvedValue(merchant) },
    plans: { list: vi.fn().mockResolvedValue([]) },
    provisioning: { listStores: vi.fn().mockResolvedValue([submission]) },
    workspace: {
      load: vi.fn().mockResolvedValue(workspace),
      save,
    },
  });
}

async function openRestoredBuilder(adapters: UiAdapters, user: ReturnType<typeof userEvent.setup>) {
  renderInterface(<App />, adapters);
  expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
  await user.click(screen.getByRole("button", { name: "إدارة المتجر" }));
  expect(await screen.findByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
}

describe("adapter-backed interface flows", () => {
  it("routes an authenticated merchant to the durable portal and keeps pending stores visible", async () => {
    const pendingStore: StoreSubmission = {
      ...submission,
      verificationStatus: "pending",
      provisioningStatus: "not_started",
      publicationBlockers: ["review_not_approved", "provisioning_not_ready"],
    };
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([pendingStore]) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    expect(window.location.pathname).toBe("/app");
    expect(screen.getAllByText("قيد المراجعة").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: "إدارة المتجر" })).toBeNull();
  });

  it("keeps an authenticated merchant inside the portal when store recovery fails", async () => {
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockRejectedValue(new UiAdapterError("تعذر الاتصال بالخادم.", "server")) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("تعذر الاتصال بالخادم");
    expect(screen.getByRole("button", { name: "إعادة المحاولة" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app");
  });

  it("restores the owned new-store route for an authenticated merchant", async () => {
    window.history.replaceState({}, "", "/app/new");
    const adapters = createFakeUiAdapters({
      auth: { session: vi.fn().mockResolvedValue(merchant) },
      plans: { list: vi.fn().mockResolvedValue([]) },
      provisioning: { listStores: vi.fn().mockResolvedValue([]) },
    });

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("heading", { name: "اختر القالب الأنسب لتجارتك" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new");
  });

  it("restores an exact ready store design route without passing through templates", async () => {
    window.history.replaceState({}, "", `/app/stores/${submission.id}/design`);
    const adapters = appAdapters(vi.fn());

    renderInterface(<App />, adapters);

    expect(await screen.findByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();
    expect(window.location.pathname).toBe(`/app/stores/${submission.id}/design`);
    expect(adapters.workspace.load).toHaveBeenCalledWith(submission.id, expect.any(AbortSignal));
  });

  it("requires an explicit decision before leaving a dirty workspace for the merchant portal", async () => {
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(vi.fn()), user);
    fireEvent.change(screen.getByPlaceholderText("أدخل اسم متجرك المميز"), { target: { value: "اسم غير محفوظ" } });

    await user.click(screen.getByTitle("الرجوع إلى بوابة التاجر"));
    expect(confirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "حفظ التعديلات" })).toBeTruthy();

    await user.click(screen.getByTitle("الرجوع إلى بوابة التاجر"));
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(await screen.findByRole("heading", { name: /مرحبًا تاجر/ })).toBeTruthy();
  });

  it("resets a password through the injected auth action", async () => {
    window.history.replaceState({}, "", "/reset-password?token=reset-token&email=merchant%40example.com");
    const resetPassword = vi.fn().mockResolvedValue("تم تحديث كلمة المرور.");
    const user = userEvent.setup();
    renderInterface(
      <ResetPasswordGateway />,
      createFakeUiAdapters({ auth: { resetPassword } }),
    );

    await user.type(screen.getByPlaceholderText("كلمة المرور الجديدة"), "new-secure-password");
    await user.type(screen.getByPlaceholderText("تأكيد كلمة المرور"), "new-secure-password");
    await user.click(screen.getByRole("button", { name: "تحديث كلمة المرور" }));

    await waitFor(() => expect(resetPassword).toHaveBeenCalledTimes(1));
    expect(resetPassword).toHaveBeenCalledWith({
      token: "reset-token",
      email: merchant.email,
      password: "new-secure-password",
      passwordConfirmation: "new-secure-password",
    });
    expect(await screen.findByText("تم تحديث كلمة المرور.")).toBeTruthy();
  });

  it("shows reviewer decisions but keeps manager publication actions hidden", async () => {
    const updateStatus = vi.fn().mockResolvedValue(undefined);
    const user = userEvent.setup();
    render(
      <AdminDashboard
        stores={[platformStore]}
        permissions={["platform.stores.view", "platform.stores.review"]}
        loading={false}
        error={null}
        onReload={vi.fn()}
        onUpdateStoreStatus={updateStatus}
        onRetryProvisioning={vi.fn()}
        onActivateSubscription={vi.fn()}
        onPublish={vi.fn()}
        onUnpublish={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "نشر المتجر" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "قبول" }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledWith(platformStore.id, "approved", undefined));
  });

  it("calls the assistant once and renders its server-backed proposal", async () => {
    const generateStoreIdeas = vi.fn().mockResolvedValue({
      storeName: "متجر ذكي",
      slogan: "شعار من الخادم",
      logoIcon: null,
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      themeStyle: "elegant",
      bannerText: "عرض من الخادم",
      products: [{
        name: "منتج",
        price: 100,
        description: "وصف من الخادم",
        category: "عام",
        imageKeyword: "default",
      }],
    });
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة الحملة");
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));

    await waitFor(() => expect(generateStoreIdeas).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/شعار من الخادم/)).toBeTruthy();
    expect(screen.getByText(/عرض من الخادم/)).toBeTruthy();
  });

  it("guards a deferred assistant request against a second submit", async () => {
    let resolveIdeas!: (value: Awaited<ReturnType<UiAdapters["assistant"]["generateStoreIdeas"]>>) => void;
    const generateStoreIdeas = vi.fn(() => new Promise<Awaited<ReturnType<UiAdapters["assistant"]["generateStoreIdeas"]>>>((resolve) => {
      resolveIdeas = resolve;
    }));
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة مؤجلة");
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));
    const loadingButton = screen.getByRole("button", { name: "جاري تفعيل الإبداع..." });
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
    await user.click(loadingButton);
    expect(generateStoreIdeas).toHaveBeenCalledTimes(1);

    resolveIdeas({
      storeName: "متجر",
      slogan: "شعار مؤجل",
      logoIcon: null,
      primaryColor: "#000000",
      secondaryColor: "#ffffff",
      themeStyle: "elegant",
      bannerText: "عرض",
      products: [],
    });
    expect(await screen.findByText(/شعار مؤجل/)).toBeTruthy();
  });

  it("preserves the assistant fallback when generation fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="ai"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters({ assistant: { generateStoreIdeas: vi.fn().mockRejectedValue(new Error("offline")) } }),
    );

    await user.type(screen.getByPlaceholderText(/بخور العود الأزرق/), "فكرة");
    await user.click(screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }));
    expect(await screen.findByText(/التميز يبدأ من الاختيار الصحيح لهويتك/)).toBeTruthy();
  });

  it("keeps completion fallback in the coordinator when no domain callback is supplied", async () => {
    const setActiveTab = vi.fn();
    const user = userEvent.setup();
    renderInterface(
      <ControlPanel
        config={ELEGANT_PRESET}
        activeTenantId={null}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="branding"
        setActiveTab={setActiveTab}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters(),
    );

    await user.click(screen.getByRole("button", { name: /تم الانتهاء من التخصيص/ }));
    expect(setActiveTab).toHaveBeenCalledWith("export");
  });

  it("aborts an in-flight catalog upload when the active tenant changes", async () => {
    let resolveUpload!: (value: { id: string; url: string; mimeType: string; byteSize: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadMedia = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;

      return new Promise<{ id: string; url: string; mimeType: string; byteSize: number }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const handleProductChange = vi.fn();
    const handleProductMediaChange = vi.fn();
    const adapters = createFakeUiAdapters({ catalog: { uploadMedia } });
    const catalogConfig = {
      ...ELEGANT_PRESET,
      products: [{
        ...ELEGANT_PRESET.products[0],
        imageKeyword: "custom",
        imageUrl: "https://images.example.test/current.jpg",
        imageUrls: ["https://images.example.test/current.jpg"],
      }],
    };
    const panel = (tenantId: string) => (
      <UiAdaptersProvider adapters={adapters}>
        <ControlPanel
          config={catalogConfig}
          activeTenantId={tenantId}
          handleConfigChange={vi.fn()}
          handleProductChange={handleProductChange}
          handleProductMediaChange={handleProductMediaChange}
          addEmptyProduct={vi.fn()}
          deleteProduct={vi.fn()}
          activeTab="products"
          setActiveTab={vi.fn()}
          previewDevice="desktop"
          setPreviewDevice={vi.fn()}
        />
      </UiAdaptersProvider>
    );
    const view = render(panel("tenant-a"));
    const productCard = screen.getByText(catalogConfig.products[0].name).closest("div.rounded-2xl");
    const editButton = productCard?.querySelector("button");
    expect(editButton).toBeTruthy();
    fireEvent.click(editButton as HTMLButtonElement);
    const input = view.container.querySelector('input[type="file"]');
    expect(input).toBeTruthy();
    fireEvent.change(input as HTMLInputElement, {
      target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));

    view.rerender(panel("tenant-b"));
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      url: "/api/catalog-media/tenant-a/7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      mimeType: "image/png",
      byteSize: 5,
    });
    await Promise.resolve();
    expect(handleProductChange).not.toHaveBeenCalled();
    expect(handleProductMediaChange).not.toHaveBeenCalled();
  });

  it("rejects a deferred catalog upload when the product collection changes", async () => {
    let resolveUpload!: (value: { id: string; url: string; mimeType: string; byteSize: number }) => void;
    let capturedSignal: AbortSignal | undefined;
    const uploadMedia = vi.fn((_tenantId: string, _file: File, signal?: AbortSignal) => {
      capturedSignal = signal;

      return new Promise<{ id: string; url: string; mimeType: string; byteSize: number }>((resolve) => {
        resolveUpload = resolve;
      });
    });
    const handleProductMediaChange = vi.fn();
    const adapters = createFakeUiAdapters({ catalog: { uploadMedia } });
    const catalogConfig = {
      ...ELEGANT_PRESET,
      products: [{
        ...ELEGANT_PRESET.products[0],
        imageKeyword: "custom",
        imageUrl: "https://images.example.test/current.jpg",
        imageUrls: ["https://images.example.test/current.jpg"],
      }],
    };
    const panel = (config: typeof catalogConfig) => (
      <UiAdaptersProvider adapters={adapters}>
        <ControlPanel
          config={config}
          activeTenantId="tenant-a"
          handleConfigChange={vi.fn()}
          handleProductChange={vi.fn()}
          handleProductMediaChange={handleProductMediaChange}
          addEmptyProduct={vi.fn()}
          deleteProduct={vi.fn()}
          activeTab="products"
          setActiveTab={vi.fn()}
          previewDevice="desktop"
          setPreviewDevice={vi.fn()}
        />
      </UiAdaptersProvider>
    );
    const view = render(panel(catalogConfig));
    const productCard = screen.getByText(catalogConfig.products[0].name).closest("div.rounded-2xl");
    fireEvent.click(productCard?.querySelector("button") as HTMLButtonElement);
    fireEvent.change(view.container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(["image"], "product.png", { type: "image/png" })] },
    });
    await waitFor(() => expect(uploadMedia).toHaveBeenCalledTimes(1));

    view.rerender(panel({
      ...catalogConfig,
      products: [{ ...catalogConfig.products[0], id: "new-draft", name: "New draft" }, ...catalogConfig.products],
    }));
    expect(capturedSignal?.aborted).toBe(true);
    resolveUpload({
      id: "7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      url: "/api/catalog-media/tenant-a/7b32b037-b35e-4be2-b799-0737f4dbe8c5",
      mimeType: "image/png",
      byteSize: 5,
    });
    await Promise.resolve();
    expect(handleProductMediaChange).not.toHaveBeenCalled();
  });

  it("keeps base and sale price edits together in the saved workspace", async () => {
    const save = vi.fn(async (_tenantId, _revision, _catalogRevision, config) => ({
      ...workspace,
      revision: 8,
      catalogRevision: 4,
      config,
    }));
    const user = userEvent.setup();
    await openRestoredBuilder(appAdapters(save), user);
    await user.click(screen.getByTestId("products-tab"));
    const product = workspace.config.products[0];
    const productCard = screen.getAllByText(product.name)[0].closest("div.rounded-2xl");
    fireEvent.click(productCard?.querySelector("button") as HTMLButtonElement);

    fireEvent.change(screen.getByTestId(`product-base-price-${product.id}`), { target: { value: "200" } });
    fireEvent.change(screen.getByTestId(`product-sale-price-${product.id}`), { target: { value: "150" } });
    await user.click(screen.getByTestId("save-workspace"));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    const savedConfig = save.mock.calls[0][3];
    expect(savedConfig.products[0]).toMatchObject({ basePrice: 200, salePrice: 150, price: 150 });
  });

  it("keeps an inventory mutation bound to its tenant and updates the saved baseline", async () => {
    const product = workspace.config.products[0];
    const inventoryWorkspace: StoreWorkspace = {
      ...workspace,
      config: {
        ...workspace.config,
        products: [{
          ...product,
          stockQuantity: 10,
          reservedQuantity: 0,
          availableQuantity: 10,
          inventoryRevision: 1,
          manageStock: true,
          lowStockThreshold: 3,
        }, ...workspace.config.products.slice(1)],
      },
    };
    let resolveAdjustment!: (result: {
      tenantId: string;
      operationId: string;
      replayed: boolean;
      items: Array<{
        productId: string;
        onHand: number;
        reserved: number;
        available: number | null;
        manageStock: boolean;
        lowStockThreshold: number;
        inventoryRevision: number;
      }>;
    }) => void;
    const adjust = vi.fn(() => new Promise<Parameters<typeof resolveAdjustment>[0]>((resolve) => {
      resolveAdjustment = resolve;
    }));
    const adapters = appAdapters(vi.fn());
    adapters.workspace.load = vi.fn().mockResolvedValue(inventoryWorkspace);
    adapters.inventory.adjust = adjust;
    vi.spyOn(window, "prompt").mockReturnValue("12");
    vi.spyOn(window, "confirm").mockReturnValue(true);

    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);
    await user.click(screen.getByRole("button", { name: "أحدث نسخة" }));
    await waitFor(() => expect(screen.getAllByText("متجر الخادم").length).toBeGreaterThan(0));
    await user.click(screen.getByTestId("inventory-tab"));
    await user.click(screen.getAllByRole("button", { name: "تسجيل حركة تصحيح" })[0]);
    await waitFor(() => expect(adjust).toHaveBeenCalledWith(
      submission.id,
      [{
        productId: product.id,
        expectedInventoryRevision: 1,
        movementKind: "correction",
        delta: 2,
      }],
      "merchant_manual_correction",
      expect.any(String),
    ));
    expect((screen.getByTestId("save-workspace") as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole("button", { name: "خروج" }) as HTMLButtonElement).disabled).toBe(true);

    resolveAdjustment({
      tenantId: submission.id,
      operationId: "00000000-0000-0000-0000-000000000099",
      replayed: false,
      items: [{
        productId: product.id,
        onHand: 12,
        reserved: 0,
        available: 12,
        manageStock: true,
        lowStockThreshold: 3,
        inventoryRevision: 2,
      }],
    });

    expect(await screen.findByText("الرصيد الفعلي: 12")).toBeTruthy();
    await waitFor(() => expect((screen.getByTestId("save-workspace") as HTMLButtonElement).disabled).toBe(false));
    expect(screen.queryByText("تعديلات أو تعارضات غير محفوظة")).toBeNull();
  });

  it("hides inventory for missing view permission and disables mutations for view-only access", async () => {
    const adapters = appAdapters(vi.fn());
    adapters.workspace.load = vi.fn().mockResolvedValue({
      ...workspace,
      capabilities: { inventoryView: false, inventoryManage: false },
    });
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);
    await user.click(screen.getByRole("button", { name: "أحدث نسخة" }));
    await waitFor(() => expect(screen.getAllByText("متجر الخادم").length).toBeGreaterThan(0));
    expect(screen.queryByTestId("inventory-tab")).toBeNull();

    const inventoryProduct = {
      ...workspace.config.products[0],
      stockQuantity: 10,
      reservedQuantity: 0,
      availableQuantity: 10,
      inventoryRevision: 1,
      manageStock: true,
      lowStockThreshold: 3,
    };
    renderInterface(
      <ControlPanel
        config={{ ...workspace.config, products: [inventoryProduct] }}
        activeTenantId={submission.id}
        canViewInventory
        canManageInventory={false}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        adjustInventory={vi.fn()}
        updateInventoryPolicy={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="inventory"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      createFakeUiAdapters(),
    );
    expect((screen.getAllByRole("button", { name: "تحديث عدد الكمية للكل" }).at(-1) as HTMLButtonElement).disabled).toBe(true);
  });

  it("serializes merchant order transitions and reuses the logical idempotency key after failure", async () => {
    let rejectFirst!: (error: Error) => void;
    const firstAttempt = new Promise<never>((_resolve, reject) => { rejectFirst = reject; });
    const order = {
      id: "22222222-2222-4222-8222-222222222222",
      number: "EO-222222222222",
      status: "submitted" as const,
      paymentState: "due_on_delivery",
      currencyCode: "YER",
      totals: {
        itemsSubtotalMinor: 1000,
        discountMinor: 0,
        shippingMinor: 0,
        taxMinor: 0,
        paymentFeeMinor: 0,
        grandTotalMinor: 1000,
      },
      items: [],
      createdAt: "2026-08-17T10:00:00Z",
    };
    const updateStatus = vi.fn()
      .mockImplementationOnce(() => firstAttempt)
      .mockResolvedValueOnce({ ...order, status: "accepted" });
    const adapters = createFakeUiAdapters({
      orders: {
        list: vi.fn().mockResolvedValue({ items: [order], total: 1 }),
        updateStatus,
      },
    });
    renderInterface(
      <ControlPanel
        config={workspace.config}
        activeTenantId={submission.id}
        handleConfigChange={vi.fn()}
        handleProductChange={vi.fn()}
        handleProductMediaChange={vi.fn()}
        addEmptyProduct={vi.fn()}
        deleteProduct={vi.fn()}
        activeTab="orders"
        setActiveTab={vi.fn()}
        previewDevice="desktop"
        setPreviewDevice={vi.fn()}
      />,
      adapters,
    );

    const advance = await screen.findByRole("button", { name: /accepted/ });
    fireEvent.click(advance);
    fireEvent.click(advance);
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(1));
    expect((advance as HTMLButtonElement).disabled).toBe(true);
    const firstKey = updateStatus.mock.calls[0][4];

    rejectFirst(new Error("ambiguous network failure"));
    await screen.findByText("ambiguous network failure");
    fireEvent.click(screen.getByRole("button", { name: /accepted/ }));
    await waitFor(() => expect(updateStatus).toHaveBeenCalledTimes(2));
    expect(updateStatus.mock.calls[1][4]).toBe(firstKey);
  });

  it("restores the workspace, saves the current revision and opens only revision-code recovery", async () => {
    const save = vi.fn()
      .mockImplementationOnce(async (_tenantId, _revision, _catalogRevision, config) => ({
        ...workspace,
        revision: 8,
        catalogRevision: 4,
        config,
      }))
      .mockRejectedValueOnce(new UiAdapterError("نسخة أحدث موجودة.", "conflict", "workspace_revision_conflict"));
    const adapters = appAdapters(save);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);

    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(submission.id, 7, 3, expect.any(Object), []));
    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(save).toHaveBeenCalledWith(submission.id, 8, 4, expect.any(Object), []));
    expect(await screen.findByText("تعارضت تعديلاتك مع نسخة أحدث")).toBeTruthy();
    expect(localStorage.getItem("mobtaker_custom_store")).toBeNull();
  });

  it("fails closed and clears tenant-owned state when a save reports an expired session", async () => {
    const save = vi.fn().mockRejectedValue(new UiAdapterError("انتهت الجلسة.", "unauthenticated"));
    const adapters = appAdapters(save);
    const user = userEvent.setup();
    await openRestoredBuilder(adapters, user);

    await user.click(screen.getByRole("button", { name: "حفظ التعديلات" }));

    await waitFor(() => expect(save).toHaveBeenCalledTimes(1));
    expect(await screen.findByText("انتهت الجلسة.")).toBeTruthy();
    expect(localStorage.getItem("mobtaker_custom_store")).toBeNull();
  });
});
