import { RegistrationForm } from "@/components/registration-form";
import { Icon } from "@/components/icon";

export default function Home() {
  return (
    <>
      <a className="skip-link" href="#registration">Skip to registration</a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Bengal Business Council home">
            <span className="brand-mark" aria-hidden="true">b<span>.</span></span>
            <span className="brand-name">BENGAL<span>BUSINESS COUNCIL</span></span>
          </a>
          <div className="header-note"><span className="status-dot" /> Connecting businesses. Building Bengal.</div>
        </div>
      </header>

      <main className="page-shell">
        <nav className="breadcrumb" aria-label="Breadcrumb"><span>Bengal Business Council</span><Icon name="chevron" size={13} /><span aria-current="page">Event registration</span></nav>

        <div className="event-layout">
          <section className="event-info" aria-labelledby="event-title">
            <div className="eyebrow"><span /> THE CONVERSATIONS THAT CONNECT US</div>
            <h1 id="event-title" lang="bn">আলাপ আলোচনা<span lang="en">Aalap Alochona</span></h1>
            <p className="event-tagline">A conversation today.<br />A collaboration tomorrow.</p>

            <div className="event-date"><span className="date-icon"><Icon name="calendar" size={23} /></span><div><strong>29 September, 2026</strong><span>Tuesday <i /> Bengal Business Council</span></div></div>

            <div className="section-rule" />
            <h2 className="about-title">Good business begins with a conversation.</h2>
            <p className="about-copy">Aalap Alochona is the official networking format of the Bengal Business Council. A space to go beyond introductions, exchange ideas, and build meaningful professional and personal relationships.</p>
            <p className="about-copy">Understand each other’s businesses, explore collaborations, and grow together through trust and mutual support.</p>

            <details className="bengali-details">
              <summary><span lang="bn">বাংলায় পড়ুন</span><Icon name="chevron" size={14} /></summary>
              <div lang="bn"><p>‘আলাপ আলোচনা’ হলো Bengal Business Council-এর আনুষ্ঠানিক নেটওয়ার্কিং প্ল্যাটফর্ম, যার উদ্দেশ্য সদস্যদের মধ্যে শুধুমাত্র পরিচয়ের গণ্ডি পেরিয়ে অর্থবহ পেশাগত ও ব্যক্তিগত সম্পর্ক গড়ে তোলা।</p><p>এই উদ্যোগ সদস্যদের একে অপরের ব্যবসা ও কর্মকাণ্ড সম্পর্কে আরও ভালোভাবে জানার, অভিজ্ঞতা ও ভাবনার আদান-প্রদান করার, পারস্পরিক সহযোগিতার সম্ভাবনা খুঁজে দেখার এবং সদস্যদের মধ্যে আস্থা, সৌহার্দ্য ও সহযোগিতার সম্পর্ক আরও দৃঢ় করার সুযোগ করে দেয়।</p></div>
            </details>

            <div className="impact-card">
              <div className="impact-icon"><Icon name="users" size={26} /></div>
              <div><span className="impact-label">CONNECTIONS THAT CREATE IMPACT</span><strong>₹2,500+ crore</strong><p>in business through connections built<br className="desktop-break" /> within the Council.</p></div>
              <span className="impact-decoration" aria-hidden="true">↗</span>
            </div>

            <div className="event-values"><span><Icon name="check" size={15} /> Meaningful connections</span><span><Icon name="check" size={15} /> Shared growth</span></div>
          </section>

          <section className="form-column" id="registration" aria-label="Event registration form">
            <RegistrationForm />
            <p className="form-footnote"><Icon name="lock" size={13} /> Your details are saved securely for this event.</p>
          </section>
        </div>
      </main>

      <footer className="site-footer"><span>© 2026 Bengal Business Council</span><span>Bringing people and possibilities together.</span></footer>
    </>
  );
}
