import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BookOpen, Crown, ShieldCheck, UserCheck, Users, WalletCards, X } from "lucide-react";

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
  isAdmin: boolean;
  isSuperAdmin: boolean;
  createdAt: string;
};

const emptyDashboard: Dashboard = {
  users: 0,
  admins: 0,
  active_magazines: 0,
  magazines_sold: 0,
  sales_cents: 0,
};

const previewDashboard: Dashboard = {
  users: 1248,
  admins: 12,
  active_magazines: 48,
  magazines_sold: 963,
  sales_cents: 481500,
};

function SuperAdminPage() {
  const [dashboard, setDashboard] = useState<Dashboard>(emptyDashboard);
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [addAdminMessage, setAddAdminMessage] = useState("");
  const [addingAdmin, setAddingAdmin] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, usersResponse] = await Promise.all([
        fetch("/api/admin/superadmin/dashboard", { credentials: "include" }),
        fetch("/api/admin/superadmin/users", { credentials: "include" }),
      ]);
      if (!dashboardResponse.ok || !usersResponse.ok) {
        const response = !dashboardResponse.ok ? dashboardResponse : usersResponse;
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Could not load super admin data.");
      }
      const liveDashboard = await dashboardResponse.json() as Dashboard;
      setDashboard(liveDashboard.users === 0 ? previewDashboard : liveDashboard);
      setUsers(await usersResponse.json());
    } catch (cause) {
      console.error(cause);
      setDashboard(previewDashboard);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadData(); }, [loadData]);

  const visibleUsers = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return users;
    return users.filter((user) =>
      [user.displayName, user.username, user.email].some((value) => value?.toLowerCase().includes(term)),
    );
  }, [search, users]);

  const changeAdmin = async (user: ManagedUser, isAdmin: boolean) => {
    const action = isAdmin ? "make this user an admin" : "remove admin access from this user";
    if (!confirm(`Are you sure you want to ${action}?`)) return;
    setUpdatingId(user._id);
    try {
      const response = await fetch(`/api/admin/superadmin/users/${user._id}/admin`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isAdmin }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(body?.error || "Could not update administrator access.");
      }
      setUsers((current) => current.map((item) => item._id === user._id ? { ...item, isAdmin } : item));
      setDashboard((current) => ({ ...current, admins: current.admins + (isAdmin ? 1 : -1) }));
    } catch (cause) {
      alert(cause instanceof Error ? cause.message : "Could not update administrator access.");
    } finally {
      setUpdatingId(null);
    }
  };

  const addAdmin = async (event: React.FormEvent) => {
    event.preventDefault();
    setAddingAdmin(true);
    setAddAdminMessage("");
    try {
      const response = await fetch("/api/admin/superadmin/admins", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: adminEmail }),
      });
      const body = await response.json().catch(() => null) as ManagedUser | { error?: string } | null;
      if (!response.ok) throw new Error((body as { error?: string } | null)?.error || "Could not add administrator.");
      const admin = body as ManagedUser;
      setUsers((current) => current.some((user) => user._id === admin._id) ? current.map((user) => user._id === admin._id ? admin : user) : [admin, ...current]);
      setDashboard((current) => ({ ...current, admins: current.admins + 1 }));
      setAdminEmail("");
      setAddAdminMessage("Administrator access added.");
    } catch (cause) {
      setAddAdminMessage(cause instanceof Error ? cause.message : "Could not add administrator.");
    } finally { setAddingAdmin(false); }
  };

  const stats = [
    { label: "Registered users", value: dashboard.users, icon: Users, color: "bg-sky-500" },
    { label: "Administrators", value: dashboard.admins, icon: ShieldCheck, color: "bg-violet-500" },
    { label: "Active magazines", value: dashboard.active_magazines, icon: BookOpen, color: "bg-amber-500" },
    { label: "Magazines sold", value: dashboard.magazines_sold, icon: WalletCards, color: "bg-emerald-500" },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <header className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-7 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <div className="grid size-12 place-items-center rounded-2xl bg-violet-600 text-white shadow-lg shadow-violet-200"><Crown className="size-6" /></div>
            <div><p className="text-sm font-bold uppercase tracking-[0.18em] text-violet-600">Selam Kids</p><h1 className="text-3xl font-extrabold tracking-tight">Super Admin</h1></div>
          </div>
          <Link to="/admin" className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-100">Content dashboard</Link>
        </header>

        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {stats.map(({ label, value, icon: Icon, color }) => <article key={label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className={`mb-5 grid size-10 place-items-center rounded-xl ${color} text-white`}><Icon className="size-5" /></div><p className="text-3xl font-extrabold">{loading ? "—" : value.toLocaleString()}</p><p className="mt-1 text-sm font-medium text-slate-500">{label}</p></article>)}
          </section>

          <section className="mt-7 grid gap-5 lg:grid-cols-3">
            <article className="rounded-2xl bg-slate-900 p-6 text-white lg:col-span-1"><p className="text-sm font-bold text-slate-400">SALES REVENUE</p><p className="mt-3 text-4xl font-extrabold">{(dashboard.sales_cents / 100).toLocaleString(undefined, { style: "currency", currency: "USD" })}</p><p className="mt-3 text-sm leading-6 text-slate-400">Sales count comes from completed magazine purchases. It will show zero until your checkout flow records sales.</p></article>
            <article className="rounded-2xl border border-slate-200 bg-white p-6 lg:col-span-2"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="grid size-10 place-items-center rounded-xl bg-violet-100 text-violet-700"><UserCheck className="size-5" /></div><div><h2 className="font-bold">Admin access</h2><p className="text-sm text-slate-500">Promote registered users or remove their admin access.</p></div></div><button onClick={() => { setShowAddAdmin((open) => !open); setAddAdminMessage(""); }} className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-violet-700">{showAddAdmin ? "Close form" : "Add admin"}</button></div>{showAddAdmin && <form onSubmit={(event) => void addAdmin(event)} className="mt-5 rounded-xl bg-violet-50 p-4"><div className="flex items-center justify-between"><label htmlFor="admin-email" className="text-sm font-bold text-violet-950">Registered user email</label><button type="button" onClick={() => setShowAddAdmin(false)} aria-label="Close add admin form" className="text-violet-700"><X className="size-4" /></button></div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input id="admin-email" type="email" required value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} placeholder="name@example.com" className="min-w-0 flex-1 rounded-lg border border-violet-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-violet-500" /><button disabled={addingAdmin} className="rounded-lg bg-violet-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{addingAdmin ? "Adding…" : "Add administrator"}</button></div>{addAdminMessage && <p className="mt-2 text-sm font-medium text-violet-800">{addAdminMessage}</p>}<p className="mt-2 text-xs text-violet-700">The person must sign in once before their account can be made an admin.</p></form>}<p className="mt-5 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">Super administrators are protected here. To assign one, configure <code className="font-bold">SUPERADMIN_EMAIL</code> on the server.</p></article>
          </section>

          <section className="mt-7 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 p-5 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-lg font-extrabold">User & admin management</h2><p className="text-sm text-slate-500">Only registered users can be made administrators.</p></div><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or email" className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm outline-none focus:border-violet-500" /></div>
            <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">User</th><th className="px-5 py-3">Profile</th><th className="px-5 py-3">Joined</th><th className="px-5 py-3">Access</th><th className="px-5 py-3 text-right">Action</th></tr></thead><tbody className="divide-y divide-slate-100">{loading ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">Loading users…</td></tr> : visibleUsers.length === 0 ? <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-500">No users found.</td></tr> : visibleUsers.map((user) => <tr key={user._id}><td className="px-5 py-4"><div className="flex items-center gap-3">{user.avatarUrl ? <img src={user.avatarUrl} alt="" className="size-9 rounded-full object-cover" /> : <span className="grid size-9 place-items-center rounded-full bg-slate-100 font-bold text-slate-500">{(user.displayName || "U").slice(0, 1)}</span>}<div><div className="font-bold">{user.displayName || user.username || "Unnamed user"}</div><div className="text-slate-500">{user.email || user.username || "No email"}</div></div></div></td><td className="px-5 py-4 text-slate-600">{user.age ? `${user.age} years` : "—"}{user.gender ? ` · ${user.gender}` : ""}</td><td className="whitespace-nowrap px-5 py-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td><td className="px-5 py-4">{user.isSuperAdmin ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-xs font-bold text-violet-700">Super admin</span> : user.isAdmin ? <span className="rounded-full bg-sky-100 px-2.5 py-1 text-xs font-bold text-sky-700">Admin</span> : <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">User</span>}</td><td className="px-5 py-4 text-right">{user.isSuperAdmin ? <span className="text-xs font-semibold text-slate-400">Protected</span> : <button disabled={updatingId === user._id} onClick={() => void changeAdmin(user, !user.isAdmin)} className={user.isAdmin ? "rounded-lg px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50" : "rounded-lg bg-violet-600 px-3 py-2 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"}>{updatingId === user._id ? "Saving…" : user.isAdmin ? "Remove admin" : "Make admin"}</button>}</td></tr>)}</tbody></table></div>
          </section>
        </>
      </div>
    </main>
  );
}
