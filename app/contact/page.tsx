import { LegalPage } from "../legal-page";

// Contact/support page following the privacy/terms legal page pattern
// (scoped styles + body markup rendered via LegalPage).
const CSS = String.raw`*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{
  --bg:#0a0a0c;--surface:#111114;--card:#16161a;
  --border:#222228;--border-focus:#3a3a48;
  --text:#f0f0f4;--sub:#888896;--dim:#444452;
  --accent:#7c6af7;--accent-glow:#7c6af720;--accent-dim:#2a2440;
  --green:#00c896;--warn:#f0a000;
  --radius:10px;--sans:'DM Sans',sans-serif;--mono:'DM Mono',monospace;
}
[data-theme="light"]{
  --bg:#f5f5f7;--surface:#ffffff;--card:#ffffff;
  --border:#e0e0e8;--border-focus:#b0b0c8;
  --text:#111118;--sub:#666674;--dim:#aaaabc;
  --accent:#7c6af7;--accent-glow:#7c6af718;--accent-dim:#ebe8ff;
  --green:#009970;--warn:#c07800;
}
html,body{
  font-family:var(--sans);background:var(--bg);color:var(--text);
  -webkit-font-smoothing:antialiased;
}
body{ min-height:100vh;font-size:15px;line-height:1.6; }
a{color:var(--accent);text-decoration:none}
a:hover{text-decoration:underline}

/* Nav */
.nav{
  position:sticky;top:0;z-index:40;
  backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);
  background:rgba(10,10,12,0.7);
  border-bottom:1px solid var(--border);
}
[data-theme="light"] .nav{ background:rgba(245,245,247,0.8); }
.nav-inner{
  max-width:800px;margin:0 auto;padding:0 24px;
  display:flex;align-items:center;justify-content:space-between;
  height:56px;
}
.brand{display:flex;align-items:center;gap:8px;text-decoration:none;color:var(--text)}
.brand:hover{text-decoration:none}
.brand-mark{width:24px;height:24px;border-radius:6px;overflow:hidden;flex-shrink:0;display:grid;place-items:center}
.logo-img{display:block;object-fit:contain;pointer-events:none;-webkit-touch-callout:none;user-select:none}
.logo-img-light{display:none}
[data-theme="light"] .logo-img-dark{display:none}
[data-theme="light"] .logo-img-light{display:block}
.brand-name{font-size:15px;font-weight:600;letter-spacing:-.01em}
.back{
  display:inline-flex;align-items:center;gap:5px;
  font-size:13px;color:var(--sub);text-decoration:none;transition:color .15s;
  margin-bottom:28px;
}
.back:hover{color:var(--text);text-decoration:none}

/* Content */
.wrap{max-width:800px;margin:0 auto;padding:56px 24px 80px}
.doc-header{margin-bottom:40px;padding-bottom:32px;border-bottom:1px solid var(--border)}
.doc-kicker{
  font-family:var(--mono);font-size:11px;color:var(--accent);
  text-transform:uppercase;letter-spacing:.12em;margin-bottom:12px;display:block;
}
.doc-title{font-size:32px;font-weight:700;letter-spacing:-.02em;margin-bottom:10px}
.doc-meta{font-size:13px;color:var(--sub);font-family:var(--mono)}

/* Contact cards */
.contact-cards{display:flex;flex-direction:column;gap:12px;margin-bottom:40px}
.contact-card{
  display:flex;align-items:center;gap:14px;
  background:var(--surface);border:1px solid var(--border);
  border-radius:12px;padding:16px 20px;
  text-decoration:none;transition:border-color .15s;
}
.contact-card:hover{border-color:var(--border-focus);text-decoration:none}
.contact-ico{
  width:38px;height:38px;border-radius:10px;flex-shrink:0;
  display:grid;place-items:center;
  background:var(--accent-dim);color:var(--accent);
}
.contact-text{min-width:0}
.contact-label{display:block;font-size:14px;font-weight:600;color:var(--text)}
.contact-sub{display:block;font-size:12px;color:var(--sub);margin-top:1px}

section{margin-bottom:40px}
h2{
  font-size:18px;font-weight:600;letter-spacing:-.01em;
  margin-bottom:14px;color:var(--text);
  display:flex;align-items:center;gap:10px;
}
h2 .sec-num{
  font-family:var(--mono);font-size:11px;color:var(--dim);
  font-weight:400;flex-shrink:0;
}
p{color:var(--sub);font-size:14px;line-height:1.7;margin-bottom:12px}
p:last-child{margin-bottom:0}
ul.doc-list{
  list-style:none;display:flex;flex-direction:column;gap:8px;
  margin:12px 0;
}
ul.doc-list li{
  display:flex;align-items:flex-start;gap:10px;
  font-size:14px;color:var(--sub);line-height:1.6;
}
ul.doc-list li::before{
  content:"·";color:var(--accent);font-weight:700;
  flex-shrink:0;margin-top:2px;
}

/* Footer */
.doc-footer{
  border-top:1px solid var(--border);
  padding:24px 0;margin-top:56px;
  display:flex;align-items:center;justify-content:space-between;
  flex-wrap:wrap;gap:12px;
  font-size:12px;color:var(--dim);font-family:var(--mono);
}
.doc-footer a{color:var(--sub)}
.doc-footer a:hover{color:var(--text)}`;

