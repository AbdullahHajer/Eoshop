// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import type { StoreDraft, UserProfile } from "../../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../../types";
import MerchantOnboardingPage from "./MerchantOnboardingPage";
import { ApiError } from "../../services/apiClient";

const user: UserProfile = {
  id: "owner-guided",
  fullName: "Guided Owner",
  email: "guided@example.test",
  phone: "",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "merchant",
  platformRoles: [],
  platformPermissions: [],
};

const businessDraft: StoreDraft = {
  id: "draft-guided",
  tenantId: null,
  status: "draft",
  revision: 1,
  onboardingStage: "business",
  onboardingReadiness: { business: true, design: false, review: false, blockers: ["design_incomplete"] },
  nextRequiredStep: "design",
  storeName: "Guided Store",
  businessType: "تجزئة",
  themeStyle: "elegant",
  handle: null,
  planKey: null,
  config: { ...ELEGANT_PRESET, storeName: "Guided Store" },
  savedAt: null,
  submittedAt: null,
};

const starter = {
  key: "starter",
  name: "البداية",
  priceMinor: 0,
  currency: "YER",
  billingInterval: "monthly" as const,
  activationMode: "automatic" as const,
  maxStores: 1,
  maxProducts: 10,
  features: [],
};

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("MerchantOnboardingPage", () => {
  it("guards a direct review URL with server readiness then persists design before advancing", async () => {
    window.history.replaceState({}, "", "/app/new/review");
    const designDraft: StoreDraft = {
      ...businessDraft,
      revision: 2,
      onboardingStage: "design",
      onboardingReadiness: { business: true, design: true, review: false, blockers: ["plan_unavailable", "domain_unavailable"] },
      nextRequiredStep: "review",
    };
    const saveDesign = vi.fn().mockResolvedValue(designDraft);
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(businessDraft), saveDesign },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="review" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "اختر نقطة بداية مناسبة" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new/design");
    await userEvent.click(screen.getByRole("button", { name: "حفظ التصميم والمتابعة" }));
    await waitFor(() => expect(saveDesign).toHaveBeenCalledWith(expect.objectContaining({ expectedRevision: 1 }), expect.any(AbortSignal)));
    expect(await screen.findByRole("heading", { name: "العنوان والباقة ثم الإرسال" })).toBeTruthy();
    expect(window.location.pathname).toBe("/app/new/review");
  });

  it("starts a new draft even when the owner already has stores instead of imposing a UI-only one-store limit", async () => {
    window.history.replaceState({}, "", "/app/new");
    const listStores = vi.fn();
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(null), listStores },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });

    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    expect(listStores).not.toHaveBeenCalled();
  });

  it("fails closed when the session expires while loading or saving a step", async () => {
    const loadExpired = vi.fn();
    const loadAdapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockRejectedValue(new ApiError("expired", "unauthenticated", 401)) },
    });
    const first = render(<UiAdaptersProvider adapters={loadAdapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={loadExpired} /></UiAdaptersProvider>);
    await waitFor(() => expect(loadExpired).toHaveBeenCalledWith("/app/new"));
    first.unmount();

    const saveExpired = vi.fn();
    const saveAdapters = createFakeUiAdapters({
      provisioning: {
        recoverCommittedSubmission: vi.fn().mockResolvedValue(null),
        currentDraft: vi.fn().mockResolvedValue(businessDraft),
        saveDesign: vi.fn().mockRejectedValue(new ApiError("expired", "unauthenticated", 401)),
      },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    render(<UiAdaptersProvider adapters={saveAdapters}><MerchantOnboardingPage user={user} requestedStep="design" onSessionExpired={saveExpired} /></UiAdaptersProvider>);
    await screen.findByRole("heading", { name: "اختر نقطة بداية مناسبة" });
    await userEvent.click(screen.getByRole("button", { name: "حفظ التصميم والمتابعة" }));
    await waitFor(() => expect(saveExpired).toHaveBeenCalledWith("/app/new/design"));
  });

  it("guards an unsaved first step against browser unload", async () => {
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission: vi.fn().mockResolvedValue(null), currentDraft: vi.fn().mockResolvedValue(null) },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    await userEvent.type(await screen.findByRole("textbox", { name: "اسم المتجر أو النشاط" }), "مسودة غير محفوظة");
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("invalidates a delayed draft load when the authenticated owner changes", async () => {
    let resolveFirst!: (value: null) => void;
    const recoverCommittedSubmission = vi.fn((ownerId: string) => ownerId === user.id
      ? new Promise<null>((resolve) => { resolveFirst = resolve; })
      : Promise.resolve(null));
    const currentDraft = vi.fn().mockResolvedValue(null);
    const adapters = createFakeUiAdapters({
      provisioning: { recoverCommittedSubmission, currentDraft },
      plans: { list: vi.fn().mockResolvedValue([starter]) },
    });
    const view = render(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={user} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);
    const nextUser = { ...user, id: "owner-guided-b", email: "guided-b@example.test" };
    view.rerender(<UiAdaptersProvider adapters={adapters}><MerchantOnboardingPage user={nextUser} requestedStep="business" onSessionExpired={vi.fn()} /></UiAdaptersProvider>);

    expect(await screen.findByRole("heading", { name: "عرّفنا بالنشاط" })).toBeTruthy();
    resolveFirst(null);
    await Promise.resolve();
    expect(currentDraft).toHaveBeenCalledTimes(1);
  });
});
