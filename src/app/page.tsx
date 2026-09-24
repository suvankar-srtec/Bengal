import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AdminLoginForm } from "@/components/admin-login-form";
import { ADMIN_SESSION_COOKIE, validAdminSession } from "@/lib/admin-auth";

export default async function Home() {
  const store = await cookies();
  if (validAdminSession(store.get(ADMIN_SESSION_COOKIE)?.value)) redirect("/dashboard");

  return <main className="admin-login-page">
    <section className="admin-login-panel">
      <div className="admin-login-card">
        <div className="admin-login-card-brand" aria-label="Bengal Business Council">
          <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
          <span className="brand-name">BENGAL<span>BUSINESS COUNCIL</span></span>
        </div>
        <h2>Sign in to open the event dashboard.</h2>
        <AdminLoginForm />
      </div>
    </section>
  </main>;
}
