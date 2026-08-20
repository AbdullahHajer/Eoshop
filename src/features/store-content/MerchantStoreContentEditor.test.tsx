// @vitest-environment jsdom

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { StoreAssetUpload } from "../../adapters/uiAdapters";
import { ELEGANT_PRESET } from "../../types";
import MerchantStoreContentEditor from "./MerchantStoreContentEditor";

afterEach(cleanup);

describe("MerchantStoreContentEditor", () => {
  it("binds a managed About image only to the active tenant context", async () => {
    const uploadAsset = vi.fn().mockResolvedValue({ id: "asset-a", url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111", mimeType: "image/png", byteSize: 4 });
    const onChange = vi.fn();
    render(<MerchantStoreContentEditor config={ELEGANT_PRESET} activeTenantId="tenant-a" mediaOwnerKey="user-a" onChange={onChange} uploadAsset={uploadAsset} />);
    const file = new File([new Uint8Array([1, 2, 3, 4])], "about.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/رفع من الجهاز/), { target: { files: [file] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith("aboutImage", "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111"));
    expect(uploadAsset).toHaveBeenCalledWith("tenant-a", file, expect.any(AbortSignal));
  });

  it("keeps upload unavailable before a real tenant exists", () => {
    render(<MerchantStoreContentEditor config={ELEGANT_PRESET} activeTenantId={null} mediaOwnerKey={null} onChange={vi.fn()} uploadAsset={vi.fn()} />);
    expect((screen.getByLabelText(/رفع من الجهاز/) as HTMLInputElement).disabled).toBe(true);
  });

  it("discards a late About upload after the account or tenant context changes", async () => {
    let resolveUpload!: (asset: StoreAssetUpload) => void;
    const uploadAsset = vi.fn((_tenantId: string, _file: File, _signal?: AbortSignal) => new Promise<StoreAssetUpload>((resolve) => { resolveUpload = resolve; }));
    const onChange = vi.fn();
    const { rerender } = render(<MerchantStoreContentEditor config={ELEGANT_PRESET} activeTenantId="tenant-a" mediaOwnerKey="user-a" onChange={onChange} uploadAsset={uploadAsset} />);
    const file = new File([new Uint8Array([1, 2, 3, 4])], "about.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText(/رفع من الجهاز/), { target: { files: [file] } });
    rerender(<MerchantStoreContentEditor config={ELEGANT_PRESET} activeTenantId="tenant-b" mediaOwnerKey="user-b" onChange={onChange} uploadAsset={uploadAsset} />);

    await act(async () => resolveUpload({ id: "asset-a", url: "/api/store-assets/tenant-a/11111111-1111-4111-8111-111111111111", mimeType: "image/png", byteSize: 4 }));

    expect(onChange).not.toHaveBeenCalled();
    expect((uploadAsset.mock.calls[0][2] as AbortSignal).aborted).toBe(true);
  });
});