const BODY = String.raw`<nav class="nav">
  <div class="nav-inner">
    <a href="/" class="brand">
      <span class="brand-mark">
        <img src="logo-dark.webp" class="logo-img logo-img-dark" alt="" width="24" height="24">
        <img src="logo-light.webp" class="logo-img logo-img-light" alt="" width="24" height="24">
      </span>
      <span class="brand-name">Hesych</span>
    </a>
  </div>
</nav>

<div class="wrap">

  <a href="/" class="back">
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 3L5 8l5 5"/></svg>
    Back to Home
  </a>

  <div class="doc-header">
    <span class="doc-kicker">Support</span>
    <h1 class="doc-title">Contact</h1>
    <div class="doc-meta">We aim to respond within 48 hours</div>
  </div>

  <div class="contact-cards">
    <a class="contact-card" href="mailto:hi@hesych.com">
      <span class="contact-ico">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
      </span>
      <span class="contact-text">
        <span class="contact-label">hi@hesych.com</span>
        <span class="contact-sub">Email — support, licensing, refunds, anything else</span>
      </span>
    </a>
    <a class="contact-card" href="https://x.com/hesych" target="_blank" rel="noopener">
      <span class="contact-ico">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
      </span>
      <span class="contact-text">
        <span class="contact-label">X / Twitter</span>
        <span class="contact-sub">@hesych — product updates and quick questions</span>
      </span>
    </a>
  </div>

  <section>
    <h2><span class="sec-num">1.</span> Before You Email</h2>
    <p>A few notes that help us help you faster:</p>
    <ul class="doc-list">
      <li><strong style="color:var(--text)">License &amp; payment.</strong> Include the email you used at purchase — your Gumroad receipt speeds things up.</li>
      <li><strong style="color:var(--text)">Refunds.</strong> Covered by the 30-day money-back guarantee, no questions asked. Just reply with your order email.</li>
      <li><strong style="color:var(--text)">Privacy questions.</strong> Check the <a href="/privacy">Privacy Policy</a> first — it covers most data questions.</li>
      <li><strong style="color:var(--text)">Bugs &amp; feature requests.</strong> Always welcome. Mention your browser and OS so we can reproduce faster.</li>
    </ul>
  </section>

  <div class="doc-footer">
    <span>© 2026 Hesych. All rights reserved.</span>
    <div style="display:flex;gap:20px">
      <a href="./privacy">Privacy Policy</a>
      <a href="./terms">Terms of Service</a>
      <a href="/">Back to Home</a>
    </div>
  </div>

</div>`;

export const metadata = {
  alternates: { canonical: "https://hesych.com/contact" },
  title: "Contact - Hesych",
  description: "Get in touch with Hesych: support, licensing, refunds, and privacy questions.",
};

export default function ContactPage() {
  return <LegalPage css={CSS} body={BODY} />;
}
