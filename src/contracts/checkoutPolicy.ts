import type { Coupon, EWallet, StoreConfig } from "../types";

const demoAccounts = new Set([
  "123456789012", "SA9480000000123456789012", "0501234567", "30678912",
  "770123456", "779876543", "771122334",
]);
const demoCoupons = new Set(["WELCOME10", "SUMMER20"]);
const walletIdPattern = /^[a-z0-9][a-z0-9_-]{0,99}$/;

export const neutralCheckoutPresentation = {
  title: "تم استلام طلبك",
  message: "احتفظ برقم الطلب للمتابعة مع المتجر.",
  whatsappTarget: null as string | null,
};

export function canonicalContactTarget(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!/^\+[0-9() -]+$/.test(trimmed)) return null;
  const digits = trimmed.replace(/\D/g, "");
  return digits.length >= 7 && digits.length <= 15 ? `+${digits}` : null;
}

export function preferredContactTarget(config: Pick<StoreConfig, "whatsapp" | "phone">): string | null {
  return canonicalContactTarget(config.whatsapp) ?? canonicalContactTarget(config.phone);
}

function moneyMinor(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.round(value * 100) : 0;
}

function percentageBasisPoints(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(10_000, Math.round(value * 100)));
}

function percentageMinor(amountMinor: number, basisPoints: number): number {
  if (!Number.isSafeInteger(amountMinor) || !Number.isSafeInteger(basisPoints)) return 0;
  return Number((BigInt(amountMinor) * BigInt(basisPoints) + 5_000n) / 10_000n);
}

export function previewPercentageDiscount(subtotal: number, discountPercent: number): number {
  return percentageMinor(moneyMinor(subtotal), percentageBasisPoints(discountPercent)) / 100;
}

export function calculatePreviewCheckout(input: {
  subtotal: number;
  discount: number;
  shippingFee: number;
  freeShippingThreshold: number;
  taxRate: number;
  paymentFee: number;
  minimum: number;
}) {
  const subtotalMinor = moneyMinor(input.subtotal);
  const discountMinor = Math.min(subtotalMinor, moneyMinor(input.discount));
  const discountedItemsMinor = subtotalMinor - discountMinor;
  const freeAtMinor = moneyMinor(input.freeShippingThreshold);
  const shippingMinor = freeAtMinor > 0 && discountedItemsMinor >= freeAtMinor
    ? 0
    : moneyMinor(input.shippingFee);
  const taxMinor = percentageMinor(discountedItemsMinor, percentageBasisPoints(input.taxRate));
  const paymentFeeMinor = moneyMinor(input.paymentFee);

  return {
    subtotal: subtotalMinor / 100,
    discount: discountMinor / 100,
    shipping: shippingMinor / 100,
    tax: taxMinor / 100,
    paymentFee: paymentFeeMinor / 100,
    total: (discountedItemsMinor + shippingMinor + taxMinor + paymentFeeMinor) / 100,
    minimumMet: discountedItemsMinor >= moneyMinor(input.minimum),
  };
}

export function canonicalWalletId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim().toLowerCase();
  return walletIdPattern.test(id) ? id : null;
}

function usableWallet(wallet: EWallet): boolean {
  return Boolean(
    canonicalWalletId(wallet.id)
    && wallet.name.trim()
    && wallet.accountName?.trim()
    && wallet.accountNumber.trim()
    && !demoAccounts.has(wallet.accountNumber.trim()),
  );
}

function cleanWallets(wallets: EWallet[] | undefined): EWallet[] {
  const seen = new Set<string>();
  return (wallets ?? []).flatMap((wallet) => {
    const id = canonicalWalletId(wallet.id);
    if (!id || seen.has(id)) return [];
    seen.add(id);
    const normalized = { ...wallet, id };
    return [{ ...normalized, active: normalized.active === true && usableWallet(normalized) }];
  });
}

function cleanCoupons(coupons: Coupon[] | undefined): Coupon[] {
  const seen = new Set<string>();
  return (coupons ?? []).flatMap((coupon) => {
    const code = coupon.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{1,50}$/.test(code) || seen.has(code)) return [];
    seen.add(code);
    return [{ ...coupon, code, active: coupon.active === true && !demoCoupons.has(code) }];
  });
}

