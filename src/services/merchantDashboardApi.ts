import { apiClient, ApiError } from "./apiClient";
import {
  arrayField,
  booleanField,
  enumField,
  nullableNumberField,
  numberField,
  record,
  stringField,
} from "./apiContract";

export type MerchantDashboardTaskCode = "orders_new" | "inventory_low" | "products_draft" | "store_contact_missing";
export type MerchantDashboardSection = "products" | "orders" | "inventory" | "pages";

export interface MerchantDashboardSnapshot {
  tenantId: string;
  generatedAt: string;
  currencyCode: string;
  visibility: {
    orders: boolean;
    inventory: boolean;
    analytics: boolean;
    productsManage: boolean;
    workspaceManage: boolean;
  };
  metrics: {
    salesTodayMinor: number | null;
    ordersToday: number | null;
    openOrders: number | null;
    publishedProducts: number | null;
    draftProducts: number | null;
    lowStockProducts: number | null;
  };
  tasks: Array<{
    code: MerchantDashboardTaskCode;
    count: number;
    section: MerchantDashboardSection;
    priority: "high" | "medium";
  }>;
  recentOrders: Array<{
    id: string;
    number: string;
    status: "submitted" | "accepted" | "processing" | "completed" | "cancelled" | "expired";
    paymentState: "due_on_delivery" | "transfer_submitted_unverified";
    currencyCode: string;
    grandTotalMinor: number;
    createdAt: string;
  }>;
  salesSeries: Array<{ date: string; totalMinor: number }>;
  topProducts: Array<{ productId: string; name: string; quantity: number }>;
}

function safeNonNegative(value: number | null, contract: string): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new ApiError(`استجابة الخادم لا تطابق عقد ${contract}.`, "unexpected", 200);
  }
  return value;
}

function mapDashboard(value: unknown): MerchantDashboardSnapshot {
  const envelope = record(value, "لوحة تشغيل المتجر");
  const dto = record(envelope.data, "لوحة تشغيل المتجر");
  const visibility = record(dto.visibility, "صلاحيات لوحة المتجر");
  const metrics = record(dto.metrics, "مؤشرات لوحة المتجر");

  return {
    tenantId: stringField(dto, "tenantId", "لوحة تشغيل المتجر"),
    generatedAt: stringField(dto, "generatedAt", "لوحة تشغيل المتجر"),
    currencyCode: stringField(dto, "currencyCode", "لوحة تشغيل المتجر"),
    visibility: {
      orders: booleanField(visibility, "orders", "صلاحيات لوحة المتجر"),
      inventory: booleanField(visibility, "inventory", "صلاحيات لوحة المتجر"),
      analytics: booleanField(visibility, "analytics", "صلاحيات لوحة المتجر"),
      productsManage: booleanField(visibility, "productsManage", "صلاحيات لوحة المتجر"),
      workspaceManage: booleanField(visibility, "workspaceManage", "صلاحيات لوحة المتجر"),
    },
    metrics: {
      salesTodayMinor: safeNonNegative(nullableNumberField(metrics, "salesTodayMinor", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
      ordersToday: safeNonNegative(nullableNumberField(metrics, "ordersToday", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
      openOrders: safeNonNegative(nullableNumberField(metrics, "openOrders", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
      publishedProducts: safeNonNegative(nullableNumberField(metrics, "publishedProducts", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
      draftProducts: safeNonNegative(nullableNumberField(metrics, "draftProducts", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
      lowStockProducts: safeNonNegative(nullableNumberField(metrics, "lowStockProducts", "مؤشرات لوحة المتجر"), "مؤشرات لوحة المتجر"),
    },
    tasks: arrayField(dto, "tasks", "مهام لوحة المتجر").map((value) => {
      const task = record(value, "مهمة لوحة المتجر");
      return {
        code: enumField(task, "code", ["orders_new", "inventory_low", "products_draft", "store_contact_missing"] as const, "مهمة لوحة المتجر"),
        count: safeNonNegative(numberField(task, "count", "مهمة لوحة المتجر"), "مهمة لوحة المتجر")!,
        section: enumField(task, "section", ["products", "orders", "inventory", "pages"] as const, "مهمة لوحة المتجر"),
        priority: enumField(task, "priority", ["high", "medium"] as const, "مهمة لوحة المتجر"),
      };
    }),
    recentOrders: arrayField(dto, "recentOrders", "أحدث طلبات المتجر").map((value) => {
      const order = record(value, "طلب مختصر");
      return {
        id: stringField(order, "id", "طلب مختصر"),
        number: stringField(order, "number", "طلب مختصر"),
        status: enumField(order, "status", ["submitted", "accepted", "processing", "completed", "cancelled", "expired"] as const, "طلب مختصر"),
        paymentState: enumField(order, "paymentState", ["due_on_delivery", "transfer_submitted_unverified"] as const, "طلب مختصر"),
        currencyCode: stringField(order, "currencyCode", "طلب مختصر"),
        grandTotalMinor: safeNonNegative(numberField(order, "grandTotalMinor", "طلب مختصر"), "طلب مختصر")!,
        createdAt: stringField(order, "createdAt", "طلب مختصر"),
      };
    }),
    salesSeries: arrayField(dto, "salesSeries", "سلسلة مبيعات المتجر").map((value) => {
      const point = record(value, "نقطة مبيعات");
      return {
        date: stringField(point, "date", "نقطة مبيعات"),
        totalMinor: safeNonNegative(numberField(point, "totalMinor", "نقطة مبيعات"), "نقطة مبيعات")!,
      };
    }),
    topProducts: arrayField(dto, "topProducts", "المنتجات الأكثر مبيعًا").map((value) => {
      const product = record(value, "منتج مبيع");
      return {
        productId: stringField(product, "productId", "منتج مبيع"),
        name: stringField(product, "name", "منتج مبيع"),
        quantity: safeNonNegative(numberField(product, "quantity", "منتج مبيع"), "منتج مبيع")!,
      };
    }),
  };
}

export const merchantDashboardApi = {
  async load(tenantId: string, signal?: AbortSignal): Promise<MerchantDashboardSnapshot> {
    return mapDashboard(await apiClient.request(
      `/api/merchant/stores/${encodeURIComponent(tenantId)}/dashboard`,
      { signal },
    ));
  },
};
