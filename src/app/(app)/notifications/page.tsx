import Link from "next/link";
import { Bell, CheckCheck, Sparkles } from "lucide-react";
import { markAllNotificationsRead, markNotificationRead } from "@/app/actions/notifications";
import { requireUser } from "@/lib/auth/require-user";
import { db } from "@/lib/db";

const kindLabels: Record<string, string> = {
  NEW_MATCHING_JOB: "New match",
  NEEDS_APPROVAL: "Approval needed",
  APPLICATION_FAILURE: "Application update",
  SYSTEM: "Account update",
};

export default async function NotificationsPage() {
  const user = await requireUser();
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unreadCount = notifications.filter((notification) => !notification.readAt).length;

  return (
    <div className="page-wrap">
      <header className="page-header"><div><p className="eyebrow">Your updates</p><h1>Notifications</h1><p>New job matches and changes that need your attention.</p></div>{unreadCount > 0 && <form action={markAllNotificationsRead}><button className="button button-quiet button-small" type="submit"><CheckCheck size={14} /> Mark all read</button></form>}</header>
      {notifications.length === 0 ? (
        <div className="panel empty-card notifications-empty"><div className="empty-mark"><Bell size={20} /></div><h3>You’re up to date</h3><p>Strong new resume matches will appear here after your company boards are scanned.</p><Link className="text-action" href="/companies">Review your companies</Link></div>
      ) : (
        <div className="notification-list">{notifications.map((notification) => <article className={`panel notification-card ${notification.readAt ? "is-read" : "is-unread"}`} key={notification.id}>
          <span className="notification-mark"><Sparkles size={16} /></span><div className="notification-copy"><div className="notification-meta"><span>{kindLabels[notification.kind] ?? "Update"}</span><time dateTime={notification.createdAt.toISOString()}>{notification.createdAt.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time></div><h2>{notification.title}</h2><p>{notification.body}</p>{notification.href?.startsWith("/") && <Link className="text-action" href={notification.href}>View details</Link>}</div>
          {!notification.readAt && <form action={markNotificationRead}><input type="hidden" name="notificationId" value={notification.id} /><button className="icon-button" type="submit" aria-label={`Mark ${notification.title} as read`}><CheckCheck size={14} /></button></form>}
        </article>)}</div>
      )}
      {notifications.length === 100 && <p className="job-feed-footnote">Showing the 100 most recent notifications.</p>}
    </div>
  );
}
