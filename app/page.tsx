import Link from "next/link";
import "./landing.css";
import StandaloneRedirect from "./StandaloneRedirect";

const compareRows = [
  { label: "Store passwords locally", free: true, pro: true },
  { label: "AES-256-GCM encryption", free: true, pro: true },
  { label: "HIBP breach check", free: true, pro: true },
  { label: "TOTP / 2FA storage", free: true, pro: true },
  { label: "Password Expiry Reminder", free: true, pro: true },
  { label: "Secret Lock (Hide for a While)", free: true, pro: true },
  { label: "Vault Health Score", free: false, pro: true },
  { label: "Encrypted Export", free: true, pro: true },
  { label: "Advanced Generator (Bulk)", free: false, pro: true },
  { label: "Custom Fields", free: false, pro: true },
  { label: "Tags & Advanced Filter", free: false, pro: true },
  { label: "Encrypted Share Link", free: false, pro: true },
] as const;

export const metadata = {
  alternates: { canonical: "https://hesych.com/" },
};

const faq = [
  {
    q: "Where is my data stored?",
    a: "All password data is encrypted with AES-256-GCM and stored only on your device. The encryption key is derived from your master password using PBKDF2. Without your master password, not even we can open your vault. Zero-knowledge by design.",
  },
  {
    q: "What is One-Time Payment?",
    a: "You pay $9.99 once and get all Premium features forever, including free updates for the next version. No monthly bills, no auto-renew. The opposite of every other password manager.",
  },
  {
    q: "Can I use it offline?",
    a: "Yes. Hesych runs 100% locally on your device. No internet needed to open your vault, generate passwords, or autofill forms. Your data never touches a server.",
  },
  {
    q: "What happens if I forget my master password?",
    a: "Your vault is encrypted with a key derived entirely from your master password. We have zero access to it. If you forget your master password, your vault cannot be recovered. No backdoor means no one can unlock it for you. We strongly recommend writing your master password down and storing it somewhere physically secure.",
  },
  {
    q: "How is Hesych different from Bitwarden?",
    a: "Bitwarden is a great product, but it's cloud-native. Your encrypted vault lives on their servers and syncs through them. Hesych is local-first: your data never leaves your device. On pricing: Bitwarden Premium is $1.65/month ($19.80/year). Hesych is $9.99, once, forever.",
  },
] as const;

