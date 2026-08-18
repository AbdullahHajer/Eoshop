// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { OrderReceipt } from "../../adapters/uiAdapters";
import type { MerchantOrderAction } from "../../workflows/orderState";
import MerchantOrdersPanel from "../orders/MerchantOrdersPanel";
import StoreSubmissionPanel from "../tenancy/StoreSubmissionPanel";
import AiCopywriterPanel from "./AiCopywriterPanel";
import { CustomizationCompletionBar, PreviewDeviceSelector } from "./ControlPanelChrome";

afterEach(cleanup);

const order = {
  id: "22222222-2222-4222-8222-222222222222",
  number: "EO-222222222222",
  status: "submitted",
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
} as OrderReceipt;

const submittedActions: MerchantOrderAction[] = [
  { status: "cancelled", label: "إلغاء", tone: "danger" },
  { status: "accepted", label: "نقل إلى accepted", tone: "primary" },
];

describe("control panel workflow panels", () => {
  it("preserves both device choices, selected styling and callbacks", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    const view = render(<PreviewDeviceSelector device="desktop" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "كمبيوتر" }).className).toContain("bg-amber-500");
    await user.click(screen.getByRole("button", { name: "جوال" }));
    expect(onChange).toHaveBeenCalledWith("mobile");

    view.rerender(<PreviewDeviceSelector device="mobile" onChange={onChange} />);
    expect(screen.getByRole("button", { name: "جوال" }).className).toContain("bg-amber-500");
  });

  it("delegates completion through one explicit callback", async () => {
    const onComplete = vi.fn();
    const user = userEvent.setup();
    render(<CustomizationCompletionBar onComplete={onComplete} />);

    await user.click(screen.getByRole("button", { name: /تم الانتهاء من التخصيص/ }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("renders order loading, error and empty states", () => {
    const props = {
      orders: [] as OrderReceipt[],
      pendingOrderIds: new Set<string>(),
      actionsFor: vi.fn(() => []),
      onAdvance: vi.fn(),
    };
    const view = render(<MerchantOrdersPanel {...props} loading error={null} />);
    expect(screen.getByText("جارٍ تحميل الطلبات...")).toBeTruthy();

    view.rerender(<MerchantOrdersPanel {...props} loading={false} error="تعذر التحميل" />);
    expect(screen.getByText("تعذر التحميل")).toBeTruthy();
    expect(screen.getByText("لا توجد طلبات مسجلة بعد.")).toBeTruthy();
  });

  it("renders only coordinator-provided order actions and disables pending transitions", async () => {
    const onAdvance = vi.fn();
    const user = userEvent.setup();
    const actionsFor = vi.fn(() => submittedActions);
    const view = render(
      <MerchantOrdersPanel
        orders={[order]}
        loading={false}
        error={null}
        pendingOrderIds={new Set()}
        actionsFor={actionsFor}
        onAdvance={onAdvance}
      />,
    );

    await user.click(screen.getByRole("button", { name: "إلغاء" }));
    await user.click(screen.getByRole("button", { name: "نقل إلى accepted" }));
    expect(onAdvance).toHaveBeenNthCalledWith(1, order, "cancelled");
    expect(onAdvance).toHaveBeenNthCalledWith(2, order, "accepted");

    view.rerender(
      <MerchantOrdersPanel
        orders={[order]}
        loading={false}
        error={null}
        pendingOrderIds={new Set([order.id])}
        actionsFor={actionsFor}
        onAdvance={onAdvance}
      />,
    );
    expect((screen.getByRole("button", { name: "إلغاء" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("shows no action for a terminal order when the coordinator supplies none", () => {
    render(
      <MerchantOrdersPanel
        orders={[{ ...order, status: "completed" }]}
        loading={false}
        error={null}
        pendingOrderIds={new Set()}
        actionsFor={() => []}
        onAdvance={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button")).toBeNull();
  });

  it("preserves assistant prompt guards, loading state and rendered output", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    const onPromptChange = vi.fn();
    const view = render(
      <AiCopywriterPanel prompt="" loading={false} output={null} onPromptChange={onPromptChange} onSubmit={onSubmit} />,
    );

    expect((screen.getByRole("button", { name: /اقترح لي نصوصاً إبداعية/ }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByPlaceholderText(/بخور العود الأزرق/), { target: { value: "فكرة" } });
    expect(onPromptChange).toHaveBeenCalledWith("فكرة");

    view.rerender(<AiCopywriterPanel prompt="فكرة" loading output={null} onPromptChange={onPromptChange} onSubmit={onSubmit} />);
    expect((screen.getByRole("button", { name: "جاري تفعيل الإبداع..." }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(
      <AiCopywriterPanel
        prompt="فكرة"
        loading={false}
        output={{ slogan: "شعار", banner: "عرض", productDesc: "وصف" }}
        onPromptChange={onPromptChange}
        onSubmit={onSubmit}
      />,
    );
    expect(screen.getByText('"شعار"')).toBeTruthy();
    expect(screen.getByText('"عرض"')).toBeTruthy();
    expect(screen.getByText('"وصف"')).toBeTruthy();
  });

  it("preserves submission summary, disabled state and avoids a publication-success claim", async () => {
    const onOpen = vi.fn();
    const user = userEvent.setup();
    const view = render(<StoreSubmissionPanel storeName="متجري" slogan="شعاري" productCount={3} onOpen={undefined} />);

    expect(screen.getByText("متجري")).toBeTruthy();
    expect(screen.getByText("شعاري")).toBeTruthy();
    expect(screen.getByText("3 منتج")).toBeTruthy();
    expect(screen.queryByText(/تم نشر/)).toBeNull();
    expect((screen.getByRole("button", { name: /اختيار العنوان/ }) as HTMLButtonElement).disabled).toBe(true);

    view.rerender(<StoreSubmissionPanel storeName="متجري" slogan="شعاري" productCount={3} onOpen={onOpen} />);
    await user.click(screen.getByRole("button", { name: /اختيار العنوان/ }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
