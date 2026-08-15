import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "./apiClient";
import { assistantApi } from "./assistantApi";

afterEach(() => {
  apiClient.clearCsrfToken();
  vi.unstubAllGlobals();
});

describe("assistantApi", () => {
  it("maps the generated DTO and discards unknown model output", async () => {
    const generated = {
      storeName: "متجر الاختبار",
      slogan: "شعار",
      primaryColor: "#112233",
      secondaryColor: "#ffffff",
      themeStyle: "elegant",
      bannerText: "أهلًا",
      secretPrompt: "must-not-escape",
      products: [{
        name: "منتج",
        price: 99,
        description: "وصف",
        category: "عام",
        imageKeyword: "product",
        internalScore: 0.9,
      }],
    };
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ csrf_token: "ai-csrf" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(generated), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await assistantApi.generateStoreIdeas("فكرة متجر");

    expect(result).not.toHaveProperty("secretPrompt");
    expect(result.products[0]).not.toHaveProperty("internalScore");
    expect(result).toMatchObject({ storeName: "متجر الاختبار", products: [{ price: 99 }] });
  });
});
