import { useCallback, useEffect, useRef, useState } from "react";
import { useUiAdapters } from "../adapters/UiAdaptersContext";
import { isUiError, uiErrorMessage } from "../contracts/uiError";
import type { InventoryItem } from "../services/inventoryApi";
import { randomUuid } from "../utils/randomUuid";

type InventoryHookMutation = { replayed: boolean; items: InventoryItem[] };

export function useMerchantInventory(tenantId: string, enabled: boolean, onSessionExpired?: () => void) {
  const { inventory } = useUiAdapters();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingProductIds, setPendingProductIds] = useState<Set<string>>(() => new Set());
  const sequence = useRef(0);
  const loadController = useRef<AbortController | null>(null);
  const mutationControllers = useRef(new Map<string, AbortController>());
  const mutationKeys = useRef(new Map<string, string>());
  const pendingRef = useRef(new Set<string>());
  const sessionExpired = useRef(onSessionExpired);
  sessionExpired.current = onSessionExpired;

  const load = useCallback(async () => {
    if (!enabled || pendingRef.current.size > 0) return;
    const operation = ++sequence.current;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    setLoading(true);
    setError(null);
    try {
      const loaded = await inventory.load(tenantId, controller.signal);
      if (operation !== sequence.current) return;
      setItems(loaded);
    } catch (caught) {
      if (operation !== sequence.current || isUiError(caught, "aborted")) return;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return;
      }
      setItems([]);
      setError(uiErrorMessage(caught, "تعذر تحميل مخزون المتجر."));
    } finally {
      if (operation === sequence.current) setLoading(false);
    }
  }, [enabled, inventory, tenantId]);

  useEffect(() => {
    sequence.current += 1;
    loadController.current?.abort();
    mutationControllers.current.forEach((controller) => controller.abort());
    mutationControllers.current.clear();
    pendingRef.current.clear();
    setPendingProductIds(new Set());
    setItems([]);
    setError(null);
    if (enabled) void load();
    return () => {
      sequence.current += 1;
      loadController.current?.abort();
      mutationControllers.current.forEach((controller) => controller.abort());
      mutationControllers.current.clear();
    };
  }, [enabled, load, tenantId]);

  const runMutation = useCallback(async (
    productId: string,
    fingerprint: string,
    mutation: (key: string, signal: AbortSignal) => Promise<InventoryHookMutation>,
  ) => {
    if (!enabled || pendingRef.current.size > 0) return false;
    const operation = ++sequence.current;
    loadController.current?.abort();
    setLoading(false);
    const key = mutationKeys.current.get(fingerprint) ?? randomUuid();
    mutationKeys.current.set(fingerprint, key);
    const controller = new AbortController();
    mutationControllers.current.set(fingerprint, controller);
    pendingRef.current.add(productId);
    setPendingProductIds(new Set(pendingRef.current));
    setError(null);
    try {
      const result = await mutation(key, controller.signal);
      if (operation !== sequence.current) return false;
      mutationKeys.current.delete(fingerprint);
      const updated = result.replayed ? await inventory.load(tenantId, controller.signal) : result.items;
      if (operation !== sequence.current) return false;
      const byId = new Map(updated.map((item) => [item.productId, item]));
      setItems((current) => current.map((item) => byId.get(item.productId) ?? item));
      return true;
    } catch (caught) {
      if (operation !== sequence.current || isUiError(caught, "aborted")) return false;
      if (isUiError(caught, "unauthenticated")) {
        sessionExpired.current?.();
        return false;
      }
      setError(uiErrorMessage(caught, "تعذر تحديث المخزون. راجع الرصيد ثم أعد المحاولة."));
      return false;
    } finally {
      mutationControllers.current.delete(fingerprint);
      if (operation === sequence.current) {
        pendingRef.current.delete(productId);
        setPendingProductIds(new Set(pendingRef.current));
      }
    }
  }, [enabled, inventory, tenantId]);

  const adjustTo = useCallback(async (item: InventoryItem, targetOnHand: number) => {
    const delta = targetOnHand - item.onHand;
    if (delta === 0) return true;
    const fingerprint = `${tenantId}:adjust:${item.productId}:${item.inventoryRevision}:${targetOnHand}`;
    return runMutation(item.productId, fingerprint, async (key, signal) => {
      const result = await inventory.adjust(tenantId, [{
        productId: item.productId,
        expectedInventoryRevision: item.inventoryRevision,
        movementKind: "correction",
        delta,
      }], "merchant_manual_correction", "Merchant operations stock correction", key, signal);
      return result;
    });
  }, [inventory, runMutation, tenantId]);

  const updatePolicy = useCallback(async (item: InventoryItem, manageStock: boolean, threshold: number) => {
    const fingerprint = `${tenantId}:policy:${item.productId}:${item.inventoryRevision}:${manageStock}:${threshold}`;
    return runMutation(item.productId, fingerprint, async (key, signal) => {
      const result = await inventory.updatePolicy(
        tenantId,
        item.productId,
        item.inventoryRevision,
        manageStock,
        threshold,
        key,
        signal,
      );
      return { replayed: result.replayed, items: [result.item] };
    });
  }, [inventory, runMutation, tenantId]);

  return { items, loading, error, pendingProductIds, load, adjustTo, updatePolicy };
}
