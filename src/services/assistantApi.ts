import { arrayField, enumField, numberField, record, stringField } from "./apiContract";
import { apiClient } from "./apiClient";

export interface GeneratedStoreProduct {
  name: string;
  price: number;
  description: string;
  category: string;
  imageKeyword: string;
}

export interface GeneratedStoreIdeas {
  storeName: string;
  slogan: string;
  logoIcon: string | null;
  primaryColor: string;
  secondaryColor: string;
  themeStyle: "elegant" | "tech";
  bannerText: string;
  products: GeneratedStoreProduct[];
}

function mapIdeas(value: unknown): GeneratedStoreIdeas {
  const dto = record(value, "مقترحات المتجر الذكية");

  return {
    storeName: stringField(dto, "storeName", "مقترحات المتجر الذكية"),
    slogan: stringField(dto, "slogan", "مقترحات المتجر الذكية"),
    logoIcon: typeof dto.logoIcon === "string" ? dto.logoIcon : null,
    primaryColor: stringField(dto, "primaryColor", "مقترحات المتجر الذكية"),
    secondaryColor: stringField(dto, "secondaryColor", "مقترحات المتجر الذكية"),
    themeStyle: enumField(dto, "themeStyle", ["elegant", "tech"] as const, "مقترحات المتجر الذكية"),
    bannerText: stringField(dto, "bannerText", "مقترحات المتجر الذكية"),
    products: arrayField(dto, "products", "مقترحات المتجر الذكية").map((productValue) => {
      const product = record(productValue, "منتج مقترح");
      return {
        name: stringField(product, "name", "منتج مقترح"),
        price: numberField(product, "price", "منتج مقترح"),
        description: stringField(product, "description", "منتج مقترح"),
        category: stringField(product, "category", "منتج مقترح"),
        imageKeyword: stringField(product, "imageKeyword", "منتج مقترح"),
      };
    }),
  };
}

export const assistantApi = {
  async generateStoreIdeas(description: string): Promise<GeneratedStoreIdeas> {
    const payload = await apiClient.request<unknown>("/api/generate-store-ideas", {
      method: "POST",
      body: { description },
    });

    return mapIdeas(payload);
  },
};