export function sanitizeCheckoutConfig(config: StoreConfig): StoreConfig {
  const wallets = cleanWallets(config.customWallets);
  const coupons = cleanCoupons(config.customCoupons);
  const bankAccount = config.bankAccountNumber?.trim() ?? "";
  const bankIban = config.bankIban?.trim() ?? "";
  const bankUsable = Boolean(
    config.bankName?.trim()
    && config.bankAccountName?.trim()
    && (bankAccount || bankIban)
    && !demoAccounts.has(bankAccount)
    && !demoAccounts.has(bankIban),
  );

  return {
    ...config,
    enableOnlineCard: false,
    enableApplePay: false,
    enableStcPay: false,
    enableBankTransfer: config.enableBankTransfer === true && bankUsable,
    customWallets: wallets,
    enableEWallets: config.enableEWallets === true && wallets.some((wallet) => wallet.active && usableWallet(wallet)),
    customCoupons: coupons,
    enableCoupons: config.enableCoupons === true && coupons.some((coupon) => coupon.active),
  };
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>'"]/g, (character) => {
    if (character === "&") return "&amp;";
    if (character === "<") return "&lt;";
    if (character === ">") return "&gt;";
    if (character === "'") return "&#39;";
    return "&quot;";
  });
}

interface PrintableOrder {
  orderNum: string;
  date: string;
  customer: { fullName: string; phone: string; city: string; address: string; notes?: string };
  paymentMethod: string;
  transferRefNumber?: string | null;
  items: Array<{ product: { name: string; price: number }; quantity: number }>;
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  codFee: number;
  total: number;
  currency: string;
}

export function buildPrintableInvoiceHtml(order: PrintableOrder, storeName: string): string {
  const money = (value: number) => `${escapeHtml(value)} ${escapeHtml(order.currency)}`;
  const rows = order.items.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.product.name)}</td><td>${escapeHtml(item.quantity)}</td><td>${money(item.product.price)}</td><td>${money(item.product.price * item.quantity)}</td></tr>`).join("");
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>فاتورة ${escapeHtml(order.orderNum)}</title><style>body{font-family:Arial,sans-serif;margin:24px;color:#0f172a}.card{max-width:760px;margin:auto;border:1px solid #cbd5e1;border-radius:16px;padding:24px}h1{font-size:22px}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:9px;border-bottom:1px solid #e2e8f0;text-align:right}.summary{background:#f8fafc;border-radius:12px;padding:14px}.row{display:flex;justify-content:space-between;margin:5px 0}.total{font-weight:800;border-top:1px solid #cbd5e1;padding-top:8px}</style></head><body><main class="card"><h1>${escapeHtml(storeName)}</h1><p>رقم الطلب: <strong>${escapeHtml(order.orderNum)}</strong></p><p>التاريخ: ${escapeHtml(order.date)}</p><section><h2>العميل والتوصيل</h2><p>${escapeHtml(order.customer.fullName)} — ${escapeHtml(order.customer.phone)}</p><p>${escapeHtml(order.customer.city)}، ${escapeHtml(order.customer.address)}</p>${order.customer.notes ? `<p>${escapeHtml(order.customer.notes)}</p>` : ""}</section><section><h2>الدفع</h2><p>${escapeHtml(order.paymentMethod)}</p>${order.transferRefNumber ? `<p>مرجع التحويل: ${escapeHtml(order.transferRefNumber)}</p>` : ""}</section><table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><section class="summary"><div class="row"><span>المجموع</span><span>${money(order.subtotal)}</span></div><div class="row"><span>الخصم</span><span>${money(order.discount)}</span></div><div class="row"><span>الشحن</span><span>${money(order.shipping)}</span></div><div class="row"><span>الضريبة</span><span>${money(order.tax)}</span></div><div class="row"><span>رسوم الدفع</span><span>${money(order.codFee)}</span></div><div class="row total"><span>الإجمالي النهائي</span><span>${money(order.total)}</span></div></section></main><script>window.onload=()=>window.print()</script></body></html>`;
}