const features = [
  {
    title: "AES-256-GCM Encryption",
    desc: "Military-grade standard. Keys derived with PBKDF2 from your master password.",
    svg: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="10" width="16" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    ),
  },
  {
    title: "HIBP Breach Check",
    desc: "Checks passwords against breach databases. Uses k-anonymity so your password is never sent.",
    svg: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
      </svg>
    ),
  },
  {
    title: "TOTP / 2FA",
    desc: "Store two-factor codes. Auto-fill 6-digit codes in one tap.",
    svg: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="9" cy="15" r="4" />
        <path d="m12 12 8-8M16 4h4v4M14 6l2 2" />
      </svg>
    ),
  },
  {
    title: "100% Offline",
    desc: "No servers. No telemetry. Airplane mode? Works perfectly.",
    svg: (
      <svg
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        style={{ width: 18, height: 18 }}
      >
        <circle cx="18" cy="29.54" r="3" fill="currentColor" />
        <path
          d="M29.18,17.71l.11-.17a1.51,1.51,0,0,0-.47-2.1A20.57,20.57,0,0,0,18,12.37c-.56,0-1.11,0-1.65.07l3.21,3.21a17.41,17.41,0,0,1,7.6,2.52A1.49,1.49,0,0,0,29.18,17.71Z"
          fill="currentColor"
        />
        <path
          d="M32.76,9.38A27.9,27.9,0,0,0,10.18,6.27L12.81,8.9A24.68,24.68,0,0,1,31.1,12.12a1.49,1.49,0,0,0,2-.46l.11-.17A1.51,1.51,0,0,0,32.76,9.38Z"
          fill="currentColor"
        />
        <path
          d="M3,4.75l3.1,3.1A27.28,27.28,0,0,0,3.18,9.42a1.51,1.51,0,0,0-.48,2.11l.11.17a1.49,1.49,0,0,0,2,.46,24.69,24.69,0,0,1,3.67-1.9l3.14,3.14a20.63,20.63,0,0,0-4.53,2.09,1.51,1.51,0,0,0-.46,2.1l.11.17a1.49,1.49,0,0,0,2,.46A17.46,17.46,0,0,1,14.25,16l3.6,3.6a13.39,13.39,0,0,0-6.79,1.93,1.5,1.5,0,0,0-.46,2.09l.1.16a1.52,1.52,0,0,0,2.06.44,10.2,10.2,0,0,1,9-.7L29,30.75l1.41-1.41-26-26Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  {
    title: "Secret Lock (Hide for a While)",
    desc: "Temporarily hide sensitive items. Out of sight, still encrypted.",
    svg: (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
        <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    ),
  },
];

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    { "@type": "WebSite", name: "Hesych", url: "https://hesych.com/" },
    { "@type": "Organization", name: "Hesych", url: "https://hesych.com/", logo: "https://hesych.com/og-image.png" },
    {
      "@type": "SoftwareApplication",
      name: "Hesych",
      applicationCategory: "SecurityApplication",
      operatingSystem: "Web (PWA)",
      description: "Local-first password manager with AES-256-GCM encryption. One-time payment, zero-knowledge.",
      offers: { "@type": "Offer", price: "9.99", priceCurrency: "USD" },
    },
    {
      "@type": "FAQPage",
      mainEntity: faq.map((f) => ({
        "@type": "Question",
        name: f.q,
        acceptedAnswer: { "@type": "Answer", text: f.a },
      })),
    },
  ],
};


