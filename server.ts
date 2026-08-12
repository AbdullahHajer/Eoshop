import express from "express";
import path from "path";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini SDK with telemetry header
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// API endpoint to generate store suggestions based on user description
app.post("/api/generate-store-ideas", async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const { description } = req.body;
    if (!description || typeof description !== "string") {
      res.status(400).json({ error: "الرجاء إدخال وصف صحيح للمتجر" });
      return;
    }

    const systemInstruction = `أنت خبير في التجارة الإلكترونية وتصميم الهويات البصرية للمتاجر السعودية والخليجية. 
مهمتك هي مساعدة المستخدم في توليد هوية كاملة لمتجره الإلكتروني الجديد بناءً على الوصف المقدم باللغة العربية.
يجب أن ترجع النتيجة ككائن JSON ملتزم تماماً بالهيكل المطلوب، باللغة العربية الفصحى الأنيقة والجذابة للمشترين.`;

    const prompt = `أريد فكرة متجر وتفاصيل كاملة بناءً على هذا الوصف: "${description}".
قم بإنشاء اسم متجر جذاب وعصري، شعار قصير ومميز (Slogan)، ألوان متناسقة، وقائمة بـ 4 منتجات متميزة وواقعية مع أسعارها بالريال السعودي (SAR).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["storeName", "slogan", "primaryColor", "secondaryColor", "themeStyle", "bannerText", "products"],
          properties: {
            storeName: {
              type: Type.STRING,
              description: "اسم تجاري مميز للمتجر باللغة العربية (مثال: نكهة الهيل، عبير العود)",
            },
            slogan: {
              type: Type.STRING,
              description: "شعار لفظي قصير وجذاب (مثال: شغف القهوة في كل كوب، سحر الشرق بين يديك)",
            },
            primaryColor: {
              type: Type.STRING,
              description: "رمز لون أساسي متناسق مع النيش بنظام Hex (مثال: #8B5A2B للقهوة، #D4AF37 للذهب والعطور)",
            },
            secondaryColor: {
              type: Type.STRING,
              description: "رمز لون فرعي متناسق بنظام Hex (مثال: #fdfaf6 أو #1e293b)",
            },
            themeStyle: {
              type: Type.STRING,
              description: "أسلوب تصميم القالب المناسب للمتجر: 'elegant' أو 'tech'",
            },
            bannerText: {
              type: Type.STRING,
              description: "عبارة ترحيبية أو عرض ترويجي للواجهة العريضة (مثال: خصم 20% على أول طلب)",
            },
            products: {
              type: Type.ARRAY,
              description: "قائمة من 4 منتجات أساسية لبدء المتجر",
              items: {
                type: Type.OBJECT,
                required: ["name", "price", "description", "category", "imageKeyword"],
                properties: {
                  name: {
                    type: Type.STRING,
                    description: "اسم المنتج بالتفصيل (مثال: بن إثيوبي مختص، طقم مبخرة رخام)",
                  },
                  price: {
                    type: Type.NUMBER,
                    description: "سعر المنتج بالريال السعودي كرقم فقط (مثال: 45, 120)",
                  },
                  description: {
                    type: Type.STRING,
                    description: "وصف تسويقي مغري وقصير يبرز مميزات المنتج",
                  },
                  category: {
                    type: Type.STRING,
                    description: "التصنيف الفرعي للمنتج (مثال: قهوة مختصة، أدوات منزلية، عطور)",
                  },
                  imageKeyword: {
                    type: Type.STRING,
                    description: "كلمة مفتاحية بالإنجليزية مناسبة لصورة المنتج لاستخدامها في البحث عن صور ملائمة (مثال: coffee-beans, perfume, oud-wood, jewelry, electronics)",
                  }
                }
              }
            }
          }
        }
      }
    });

    const resultText = response.text;
    if (!resultText) {
      throw new Error("لم يتم توليد أي محتوى من الذكاء الاصطناعي");
    }

    const storeData = JSON.parse(resultText);
    res.json(storeData);
  } catch (error: any) {
    console.error("Gemini Generation Error:", error);
    res.status(500).json({ error: error.message || "فشل توليد الأفكار، يرجى المحاولة لاحقاً" });
  }
});

// Setup Vite or Static File Server
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server is running at http://0.0.0.0:${PORT}`);
  });
}

setupServer();
