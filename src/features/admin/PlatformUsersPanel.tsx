import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Ban,
  ChevronLeft,
  ChevronRight,
  Mail,
  Pencil,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import {
  isUiError,
  isUiErrorCode,
  uiErrorMessage,
  type PaginatedResult,
  type PlatformRole,
  type PlatformUser,
  type PlatformUserQuery,
  type PlatformUserStatus,
  type UserProfile,
  type UiAdapters,
} from "../../adapters/uiAdapters";

interface PlatformUsersPanelProps {
  administration: UiAdapters["administration"];
  currentUser: UserProfile;
  onSessionExpired: () => void;
  onToast: (message: string, type?: "success" | "error" | "info") => void;
  refreshSignal: number;
  onLoadingChange: (loading: boolean) => void;
  onForbiddenChange: (forbidden: boolean) => void;
}

const emptyPagination = { currentPage: 1, lastPage: 1, perPage: 25, total: 0 };
const emptyUsers: PaginatedResult<PlatformUser> = { items: [], pagination: emptyPagination };

const statusLabel: Record<PlatformUserStatus, string> = {
  pending: "بانتظار إعداد الحساب",
  active: "نشط",
  suspended: "معلّق",
};

const statusClass: Record<PlatformUserStatus, string> = {
  pending: "border-amber-200 bg-amber-50 text-amber-800",
  active: "border-emerald-200 bg-emerald-50 text-emerald-800",
  suspended: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function PlatformUsersPanel({
  administration,
  currentUser,
  onSessionExpired,
  onToast,
  refreshSignal,
  onLoadingChange,
  onForbiddenChange,
}: PlatformUsersPanelProps) {
  const mounted = useRef(true);
  const readSequence = useRef(0);
  const mutationInFlight = useRef(false);
  const forbiddenRef = useRef(false);
  const [roles, setRoles] = useState<PlatformRole[]>([]);
  const [users, setUsers] = useState<PaginatedResult<PlatformUser>>(emptyUsers);
  const [query, setQuery] = useState<PlatformUserQuery>({ page: 1, perPage: 25 });
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [mutationPending, setMutationPending] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRoleKeys, setInviteRoleKeys] = useState<string[]>([]);
  const [editingUser, setEditingUser] = useState<PlatformUser | null>(null);
  const [editingRoleKeys, setEditingRoleKeys] = useState<string[]>([]);
  const [suspendingUser, setSuspendingUser] = useState<PlatformUser | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      readSequence.current += 1;
    };
  }, []);

  useEffect(() => {
    onLoadingChange(loading || mutationPending);
  }, [loading, mutationPending, onLoadingChange]);

  useEffect(() => {
    onForbiddenChange(forbidden);
  }, [forbidden, onForbiddenChange]);

  useEffect(() => {
    forbiddenRef.current = false;
    setForbidden(false);
    setError(null);
    setEditingUser(null);
    setSuspendingUser(null);
  }, [currentUser.id]);

  const revokeAccess = () => {
    forbiddenRef.current = true;
    readSequence.current += 1;
    setUsers(emptyUsers);
    setRoles([]);
    setLoading(false);
    setError(null);
    setEditingUser(null);
    setSuspendingUser(null);
    setInviteOpen(false);
    setForbidden(true);
  };

  const handleError = (cause: unknown, fallback: string) => {
    if (isUiError(cause, "unauthenticated")) {
      onSessionExpired();
      return;
    }
    if (isUiError(cause, "forbidden")) {
      revokeAccess();
      return;
    }
    setError(uiErrorMessage(cause, fallback));
  };

  const load = async (nextQuery: PlatformUserQuery = query) => {
    if (forbiddenRef.current) return;
    const sequence = ++readSequence.current;
    setLoading(true);
    setError(null);
    try {
      const [nextRoles, nextUsers] = await Promise.all([
        roles.length > 0 ? Promise.resolve(roles) : administration.listPlatformRoles(),
        administration.listUsers(nextQuery),
      ]);
      if (!mounted.current || sequence !== readSequence.current) return;
      setRoles(nextRoles);
      setUsers(nextUsers);
      if (inviteRoleKeys.length === 0 && nextRoles.length > 0) setInviteRoleKeys([nextRoles[0].key]);
    } catch (cause) {
      if (mounted.current && sequence === readSequence.current) {
        handleError(cause, "تعذر تحميل مستخدمي المنصة.");
      }
    } finally {
      if (mounted.current && sequence === readSequence.current) setLoading(false);
    }
  };

  useEffect(() => {
    void load(query);
  }, [currentUser.id, query, refreshSignal]);

  const runMutation = async (operation: () => Promise<void>) => {
    if (mutationInFlight.current || forbiddenRef.current) return;
    mutationInFlight.current = true;
    setMutationPending(true);
    setError(null);
    setConflictMessage(null);
    try {
      await operation();
    } catch (cause) {
      if (isUiError(cause, "unauthenticated")) onSessionExpired();
      else if (isUiError(cause, "forbidden")) revokeAccess();
      else throw cause;
    } finally {
      mutationInFlight.current = false;
      if (mounted.current) setMutationPending(false);
    }
  };

  const invite = async () => {
    await runMutation(async () => {
      try {
        const result = await administration.inviteUser({
          name: inviteName.trim(),
          email: inviteEmail.trim(),
          roleKeys: [...inviteRoleKeys].sort(),
        });
        setInviteOpen(false);
        setInviteName("");
        setInviteEmail("");
        await load({ ...query, page: 1 });
        const dispatchCopy = result.invitationDispatchStatus === "accepted"
          ? "تم إنشاء الحساب وقَبِل الخادم طلب إرسال رابط الإعداد؛ لا يعني ذلك ضمان وصول البريد."
          : "تم إنشاء الحساب، لكن إرسال رابط الإعداد يحتاج إعادة المحاولة من بطاقة المستخدم.";
        onToast(dispatchCopy, result.invitationDispatchStatus === "accepted" ? "success" : "info");
      } catch (cause) {
        if (isUiErrorCode(cause, "conflict", "platform_user_email_occupied")) {
          setConflictMessage("البريد مرتبط بهوية موجودة. يمكنك تحميل الحساب المطابق بدل تكرار الإنشاء.");
          return;
        }
        handleError(cause, "تعذر إنشاء دعوة مستخدم المنصة.");
      }
    });
  };

  const saveRoles = async () => {
    if (!editingUser) return;
    await runMutation(async () => {
      try {
        await administration.replaceUserRoles(
          editingUser.id,
          editingUser.roles.map((role) => role.key).sort(),
          [...editingRoleKeys].sort(),
        );
        setEditingUser(null);
        await load();
        onToast("تم تحديث أدوار المستخدم وتسجيل العملية.", "success");
      } catch (cause) {
        if (isUiErrorCode(cause, "conflict", "platform_user_roles_stale")) {
          setConflictMessage("تغيّرت أدوار المستخدم على الخادم. احتفظنا باختيارك؛ حمّل أحدث حالة قبل اتخاذ القرار.");
          return;
        }
        handleError(cause, "تعذر تحديث أدوار المستخدم.");
      }
    });
  };

  const updateStatus = async (target: PlatformUser, status: PlatformUserStatus) => {
    await runMutation(async () => {
      try {
        await administration.updateUserStatus(target.id, target.status, status);
        setSuspendingUser(null);
        await load();
        onToast(status === "suspended" ? "تم تعليق الهوية وإبطال جلساتها وروابطها." : "تم تحديث حالة المستخدم.", "success");
      } catch (cause) {
        if (isUiErrorCode(cause, "conflict", "platform_user_status_stale")) {
          setConflictMessage("تغيّرت حالة المستخدم على الخادم. حمّل أحدث حالة قبل إعادة المحاولة.");
          return;
        }
        handleError(cause, "تعذر تحديث حالة المستخدم.");
      }
    });
  };

  const resendInvitation = async (target: PlatformUser) => {
    await runMutation(async () => {
      try {
        await administration.resendUserInvitation(target.id);
        onToast("قَبِل الخادم طلب إرسال رابط إعداد جديد؛ لا يعني ذلك ضمان وصول البريد.", "success");
      } catch (cause) {
        handleError(cause, "بقي الحساب معلقًا، وتعذر طلب إرسال الرابط الآن.");
      }
    });
  };

  const reloadConflict = async () => {
    setConflictMessage(null);
    setEditingUser(null);
    setSuspendingUser(null);
    await load();
  };

  const findOccupiedEmail = () => {
    const normalized = inviteEmail.trim().toLowerCase();
    setConflictMessage(null);
    setInviteOpen(false);
    setSearch(normalized);
    setQuery({ page: 1, perPage: 25, search: normalized });
  };

  if (forbidden) {
    return (
      <div className="mx-auto grid max-w-2xl place-items-center rounded-3xl border border-rose-200 bg-rose-50 p-12 text-center text-rose-900">
        <ShieldAlert className="mb-4 h-11 w-11" />
        <h2 className="text-lg font-black">تم سحب صلاحية إدارة المستخدمين</h2>
        <p className="mt-2 text-sm leading-7">حذفنا البيانات السابقة وأخفينا الإجراءات فور رفض الخادم الوصول.</p>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
        <div>
          <h2 className="font-black">فريق تشغيل المنصة</h2>
          <p className="mt-1 text-xs text-slate-500">الحسابات هنا لمشغلي المنصة فقط، وليست لإدارة موظفي المتاجر.</p>
        </div>
        <button type="button" disabled={mutationPending || loading} onClick={() => setInviteOpen(true)} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-xs font-black text-white disabled:opacity-50">
          <UserPlus className="h-4 w-4" /> دعوة مستخدم
        </button>
      </div>

      <form onSubmit={(event) => { event.preventDefault(); setQuery((current) => ({ ...current, search: search.trim() || undefined, page: 1 })); }} className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 md:grid-cols-5">
        <label className="relative md:col-span-2">
          <span className="sr-only">البحث عن مستخدم</span>
          <Search className="absolute right-3 top-3 h-4 w-4 text-slate-400" />
          <input value={search} minLength={2} maxLength={100} onChange={(event) => setSearch(event.target.value)} placeholder="الاسم أو البريد" className="w-full rounded-xl border border-slate-200 py-2.5 pr-10 pl-3 text-sm outline-none focus:border-indigo-400" />
        </label>
        <select aria-label="حالة المستخدم" value={query.status ?? ""} onChange={(event) => setQuery((current) => ({ ...current, status: (event.target.value || undefined) as PlatformUserStatus | undefined, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          <option value="">كل الحالات</option><option value="pending">بانتظار الإعداد</option><option value="active">نشط</option><option value="suspended">معلّق</option>
        </select>
        <select aria-label="دور المستخدم" value={query.role ?? ""} onChange={(event) => setQuery((current) => ({ ...current, role: event.target.value || undefined, page: 1 }))} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">
          <option value="">كل الأدوار</option>{roles.map((role) => <option key={role.key} value={role.key}>{role.name}</option>)}
        </select>
        <div className="flex gap-2"><button type="submit" className="flex-1 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-bold text-white">بحث</button><button type="button" onClick={() => { setSearch(""); setQuery({ page: 1, perPage: 25 }); }} className="rounded-xl border border-slate-200 px-3 py-2 text-xs">مسح</button></div>
      </form>

      {conflictMessage && <div className={`${inviteOpen || editingUser || suspendingUser ? "fixed left-1/2 top-6 z-[90] w-[min(92vw,42rem)] -translate-x-1/2 shadow-2xl" : ""} flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900`}><span className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> {conflictMessage}</span><div className="flex gap-2"><button type="button" onClick={() => void reloadConflict()} className="rounded-xl bg-white px-4 py-2 text-xs font-bold">تحميل أحدث حالة</button>{inviteOpen && <button type="button" onClick={findOccupiedEmail} className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white">البحث بالبريد</button>}</div></div>}
      {error && <div className={`${inviteOpen || editingUser || suspendingUser ? "fixed left-1/2 top-6 z-[90] w-[min(92vw,42rem)] -translate-x-1/2 shadow-2xl" : ""} flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800`}><span className="flex items-center gap-2 font-bold"><AlertTriangle className="h-5 w-5" /> {error}</span><button type="button" onClick={() => void load()} className="rounded-xl bg-white px-4 py-2 text-xs font-bold">إعادة التحميل</button></div>}
      {!error && loading && users.items.length === 0 && <div className="flex items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white p-12 text-sm text-slate-500"><RefreshCw className="h-5 w-5 animate-spin" /> تحميل مستخدمي المنصة...</div>}
      {!loading && !error && users.items.length === 0 && <div className="grid place-items-center rounded-2xl border border-dashed border-slate-300 bg-white p-14 text-sm text-slate-500"><UsersRound className="mb-3 h-9 w-9" /> لا يوجد مستخدمون مطابقون للمرشحات الحالية.</div>}

      <div className="grid gap-4 xl:grid-cols-2">
        {users.items.map((platformUser) => {
          const self = platformUser.id === currentUser.id;
          const resumeStatus = platformUser.resumeStatus;
          return (
            <article key={platformUser.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4"><div><h3 className="font-black">{platformUser.name}{self && <span className="mr-2 text-xs text-indigo-600">(حسابك)</span>}</h3><p className="mt-1 text-xs text-slate-500" dir="ltr">{platformUser.email}</p></div><span className={`rounded-full border px-3 py-1 text-[11px] font-black ${statusClass[platformUser.status]}`}>{statusLabel[platformUser.status]}</span></div>
              <div className="mt-4 flex flex-wrap gap-2">{platformUser.roles.map((role) => <span key={role.key} className="rounded-lg bg-indigo-50 px-2.5 py-1 text-[11px] font-bold text-indigo-700">{role.name}</span>)}</div>
              <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs text-slate-600 sm:grid-cols-2"><span>آخر دخول: <b>{platformUser.lastLoginAt ? new Date(platformUser.lastLoginAt).toLocaleString("ar-YE") : "لم يسجل الدخول"}</b></span><span>عضويات متاجر نشطة: <b>{platformUser.activeTenantMembershipCount}</b></span></div>
              <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <button type="button" disabled={self || mutationPending} onClick={() => { setEditingUser(platformUser); setEditingRoleKeys(platformUser.roles.map((role) => role.key)); setConflictMessage(null); }} className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold disabled:opacity-40"><Pencil className="h-4 w-4" /> الأدوار</button>
                {platformUser.status === "pending" && <button type="button" disabled={mutationPending} onClick={() => void resendInvitation(platformUser)} className="flex items-center gap-1 rounded-xl bg-amber-500 px-3 py-2 text-xs font-bold disabled:opacity-40"><Mail className="h-4 w-4" /> طلب رابط جديد</button>}
                {platformUser.status !== "suspended" && <button type="button" disabled={self || mutationPending} onClick={() => setSuspendingUser(platformUser)} className="flex items-center gap-1 rounded-xl bg-rose-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><Ban className="h-4 w-4" /> تعليق الهوية</button>}
                {platformUser.status === "suspended" && resumeStatus && <button type="button" disabled={self || mutationPending} onClick={() => void updateStatus(platformUser, resumeStatus)} className="flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"><RotateCcw className="h-4 w-4" /> {resumeStatus === "active" ? "إعادة التفعيل" : "إعادة للدعوة"}</button>}
                {self && <span className="self-center text-[11px] text-slate-500">لا يمكن تغيير أدوارك أو حالتك من جلستك الحالية.</span>}
              </div>
            </article>
          );
        })}
      </div>

      {users.pagination.lastPage > 1 && <div className="flex items-center justify-between gap-3 border-t border-slate-200 pt-4 text-xs text-slate-600"><span>صفحة {users.pagination.currentPage} من {users.pagination.lastPage} · {users.pagination.total} مستخدم</span><div className="flex gap-2"><button type="button" aria-label="الصفحة السابقة" disabled={users.pagination.currentPage <= 1} onClick={() => setQuery((current) => ({ ...current, page: users.pagination.currentPage - 1 }))} className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button><button type="button" aria-label="الصفحة التالية" disabled={users.pagination.currentPage >= users.pagination.lastPage} onClick={() => setQuery((current) => ({ ...current, page: users.pagination.currentPage + 1 }))} className="rounded-xl border border-slate-200 bg-white p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button></div></div>}

      {inviteOpen && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><form onSubmit={(event) => { event.preventDefault(); void invite(); }} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><div className="flex items-center justify-between"><div><h2 className="font-black">دعوة مستخدم للمنصة</h2><p className="mt-1 text-xs text-slate-500">سيُنشأ حساب معلّق بلا كلمة مرور، ثم يُطلب إرسال رابط إعداد آمن.</p></div><button type="button" onClick={() => setInviteOpen(false)} aria-label="إغلاق"><X className="h-5 w-5" /></button></div><label htmlFor="platform-invite-name" className="mt-5 block text-xs font-bold">الاسم</label><input id="platform-invite-name" required minLength={2} maxLength={120} value={inviteName} onChange={(event) => setInviteName(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" /><label htmlFor="platform-invite-email" className="mt-4 block text-xs font-bold">البريد الإلكتروني</label><input id="platform-invite-email" required type="email" maxLength={255} dir="ltr" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm" /><fieldset className="mt-4"><legend className="text-xs font-bold">الأدوار</legend><div className="mt-2 space-y-2">{roles.map((role) => <label key={role.key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={inviteRoleKeys.includes(role.key)} onChange={() => setInviteRoleKeys((current) => current.includes(role.key) ? current.filter((key) => key !== role.key) : [...current, role.key])} /><span><b className="block text-xs">{role.name}</b><span className="text-[11px] text-slate-500">{role.description ?? role.permissionKeys.join("، ")}</span></span></label>)}</div></fieldset><div className="mt-5 flex gap-2"><button type="submit" disabled={mutationPending || inviteRoleKeys.length === 0} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">إنشاء وطلب الإرسال</button><button type="button" onClick={() => setInviteOpen(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">إلغاء</button></div></form></div>}

      {editingUser && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h2 className="font-black">أدوار {editingUser.name}</h2><p className="mt-2 text-xs text-slate-500">التعديل يستبدل مجموعة أدوار المنصة كاملة، ولا يغيّر أي عضوية متجر.</p><div className="mt-4 space-y-2">{roles.map((role) => <label key={role.key} className="flex items-start gap-3 rounded-xl border border-slate-200 p-3"><input type="checkbox" checked={editingRoleKeys.includes(role.key)} onChange={() => setEditingRoleKeys((current) => current.includes(role.key) ? current.filter((key) => key !== role.key) : [...current, role.key])} /><span><b className="block text-xs">{role.name}</b><span className="text-[11px] text-slate-500">{role.description ?? role.permissionKeys.join("، ")}</span></span></label>)}</div><div className="mt-5 flex gap-2"><button type="button" disabled={mutationPending || editingRoleKeys.length === 0} onClick={() => void saveRoles()} className="rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">حفظ الأدوار</button><button type="button" onClick={() => setEditingUser(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">إلغاء</button></div></div></div>}

      {suspendingUser && <div className="fixed inset-0 z-[80] grid place-items-center bg-slate-950/70 p-4" dir="rtl"><div className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><ShieldAlert className="h-10 w-10 text-rose-600" /><h2 className="mt-3 font-black">تعليق هوية {suspendingUser.name}</h2><p className="mt-3 text-sm leading-7 text-slate-600">هذا تعليق عالمي للهوية: سيمنع دخول المنصة والمتاجر، ويلغي الجلسات وروابط الإعداد الحالية. إعادة التفعيل لاحقًا لا تعيد جلسة قديمة.</p>{suspendingUser.activeTenantMembershipCount > 0 && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-bold text-amber-900">للمستخدم {suspendingUser.activeTenantMembershipCount} عضوية متجر نشطة حاليًا. العدد سياق لحظي وليس شرط الأمان.</p>}<div className="mt-5 flex gap-2"><button type="button" disabled={mutationPending} onClick={() => void updateStatus(suspendingUser, "suspended")} className="rounded-xl bg-rose-600 px-5 py-2.5 text-xs font-black text-white disabled:opacity-40">تأكيد التعليق العالمي</button><button type="button" onClick={() => setSuspendingUser(null)} className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold">إلغاء</button></div></div></div>}
    </section>
  );
}
