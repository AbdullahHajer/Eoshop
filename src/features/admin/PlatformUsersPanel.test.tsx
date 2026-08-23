// @vitest-environment jsdom

import React from "react";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider } from "../../adapters/UiAdaptersContext";
import { createFakeUiAdapters } from "../../adapters/testing/fakeUiAdapters";
import {
  UiAdapterError,
  type PaginatedResult,
  type PlatformRole,
  type PlatformUser,
  type UserProfile,
} from "../../adapters/uiAdapters";
import PlatformUsersPanel from "./PlatformUsersPanel";

const roles: PlatformRole[] = [
  {
    key: "platform_reviewer",
    name: "مراجع المنصة",
    description: "مراجعة المتاجر وسجل التدقيق",
    permissionKeys: ["platform.stores.view", "platform.stores.review", "platform.audit.view"],
  },
  {
    key: "platform_super_admin",
    name: "مدير المنصة",
    description: "إدارة المنصة والمستخدمين",
    permissionKeys: ["platform.users.manage"],
  },
];

const managerProfile: UserProfile = {
  id: "01MANAGER",
  fullName: "المدير الحالي",
  email: "manager@example.test",
  phone: "",
  profileRevision: 1,
  createdAt: null,
  updatedAt: null,
  role: "admin",
  platformRoles: ["platform_super_admin"],
  platformPermissions: ["platform.users.manage"],
};

const manager: PlatformUser = {
  id: managerProfile.id,
  name: managerProfile.fullName,
  email: managerProfile.email,
  status: "active",
  resumeStatus: null,
  roles: [{ key: "platform_super_admin", name: "مدير المنصة" }],
  platformPermissions: ["platform.users.manage"],
  activeTenantMembershipCount: 0,
  emailVerifiedAt: "2026-08-21T09:00:00Z",
  lastLoginAt: "2026-08-21T10:00:00Z",
  createdAt: "2026-08-20T10:00:00Z",
};

const reviewer: PlatformUser = {
  id: "01REVIEWER",
  name: "مراجع المتاجر",
  email: "reviewer@example.test",
  status: "active",
  resumeStatus: null,
  roles: [{ key: "platform_reviewer", name: "مراجع المنصة" }],
  platformPermissions: ["platform.stores.view", "platform.stores.review"],
  activeTenantMembershipCount: 2,
  emailVerifiedAt: "2026-08-21T09:00:00Z",
  lastLoginAt: null,
  createdAt: "2026-08-21T08:00:00Z",
};

function page(items: PlatformUser[]): PaginatedResult<PlatformUser> {
  return { items, pagination: { currentPage: 1, lastPage: 1, perPage: 25, total: items.length } };
}

function renderPanel(administration: Parameters<typeof createFakeUiAdapters>[0]["administration"]) {
  const onSessionExpired = vi.fn<() => void>();
  const onToast = vi.fn<(message: string, type?: "success" | "error" | "info") => void>();
  const adapters = createFakeUiAdapters({ administration });
  render(
    <UiAdaptersProvider adapters={adapters}>
      <PlatformUsersPanel
        administration={adapters.administration}
        currentUser={managerProfile}
        onSessionExpired={onSessionExpired}
        onToast={onToast}
        refreshSignal={0}
        onLoadingChange={vi.fn()}
        onForbiddenChange={vi.fn()}
      />
    </UiAdaptersProvider>,
  );

  return { onSessionExpired, onToast };
}

afterEach(cleanup);

