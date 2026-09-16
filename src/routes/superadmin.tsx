import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  Check,
  Crown,
  Edit2,
  KeyRound,
  LogOut,
  Power,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserCheck,
  UserPlus,
  Users,
  WalletCards,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/superadmin")({
  head: () => ({
    meta: [
      { title: "Super Admin | Selam Kids" },
      { name: "description", content: "Selam Kids super administrator dashboard." },
    ],
  }),
  component: SuperAdminPage,
});

type Dashboard = {
  users: number;
  admins: number;
  active_magazines: number;
  magazines_sold: number;
  sales_cents: number;
};

type ManagedUser = {
  _id: string;
  displayName: string;
  username: string | null;
  email: string | null;
  gender: string | null;
  age: number | null;
  avatarUrl: string;
  role: string;
  accountType: "Google" | "Email" | "Admin" | string;
  isDisabled: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
};

type ActivityLog = {
  _id: string;
  userId: string | null;
  username: string;
  action: string;
  details: string;
  targetType: string;
  targetId: string | null;
  createdAt: string;
};

const emptyDashboard: Dashboard = {
  users: 0,
  admins: 0,
  active_magazines: 0,
  magazines_sold: 0,
  sales_cents: 0,
};


function SuperAdminPage() {
  const { user: currentAuthUser, isLoggedIn, loading: authLoading, logout } = useAuth();
  const navigate = useNavigate();

  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [tabFilter, setTabFilter] = useState<"all" | "admins" | "google">("all");
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  // Create admin modal state
  const [showCreateAdmin, setShowCreateAdmin] = useState(false);
  const [createAdminForm, setCreateAdminForm] = useState({
    username: "",
    password: "",
    displayName: "",
    email: "",
    role: "Admin",
  });
  const [createAdminError, setCreateAdminError] = useState("");
  const [creatingAdmin, setCreatingAdmin] = useState(false);

  // Edit admin modal state
  const [editingAdmin, setEditingAdmin] = useState<ManagedUser | null>(null);
  const [editAdminForm, setEditAdminForm] = useState({
    username: "",
    displayName: "",
    email: "",
    password: "",
    role: "Admin",
  });
  const [editAdminError, setEditAdminError] = useState("");
  const [savingEditAdmin, setSavingEditAdmin] = useState(false);

  // Role-based security check for Super Admin
  useEffect(() => {
    if (!authLoading) {
      if (!isLoggedIn) {
        void navigate({ to: "/auth" });
      } else if (currentAuthUser && !currentAuthUser.isSuperAdmin) {
        if (currentAuthUser.isAdmin) void navigate({ to: "/admin" });
        else void navigate({ to: "/home" });
      }
    }
  }, [authLoading, isLoggedIn, currentAuthUser, navigate]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, usersResponse, activityResponse] = await Promise.all([
        fetch("/api/admin/superadmin/dashboard", { credentials: "include" }),
        fetch("/api/admin/superadmin/users", { credentials: "include" }),
        fetch("/api/admin/superadmin/activity", { credentials: "include" }),
      ]);
      if (!dashboardResponse.ok || !usersResponse.ok) {
        const response = !dashboardResponse.ok ? dashboardResponse : usersResponse;
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not load super admin data.");
      }
      const liveDashboard = (await dashboardResponse.json()) as Dashboard;
      setDashboard(liveDashboard);
      setUsers(await usersResponse.json());

      if (activityResponse.ok) {
        setActivities(await activityResponse.json());
      }
    } catch (cause) {
      console.error(cause);
      setDashboard(emptyDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const visibleUsers = useMemo(() => {
    let result = users;
    if (tabFilter === "admins") {
      result = result.filter((u) => u.isAdmin || u.isSuperAdmin);
    } else if (tabFilter === "google") {
      result = result.filter(
        (u) =>
          u.accountType === "Google" ||
          u.avatarUrl?.includes("googleusercontent.com") ||
          u.avatarUrl?.includes("lh3.google"),
      );
    }
    const term = search.trim().toLowerCase();
    if (!term) return result;
    return result.filter((user) =>
      [user.displayName, user.username, user.email, user.role, user.accountType].some((value) =>
        value?.toLowerCase().includes(term),
      ),
    );
  }, [search, tabFilter, users]);

  // Handle Promote / Demote existing user to Admin
  const changeAdmin = async (targetUser: ManagedUser, isAdmin: boolean) => {
    const action = isAdmin ? "make this user an admin" : "remove admin access from this user";
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    setUpdatingId(targetUser._id);
    try {
      const response = await fetch(`/api/admin/superadmin/users/${targetUser._id}/admin`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not update administrator access.");
      }
      setUsers((current) =>
        current.map((item) => (item._id === targetUser._id ? { ...item, isAdmin } : item)),
      );
      setDashboard((current) => ({ ...current, admins: current.admins + (isAdmin ? 1 : -1) }));
      void loadData();
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Could not update administrator access.");
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Create Normal Admin
  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingAdmin(true);
    setCreateAdminError("");
    try {
      const response = await fetch("/api/admin/superadmin/admins", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(createAdminForm),
      });
      const data = (await response.json().catch(() => null)) as
        | ManagedUser
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || "Failed to create admin.");
      }
      const newAdmin = data as ManagedUser;
      setUsers((current) => [newAdmin, ...current]);
      setDashboard((current) => ({
        ...current,
        users: current.users + 1,
        admins: current.admins + 1,
      }));
      setShowCreateAdmin(false);
      setCreateAdminForm({
        username: "",
        password: "",
        displayName: "",
        email: "",
        role: "Admin",
      });
      void loadData();
    } catch (err) {
      setCreateAdminError(err instanceof Error ? err.message : "Could not create administrator.");
    } finally {
      setCreatingAdmin(false);
    }
  };

  // Open Edit Admin Modal
  const openEditModal = (admin: ManagedUser) => {
    setEditingAdmin(admin);
    setEditAdminForm({
      username: admin.username || "",
      displayName: admin.displayName || "",
      email: admin.email || "",
      password: "",
      role: admin.role || "Admin",
    });
    setEditAdminError("");
  };

  // Handle Edit Admin
  const handleSaveEditAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAdmin) return;
    setSavingEditAdmin(true);
    setEditAdminError("");
    try {
      const payload: Record<string, string> = {
        username: editAdminForm.username,
        displayName: editAdminForm.displayName,
        email: editAdminForm.email,
        role: editAdminForm.role,
      };
      if (editAdminForm.password.trim()) {
        payload.password = editAdminForm.password.trim();
      }
      const response = await fetch(`/api/admin/superadmin/admins/${editingAdmin._id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => null)) as
        | ManagedUser
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error((data as { error?: string } | null)?.error || "Failed to update admin.");
      }
      const updated = data as ManagedUser;
      setUsers((current) =>
        current.map((item) => (item._id === updated._id ? { ...item, ...updated } : item)),
      );
      setEditingAdmin(null);
      void loadData();
    } catch (err) {
      setEditAdminError(err instanceof Error ? err.message : "Could not update admin account.");
    } finally {
      setSavingEditAdmin(false);
    }
  };

  // Handle Disable / Enable Admin
  const toggleDisableAdmin = async (admin: ManagedUser) => {
    const actionText = admin.isDisabled ? "enable" : "disable";
    if (!confirm(`Are you sure you want to ${actionText} admin @${admin.username}?`)) return;
    setUpdatingId(admin._id);
    try {
      const response = await fetch(`/api/admin/superadmin/admins/${admin._id}/status`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDisabled: !admin.isDisabled }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Could not ${actionText} administrator.`);
      }
      const result = (await response.json()) as { isDisabled: boolean };
      setUsers((current) =>
        current.map((item) =>
          item._id === admin._id ? { ...item, isDisabled: result.isDisabled } : item,
        ),
      );
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Could not ${actionText} administrator.`);
    } finally {
      setUpdatingId(null);
    }
  };

  // Handle Delete Admin
  const handleDeleteAdmin = async (admin: ManagedUser) => {
    if (
      !confirm(
        `Are you sure you want to PERMANENTLY delete admin @${admin.username}? This cannot be undone.`,
      )
    )
      return;
    setUpdatingId(admin._id);
    try {
      const response = await fetch(`/api/admin/superadmin/admins/${admin._id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || "Could not delete administrator.");
      }
      setUsers((current) => current.filter((item) => item._id !== admin._id));
      setDashboard((current) => ({
        ...current,
        users: current.users - 1,
        admins: current.admins - 1,
      }));
      void loadData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Could not delete administrator.");
    } finally {
      setUpdatingId(null);
    }
  };

  const stats = [
    { label: "Registered users", value: dashboard.users, icon: Users, color: "bg-sky-500" },
    { label: "Administrators", value: dashboard.admins, icon: ShieldCheck, color: "bg-violet-500" },
    {
      label: "Active magazines",
      value: dashboard.active_magazines,
      icon: BookOpen,
      color: "bg-amber-500",
    },
    {
      label: "Magazines sold",
      value: dashboard.magazines_sold,
      icon: WalletCards,
      color: "bg-emerald-500",
    },
  ];

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return "—";
    try {
      const d = new Date(dateStr);
      return d.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      return dateStr;
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500 font-sans">
        <div className="flex items-center gap-3">
          <span className="size-5 border-2 border-violet-600 border-t-transparent rounded-full animate-spin" />
          <span className="font-semibold text-sm">Loading Super Admin Dashboard...</span>
        </div>
      </div>
    );
  }

  if (!isLoggedIn || (currentAuthUser && !currentAuthUser.isSuperAdmin)) {
    return null;
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 font-sans pb-16">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Top Header */}
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200">
              <Crown className="size-6" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">
                Selam Kids
              </p>
              <h1 className="text-3xl font-extrabold tracking-tight">Super Admin Dashboard</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-100 shadow-xs"
            >
              Content Dashboard →
            </Link>
            <button
              type="button"
              onClick={async () => {
                await logout();
                void navigate({ to: "/auth" });
              }}
              title="Log out"
              className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm font-bold text-rose-600 hover:bg-rose-50 transition shadow-xs"
            >
              <LogOut className="size-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        {/* Stats Grid */}
        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, icon: Icon, color }) => (
            <article
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div
                className={`mb-5 grid size-10 place-items-center rounded-xl ${color} text-white shadow-sm`}
              >
                <Icon className="size-5" />
              </div>
              <p className="text-3xl font-extrabold">{loading ? "—" : value.toLocaleString()}</p>
              <p className="mt-1 text-sm font-medium text-slate-500">{label}</p>
            </article>
          ))}
        </section>

        {/* Top Control Sections */}
        <section className="mt-7 grid gap-5 lg:grid-cols-3">
          {/* Revenue */}
          <article className="rounded-2xl bg-slate-900 p-6 text-white shadow-sm lg:col-span-1 flex flex-col justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-slate-400">
                Sales Revenue
              </p>
              <p className="mt-3 text-4xl font-extrabold">
                {(dashboard.sales_cents / 100).toLocaleString(undefined, {
                  style: "currency",
                  currency: "USD",
                })}
              </p>
              <p className="mt-3 text-sm leading-relaxed text-slate-400">
                Live sales records from magazine readers. Track sales performance and customer
                engagement.
              </p>
            </div>
            <div className="mt-6 pt-4 border-t border-slate-800 text-xs text-slate-400">
              Authenticated Super Admin:{" "}
              <span className="text-white font-bold">@{currentAuthUser?.username || "admin"}</span>
            </div>
          </article>

          {/* Admin Management Quick Action Box */}
          <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700 shadow-xs">
                  <ShieldCheck className="size-5" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-900">Admin Account Creation</h2>
                  <p className="text-sm text-slate-500">
                    Create new normal Admin accounts with custom username and secure password.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowCreateAdmin((v) => !v);
                  setCreateAdminError("");
                }}
                className="flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700 transition shadow-sm"
              >
                <UserPlus className="size-4" />
                {showCreateAdmin ? "Close Form" : "Create Normal Admin"}
              </button>
            </div>

            {/* Create Admin Form Dropdown */}
            {showCreateAdmin && (
              <form
                onSubmit={(e) => void handleCreateAdmin(e)}
                className="mt-5 rounded-xl border border-violet-200 bg-violet-50/70 p-5"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-violet-950 flex items-center gap-2">
                    <KeyRound className="size-4 text-violet-600" />
                    New Administrator Credentials
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowCreateAdmin(false)}
                    aria-label="Close form"
                    className="text-violet-600 hover:text-violet-900"
                  >
                    <X className="size-4" />
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Username <span className="text-rose-500">*</span>
                    </label>
                    <input
                      required
                      value={createAdminForm.username}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, username: e.target.value })
                      }
                      placeholder="e.g. content_admin"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Password <span className="text-rose-500">* (min 8 chars)</span>
                    </label>
                    <input
                      required
                      type="password"
                      minLength={8}
                      value={createAdminForm.password}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, password: e.target.value })
                      }
                      placeholder="••••••••"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Full Name</label>
                    <input
                      value={createAdminForm.displayName}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, displayName: e.target.value })
                      }
                      placeholder="e.g. Sara Kidane"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address (optional)
                    </label>
                    <input
                      type="email"
                      value={createAdminForm.email}
                      onChange={(e) =>
                        setCreateAdminForm({ ...createAdminForm, email: e.target.value })
                      }
                      placeholder="admin@selamkids.com"
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                    />
                  </div>
                </div>

                {createAdminError && (
                  <p className="mt-3 text-sm font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {createAdminError}
                  </p>
                )}

                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateAdmin(false)}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/60"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={creatingAdmin}
                    className="rounded-lg bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 shadow-sm"
                  >
                    {creatingAdmin ? "Creating..." : "Save Admin Account"}
                  </button>
                </div>
              </form>
            )}

            <div className="mt-5 rounded-xl bg-amber-50/80 border border-amber-200 p-3.5 text-xs text-amber-900 leading-relaxed">
              <strong>Role-based access:</strong> Normal Admins can log in with their created
              username/password and access the Admin Dashboard to manage magazines, banners, and
              user feedback. Super Admin privileges are protected.
            </div>
          </article>
        </section>

        {/* ─── SECTION 3: RECENT ACTIVITY LOG ─── */}
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
            <div className="flex items-center gap-3">
              <div className="grid size-9 place-items-center rounded-xl bg-emerald-100 text-emerald-700">
                <Activity className="size-5" />
              </div>
              <div>
                <h2 className="text-lg font-extrabold text-slate-900">Recent Activity</h2>
                <p className="text-xs text-slate-500">
                  Automatic audit trail of important actions performed by Admins and Super Admins.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void loadData()}
              title="Refresh logs"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 transition"
            >
              <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>

          {activities.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              No recent activity recorded yet. Actions like adding magazines, banners, or creating
              admins will appear here.
            </p>
          ) : (
            <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 pr-1">
              {activities.map((log) => (
                <div
                  key={log._id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-2 text-sm"
                >
                  <div className="flex items-start sm:items-center gap-2.5">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                        log.action.includes("Created") || log.action.includes("Added")
                          ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                          : log.action.includes("Deleted")
                            ? "bg-rose-100 text-rose-800 border border-rose-200"
                            : log.action.includes("Disabled")
                              ? "bg-amber-100 text-amber-800 border border-amber-200"
                              : "bg-sky-100 text-sky-800 border border-sky-200"
                      }`}
                    >
                      {log.action}
                    </span>
                    <span className="text-slate-700 font-medium">{log.details}</span>
                    <span className="text-xs text-slate-400 font-semibold">
                      by <strong className="text-slate-800">@{log.username || "admin"}</strong>
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 shrink-0 font-medium">
                    {formatDate(log.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ─── SECTION 1: USERS & ADMIN MANAGEMENT TABLE ─── */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">User & Admin Management</h2>
              <p className="text-sm text-slate-500">
                All registered users (including Google Sign-In users) and administrator accounts.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Filter Tabs */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setTabFilter("all")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFilter === "all" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  All ({users.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabFilter("admins")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFilter === "admins" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Admins ({users.filter((u) => u.isAdmin || u.isSuperAdmin).length})
                </button>
                <button
                  type="button"
                  onClick={() => setTabFilter("google")}
                  className={`px-3 py-1.5 rounded-lg transition ${
                    tabFilter === "google" ? "bg-white text-slate-900 shadow-xs" : "text-slate-500"
                  }`}
                >
                  Google Users (
                  {
                    users.filter(
                      (u) =>
                        u.accountType === "Google" ||
                        u.avatarUrl?.includes("googleusercontent.com") ||
                        u.avatarUrl?.includes("lh3.google"),
                    ).length
                  }
                  )
                </button>
              </div>

              {/* Search input */}
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search username, email, role..."
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm outline-none focus:border-violet-500"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-5 py-3 font-bold">Username & Profile</th>
                  <th className="px-5 py-3 font-bold">Email</th>
                  <th className="px-5 py-3 font-bold">Role</th>
                  <th className="px-5 py-3 font-bold">Account Type</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Joined</th>
                  <th className="px-5 py-3 text-right font-bold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                      Loading users from database and auth system…
                    </td>
                  </tr>
                ) : visibleUsers.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500 font-medium">
                      No matching users found.
                    </td>
                  </tr>
                ) : (
                  visibleUsers.map((u) => {
                    const isGoogleUser =
                      u.accountType === "Google" ||
                      u.avatarUrl?.includes("googleusercontent.com") ||
                      u.avatarUrl?.includes("lh3.google");

                    return (
                      <tr
                        key={u._id}
                        className={`hover:bg-slate-50/80 transition-colors ${u.isDisabled ? "bg-rose-50/20" : ""}`}
                      >
                        {/* User & Username */}
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            {u.avatarUrl ? (
                              <img
                                src={u.avatarUrl}
                                alt=""
                                className="size-9 rounded-full object-cover border border-slate-200"
                              />
                            ) : (
                              <span className="grid size-9 place-items-center rounded-full bg-slate-200 font-bold text-slate-700">
                                {(u.displayName || u.username || "U").slice(0, 1).toUpperCase()}
                              </span>
                            )}
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <span>{u.displayName || "User"}</span>
                                {u.isSuperAdmin && (
                                  <Crown className="size-3.5 text-amber-500 inline" />
                                )}
                              </div>
                              <div className="text-xs text-slate-500 font-mono">
                                @{u.username || "no-username"}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Email */}
                        <td className="px-5 py-4 text-slate-600 font-medium">
                          {u.email || <span className="text-slate-400 italic">No email</span>}
                        </td>

                        {/* Role */}
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                              u.isSuperAdmin
                                ? "bg-violet-100 text-violet-800 border border-violet-200"
                                : u.isAdmin
                                  ? "bg-purple-100 text-purple-800 border border-purple-200"
                                  : u.role === "Family"
                                    ? "bg-amber-100 text-amber-800 border border-amber-200"
                                    : "bg-sky-100 text-sky-800 border border-sky-200"
                            }`}
                          >
                            {u.isSuperAdmin ? "Super Admin" : u.isAdmin ? "Admin" : u.role}
                          </span>
                        </td>

                        {/* Account Type */}
                        <td className="px-5 py-4">
                          {isGoogleUser ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                              <span className="grid size-3.5 place-items-center rounded-full bg-blue-600 text-[9px] font-black text-white">
                                G
                              </span>
                              Google
                            </span>
                          ) : u.accountType === "Admin" ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-50 text-violet-700 border border-violet-200">
                              Admin Credential
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                              Email / Password
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-5 py-4">
                          {u.isDisabled ? (
                            <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-bold text-rose-700">
                              <Power className="size-3" /> Disabled
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-bold text-emerald-700">
                              <Check className="size-3" /> Active
                            </span>
                          )}
                        </td>

                        {/* Joined */}
                        <td className="whitespace-nowrap px-5 py-4 text-slate-500 text-xs font-medium">
                          {new Date(u.createdAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </td>

                        {/* Actions */}
                        <td className="px-5 py-4 text-right">
                          {u.isSuperAdmin ? (
                            <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-400">
                              Super Admin (Protected)
                            </span>
                          ) : u.isAdmin ? (
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Edit Admin */}
                              <button
                                type="button"
                                onClick={() => openEditModal(u)}
                                title="Edit admin credentials & profile"
                                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-bold text-slate-700 hover:bg-slate-100 transition"
                              >
                                <Edit2 className="size-3.5" />
                                <span>Edit</span>
                              </button>

                              {/* Disable / Enable Admin */}
                              <button
                                type="button"
                                disabled={updatingId === u._id}
                                onClick={() => void toggleDisableAdmin(u)}
                                title={u.isDisabled ? "Enable account" : "Disable account"}
                                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-bold transition disabled:opacity-50 ${
                                  u.isDisabled
                                    ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                    : "border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                }`}
                              >
                                <Power className="size-3.5" />
                                <span>{u.isDisabled ? "Enable" : "Disable"}</span>
                              </button>

                              {/* Delete Admin */}
                              <button
                                type="button"
                                disabled={updatingId === u._id}
                                onClick={() => void handleDeleteAdmin(u)}
                                title="Delete admin account"
                                className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-bold text-rose-700 hover:bg-rose-100 transition disabled:opacity-50"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete</span>
                              </button>
                            </div>
                          ) : (
                            /* Regular user promote/demote button */
                            <button
                              disabled={updatingId === u._id}
                              onClick={() => void changeAdmin(u, true)}
                              className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 transition disabled:opacity-50 shadow-xs"
                            >
                              {updatingId === u._id ? "Saving…" : "Make Admin"}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ─── EDIT ADMIN MODAL ─── */}
        {editingAdmin && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between border-b border-slate-200 pb-4 mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700">
                    <Edit2 className="size-4" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-900">
                      Edit Admin: @{editingAdmin.username}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Update credentials, display name, and role.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setEditingAdmin(null)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="size-5" />
                </button>
              </div>

              <form onSubmit={(e) => void handleSaveEditAdmin(e)} className="space-y-3.5">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Username</label>
                  <input
                    required
                    value={editAdminForm.username}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, username: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Display Name
                  </label>
                  <input
                    value={editAdminForm.displayName}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, displayName: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email</label>
                  <input
                    type="email"
                    value={editAdminForm.email}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, email: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    New Password{" "}
                    <span className="text-slate-400 font-normal">
                      (leave blank to keep current)
                    </span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter new password (optional)"
                    value={editAdminForm.password}
                    onChange={(e) =>
                      setEditAdminForm({ ...editAdminForm, password: e.target.value })
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Role</label>
                  <select
                    value={editAdminForm.role}
                    onChange={(e) => setEditAdminForm({ ...editAdminForm, role: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-violet-600"
                  >
                    <option value="Admin">Admin</option>
                    <option value="Family">Family</option>
                    <option value="Kid">Kid</option>
                  </select>
                </div>

                {editAdminError && (
                  <p className="text-sm font-semibold text-rose-600 bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                    {editAdminError}
                  </p>
                )}

                <div className="mt-5 flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setEditingAdmin(null)}
                    className="rounded-lg px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingEditAdmin}
                    className="rounded-lg bg-violet-600 px-5 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50 shadow-sm"
                  >
                    {savingEditAdmin ? "Saving…" : "Save Changes"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
