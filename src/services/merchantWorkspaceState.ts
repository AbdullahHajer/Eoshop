import type { StoreConfig } from "../types";
import { ELEGANT_PRESET } from "../types";
import { ApiError } from "./apiClient";

export type MerchantRestoreResult = "loaded" | "none" | "error";

export interface WorkspaceMergeResult {
  merged: StoreConfig;
  conflicts: (keyof StoreConfig)[];
}

export interface WorkspaceConflictState {
  tenantId: string;
  base: StoreConfig;
  draft: StoreConfig;
  serverReloaded: boolean;
  merged: StoreConfig | null;
  conflictingFields: (keyof StoreConfig)[];
}

export interface WorkspaceConflictReviewState {
  tenantId: string;
  draft: StoreConfig;
  server: StoreConfig;
  conflictingFields: (keyof StoreConfig)[];
}

export class LatestWorkspaceLoad {
  private sequence = 0;
  private controller: AbortController | null = null;

  begin(): { sequence: number; signal: AbortSignal } {
    this.controller?.abort();
    this.controller = new AbortController();
    return { sequence: ++this.sequence, signal: this.controller.signal };
  }

  isCurrent(sequence: number): boolean {
    return sequence === this.sequence && this.controller?.signal.aborted === false;
  }

  finish(sequence: number): void {
    if (sequence === this.sequence) this.controller = null;
  }

  invalidate(): void {
    this.sequence += 1;
    this.controller?.abort();
    this.controller = null;
  }
}

export function tenantSafeConfig(localDraft: StoreConfig | null): StoreConfig {
  return localDraft ?? ELEGANT_PRESET;
}

export function classifyMerchantRestore(storeCount: number, failed = false): MerchantRestoreResult {
  if (failed) return "error";
  return storeCount === 0 ? "none" : "loaded";
}

export function isRevisionConflict(cause: unknown): cause is ApiError {
  return cause instanceof ApiError
    && cause.category === "conflict"
    && cause.code === "workspace_revision_conflict";
}

export function shouldApplyWorkspaceResponse(
  startingEditGeneration: number,
  currentEditGeneration: number,
  requestIsCurrent: boolean,
): boolean {
  return requestIsCurrent && startingEditGeneration === currentEditGeneration;
}

export function mayDiscardDirtyWorkspace(dirty: boolean, confirmed: boolean): boolean {
  return !dirty || confirmed;
}

export function shouldClaimAiSave(saved: boolean): boolean {
  return saved;
}

export function isAsyncWorkspaceResultCurrent(
  startingOperation: number,
  currentOperation: number,
  startingEditGeneration: number,
  currentEditGeneration: number,
  blocked: boolean,
): boolean {
  return !blocked
    && startingOperation === currentOperation
    && startingEditGeneration === currentEditGeneration;
}

export function hasRecoverableWorkspaceChanges(
  dirty: boolean,
  hasConflict: boolean,
  hasConflictReview: boolean,
): boolean {
  return dirty || hasConflict || hasConflictReview;
}

export function mergeWorkspaceChanges(
  base: StoreConfig,
  draft: StoreConfig,
  server: StoreConfig,
): WorkspaceMergeResult {
  const merged = structuredClone(server);
  const conflicts: (keyof StoreConfig)[] = [];
  const keys = new Set<keyof StoreConfig>([
    ...(Object.keys(base) as (keyof StoreConfig)[]),
    ...(Object.keys(draft) as (keyof StoreConfig)[]),
    ...(Object.keys(server) as (keyof StoreConfig)[]),
  ]);

  for (const key of keys) {
    const baseValue = JSON.stringify(base[key]);
    const draftValue = JSON.stringify(draft[key]);
    const serverValue = JSON.stringify(server[key]);

    if (draftValue === baseValue) continue;
    if (serverValue === baseValue || serverValue === draftValue) {
      (merged as unknown as Record<string, unknown>)[key as string] = structuredClone(draft[key]);
      continue;
    }
    conflicts.push(key);
  }

  return { merged, conflicts };
}

export function openWorkspaceConflict(
  tenantId: string,
  base: StoreConfig,
  draft: StoreConfig,
): WorkspaceConflictState {
  return {
    tenantId,
    base: structuredClone(base),
    draft: structuredClone(draft),
    serverReloaded: false,
    merged: null,
    conflictingFields: [],
  };
}

export function reloadWorkspaceConflict(
  conflict: WorkspaceConflictState,
  server: StoreConfig,
): WorkspaceConflictState {
  const merge = mergeWorkspaceChanges(conflict.base, conflict.draft, server);
  return {
    ...conflict,
    serverReloaded: true,
    merged: merge.merged,
    conflictingFields: merge.conflicts,
  };
}

export function resolveWorkspaceConflict(
  conflict: WorkspaceConflictState,
  server: StoreConfig,
): { config: StoreConfig; review: WorkspaceConflictReviewState | null } | null {
  if (!conflict.serverReloaded || !conflict.merged) return null;
  return {
    config: conflict.merged,
    review: conflict.conflictingFields.length === 0 ? null : {
      tenantId: conflict.tenantId,
      draft: conflict.draft,
      server,
      conflictingFields: conflict.conflictingFields,
    },
  };
}
