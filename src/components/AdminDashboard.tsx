import React, { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Store, ShieldCheck, CheckCircle2, AlertTriangle, XCircle, Search, 
  Trash2, Eye, Sliders, CheckCircle, RefreshCw, X, Plus, ExternalLink,
  Edit, FileText, Ban, Mail, User, ShieldAlert, Award, FileCheck, Check,
  FolderOpen, AlertCircle, Building2, Briefcase
} from "lucide-react";
import { StoreConfig, Product } from "../types";

export interface PlatformStore {
  id: string;
  storeName: string;
  ownerName: string;
  ownerEmail: string;
  businessType: string;
  socialPageUrl?: string;
  docType: string;
  docFileName: string;
  docFileSize: string;
  verificationStatus: "approved" | "pending" | "rejected" | "suspended";
  rejectionReason?: string;
  themeStyle: "elegant" | "tech";
  createdAt: string;
  config: StoreConfig;
}

interface AdminDashboardProps {
  stores: PlatformStore[];
  onUpdateStoreStatus: (storeId: string, status: PlatformStore["verificationStatus"], reason?: string) => void;
  onUpdateStoreConfig: (storeId: string, updatedConfig: StoreConfig) => void;
  onDeleteStore: (storeId: string) => void;
  onPreviewStore: (storeConfig: StoreConfig) => void;
  onAddStoreManually: (newStore: PlatformStore) => void;
  onClose: () => void;
}

