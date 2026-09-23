import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";

export default async function Home() {
  const store = await cookies();
  if (validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/dashboard");

  return <main className="admin-login-page">
    <section className="admin-login-brand-panel">
      <div className="admin-login-brand">
        <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
        <span className="brand-name">BENGAL<span>BUSINESS COUNCIL</span></span>
      </div>
      <div className="admin-login-copy">
        <span className="eyebrow"><span /> EVENT ADMINISTRATION</span>
        <h1>Manage Aalap Alochona.</h1>
        <p>Secure access for registration, payments and participant QR passes.</p>
      </div>
      <div className="admin-login-event"><strong>29 September, 2026</strong><span>Aalap Alochona · Bengal Business Council</span></div>
    </section>

    <section className="admin-login-panel">
      <div className="admin-login-card">
        <span className="eyebrow">ADMIN ACCESS</span>
        <h2>Welcome back</h2>
        <p>Sign in to open the event dashboard.</p>
        <AdminLoginForm />
        <div className="admin-login-hint">Default access: <strong>admin</strong> / <strong>admin</strong></div>
      </div>
    </section>
  </main>;
}
