import { describe, expect, it } from "vitest";
import { ELEGANT_PRESET, TECH_PRESET } from "../types";
import { buildPrintableInvoiceHtml, calculatePreviewCheckout, canonicalContactTarget, previewPercentageDiscount, sanitizeCheckoutConfig } from "./checkoutPolicy";

describe("checkout truthfulness contract", () => {
  it("keeps every new-store preset free from demo payment and contact destinations", () => {
    for (const preset of [ELEGANT_PRESET, TECH_PRESET]) {
      expect(preset.enableBankTransfer).toBe(false);
      expect(preset.enableEWallets).toBe(false);
      expect(preset.enableCoupons).toBe(false);
      expect(preset.enableOnlineCard).toBe(false);
      expect(preset.enableApplePay).toBe(false);
      expect(preset.enableStcPay).toBe(false);
      expect(preset.customWallets).toEqual([]);
      expect(preset.customCoupons).toEqual([]);
      expect(preset.phone).toBe("");
      expect(preset.whatsapp).toBe("");
      expect(preset.email).toBe("");
    }
  });

  it("normalizes legacy demo and duplicate checkout capabilities fail closed", () => {
    const sanitized = sanitizeCheckoutConfig({
      ...ELEGANT_PRESET,
      enableBankTransfer: true,
      bankName: "Demo",
      bankAccountName: "Demo",
      bankAccountNumber: "123456789012",
      enableOnlineCard: true,
      enableApplePay: true,
      enableStcPay: true,
      enableEWallets: true,
      customWallets: [
        { id: "Wallet-One", name: "Wallet", accountNumber: "0501234567", accountName: "Demo", active: true },
        { id: "wallet-one", name: "Duplicate", accountNumber: "999999", accountName: "Real", active: true },
      ],
      enableCoupons: true,
      customCoupons: [{ code: "WELCOME10", discountPercent: 10, active: true }],
    });
    expect(sanitized.enableBankTransfer).toBe(false);
    expect(sanitized.enableOnlineCard).toBe(false);
    expect(sanitized.enableApplePay).toBe(false);
    expect(sanitized.enableStcPay).toBe(false);
    expect(sanitized.enableEWallets).toBe(false);
    expect(sanitized.enableCoupons).toBe(false);
    expect(sanitized.customWallets).toHaveLength(1);
    expect(sanitized.customWallets?.[0].active).toBe(false);
  });

  it("accepts only canonical international contact targets", () => {
    expect(canonicalContactTarget("+967 700-000-000")).toBe("+967700000000");
    expect(canonicalContactTarget("770000000")).toBeNull();
    expect(canonicalContactTarget("+12<script>")).toBeNull();
  });

  it("escapes every shopper and merchant string in printable invoice HTML", () => {
    const html = buildPrintableInvoiceHtml({
      orderNum: "<script>order</script>", date: "today", customer: { fullName: "<img src=x>", phone: "+967", city: "Sanaa", address: "<b>home</b>" }, paymentMethod: "COD", items: [{ product: { name: "<svg onload=x>", price: 10 }, quantity: 1 }], subtotal: 10, discount: 0, shipping: 0, tax: 0, codFee: 0, total: 10, currency: "YER",
    }, "<script>store</script>");
    expect(html).not.toContain("<script>store</script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;store&lt;/script&gt;");
    expect(html).toContain("&lt;svg onload=x&gt;");
  });

  it("matches server minor-unit discount, shipping, tax and minimum ordering", () => {
    expect(previewPercentageDiscount(12.55, 10)).toBe(1.26);
    expect(previewPercentageDiscount(490_288_001_775.87, 93.1)).toBe(456_458_129_653.33);
    expect(calculatePreviewCheckout({
      subtotal: 100,
      discount: 10,
      shippingFee: 10,
      freeShippingThreshold: 95,
      taxRate: 15,
      paymentFee: 2,
      minimum: 91,
    })).toEqual({
      subtotal: 100,
      discount: 10,
      shipping: 10,
      tax: 13.5,
      paymentFee: 2,
      total: 115.5,
      minimumMet: false,
    });
  });
});
