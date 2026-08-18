import React from "react";
import { CheckCircle2, Download, Monitor, Smartphone } from "lucide-react";
import type { PreviewDevice } from "./controlPanelTypes";

interface PreviewDeviceSelectorProps {
  device: PreviewDevice;
  onChange: (device: PreviewDevice) => void;
}

export function PreviewDeviceSelector({ device, onChange }: PreviewDeviceSelectorProps) {
  return (
    <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
      <h3 className="font-extrabold text-xs text-slate-500 uppercase tracking-wider">نمط المعاينة</h3>
      <div className="flex items-center bg-white p-1 rounded-xl border border-slate-200/90 shadow-2xs">
        <button
          onClick={() => onChange("desktop")}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
            device === "desktop" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Monitor className="w-4 h-4" />
          <span>كمبيوتر</span>
        </button>
        <button
          onClick={() => onChange("mobile")}
          className={`px-3.5 py-2 min-h-[40px] rounded-lg text-xs font-extrabold flex items-center gap-1.5 transition touch-manipulation cursor-pointer active:scale-95 ${
            device === "mobile" ? "bg-amber-500 text-slate-950 shadow-xs font-black" : "text-slate-600 hover:text-slate-900"
          }`}
        >
          <Smartphone className="w-4 h-4" />
          <span>جوال</span>
        </button>
      </div>
    </div>
  );
}

interface CustomizationCompletionBarProps {
  onComplete: () => void;
}

export function CustomizationCompletionBar({ onComplete }: CustomizationCompletionBarProps) {
  return (
    <div className="p-3 bg-slate-50/90 backdrop-blur-xs border-t border-slate-200 shrink-0 shadow-lg flex items-center justify-between gap-2">
      <div className="text-[11px] text-slate-600 font-bold flex items-center gap-1.5 min-w-0 truncate">
        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
        <span className="truncate">هل انتهيت من تعديل القالب والمنتجات؟</span>
      </div>
      <button
        type="button"
        onClick={onComplete}
        className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs rounded-xl shadow-md hover:shadow-emerald-600/30 transition flex items-center gap-1.5 shrink-0 cursor-pointer active:scale-95"
      >
        <span>تم الانتهاء من التخصيص 🚀</span>
        <Download className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