export default function HomePage() {
  return (
    <div>
      <StandaloneRedirect />

      <nav className="nav">
        <div className="wrap nav-inner">
          <span className="brand" aria-label="Hesych">
            <span className="brand-mark" aria-hidden="true">
              <img src="/logo-dark.webp" className="logo-img logo-img-dark" alt="" width="24" height="24" />
              <img src="/logo-light.webp" className="logo-img logo-img-light" alt="" width="24" height="24" />
            </span>
            <span>
              <span className="brand-name">Hesych</span>
              <span className="brand-tag">· Local-first</span>
            </span>
          </span>
          <div className="nav-right">
            <Link href="/app" className="btn btn-sm btn-primary">
              Open Hesych
            </Link>
          </div>
        </div>
      </nav>

      <main>
        {/* ============== HERO ============== */}
        <section className="hero">
          <div className="wrap">
            <div className="hero-inner">
              <div className="hero-text">
                <h1>
                  <span>The Most Secure Password Manager.</span>
                  <br />
                  <span className="hl">No Subscription.</span>
                </h1>
                <p className="hero-sub">
                  Local AES-256 encryption. No cloud. Pay once, yours forever.
                </p>
                <div className="hero-ctas">
                  <Link href="/app" className="btn btn-lg">
                    Try Free
                  </Link>
                  <Link href="/upgrade" className="btn btn-lg btn-primary">
                    Buy Now - $9.99
                  </Link>
                </div>
                <div className="hero-meta">
                  <span>AES-256-GCM</span>
                  <span className="dot" />
                  <span>Zero-Knowledge</span>
                  <span className="dot" />
                  <span>No Telemetry</span>
                </div>
              </div>
              <div className="hero-visual-col">
                <div className="hero-mock-card">
                  <div className="hero-mock-icon" style={{ background: "#1a1a2e" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <circle cx="12" cy="12" r="10" fill="#24292e" />
                      <path
                        d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.49.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.605-3.369-1.34-3.369-1.34-.454-1.155-1.11-1.463-1.11-1.463-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0 1 12 6.836a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.001 10.001 0 0 0 22 12C22 6.477 17.523 2 12 2z"
                        fill="#f0f0f0"
                      />
                    </svg>
                  </div>
                  <div className="hero-mock-info">
                    <div className="hero-mock-name">GitHub</div>
                    <div className="hero-mock-user">dev@example.com</div>
                  </div>
                  <span className="hero-mock-badge safe">Safe ✓</span>
                </div>

                <div className="hero-mock-card">
                  <div className="hero-mock-icon" style={{ background: "#fff1e6" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="4" fill="#fff1e6" />
                      <text
                        x="12"
                        y="17"
                        textAnchor="middle"
                        fontFamily="Arial Black,sans-serif"
                        fontWeight="900"
                        fontSize="13"
                        fill="#FF9900"
                      >
                        a
                      </text>
                    </svg>
                  </div>
                  <div className="hero-mock-info">
                    <div className="hero-mock-name">Amazon</div>
                    <div className="hero-mock-user">••••••••••••</div>
                  </div>
                  <span className="hero-mock-badge totp">TOTP</span>
                </div>

                <div
                  className="hero-mock-card"
                  style={{
                    borderColor: "rgba(240,0,80,0.25)",
                    background:
                      "linear-gradient(90deg, var(--card), rgba(240,0,80,0.04))",
                  }}
                >
                  <div className="hero-mock-icon" style={{ background: "#fce8ef" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="4" fill="#fce8ef" />
                      <text
                        x="12"
                        y="17"
                        textAnchor="middle"
                        fontFamily="Arial Black,sans-serif"
                        fontWeight="900"
                        fontSize="14"
                        fill="#EA4335"
                      >
                        G
                      </text>
                    </svg>
                  </div>
                  <div className="hero-mock-info">
                    <div className="hero-mock-name">Google</div>
                    <div className="hero-mock-user">user@gmail.com</div>
                  </div>
                  <span className="hero-mock-badge warn">⚠ Breach Found</span>
                </div>

                <div className="hero-mock-card">
                  <div className="hero-mock-icon" style={{ background: "#e8f0fe" }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                      <rect width="24" height="24" rx="4" fill="#e8f0fe" />
                      <path
                        d="M5 8l7 5 7-5"
                        stroke="#4285F4"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                      />
                      <rect
                        x="3"
                        y="6"
                        width="18"
                        height="13"
                        rx="2"
                        stroke="#4285F4"
                        strokeWidth="1.5"
                        fill="none"
                      />
                    </svg>
                  </div>
                  <div className="hero-mock-info">
                    <div className="hero-mock-name">Outlook</div>
                    <div className="hero-mock-user">work@company.io</div>
                  </div>
                  <span className="hero-mock-badge safe">Safe ✓</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ============== FEATURES ============== */}
        <section>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-kicker">/ Core Features</span>
              <h2 className="sec-title">Built for privacy, not data profit.</h2>
            </div>
            <div className="features">
              {features.map((f) => (
                <article className="feat" key={f.title}>
                  <div className="feat-ico">{f.svg}</div>
                  <div className="feat-title">{f.title}</div>
                  <p className="feat-desc">{f.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ============== COMPARE + PRICING GRID ============== */}
        <section id="compare">
          <div className="wrap">
            <div className="cmp-price-grid">
              <div>
                <div className="sec-head">
                  <span className="sec-kicker">/ Free vs Premium</span>
                  <h2 className="sec-title">
                    Free forever. Upgrade for the power tools.
                  </h2>
                </div>

                <div className="compare" role="table">
                  <div className="compare-row compare-head" role="row">
                    <span>Feature</span>
                    <span style={{ textAlign: "center" }}>Free</span>
                    <span style={{ textAlign: "center" }}>Premium</span>
                  </div>

                  {compareRows.map((row) => (
                    <div className="compare-row" key={row.label}>
                      <span>{row.label}</span>
                      <span className={`c-val ${row.free ? "yes" : "no"}`}>
                        {row.free ? "✓" : "—"}
                      </span>
                      <span className={`c-val ${row.pro ? "yes" : "no"}`}>
                        {row.pro ? "✓" : "—"}
                      </span>
                    </div>
                  ))}

                  <div className="compare-row price-row">
                    <span>Price</span>
                    <span className="c-val free">Free</span>
                    <span className="c-val pro">$9.99</span>
                  </div>
                </div>
              </div>

              <div>
                <div className="sec-head">
                  <span className="sec-kicker">/ One-Time Payment</span>
                  <h2 className="sec-title">Pay once. Never subscribe again.</h2>
                </div>

                <div className="price-card">
                  <span className="price-badge">Lifetime · One-Time Payment</span>
                  <div className="price-main">
                    <span className="big">$9.99</span>
                    <span className="usd">USD</span>
                  </div>
                  <div className="price-strike">
                    <span className="price-strike-label">was</span>
                    <s>$19.99</s>
                    <span className="price-strike-note">one-time only</span>
                  </div>

                  <ul className="price-feats">
                    <li>
                      <span className="check">✓</span>
                      <span>All Premium features, forever</span>
                    </li>
                    <li>
                      <span className="check">✓</span>
                      <span>Vault Health Score &amp; duplicate audit</span>
                    </li>
                    <li>
                      <span className="check">✓</span>
                      <span>Custom Fields, Tags &amp; Share Link</span>
                    </li>
                    <li>
                      <span className="check">✓</span>
                      <span>Free updates, forever</span>
                    </li>
                    <li>
                      <span className="check">✓</span>
                      <span>Priority email support</span>
                    </li>
                  </ul>

                  <div className="price-cta">
                    <Link href="/upgrade" className="btn btn-lg btn-primary btn-block">
                      Buy Now - $9.99
                    </Link>
                  </div>
                  <p className="price-foot">
                    30-day money-back guarantee · No questions asked · One-time
                    payment
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            {/* ============== FAQ ============== */}
        <section>
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-kicker">/ Questions</span>
              <h2 className="sec-title">Frequently asked.</h2>
            </div>

            <div className="faq">
              {faq.map((item) => (
                <details className="faq-item" key={item.q}>
                  <summary>
                    <span>{item.q}</span>
                    <span className="plus" aria-hidden="true" />
                  </summary>
                  <div className="faq-body">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-grid">
            <div className="foot-brand-col">
              <div className="foot-brand">
                <span className="brand-mark" aria-hidden="true">
                  <img src="/logo-dark.webp" className="logo-img logo-img-dark" alt="" width="24" height="24" />
                  <img src="/logo-light.webp" className="logo-img logo-img-light" alt="" width="24" height="24" />
                </span>
                <span className="brand-name">Hesych</span>
              </div>
              <p className="foot-tagline">
                Local-first password manager. Your data is encrypted on your
                device and never leaves it.
              </p>
              <div className="foot-social">
                <a
                  href="https://x.com/hesych"
                  target="_blank"
                  rel="noopener"
                  aria-label="Twitter/X"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622 5.911-5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                </a>
                <a href="mailto:hi@hesych.com" aria-label="Email">
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <div className="foot-col-title">Product</div>
              <ul className="foot-links">
                <li>
                  <Link href="/app">Open App</Link>
                </li>
                <li>
                  <Link href="/upgrade">Upgrade to Premium</Link>
                </li>
                <li>
                  <Link href="/#compare">Compare Plans</Link>
                </li>
              </ul>
            </div>

            <div>
              <div className="foot-col-title">Company</div>
              <ul className="foot-links">
                <li>
                  <Link href="/contact">Contact</Link>
                </li>
                <li>
                  <Link href="/privacy">Privacy Policy</Link>
                </li>
                <li>
                  <Link href="/terms">Terms of Service</Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="foot-bottom">
            <span className="foot-copy">© 2026 Hesych. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}