// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import AuthRoutePage from "./AuthRoutePage";

afterEach(() => {
  cleanup();
  window.history.replaceState({}, "", "/");
  vi.restoreAllMocks();
});

describe("AuthRoutePage", () => {
  it("keeps forgot-password enumeration-safe and displays only the server message", async () => {
    window.history.replaceState({}, "", "/forgot-password");
    const forgotPassword = vi.fn().mockResolvedValue("إذا كان البريد مسجلاً فستصلك تعليمات إعادة كلمة المرور.");
    const adapters = createFakeUiAdapters({ auth: { forgotPassword } });
    render(<UiAdaptersProvider adapters={adapters}><AuthRoutePage mode="forgot" currentUser={null} restoring={false} onAuthenticated={vi.fn()} /></UiAdaptersProvider>);

    await userEvent.type(screen.getByLabelText("البريد الإلكتروني"), "unknown@example.test");
    await userEvent.click(screen.getByRole("button", { name: "إرسال تعليمات الاستعادة" }));

    await waitFor(() => expect(forgotPassword).toHaveBeenCalledWith("unknown@example.test"));
    expect(await screen.findByText("إذا كان البريد مسجلاً فستصلك تعليمات إعادة كلمة المرور.")).toBeTruthy();
  });

  it("renders registration as a dedicated route with explicit server-backed identity fields", () => {
    const adapters = createFakeUiAdapters();
    render(<UiAdaptersProvider adapters={adapters}><AuthRoutePage mode="register" currentUser={null} restoring={false} onAuthenticated={vi.fn()} /></UiAdaptersProvider>);

    expect(screen.getByRole("heading", { name: "ابدأ حساب التاجر" })).toBeTruthy();
    expect(screen.getByLabelText("الاسم الكامل")).toBeTruthy();
    expect(screen.getByLabelText("رقم الهاتف — اختياري")).toBeTruthy();
    expect(screen.getByRole("button", { name: "إنشاء الحساب والمتابعة" })).toBeTruthy();
  });
});
