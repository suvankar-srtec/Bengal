import Link from "next/link";
import { NotificationNavLink } from "@/components/notification-nav-link";
import { NotificationInboxStatus } from "@/components/notification-inbox-status";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, readAdminSession } from "@/lib/admin-auth";
import { getDatabase } from "@/lib/db";
import { BBC_LOGO_DATA_URL } from "@/lib/bbc-logo";
import { formatMoney } from "@/lib/registration";
import { AdminLogoutButton } from "@/components/admin-logout-button";
import { MobileAdminNav } from "@/components/mobile-admin-nav";
import { PaymentReviewActions } from "@/components/payment-review-actions";
export const dynamic="force-dynamic";
type Review={id:string;registration_id:string;member_name:string;email:string;phone:string;event_name:string;reference:string;method:string;status:string;amount_paise:number;note:string;created_at:Date;whatsapp:string|null;email_status:string|null;email_error:string|null;whatsapp_error:string|null;photo_total:number;photo_uploaded:number;photo_email_sent:number;photo_whatsapp_sent:number};
export default async function Notifications({searchParams}:{searchParams:Promise<{q?:string;status?:string;page?:string}>}) {
  const session=readAdminSession((await cookies()).get(ADMIN_SESSION_COOKIE)?.value);
  if(!session)redirect("/");if(session.role!=="admin")redirect("/dashboard");
  const params=await searchParams;
  const q=typeof params.q==="string"?params.q.trim().slice(0,120):"";
  const status=["pending","approved","rejected","all"].includes(params.status||"")?params.status!:"pending";
  const n=Number(params.page);const page=Number.isSafeInteger(n)&&n>0?Math.min(n,100000):1;
  let rows:Review[]=[];let failed=false;
  try {rows=(await getDatabase().query<Review>(`SELECT p.id,p.registration_id,p.method,p.status,p.amount_paise,p.note,p.created_at,
    r.member_name,r.email,r.phone,r.event_name,r.reference,w.status AS whatsapp,e.status AS email_status,e.error_code AS email_error,w.error_code AS whatsapp_error,
    COALESCE((SELECT COUNT(*) FROM public.bbc_participant_photos ph WHERE ph.registration_id=r.id),0)::int AS photo_total,
    COALESCE((SELECT COUNT(*) FROM public.bbc_participant_photos ph WHERE ph.registration_id=r.id AND ph.photo_data IS NOT NULL),0)::int AS photo_uploaded,
    COALESCE((SELECT COUNT(*) FROM public.bbc_participant_photos ph WHERE ph.registration_id=r.id AND ph.email_status='accepted'),0)::int AS photo_email_sent,
    COALESCE((SELECT COUNT(*) FROM public.bbc_participant_photos ph WHERE ph.registration_id=r.id AND ph.whatsapp_status='accepted'),0)::int AS photo_whatsapp_sent
    FROM public.bbc_registration_payment_reviews p JOIN public.bbc_event_registrations r ON r.id=p.registration_id
    LEFT JOIN public.bbc_whatsapp_pass_deliveries w ON w.registration_id=r.id LEFT JOIN public.bbc_email_pass_deliveries e ON e.registration_id=r.id
    WHERE ($1='all' OR p.status=$1) AND ($2='' OR strpos(lower(concat_ws(' ',r.member_name,r.email,r.phone,r.event_name,r.reference)),lower($2))>0)
    ORDER BY p.created_at DESC,p.id DESC LIMIT 51 OFFSET $3`,[status,q,(page-1)*50])).rows;}catch{failed=true;}
  const href=(next:number)=>`/notifications?${new URLSearchParams({q,status,page:String(next)})}`;
  return <div className="admin-dashboard-shell">
    <MobileAdminNav role="admin"/>
    <aside className="admin-sidebar"><Link prefetch={false} className="admin-sidebar-brand" href="/dashboard"><img className="bbc-logo bbc-logo-sidebar" src={BBC_LOGO_DATA_URL} alt="Bengal Business Council"/></Link>
      <nav className="admin-nav"><Link prefetch={false} href="/dashboard">Dashboard</Link><Link prefetch={false} href="/managers">Manager</Link><Link prefetch={false} href="/upload">Upload</Link>
        <details className="admin-nav-group"><summary className="admin-nav-parent">Report</summary><div className="admin-nav-submenu">
          <Link prefetch={false} href="/report?report=registration">Registration Report</Link><Link prefetch={false} href="/report?report=event">Event Report</Link><Link prefetch={false} href="/report/whatsapp">WhatsApp</Link>
        </div></details>
        <NotificationNavLink />
      </nav><div className="admin-sidebar-footer"><AdminLogoutButton/></div></aside>
    <main className="admin-dashboard-main whatsapp-history-main"><div className="members-heading"><div><h1>Notification</h1><p>Confirm cash payments or review bank receipts before issuing QR passes.</p></div></div>
      <NotificationInboxStatus visibleIds={failed ? [] : rows.slice(0,50).map(row=>row.id)} />
      <form className="whatsapp-history-filters" method="get" action="/notifications">
        <label htmlFor="payment-search">Search notifications<input id="payment-search" type="search" name="q" defaultValue={q} placeholder="Member, event, email or reference"/></label>
        <label htmlFor="payment-status">Status<select id="payment-status" name="status" defaultValue={status}><option value="pending">Awaiting approval</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All</option></select></label>
        <button type="submit">Search</button><Link href="/notifications">Reset</Link>
      </form>
      {failed?<p className="error-banner" role="alert">Payment reviews could not be loaded. Please try again.</p>:rows.length===0?<div className="report-empty-state">No notifications match this view.</div>:<div className="payment-review-list">{rows.slice(0,50).map(row=><article className="payment-review-card" key={row.id}>
        <header><div><h2>{row.member_name}</h2><p>{row.event_name}</p></div><span className={`whatsapp-history-status ${row.status==="approved"?"accepted":row.status==="rejected"?"failed":"pending"}`}>{row.status}</span></header>
        <dl className="payment-review-details"><div><dt>Payment</dt><dd>{row.method==="bank"?"Bank transfer":"Cash"} / {formatMoney(row.amount_paise)}</dd></div><div><dt>Submitted</dt><dd>{new Intl.DateTimeFormat("en-IN",{dateStyle:"medium",timeStyle:"short",timeZone:"Asia/Kolkata"}).format(row.created_at)}</dd></div><div><dt>Email</dt><dd>{row.email}</dd></div><div><dt>WhatsApp</dt><dd>{row.phone}</dd></div><div className="full-width"><dt>Registration reference</dt><dd>{row.reference}</dd></div></dl>
        {row.method==="bank"&&<a className="receipt-download" href={`/api/admin/payment-reviews/${row.id}/receipt`}>Download bank receipt</a>}
        {row.note&&<p>Review note: {row.note}</p>}
        {row.status==="approved"&&<p className="payment-delivery-status">
          Participant photos: <strong>{row.photo_uploaded}/{row.photo_total || 0} uploaded</strong><br/>
          Photo links: WhatsApp {row.photo_whatsapp_sent}/{row.photo_total || 0} sent · Email {row.photo_email_sent}/{row.photo_total || 0} sent<br/>
          Passes: <strong>{row.photo_total>0&&row.photo_uploaded===row.photo_total?"Ready":"Awaiting participant photos"}</strong>
        </p>}
        <PaymentReviewActions id={row.id} registrationId={row.registration_id} status={row.status} method={row.method}/>
      </article>)}</div>}
      {!failed&&<nav className="whatsapp-history-pagination" aria-label="Notification pages"><span>Page {page}</span>{page>1&&<Link href={href(page-1)}>Previous</Link>}{rows.length>50&&<Link href={href(page+1)}>Next</Link>}</nav>}
    </main>
  </div>;
}
