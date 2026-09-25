import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { DEMO_MEMBER_PROFILES } from "@/lib/demo-members";

export default async function MembersPage() {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  return <div className="admin-dashboard-shell">
    <aside className="admin-sidebar">
      <a className="admin-sidebar-brand" href="/dashboard" aria-label="Bengal Business Council">
        <img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council" />
      </a>
      <nav className="admin-nav">
        <a href="/dashboard">Dashboard</a>
        <a className="active" href="/members">Members</a>
        <a href="/report">Report</a>
      </nav>
      <div className="admin-sidebar-footer"><AdminLogoutButton /></div>
    </aside>

    <main className="admin-dashboard-main members-main">
      <div className="members-heading">
        <div>
          <h1>Members</h1>
          <p>Read-only demo member directory used by the registration form.</p>
        </div>
        <span>{DEMO_MEMBER_PROFILES.length} members</span>
      </div>

      <section className="members-grid" aria-label="Member directory">
        {DEMO_MEMBER_PROFILES.map((member) => <article className="member-directory-card" key={member.id}>
          <div className="member-directory-photo"><img src={member.photo} alt={member.primaryName} /></div>
          <div className="member-directory-content">
            <h2>{member.primaryName}</h2>
            <dl>
              <div><dt>Email</dt><dd>{member.email}</dd></div>
              <div><dt>WhatsApp</dt><dd>+91 {member.phone}</dd></div>
              <div><dt>Billing</dt><dd>{member.billingDetails}</dd></div>
              <div><dt>Members</dt><dd>{member.participantNames.join(", ")}</dd></div>
            </dl>
          </div>
        </article>)}
      </section>
    </main>
  </div>;
}
