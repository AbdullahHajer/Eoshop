import React, { useState, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  User, Mail, Building2, Briefcase, FileText, UploadCloud, 
  CheckCircle, AlertCircle, RefreshCw, ShieldCheck, Lock, X, Eye, Globe, Share2, Phone
} from "lucide-react";

interface RegistrationGatewayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (userData: {
    fullName: string;
    email: string;
    businessName: string;
    businessType: string;
    socialPageUrl?: string;
    docType: string;
    fileName: string;
    fileSize: string;
  }) => void;
  initialStoreName?: string;
  currentUser?: {
    fullName: string;
    email: string;
    businessName: string;
    businessType: string;
    socialPageUrl?: string;
    docType: string;
    fileName?: string;
    fileSize?: string;
  } | null;
  authenticatedUser: {
    fullName: string;
    email: string;
  };
}

export default function RegistrationGateway({ 
  isOpen, 
  onClose, 
  onSuccess,
  initialStoreName = "",
  currentUser = null,
  authenticatedUser,
}: RegistrationGatewayProps) {
  
  // Form states
  const [fullName] = useState(authenticatedUser.fullName);
  const [email] = useState(authenticatedUser.email);
  const [phone, setPhone] = useState("");
  const [businessName, setBusinessName] = useState(currentUser?.businessName || initialStoreName);
  const [businessType, setBusinessType] = useState(currentUser?.businessType || "عطور وبخور");
  const [socialPageUrl, setSocialPageUrl] = useState(currentUser?.socialPageUrl || "");
  const [docType, setDocType] = useState(currentUser?.docType || "حساب تجاري / سوشيال ميديا");
  
  // File upload states (NOW OPTIONAL)
  const [file, setFile] = useState<any>(
    currentUser?.fileName 
      ? { name: currentUser.fileName, size: currentUser.fileSize || "0 Bytes", isPreloaded: true }
      : null
  );
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragActive, setIsDragActive] = useState(false);
  
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileChange = (selectedFile: File) => {
    setError("");
    const allowedExtensions = ["pdf", "jpg", "jpeg", "png", "docx"];
    const fileExt = selectedFile.name.split(".").pop()?.toLowerCase() || "";
    
    if (!allowedExtensions.includes(fileExt)) {
      setError("صيغة الملف غير مدعومة! يمكنك إرفاق ملف PDF أو صورة (PNG, JPG) أو ترك المستند فارغاً والاستكفاء برابط الصفحة.");
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      setError("حجم الملف كبير جداً! الحد الأقصى المسموح به هو 10 ميجابايت.");
      return;
    }

    setFile(selectedFile);
    simulateUpload(selectedFile);
  };

  // Simulate uploading experience
  const simulateUpload = (selectedFile: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    const interval = setInterval(() => {
      setUploadProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsUploading(false);
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  // Drag and drop handlers
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const removeFile = () => {
    setFile(null);
    setUploadProgress(0);
    setIsUploading(false);
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = 2;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!fullName.trim()) {
      setError("يرجى إدخال اسم مالك المتجر.");
      return;
    }
    if (!email.trim() || !email.includes("@")) {
      setError("يرجى إدخال بريد إلكتروني صحيح للقيام بالربط والإشعارات.");
      return;
    }
    if (!businessName.trim()) {
      setError("يرجى تحديد اسم المتجر المراد إنشاؤه.");
      return;
    }
    if (isUploading) {
      setError("يرجى الانتظار حتى اكتمال رفع الملف المرفق في حال قمت باختيار ملف.");
      return;
    }

    // Call success with simplified owner brief details
    onSuccess({
      fullName,
      email,
      businessName,
      businessType,
      socialPageUrl: socialPageUrl.trim() || "صفحة تواصل رسمية (فيسبوك/واتساب)",
      docType: file ? docType : "حساب تجاري / سوشيال ميديا",
      fileName: file ? file.name : (socialPageUrl ? `رابط: ${socialPageUrl}` : "صفحة موثقة بدونه سجل تجاري"),
      fileSize: file ? formatBytes(file.size) : "رقمي"
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh] text-right"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Header section with easy brief design */}
        <div className="bg-gradient-to-r from-slate-900 via-sky-950 to-slate-900 text-white px-6 py-5 flex items-center justify-between select-none shrink-0 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="bg-sky-500/20 text-sky-400 p-2.5 rounded-2xl border border-sky-400/30">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-base md:text-lg">بريف التقديم الميسر لإنشاء المتجر 🚀</h2>
              <span className="text-[11px] text-sky-200/90 block -mt-0.5">بدون سجل تجاري! يكفي بيانات المالك ورابط صفحتك التجارية لتفعيل متجرك</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-start gap-3 text-rose-800 text-xs font-semibold"
            >
              <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{error}</p>
            </motion.div>
          )}

          {/* Intro Notice highlighting No Commercial Register Required */}
          <div className="bg-gradient-to-r from-emerald-50 to-sky-50 border border-emerald-200/80 p-4 rounded-2xl space-y-1">
            <h4 className="font-extrabold text-emerald-900 text-xs flex items-center gap-2">
              <CheckCircle className="w-4.5 h-4.5 text-emerald-600" />
              <span>تقديم ميسر وسريع بدون تعقيدات رسمية ✨</span>
            </h4>
            <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
              لا يلزم وجود سجل تجاري! يمكنك البدء مباشرة بتعبئة بيانات مالك المتجر وتزويدنا برابط صفحتك على (فيسبوك، إنستغرام، تيك توك، أو واتساب) ليتم إعداد متجرك الإلكتروني الفاخر وتفعيله فوراً.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Owner Full Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">اسم مالك المتجر (المالك)</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={fullName}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-slate-700 text-xs font-bold"
                  placeholder="مثال: محمد بن علي العتيبي"
                />
                <User className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* Owner Email */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">البريد الإلكتروني للتواصل</label>
              <div className="relative">
                <input
                  type="email"
                  required
                  value={email}
                  readOnly
                  className="w-full bg-slate-100 border border-slate-200 rounded-xl pr-10 pl-4 py-3 text-slate-700 text-xs font-bold text-left"
                  placeholder="merchant@example.com"
                />
                <Mail className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* Store Proposed Name */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">اسم المتجر المراد إنشاؤه</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl pr-10 pl-4 py-3 text-slate-800 text-xs font-bold focus:outline-none transition"
                  placeholder="مثال: متجر الفخامة للعود"
                />
                <Building2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>

            {/* Business Category */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">مجال ونشاط المتجر</label>
              <div className="relative">
                <select
                  value={businessType}
                  onChange={(e) => setBusinessType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl pr-10 pl-4 py-3 text-slate-800 text-xs font-bold focus:outline-none transition appearance-none"
                >
                  <option value="عطور وبخور">عطور وبخور شرقية وفرنسية</option>
                  <option value="إلكترونيات وأجهزة">إلكترونيات وأجهزة ذكية وملحقاتها</option>
                  <option value="أزياء وملابس">أزياء وملابس ومستلزمات شخصية</option>
                  <option value="قهوة ومأكولات">بن وقهوة مختصة ومستلزمات الضيافة</option>
                  <option value="أخرى">أنشطة عامة وهدايا ومصنوعات يدوية</option>
                </select>
                <Briefcase className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
              </div>
            </div>
          </div>

          {/* Social Media Link / Store Page Link (KEY REQUIREMENT) */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-sky-600" />
                <span>رابط صفحتك التجارية على منصات التواصل (فيسبوك، إنستغرام، إلخ)</span>
              </label>
              <span className="text-[10px] text-sky-700 font-bold bg-sky-100 border border-sky-200 px-2 py-0.5 rounded-full">بديل السجل التجاري 👌</span>
            </div>

            <div className="relative">
              <input
                type="text"
                value={socialPageUrl}
                onChange={(e) => setSocialPageUrl(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl pr-10 pl-4 py-3 text-slate-800 text-xs font-mono font-bold focus:outline-none transition text-left placeholder:text-right placeholder:font-sans"
                placeholder="https://facebook.com/your_store_page أو رابط إنستغرام / تيك توك / واتساب"
              />
              <Share2 className="w-4 h-4 text-slate-400 absolute right-3.5 top-3.5" />
            </div>

            {/* Quick Prefixes Shortcuts */}
            <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[10px]">
              <span className="text-slate-500 font-bold">اختصارات سريعة:</span>
              <button
                type="button"
                onClick={() => setSocialPageUrl("https://facebook.com/")}
                className="bg-white border border-slate-200 hover:border-blue-400 hover:bg-blue-50 px-2.5 py-1 rounded-lg text-slate-700 font-bold transition shadow-2xs"
              >
                📘 فيسبوك
              </button>
              <button
                type="button"
                onClick={() => setSocialPageUrl("https://instagram.com/")}
                className="bg-white border border-slate-200 hover:border-pink-400 hover:bg-pink-50 px-2.5 py-1 rounded-lg text-slate-700 font-bold transition shadow-2xs"
              >
                📸 إنستغرام
              </button>
              <button
                type="button"
                onClick={() => setSocialPageUrl("https://tiktok.com/@")}
                className="bg-white border border-slate-200 hover:border-slate-400 hover:bg-slate-100 px-2.5 py-1 rounded-lg text-slate-700 font-bold transition shadow-2xs"
              >
                🎵 تيك توك
              </button>
              <button
                type="button"
                onClick={() => setSocialPageUrl("https://wa.me/")}
                className="bg-white border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50 px-2.5 py-1 rounded-lg text-slate-700 font-bold transition shadow-2xs"
              >
                💬 واتساب الأعمال
              </button>
            </div>
          </div>

          {/* OPTIONAL File / Document Attachment */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-xs text-slate-700 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-slate-400" />
                <span>إرفاق مستند أو صورة (اختياري فقط)</span>
              </h3>
              <span className="text-[10px] text-slate-400 font-bold">(يمكنك التخطي ودون إرفاق ملف)</span>
            </div>

            {!file ? (
              <div
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-pointer transition ${
                  isDragActive 
                    ? "border-sky-500 bg-sky-50/50" 
                    : "border-slate-200 bg-slate-50/50 hover:bg-slate-100/70 hover:border-slate-300"
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileChange(e.target.files[0]);
                    }
                  }}
                  accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                />
                <UploadCloud className="w-8 h-8 text-slate-400 mb-2" />
                <p className="text-xs font-bold text-slate-700">اضغط هنا لإرفاق صورة شعار أو وثيقة إضافية (إن وجدت)</p>
                <p className="text-[10px] text-slate-400 mt-1">اختياري تماماً • يدعم PDF أو صور بحد أقصى 10 ميجابايت</p>
              </div>
            ) : (
              <div className="border border-slate-200 bg-slate-50 rounded-2xl p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 bg-sky-100 text-sky-600 rounded-xl flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h5 className="text-xs font-bold text-slate-800 truncate" title={file.name}>
                      {file.name}
                    </h5>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {formatBytes(file.size)}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {isUploading ? (
                    <div className="flex items-center gap-2 text-sky-600 font-bold text-xs">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>جاري الرفع ({uploadProgress}%)</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-emerald-600 font-bold text-xs bg-emerald-50 border border-emerald-100 px-3 py-1 rounded-full">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>تم المرفق</span>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={removeFile}
                    className="p-1.5 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition"
                    title="إزالة هذا المستند"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Form Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition text-slate-600 text-xs font-bold"
            >
              إلغاء الأمر
            </button>
            <button
              type="submit"
              disabled={isUploading}
              className="px-8 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition shadow-lg shadow-slate-900/10 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              <span>تقديم البريد وإنشاء المتجر فوراً 🚀</span>
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
