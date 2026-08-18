import type { Product, StoreConfig } from "../../types";

export type ControlTab =
  | "branding"
  | "design"
  | "products"
  | "inventory"
  | "orders"
  | "checkout"
  | "pages"
  | "ai"
  | "export";

export type PreviewDevice = "desktop" | "mobile";

export interface ControlPanelProps {
  config: StoreConfig;
  activeTenantId: string | null;
  canViewInventory?: boolean;
  canManageInventory?: boolean;
  handleConfigChange: (key: keyof StoreConfig, value: any) => void;
  handleProductChange: (index: number, key: keyof Product, value: any) => void;
  handleProductMediaChange: (productId: string, urls: string[]) => void;
  adjustInventory?: (targets: Array<{ productId: string; targetOnHand: number }>) => Promise<boolean>;
  updateInventoryPolicy?: (productId: string, manageStock: boolean, lowStockThreshold: number) => Promise<boolean>;
  addEmptyProduct: () => void;
  deleteProduct: (id: string) => void;
  activeTab: ControlTab;
  setActiveTab: (tab: ControlTab) => void;
  previewDevice: PreviewDevice;
  setPreviewDevice: (device: PreviewDevice) => void;
  onOpenCheckoutPreview?: () => void;
  onOpenDomainModal?: () => void;
}

export interface CopywriterOutput {
  slogan?: string;
  banner?: string;
  productDesc?: string;
}
