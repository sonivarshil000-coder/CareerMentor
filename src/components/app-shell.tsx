import Link from "next/link";
import {
  Bell,
  BriefcaseBusiness,
  Building2,
  CheckCheck,
  CircleHelp,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings2,
  UserRound,
} from "lucide-react";
import { signOut } from "@/auth";
import { Logo } from "@/components/logo";

const navigation = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/resumes", label: "Resumes", icon: FileText },
  { href: "/companies", label: "Companies", icon: Building2 },
  { href: "/jobs", label: "Job matches", icon: BriefcaseBusiness },
  { href: "/approvals", label: "Approval queue", icon: CheckCheck },
  { href: "/applications", label: "Applications", icon: LayoutDashboard },
];

export function AppShell({
  user,
  children,
}: {
  user: { id: string; name: string | null; email: string | null };
  children: React.ReactNode;
}) {
  const initials = (user.name ?? user.email ?? "A").slice(0, 1).toUpperCase();

  return (
    <div className="workspace">
      <aside className="sidebar">
        <div className="sidebar-brand"><Logo /></div>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="side-nav" aria-label="Workspace">
          {navigation.map(({ href, label, icon: Icon }) => (
            <Link href={href} key={href}>
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {label === "Approval queue" && <span className="nav-count">0</span>}
            </Link>
          ))}
        </nav>
        <p className="nav-caption nav-caption-spaced">ACCOUNT</p>
        <nav className="side-nav" aria-label="Account">
          <Link href="/profile"><UserRound size={18} strokeWidth={1.8} /><span>Profile & answers</span></Link>
          <Link href="/notifications"><Bell size={18} strokeWidth={1.8} /><span>Notifications</span></Link>
          <Link href="/settings"><Settings2 size={18} strokeWidth={1.8} /><span>Settings</span></Link>
          <Link href="/help"><CircleHelp size={18} strokeWidth={1.8} /><span>Help center</span></Link>
        </nav>
        <div className="sidebar-bottom">
          <div className="user-mini"><span className="avatar">{initials}</span><div><b>{user.name ?? "Your workspace"}</b><small>Free plan</small></div></div>
          <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
            <button className="signout-button" type="submit"><LogOut size={16} /> Sign out</button>
          </form>
        </div>
      </aside>
      <main className="workspace-main">{children}</main>
    </div>
  );
}
