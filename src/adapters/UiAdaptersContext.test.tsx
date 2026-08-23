import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { UiAdaptersProvider, useUiAdapters } from "./UiAdaptersContext";
import type { AuthActions } from "./uiAdapters";
import { createFakeUiAdapters } from "./testing/fakeUiAdapters";

function AdapterProbe({ expected }: { expected: AuthActions }) {
  const { auth } = useUiAdapters();
  return <span>{auth === expected ? "injected" : "unexpected"}</span>;
}

describe("UiAdaptersProvider", () => {
  it("fails closed when the application composition root is missing", () => {
    expect(() => renderToStaticMarkup(<AdapterProbe expected={createFakeUiAdapters().auth} />))
      .toThrow("UiAdaptersProvider is required");
  });

  it("injects an explicit fake adapter set without a production fallback", () => {
    const fakeAuth: AuthActions = {
      session: vi.fn().mockResolvedValue(null),
      register: vi.fn(),
      login: vi.fn(),
      logout: vi.fn(),
      updateProfile: vi.fn(),
      changePassword: vi.fn(),
      forgotPassword: vi.fn(),
      resetPassword: vi.fn(),
    };
    const fakeAdapters = createFakeUiAdapters({ auth: fakeAuth });

    expect(renderToStaticMarkup(
      <UiAdaptersProvider adapters={fakeAdapters}>
        <AdapterProbe expected={fakeAdapters.auth} />
      </UiAdaptersProvider>,
    )).toContain("injected");
  });
});
