import React from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import type { CopywriterOutput } from "./controlPanelTypes";

interface AiCopywriterPanelProps {
  prompt: string;
  loading: boolean;
  output: CopywriterOutput | null;
  onPromptChange: (prompt: string) => void;
  onSubmit: (event: React.FormEvent) => void;
}

export default function AiCopywriterPanel({ prompt, loading, output, onPromptChange, onSubmit }: AiCopywriterPanelProps) {
  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="bg-sky-50 p-4 rounded-xl border border-sky-100 space-y-1">
        <h4 className="font-bold text-sky-800 text-xs flex items-center gap-1.5">
          <Sparkles className="w-4 h-4" />
          <span>مساعد المحتوى والكتابة الإبداعية</span>
        </h4>
        <p className="text-[11px] text-sky-600 leading-relaxed">
          هل تواجه صعوبة في كتابة شعارات تسويقية أو عروض إعلانية جذابة؟ اكتب فكرتك أو المنتج، وسيقوم مساعدنا الذكي باقتراح أفكار فورية لتستعملها فوراً!
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-3">
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-600">عن ماذا تود الكتابة؟</label>
          <input
            type="text"
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            placeholder="مثال: بخور العود الأزرق الملكي الفاخر..."
            className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 rounded-xl px-4 py-3 text-sm focus:outline-none transition text-slate-800"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="w-full bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-black py-3 min-h-[44px] rounded-xl text-xs transition flex items-center justify-center gap-2 shadow-2xs cursor-pointer touch-manipulation disabled:opacity-50"
        >
          {loading ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>جاري تفعيل الإبداع...</span>
            </>
          ) : (
            <>
              <span>اقترح لي نصوصاً إبداعية ✨</span>
              <Sparkles className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>

      {output && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4 text-xs animate-fadeIn">
          <div className="space-y-1">
            <span className="font-extrabold text-[10px] text-sky-600 uppercase block">اقتراح الشعار (Slogan):</span>
            <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 font-semibold leading-relaxed">"{output.slogan}"</p>
          </div>
          <div className="space-y-1">
            <span className="font-extrabold text-[10px] text-sky-600 uppercase block">عرض ترويجي للإعلان:</span>
            <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed">"{output.banner}"</p>
          </div>
          <div className="space-y-1">
            <span className="font-extrabold text-[10px] text-sky-600 uppercase block">وصف تسويقي للمنتج الأول:</span>
            <p className="text-slate-800 bg-white p-2.5 rounded-lg border border-slate-100 leading-relaxed text-[11px]">"{output.productDesc}"</p>
          </div>
          <p className="text-[10px] text-slate-400 text-center">
            * انسخ أي نص وألصقه في علامات تبويب "معلومات المتجر" أو "المنتجات" لتراه يظهر فوراً!
          </p>
        </div>
      )}
    </div>
  );
}
