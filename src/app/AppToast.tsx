import { AnimatePresence, motion } from "motion/react";
import { Sparkles } from "lucide-react";

export interface AppToastMessage {
  message: string;
  type: "success" | "error" | "info";
}

interface AppToastProps {
  toast: AppToastMessage | null;
}

export default function AppToast({ toast }: AppToastProps) {
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-4 rounded-xl shadow-xl border text-sm md:text-base font-semibold max-w-lg text-center ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-800 border-emerald-200"
              : toast.type === "error"
                ? "bg-rose-50 text-rose-800 border-rose-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
          }`}
        >
          <Sparkles className="w-5 h-5 shrink-0" />
          <span>{toast.message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
