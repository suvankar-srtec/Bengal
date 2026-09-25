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
          <p>Read-only member directory used to prefill event registrations.</p>
        </div>
        <span>{DEMO_MEMBER_PROFILES.length} members</span>
      </div>

      <section className="members-table-card">
        <div className="members-table-heading">
          <div>
            <h2>Member directory</h2>
            <p>Member information is fixed and cannot be edited from this page.</p>
          </div>
        </div>

        <div className="members-table-wrap">
          <table className="members-table">
            <thead>
              <tr>
                <th>Photo</th>
                <th>Primary member</th>
                <th>Associated members</th>
                <th>Email</th>
                <th>WhatsApp</th>
                <th>Billing details</th>
              </tr>
            </thead>
            <tbody>
              {DEMO_MEMBER_PROFILES.map((member) => <tr key={member.id}>
                <td>
                  <img className="members-table-photo" src={member.photo} alt={member.primaryName} />
                </td>
                <td><strong>{member.primaryName}</strong></td>
                <td>
                  <div className="members-table-associated">
                    {member.participantNames.map((name) => <span key={name}>{name}</span>)}
                  </div>
                </td>
                <td>{member.email}</td>
                <td>+91 {member.phone}</td>
                <td>{member.billingDetails}</td>
              </tr>)}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}