export default function AdminDashboard({
  stores,
  onUpdateStoreStatus,
  onUpdateStoreConfig,
  onDeleteStore,
  onPreviewStore,
  onAddStoreManually,
  onClose
}: AdminDashboardProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "approved" | "pending" | "rejected" | "suspended">("all");
  
  // Modals / Selected state
  const [selectedStore, setSelectedStore] = useState<PlatformStore | null>(null);
  const [rejectionModalStoreId, setRejectionModalStoreId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  
  // Direct config edit modal state
  const [editingStore, setEditingStore] = useState<PlatformStore | null>(null);
  const [editStoreName, setEditStoreName] = useState("");
  const [editSlogan, setEditSlogan] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPrimaryColor, setEditPrimaryColor] = useState("");
  const [editBannerText, setEditBannerText] = useState("");

  // Manually Add Store State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addStoreName, setAddStoreName] = useState("");
  const [addOwnerName, setAddOwnerName] = useState("");
  const [addOwnerEmail, setAddOwnerEmail] = useState("");
  const [addBusinessType, setAddBusinessType] = useState("عطور وبخور");
  const [addDocType, setAddDocType] = useState("سجل تجاري");
  const [addDocFileName, setAddDocFileName] = useState("cr_document.pdf");

  // Document preview simulation
  const [viewingDoc, setViewingDoc] = useState<PlatformStore | null>(null);

  // Statistics
  const totalCount = stores.length;
  const pendingCount = stores.filter(s => s.verificationStatus === "pending").length;
  const approvedCount = stores.filter(s => s.verificationStatus === "approved").length;
  const rejectedCount = stores.filter(s => s.verificationStatus === "rejected").length;
  const suspendedCount = stores.filter(s => s.verificationStatus === "suspended").length;

  // Filtered stores
  const filteredStores = stores.filter(store => {
    const matchesSearch = 
      store.storeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.ownerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      store.ownerEmail.toLowerCase().includes(searchTerm.toLowerCase());
      
    if (statusFilter === "all") return matchesSearch;
    return matchesSearch && store.verificationStatus === statusFilter;
  });

  // Handle reject action submission
  const handleRejectSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectionReason.trim() || !rejectionModalStoreId) return;
    onUpdateStoreStatus(rejectionModalStoreId, "rejected", rejectionReason);
    setRejectionModalStoreId(null);
    setRejectionReason("");
    // Close detail view if open
    setSelectedStore(null);
  };

  // Open direct editing modal
  const startEditing = (store: PlatformStore) => {
    setEditingStore(store);
    setEditStoreName(store.storeName);
    setEditSlogan(store.config.slogan);
    setEditPhone(store.config.phone);
    setEditPrimaryColor(store.config.primaryColor);
    setEditBannerText(store.config.bannerText);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStore) return;
    
    const updatedConfig: StoreConfig = {
      ...editingStore.config,
      storeName: editStoreName,
      slogan: editSlogan,
      phone: editPhone,
      primaryColor: editPrimaryColor,
      bannerText: editBannerText
    };

    onUpdateStoreConfig(editingStore.id, updatedConfig);
    setEditingStore(null);
    setSelectedStore(null);
  };

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addStoreName || !addOwnerName || !addOwnerEmail) return;

    const mockConfig: StoreConfig = {
      storeName: addStoreName,
      slogan: "متجر موثق ومؤسس يدوياً عبر المنصة",
      logoIcon: "🛍️",
      primaryColor: "#0284C7",
      secondaryColor: "#0F172A",
      themeStyle: "tech",
      bannerText: "مرحباً بكم في متجرنا الرسمي المعتمد",
      fontFamily: "Tajawal",
      phone: "+966 50 000 0000",
      currency: "ر.س",
      products: [
        {
          id: `p-${Date.now()}-1`,
          name: "منتج تجريبي معتمد",
          price: 150,
          description: "هذا منتج افتراضي تم إضافته تلقائياً لتأسيس المتجر.",
          category: "عام",
          imageKeyword: "default"
        }
      ]
    };

    const newStore: PlatformStore = {
      id: `store-${Date.now()}`,
      storeName: addStoreName,
      ownerName: addOwnerName,
      ownerEmail: addOwnerEmail,
      businessType: addBusinessType,
      docType: addDocType,
      docFileName: addDocFileName,
      docFileSize: "1.5 MB",
      verificationStatus: "pending",
      themeStyle: "tech",
      createdAt: new Date().toLocaleDateString("ar-SA"),
      config: mockConfig
    };

    onAddStoreManually(newStore);
    setIsAddModalOpen(false);
    // Reset inputs
    setAddStoreName("");
    setAddOwnerName("");
    setAddOwnerEmail("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md overflow-hidden">
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="bg-white border border-slate-200 text-slate-900 w-full max-w-6xl h-[92vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col text-right"
        style={{ fontFamily: "'Cairo', sans-serif" }}
      >
        {/* Header */}
        <div className="bg-slate-50/90 px-6 py-4 flex items-center justify-between border-b border-slate-200 shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-tr from-sky-600 to-blue-600 p-2.5 rounded-2xl shadow-md text-white">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-base md:text-lg flex items-center gap-2">
                <span>لوحة تحكم المنصة المركزية (المدير)</span>
                <span className="bg-sky-100 text-sky-900 border border-sky-300 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase">ADMIN HUB</span>
              </h2>
              <span className="text-xs text-slate-500 block -mt-0.5">مراقبة طلبات التسجيل، تدقيق وثائق التراخيص، وإدارة إعدادات المتاجر وحالات تفعيلها</span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Cards / Analytics Bar */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 p-6 bg-slate-50/60 border-b border-slate-200 shrink-0">
          {/* Card 1: Total */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 font-bold block uppercase">إجمالي المتاجر</span>
              <span className="text-2xl font-black text-slate-900 block mt-0.5">{totalCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Store className="w-5 h-5" />
            </div>
          </div>

          {/* Card 2: Pending */}
          <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-amber-800 font-bold block uppercase">قيد التدقيق</span>
              <span className="text-2xl font-black text-amber-700 block mt-0.5">{pendingCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center text-amber-800">
              <RefreshCw className="w-5 h-5 animate-spin" style={{ animationDuration: "3s" }} />
            </div>
          </div>

          {/* Card 3: Approved */}
          <div className="bg-emerald-50/80 p-4 rounded-2xl border border-emerald-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-emerald-800 font-bold block uppercase">نشطة وموثقة</span>
              <span className="text-2xl font-black text-emerald-700 block mt-0.5">{approvedCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center text-emerald-800">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>

          {/* Card 4: Rejected */}
          <div className="bg-rose-50/80 p-4 rounded-2xl border border-rose-200 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-[10px] text-rose-800 font-bold block uppercase">مرفوضة الوثائق</span>
              <span className="text-2xl font-black text-rose-700 block mt-0.5">{rejectedCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center text-rose-800">
              <XCircle className="w-5 h-5" />
            </div>
          </div>

          {/* Card 5: Suspended */}
          <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 shadow-2xs flex items-center justify-between col-span-2 lg:col-span-1">
            <div>
              <span className="text-[10px] text-slate-600 font-bold block uppercase">موقوفة مؤقتاً</span>
              <span className="text-2xl font-black text-slate-800 block mt-0.5">{suspendedCount}</span>
            </div>
            <div className="w-10 h-10 rounded-xl bg-slate-200 flex items-center justify-center text-slate-700">
              <Ban className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="p-6 pb-2 flex flex-col md:flex-row items-center justify-between gap-4 shrink-0">
          <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200 w-full md:w-auto">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition ${statusFilter === "all" ? "bg-white text-slate-900 shadow-2xs" : "text-slate-600 hover:text-slate-900"}`}
            >
              الكل ({totalCount})
            </button>
            <button
              onClick={() => setStatusFilter("pending")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${statusFilter === "pending" ? "bg-amber-100 text-amber-900 border border-amber-300" : "text-slate-600 hover:text-slate-900"}`}
            >
              قيد المراجعة ({pendingCount})
            </button>
            <button
              onClick={() => setStatusFilter("approved")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${statusFilter === "approved" ? "bg-emerald-100 text-emerald-900 border border-emerald-300" : "text-slate-600 hover:text-slate-900"}`}
            >
              مقبولة وموثقة ({approvedCount})
            </button>
            <button
              onClick={() => setStatusFilter("rejected")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${statusFilter === "rejected" ? "bg-rose-100 text-rose-900 border border-rose-300" : "text-slate-600 hover:text-slate-900"}`}
            >
              مرفوضة ({rejectedCount})
            </button>
            <button
              onClick={() => setStatusFilter("suspended")}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${statusFilter === "suspended" ? "bg-slate-200 text-slate-900 border border-slate-300" : "text-slate-600 hover:text-slate-900"}`}
            >
              موقوفة ({suspendedCount})
            </button>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="ابحث باسم المتجر، المالك، البريد..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-white border border-slate-200 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/20 rounded-xl pr-10 pl-4 py-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none transition shadow-2xs"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-3 top-3.5" />
            </div>

            <button
              onClick={() => setIsAddModalOpen(true)}
              className="bg-sky-600 hover:bg-sky-700 text-white font-black text-xs px-4 py-3 rounded-xl shadow-xs transition flex items-center gap-1.5 shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>إضافة متجر جديد</span>
            </button>
          </div>
        </div>

        {/* Main Work Area: Table list */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          {filteredStores.length === 0 ? (
            <div className="border border-dashed border-slate-200 bg-slate-50/50 rounded-3xl p-16 flex flex-col items-center justify-center text-center h-full">
              <FolderOpen className="w-16 h-16 text-slate-400 mb-4" />
              <h3 className="font-bold text-base text-slate-700">لا يوجد متاجر تطابق الفلتر المختار</h3>
              <p className="text-xs text-slate-500 max-w-sm mt-1">تأكد من كتابة مصطلح بحث صحيح أو تغيير تصنيف الفلترة المختار أعلاه.</p>
            </div>
          ) : (
            <div className="border border-slate-200 bg-white rounded-2xl shadow-2xs overflow-hidden">
              <table className="w-full text-right border-collapse text-xs md:text-sm">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-600 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider select-none">
                    <th className="px-5 py-4">اسم المتجر الكيان</th>
                    <th className="px-5 py-4">المالك / الاتصال</th>
                    <th className="px-5 py-4">المستند التجاري</th>
                    <th className="px-5 py-4">تاريخ التقديم</th>
                    <th className="px-5 py-4">حالة التوثيق</th>
                    <th className="px-5 py-4 text-left">الإجراءات والعمليات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-sans">
                  {filteredStores.map((store) => (
                    <tr 
                      key={store.id} 
                      className="hover:bg-sky-50/40 transition group"
                    >
                      {/* Name */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${
                            store.themeStyle === "elegant" 
                              ? "bg-amber-100 text-amber-800 border border-amber-200" 
                              : "bg-sky-100 text-sky-800 border border-sky-200"
                          }`}>
                            <Store className="w-4 h-4" />
                          </div>
                          <div>
                            <span className="font-bold text-slate-900 block text-xs md:text-sm">{store.storeName}</span>
                            <span className="text-[10px] text-slate-500 block">{store.businessType} • {store.themeStyle === "elegant" ? "قالب أنيق" : "قالب تقني"}</span>
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="px-5 py-4">
                        <div className="space-y-0.5">
                          <span className="font-bold text-slate-800 block text-xs flex items-center gap-1">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            {store.ownerName}
                          </span>
                          <span className="text-[10px] text-slate-500 block flex items-center gap-1 text-left justify-end">
                            {store.ownerEmail}
                            <Mail className="w-3 h-3 text-slate-400" />
                          </span>
                        </div>
                      </td>

                      {/* Documents */}
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setViewingDoc(store)}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-800 px-2.5 py-1.5 rounded-lg font-bold text-[10px] flex items-center gap-1 border border-slate-200 transition shrink-0"
                            title="عرض مستند الإثبات ومراجعته"
                          >
                            <FileText className="w-3.5 h-3.5 text-sky-600" />
                            <span>{store.docType}</span>
                          </button>
                          <span className="text-[10px] text-slate-500 max-w-[100px] truncate hidden xl:inline" title={store.docFileName}>
                            {store.docFileName}
                          </span>
                        </div>
                      </td>

                      {/* Date */}
                      <td className="px-5 py-4 text-slate-500 text-xs font-mono">
                        {store.createdAt}
                      </td>

                      {/* Status */}
                      <td className="px-5 py-4">
                        {store.verificationStatus === "approved" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1 w-fit">
                            <Check className="w-3 h-3 text-emerald-600" />
                            <span>مقبول وموثق</span>
                          </span>
                        )}
                        {store.verificationStatus === "pending" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 flex items-center gap-1 w-fit animate-pulse">
                            <RefreshCw className="w-3 h-3 text-amber-600 animate-spin" style={{ animationDuration: "3s" }} />
                            <span>تحت المراجعة</span>
                          </span>
                        )}
                        {store.verificationStatus === "rejected" && (
                          <span 
                            className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 text-rose-800 border border-rose-200 flex items-center gap-1 w-fit cursor-help"
                            title={`سبب الرفض: ${store.rejectionReason || "غير محدد"}`}
                          >
                            <XCircle className="w-3 h-3 text-rose-600" />
                            <span>مرفوض</span>
                          </span>
                        )}
                        {store.verificationStatus === "suspended" && (
                          <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-800 border border-slate-300 flex items-center gap-1 w-fit">
                            <Ban className="w-3 h-3 text-slate-600" />
                            <span>موقوف مؤقتاً</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-4 text-left">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Details Auditing */}
                          <button
                            onClick={() => setSelectedStore(store)}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition border border-slate-200"
                            title="التفاصيل وإجراءات التوثيق والقبول"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                          </button>

                          {/* Quick Edit Config */}
                          <button
                            onClick={() => startEditing(store)}
                            className="p-2 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200/60 rounded-lg transition"
                            title="تعديل إعدادات وهوية المتجر مباشرة"
                          >
                            <Edit className="w-3.5 h-3.5" />
                          </button>

                          {/* Preview Live */}
                          <button
                            onClick={() => {
                              onPreviewStore(store.config);
                            }}
                            className="p-2 bg-slate-100 hover:bg-sky-600 hover:text-white text-slate-700 rounded-lg transition border border-slate-200"
                            title="معاينة حية للمتجر"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => {
                              if (window.confirm(`هل أنت متأكد من حذف متجر "${store.storeName}" بالكامل من المنصة؟ لا يمكن التراجع عن هذا الإجراء.`)) {
                                onDeleteStore(store.id);
                              }
                            }}
                            className="p-2 bg-slate-100 hover:bg-rose-100 text-slate-500 hover:text-rose-700 rounded-lg transition border border-slate-200"
                            title="حذف المتجر"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ------------------- MODAL 1: STORE DETAILS AND VERIFICATION PROCESSOR ------------------- */}
        <AnimatePresence>
          {selectedStore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-xl text-slate-900 p-6 space-y-6 text-right max-h-[90vh] overflow-y-auto shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-4">
                  <h3 className="font-extrabold text-base flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-sky-600" />
                    <span>إجراءات تدقيق متجر: {selectedStore.storeName}</span>
                  </h3>
                  <button onClick={() => setSelectedStore(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Grid Details */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 text-xs">
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <span className="text-slate-500 block">مالك المتجر:</span>
                      <span className="font-bold text-slate-900">{selectedStore.ownerName}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">البريد الإلكتروني:</span>
                      <span className="font-bold text-slate-900">{selectedStore.ownerEmail}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">نوع التوثيق:</span>
                      <span className="font-bold text-sky-700 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5" />
                        {selectedStore.docType} ({selectedStore.docFileSize})
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">تاريخ التسجيل:</span>
                      <span className="font-bold text-slate-900">{selectedStore.createdAt}</span>
                    </div>
                  </div>

                  {selectedStore.socialPageUrl && (
                    <div className="pt-2 border-t border-slate-200/80">
                      <span className="text-slate-500 block mb-1">رابط صفحة المالك والتجارة:</span>
                      <a
                        href={selectedStore.socialPageUrl.startsWith("http") ? selectedStore.socialPageUrl : `https://${selectedStore.socialPageUrl}`}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-bold text-sky-700 hover:text-sky-900 underline text-xs bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200/80"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>{selectedStore.socialPageUrl}</span>
                      </a>
                    </div>
                  )}

                  {selectedStore.rejectionReason && selectedStore.verificationStatus === "rejected" && (
                    <div className="mt-2 bg-rose-50 border border-rose-200 p-3 rounded-lg text-rose-900">
                      <span className="font-bold block text-rose-800">سبب الرفض الحالي:</span>
                      <p>{selectedStore.rejectionReason}</p>
                    </div>
                  )}
                </div>

                {/* Proof Document Simulation */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-emerald-600" />
                      <span>معاينة وثيقة التراخيص الرسمية المرفقة</span>
                    </span>
                    <span className="text-[10px] text-slate-600 font-mono bg-white px-2 py-0.5 rounded border border-slate-200">{selectedStore.docFileName}</span>
                  </div>

                  <div className="h-28 bg-white rounded-lg flex flex-col items-center justify-center border border-slate-200 text-center p-3 shadow-2xs">
                    <FileText className="w-8 h-8 text-sky-600 mb-1" />
                    <span className="text-xs text-slate-800 font-bold">{selectedStore.docType} معتمد ومصدق إلكترونياً</span>
                    <span className="text-[10px] text-emerald-700 font-bold mt-1">تشفير أمان تام • بصمة وزارة الاستثمار ومجلس التجارة الإلكترونية</span>
                  </div>
                </div>

                {/* Actions Grid */}
                <div className="space-y-3">
                  <span className="block text-xs font-bold text-slate-600">اتخاذ قرار وإجراءات التفعيل للمتجر</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {/* Approve */}
                    <button
                      onClick={() => {
                        onUpdateStoreStatus(selectedStore.id, "approved");
                        setSelectedStore(null);
                      }}
                      className="py-3 px-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <CheckCircle className="w-5 h-5" />
                      <span>قبول وتفعيل 🛡️</span>
                    </button>

                    {/* Reject Trigger */}
                    <button
                      onClick={() => setRejectionModalStoreId(selectedStore.id)}
                      className="py-3 px-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <XCircle className="w-5 h-5" />
                      <span>رفض المستندات</span>
                    </button>

                    {/* Suspend */}
                    <button
                      onClick={() => {
                        onUpdateStoreStatus(selectedStore.id, "suspended");
                        setSelectedStore(null);
                      }}
                      className="py-3 px-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition shadow-xs"
                    >
                      <Ban className="w-5 h-5" />
                      <span>إيقاف مؤقت ⚠️</span>
                    </button>

                    {/* Pending review */}
                    <button
                      onClick={() => {
                        onUpdateStoreStatus(selectedStore.id, "pending");
                        setSelectedStore(null);
                      }}
                      className="py-3 px-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex flex-col items-center justify-center gap-1.5 transition border border-slate-200"
                    >
                      <RefreshCw className="w-5 h-5" />
                      <span>قيد المراجعة</span>
                    </button>
                  </div>
                </div>

                {/* Footer close */}
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedStore(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-lg transition border border-slate-200"
                  >
                    إغلاق النافذة
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ------------------- MODAL 2: REJECTION EXPLANATION MODAL ------------------- */}
        <AnimatePresence>
          {rejectionModalStoreId && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-md p-5 space-y-4 text-right text-slate-900 shadow-2xl"
              >
                <h4 className="font-bold text-sm text-rose-700 flex items-center gap-1.5">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                  <span>تحديد سبب رفض وثيقة إثبات التجارة</span>
                </h4>
                
                <form onSubmit={handleRejectSubmit} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="block text-xs text-slate-600 font-bold">لماذا ترفض هذا المستند؟ (سيظهر للتاجر)</label>
                    <textarea
                      required
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 rounded-xl p-3 text-xs text-slate-800 focus:outline-none h-24 transition resize-none"
                      placeholder="مثال: المستند المرفق غير واضح وتاريخ السجل التجاري منتهي، يرجى إعادة رفع مستند ساري الصلاحية."
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5">
                    <button
                      type="button"
                      onClick={() => setRejectionModalStoreId(null)}
                      className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition border border-slate-200"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-md"
                    >
                      إثبات رفض الوثيقة ❌
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ------------------- MODAL 3: DIRECT CONFIG EDITING MODAL ------------------- */}
        <AnimatePresence>
          {editingStore && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg text-slate-900 p-6 space-y-4 text-right shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <Edit className="w-5 h-5 text-sky-600" />
                    <span>تعديل إعدادات وهوية المتجر مباشرة بالنيابة</span>
                  </h3>
                  <button onClick={() => setEditingStore(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
                  {/* Store Name */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">اسم المتجر</label>
                    <input
                      type="text"
                      required
                      value={editStoreName}
                      onChange={(e) => setEditStoreName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800"
                    />
                  </div>

                  {/* Slogan */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">الشعار اللفظي للمتجر</label>
                    <input
                      type="text"
                      required
                      value={editSlogan}
                      onChange={(e) => setEditSlogan(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800"
                    />
                  </div>

                  {/* Phone & Color */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">رقم الهاتف الدعم</label>
                      <input
                        type="text"
                        required
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800 text-left font-mono"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">اللون الأساسي للهوية</label>
                      <div className="flex gap-2">
                        <input
                          type="color"
                          value={editPrimaryColor}
                          onChange={(e) => setEditPrimaryColor(e.target.value)}
                          className="w-10 h-10 bg-transparent border-0 rounded-lg cursor-pointer"
                        />
                        <input
                          type="text"
                          required
                          value={editPrimaryColor}
                          onChange={(e) => setEditPrimaryColor(e.target.value)}
                          className="flex-1 bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800 font-mono"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Banner Text */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">نص الشريط الإعلاني العلوي للمتجر</label>
                    <textarea
                      required
                      value={editBannerText}
                      onChange={(e) => setEditBannerText(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800 h-20 resize-none"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setEditingStore(null)}
                      className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition border border-slate-200"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>حفظ التعديلات الفورية</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ------------------- MODAL 4: MANUALLY ADD STORE MODAL ------------------- */}
        <AnimatePresence>
          {isAddModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-lg text-slate-900 p-6 space-y-4 text-right shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <h3 className="font-extrabold text-sm flex items-center gap-2">
                    <Plus className="w-5 h-5 text-emerald-600" />
                    <span>تأسيس وإضافة متجر جديد للمنصة يدوياً</span>
                  </h3>
                  <button onClick={() => setIsAddModalOpen(false)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
                  {/* Store Name */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">اسم المتجر / الكيان المقترح</label>
                    <input
                      type="text"
                      required
                      value={addStoreName}
                      onChange={(e) => setAddStoreName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800"
                      placeholder="مثال: لافندر للمصنوعات الفخارية"
                    />
                  </div>

                  {/* Owner Name */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">اسم المالك الثلاثي لمطابقة الهوية</label>
                    <input
                      type="text"
                      required
                      value={addOwnerName}
                      onChange={(e) => setAddOwnerName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800"
                      placeholder="سلمان بن عبدالعزيز الغامدي"
                    />
                  </div>

                  {/* Owner Email */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">البريد الإلكتروني للتاجر</label>
                    <input
                      type="email"
                      required
                      value={addOwnerEmail}
                      onChange={(e) => setAddOwnerEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800 text-left font-mono"
                      placeholder="salman@lavender.sa"
                    />
                  </div>

                  {/* Business Type & Doc Type */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">نوع النشاط</label>
                      <select
                        value={addBusinessType}
                        onChange={(e) => setAddBusinessType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                      >
                        <option value="عطور وبخور">عطور وبخور</option>
                        <option value="إلكترونيات وأجهزة">إلكترونيات وأجهزة ذكية</option>
                        <option value="أزياء وملابس">أزياء ومستلزمات</option>
                        <option value="قهوة ومأكولات">بن ومأكولات</option>
                        <option value="أخرى">أنشطة أخرى عامة</option>
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="block font-bold text-slate-700">نوع مستند التوثيق</label>
                      <select
                        value={addDocType}
                        onChange={(e) => setAddDocType(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-slate-800 focus:outline-none"
                      >
                        <option value="سجل تجاري">سجل تجاري إلكتروني</option>
                        <option value="وثيقة عمل حر">وثيقة عمل حر رقمية</option>
                        <option value="شهادة معروف">شهادة معروف الذهبية</option>
                        <option value="الهوية الوطنية">هوية مالك المنشأة</option>
                      </select>
                    </div>
                  </div>

                  {/* Doc Name */}
                  <div className="space-y-1.5">
                    <label className="block font-bold text-slate-700">اسم ملف المستند (للمحاكاة)</label>
                    <input
                      type="text"
                      required
                      value={addDocFileName}
                      onChange={(e) => setAddDocFileName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 rounded-xl px-3.5 py-2.5 text-slate-800"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200">
                    <button
                      type="button"
                      onClick={() => setIsAddModalOpen(false)}
                      className="px-4 py-2.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition border border-slate-200"
                    >
                      إلغاء الأمر
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition flex items-center gap-1.5 shadow-md"
                    >
                      <Check className="w-4 h-4" />
                      <span>تأسيس وإضافة المتجر</span>
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* ------------------- MODAL 5: DOCUMENT PREVIEW SIMULATOR ------------------- */}
        <AnimatePresence>
          {viewingDoc && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl text-slate-900 p-6 space-y-4 text-right shadow-2xl"
              >
                <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-sky-600" />
                    <div>
                      <h4 className="font-extrabold text-sm">مستند إثبات التجارة: {viewingDoc.docType}</h4>
                      <span className="text-[10px] text-slate-500 block -mt-1">صاحب المتجر: {viewingDoc.ownerName}</span>
                    </div>
                  </div>
                  <button onClick={() => setViewingDoc(null)} className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-slate-900">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Simulated Document Certificate */}
                <div className="border border-slate-200 rounded-xl p-6 bg-slate-50 text-slate-900 space-y-6 shadow-inner select-none font-sans relative overflow-hidden">
                  {/* Decorative stamp watermark */}
                  <div className="absolute -bottom-10 -left-10 w-44 h-44 bg-emerald-500/5 rounded-full border-4 border-dashed border-emerald-500/20 flex items-center justify-center rotate-12">
                    <span className="font-black text-[10px] text-emerald-700/30 uppercase tracking-widest text-center">SAUDI ARABIA<br/>CERTIFIED</span>
                  </div>

                  {/* Cert Header */}
                  <div className="flex items-start justify-between border-b border-slate-200 pb-4">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-500 block font-bold">وزارة الاستثمار / مجلس التجارة الإلكترونية</span>
                      <h3 className="font-black text-sm text-slate-900 mt-0.5">شهادة ممارسة النشاط التجاري الإلكتروني والموثوقية</h3>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center border border-slate-200 shadow-2xs">
                      <Award className="w-6 h-6 text-emerald-600" />
                    </div>
                  </div>

                  {/* Cert Body */}
                  <div className="space-y-3.5 text-xs">
                    <p className="leading-relaxed text-slate-700">
                      يشهد مجلس التجارة الإلكترونية بالتعاون مع المركز السعودي للأعمال بأن المستند التجاري الرقمي الموضح أدناه قد تم إصداره بصفة رسمية وتوثيقه في قواعد البيانات الوطنية للتاجر:
                    </p>

                    <div className="bg-white border border-slate-200 p-4 rounded-xl grid grid-cols-2 gap-3 font-medium text-slate-700 shadow-2xs">
                      <div>
                        <span className="text-slate-500 text-[10px] block">الاسم المعتمد:</span>
                        <span className="text-slate-900 font-bold text-xs">{viewingDoc.ownerName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">اسم المتجر التجاري:</span>
                        <span className="text-slate-900 font-bold text-xs">{viewingDoc.storeName}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">نوع المستند التجاري:</span>
                        <span className="text-slate-900 font-bold text-xs">{viewingDoc.docType}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">الرقم المرجعي والباركود:</span>
                        <span className="text-slate-900 font-mono font-bold text-[11px]">CR-9824-2026-XQ</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">تاريخ إصدار المستند:</span>
                        <span className="text-slate-900 font-mono text-[11px]">2026/01/15</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] block">حالة التحقق الحالية بالمنصة:</span>
                        <span className={`font-bold text-xs ${
                          viewingDoc.verificationStatus === "approved" ? "text-emerald-700" :
                          viewingDoc.verificationStatus === "rejected" ? "text-rose-700" :
                          viewingDoc.verificationStatus === "pending" ? "text-amber-700" : "text-slate-600"
                        }`}>
                          {viewingDoc.verificationStatus === "approved" ? "مقبول ومفعل" :
                           viewingDoc.verificationStatus === "rejected" ? "مرفوض" :
                           viewingDoc.verificationStatus === "pending" ? "قيد التدقيق" : "موقوف مؤقتاً"}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-500 border-t border-slate-200 pt-3">
                      <ShieldAlert className="w-4 h-4 text-emerald-600" />
                      <span>تخضع هذه البيانات لسياسات الهيئة العامة للمنشآت الصغيرة والمتوسطة (منشآت) والخصوصية التامة.</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    onClick={() => setViewingDoc(null)}
                    className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs px-5 py-2.5 rounded-lg transition border border-slate-200"
                  >
                    إغلاق المعاينة
                  </button>
                  {viewingDoc.verificationStatus === "pending" && (
                    <>
                      <button
                        onClick={() => {
                          onUpdateStoreStatus(viewingDoc.id, "approved");
                          setViewingDoc(null);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-1 shadow-xs"
                      >
                        <Check className="w-4 h-4" />
                        <span>اعتماد وقبول المستند 🛡️</span>
                      </button>
                      <button
                        onClick={() => {
                          setRejectionModalStoreId(viewingDoc.id);
                          setViewingDoc(null);
                        }}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs px-5 py-2.5 rounded-lg transition flex items-center gap-1 shadow-xs"
                      >
                        <X className="w-4 h-4" />
                        <span>رفض المستند</span>
                      </button>
                    </>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