describe("PlatformUsersPanel", () => {
  it("creates a passwordless invitation and reports broker acceptance truthfully", async () => {
    const listUsers = vi.fn().mockResolvedValue(page([manager, reviewer]));
    const inviteUser = vi.fn().mockResolvedValue({
      user: { ...reviewer, id: "01INVITED", status: "pending", resumeStatus: null, emailVerifiedAt: null },
      invitationDispatchStatus: "accepted",
    });
    const { onToast } = renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers,
      inviteUser,
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "دعوة مستخدم" }));
    const dialog = screen.getByRole("heading", { name: "دعوة مستخدم للمنصة" }).closest("form") as HTMLFormElement;
    await user.type(within(dialog).getByLabelText("الاسم"), "مشغل جديد");
    await user.type(within(dialog).getByLabelText("البريد الإلكتروني"), "new.operator@example.test");
    await user.click(within(dialog).getByRole("button", { name: "إنشاء وطلب الإرسال" }));

    await waitFor(() => expect(inviteUser).toHaveBeenCalledWith({
      name: "مشغل جديد",
      email: "new.operator@example.test",
      roleKeys: ["platform_reviewer"],
    }));
    expect(onToast).toHaveBeenCalledWith(expect.stringContaining("لا يعني ذلك ضمان وصول البريد"), "success");
    expect(screen.queryByText(/كلمة مرور/)).toBeNull();
    expect(screen.queryByRole("button", { name: /حذف/ })).toBeNull();
  });

  it("warns that suspension is global and sends an optimistic expected status", async () => {
    const listUsers = vi.fn().mockResolvedValue(page([manager, reviewer]));
    const updateUserStatus = vi.fn().mockResolvedValue({ ...reviewer, status: "suspended" });
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers,
      updateUserStatus,
    });
    const user = userEvent.setup();

    await screen.findByText(reviewer.name);
    const suspend = screen.getAllByRole("button", { name: "تعليق الهوية" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    await user.click(suspend);
    expect(screen.getByText(/هذا تعليق عالمي للهوية/)).toBeTruthy();
    expect(screen.getByText(/2 عضوية متجر نشطة/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تأكيد التعليق العالمي" }));

    await waitFor(() => expect(updateUserStatus).toHaveBeenCalledWith(reviewer.id, "active", "suspended"));
  });

  it("uses the server-owned resume transition for an unverified established operator", async () => {
    const suspended = {
      ...reviewer,
      status: "suspended" as const,
      resumeStatus: "active" as const,
      emailVerifiedAt: null,
    };
    const updateUserStatus = vi.fn().mockResolvedValue({ ...suspended, status: "active", resumeStatus: null });
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers: vi.fn().mockResolvedValue(page([manager, suspended])),
      updateUserStatus,
    });
    const user = userEvent.setup();

    await user.click(await screen.findByRole("button", { name: "إعادة التفعيل" }));
    await waitFor(() => expect(updateUserStatus).toHaveBeenCalledWith(suspended.id, "suspended", "active"));
    expect(screen.queryByRole("button", { name: "إعادة للدعوة" })).toBeNull();
  });

  it("preserves a stale role form until an explicit server reload", async () => {
    const listUsers = vi.fn().mockResolvedValue(page([manager, reviewer]));
    const replaceUserRoles = vi.fn().mockRejectedValue(new UiAdapterError(
      "تغيّرت الأدوار",
      "conflict",
      "platform_user_roles_stale",
    ));
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers,
      replaceUserRoles,
    });
    const user = userEvent.setup();

    await screen.findByText(reviewer.name);
    const edit = screen.getAllByRole("button", { name: "الأدوار" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    await user.click(edit);
    const dialogHeading = screen.getByRole("heading", { name: `أدوار ${reviewer.name}` });
    const dialog = dialogHeading.parentElement as HTMLElement;
    await user.click(within(dialog).getByRole("checkbox", { name: /مدير المنصة/ }));
    await user.click(within(dialog).getByRole("button", { name: "حفظ الأدوار" }));

    expect(await screen.findByText(/احتفظنا باختيارك/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: `أدوار ${reviewer.name}` })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "تحميل أحدث حالة" }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
    expect(screen.queryByRole("heading", { name: `أدوار ${reviewer.name}` })).toBeNull();
  });

  it("preserves a stale status conflict until the operator explicitly reloads", async () => {
    const listUsers = vi.fn().mockResolvedValue(page([manager, reviewer]));
    const updateUserStatus = vi.fn().mockRejectedValue(new UiAdapterError(
      "تغيّرت الحالة",
      "conflict",
      "platform_user_status_stale",
    ));
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers,
      updateUserStatus,
    });
    const user = userEvent.setup();

    await screen.findByText(reviewer.name);
    const suspend = screen.getAllByRole("button", { name: "تعليق الهوية" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    await user.click(suspend);
    await user.click(screen.getByRole("button", { name: "تأكيد التعليق العالمي" }));

    expect(await screen.findByText(/تغيّرت حالة المستخدم على الخادم/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: `تعليق هوية ${reviewer.name}` })).toBeTruthy();
    expect(updateUserStatus).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole("button", { name: "تحميل أحدث حالة" }));
    await waitFor(() => expect(listUsers).toHaveBeenCalledTimes(2));
  });

  it("keeps the safe list and never replays a failed server mutation", async () => {
    const updateUserStatus = vi.fn().mockRejectedValue(new UiAdapterError("الخدمة غير متاحة", "server"));
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers: vi.fn().mockResolvedValue(page([manager, reviewer])),
      updateUserStatus,
    });
    const user = userEvent.setup();

    await screen.findByText(reviewer.name);
    const suspend = screen.getAllByRole("button", { name: "تعليق الهوية" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    await user.click(suspend);
    await user.click(screen.getByRole("button", { name: "تأكيد التعليق العالمي" }));

    expect(await screen.findByText("الخدمة غير متاحة")).toBeTruthy();
    expect(screen.getByText(reviewer.name)).toBeTruthy();
    expect(updateUserStatus).toHaveBeenCalledTimes(1);
  });

  it("serializes user mutations while a deferred status operation is pending", async () => {
    const pending = {
      ...reviewer,
      id: "01PENDING",
      name: "مشغل بانتظار الإعداد",
      status: "pending" as const,
      resumeStatus: null,
    };
    let resolveStatus!: (value: PlatformUser) => void;
    const updateUserStatus = vi.fn(() => new Promise<PlatformUser>((resolve) => { resolveStatus = resolve; }));
    const resendUserInvitation = vi.fn().mockResolvedValue("accepted");
    const { onToast } = renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers: vi.fn().mockResolvedValue(page([manager, reviewer, pending])),
      updateUserStatus,
      resendUserInvitation,
    });
    const user = userEvent.setup();

    await screen.findByText(reviewer.name);
    const suspend = screen.getAllByRole("button", { name: "تعليق الهوية" })
      .find((button) => !(button as HTMLButtonElement).disabled) as HTMLButtonElement;
    await user.click(suspend);
    await user.click(screen.getByRole("button", { name: "تأكيد التعليق العالمي" }));
    await waitFor(() => expect(updateUserStatus).toHaveBeenCalledTimes(1));

    const resend = screen.getByRole("button", { name: "طلب رابط جديد" }) as HTMLButtonElement;
    expect(resend.disabled).toBe(true);
    await user.click(resend);
    expect(resendUserInvitation).not.toHaveBeenCalled();

    resolveStatus({ ...reviewer, status: "suspended", resumeStatus: "active" });
    await waitFor(() => expect(onToast).toHaveBeenCalledWith("تم تعليق الهوية وإبطال جلساتها وروابطها.", "success"));
  });

  it("expires the administration identity on 401", async () => {
    const listUsers = vi.fn().mockRejectedValue(new UiAdapterError("انتهت الجلسة", "unauthenticated"));
    const { onSessionExpired } = renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers,
    });

    await waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
    expect(screen.queryByText(reviewer.name)).toBeNull();
  });

  it("clears protected user data and actions on 403", async () => {
    renderPanel({
      listPlatformRoles: vi.fn().mockResolvedValue(roles),
      listUsers: vi.fn().mockRejectedValue(new UiAdapterError("سُحبت الصلاحية", "forbidden")),
    });

    expect(await screen.findByRole("heading", { name: "تم سحب صلاحية إدارة المستخدمين" })).toBeTruthy();
    expect(screen.queryByText(reviewer.name)).toBeNull();
    expect(screen.queryByRole("button", { name: "دعوة مستخدم" })).toBeNull();
  });
});
