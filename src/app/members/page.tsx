import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { getDatabase } from "@/lib/db";
import { memberPhotoDataUri } from "@/lib/demo-members";

export const dynamic = "force-dynamic";

type MemberRow = {
  id: string;
  primary_name: string;
  participant_names: string[];
  email: string;
  phone: string;
  billing_details: string;
  updated_at: Date | string;
};

export default async function MembersPage() {
  const store = await cookies();
  if (!validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/");

  let members: MemberRow[] = [];
  try {
    const result = await getDatabase().query<MemberRow>(`
      SELECT id, primary_name, participant_names, email, phone, billing_details, updated_at
      FROM public.bbc_members
      ORDER BY updated_at DESC, primary_name ASC
    `);
    members = result.rows;
  } catch (error) {
    console.error("Members directory could not be loaded.", error);
  }

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
          <p>Read-only member directory created automatically from submitted registrations.</p>
        </div>
        <span>{members.length} {members.length === 1 ? "member" : "members"}</span>
      </div>

      <section className="members-table-card">
        <div className="members-table-heading">
          <div>
            <h2>Member directory</h2>
            <p>Member details are saved from the registration form and cannot be edited here.</p>
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
              {members.length ? members.map((member, index) => <tr key={member.id}>
                <td>
                  <img className="members-table-photo" src={memberPhotoDataUri(member.primary_name, index)} alt={member.primary_name} />
                </td>
                <td><strong>{member.primary_name}</strong></td>
                <td>
                  <div className="members-table-associated">
                    {member.participant_names.length
                      ? member.participant_names.map((name) => <span key={name}>{name}</span>)
                      : <span>—</span>}
                  </div>
                </td>
                <td>{member.email}</td>
                <td>{member.phone}</td>
                <td>{member.billing_details}</td>
              </tr>) : <tr>
                <td colSpan={6}>
                  <div className="members-empty-state">
                    <strong>No members saved yet</strong>
                    <span>Members will appear here automatically after a registration is submitted.</span>
                  </div>
                </td>
              </tr>}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  </div>;
}
