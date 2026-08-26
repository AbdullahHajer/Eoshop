import { useCallback, useEffect, useRef, useState } from "react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import type { OrderReceipt } from "../adapters/uiAdapters";
import { isUiError, uiErrorMessage } from "../contracts/uiError";
import { randomUuid } from "../utils/randomUuid";

export function useMerchantOrders(tenantId: string, enabled: boolean, onSessionExpired?: () => void) {
  const { orders } = useUiAdapters();
  const [items, setItems] = useState<OrderReceipt[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(() => new Set());
  const loadSequence = useRef(0);
  const transitionSequence = useRef(0);
  const pendingRef = useRef(new Set<string>());
  const transitionKeys = useRef(new Map<string, string>());
  const loadController = useRef<AbortController | null>(null);
  const transitionControllers = useRef(new Map<string, AbortController>());
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  const load = useCallback(async () => {
    if (!enabled || pendingRef.current.size > 0) return;
    const sequence = ++loadSequence.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const result = await orders.list(tenantId, controller.signal);
      if (sequence !== loadSequence.current) return;
      setItems(result.items);
      setTotal(result.total);
    } catch (caught) {
      if (sequence !== loadSequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setItems([]);
      setTotal(null);
      setError(uiErrorMessage(caught, "تعذر تحميل طلبات المتجر."));
    } finally {
      if (sequence === loadSequence.current) setLoading(false);
    }
  }, [enabled, orders, tenantId]);

  useEffect(() => {
    loadSequence.current += 1;
    transitionSequence.current += 1;
    loadController.current?.abort();
    transitionControllers.current.forEach((controller) => controller.abort());
    transitionControllers.current.clear();
    pendingRef.current.clear();
    setPendingOrderIds(new Set());
    setItems([]);
    setTotal(null);
    setError(null);
    if (enabled) void load();
    return () => {
      loadSequence.current += 1;
      transitionSequence.current += 1;
      loadController.current?.abort();
      transitionControllers.current.forEach((controller) => controller.abort());
      transitionControllers.current.clear();
    };
  }, [enabled, load, tenantId]);

  const advance = useCallback(async (order: OrderReceipt, target: OrderReceipt["status"]) => {
    if (!enabled || pendingRef.current.size > 0 || !order.allowedTransitions?.some((allowed) => allowed === target)) return;
    loadSequence.current += 1;
    loadController.current?.abort();
    setLoading(false);
    const operation = `${tenantId}:${order.id}:${target}:merchant_${target}`;
    const key = transitionKeys.current.get(operation) ?? randomUuid();
    transitionKeys.current.set(operation, key);
    const sequence = transitionSequence.current;
    const controller = new AbortController();
    transitionControllers.current.set(operation, controller);
    pendingRef.current.add(order.id);
    setPendingOrderIds(new Set(pendingRef.current));
    setError(null);
    try {
      const result = await orders.updateStatus(tenantId, order.id, target, `merchant_${target}`, key, controller.signal);
      if (sequence !== transitionSequence.current) return;
      transitionKeys.current.delete(operation);
      if (result.replayed) {
        const authoritative = await orders.list(tenantId, controller.signal);
        if (sequence !== transitionSequence.current) return;
        setItems(authoritative.items);
        setTotal(authoritative.total);
      } else {
        setItems((current) => current.map((candidate) => candidate.id === result.order.id ? result.order : candidate));
      }
    } catch (caught) {
      if (sequence !== transitionSequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setError(uiErrorMessage(caught, "تعذر تحديث حالة الطلب. يمكنك إعادة المحاولة دون تكرار العملية."));
    } finally {
      transitionControllers.current.delete(operation);
      if (sequence === transitionSequence.current) {
        pendingRef.current.delete(order.id);
        setPendingOrderIds(new Set(pendingRef.current));
      }
    }
  }, [enabled, orders, tenantId]);

  return { items, total, loading, error, pendingOrderIds, load, advance };
}
