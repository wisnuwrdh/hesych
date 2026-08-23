import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://hesych.com"),
  title: "Hesych - Local-First Password Manager, $9.99 Lifetime",
  description:
    "Hesych is a local-first password manager with AES-256-GCM encryption. Zero-knowledge, no subscription, one-time payment of $9.99. Your passwords never leave your device.",
  applicationName: "Hesych",
  manifest: "/manifest.webmanifest",
  openGraph: {
    title: "Hesych — Local-First Password Manager, $9.99 Lifetime",
    description:
      "AES-256-GCM encrypted password manager. One-time payment $9.99. No subscription, no cloud, your data never leaves your device.",
    images: ["/og-image.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Hesych — Local-First Password Manager, $9.99 Lifetime",
    description:
      "AES-256-GCM encrypted password manager. One-time payment $9.99. No subscription, no cloud.",
    images: ["/og-image.png"],
  },
};

// Apply persisted theme before first paint to avoid a flash of the wrong theme.
function ThemeScript() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `try{var t=localStorage.getItem('hesych_theme');if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
      }}
    />
  );
}

// TEMP DEBUG PROBE — surfaces silent JS failures on-screen (no devtools needed).
// Remove once the /app blank-screen issue is diagnosed.
function DebugProbe() {
  return (
    <script
      dangerouslySetInnerHTML={{
        __html: `(function(){
  function show(msg){
    var o=document.getElementById('__dbg');
    if(!o){o=document.createElement('pre');o.id='__dbg';o.style.cssText='position:fixed;top:0;left:0;right:0;z-index:99999;background:#a00;color:#fff;font:11px/1.4 monospace;padding:8px;white-space:pre-wrap;max-height:50vh;overflow:auto;margin:0';(document.body||document.documentElement).appendChild(o)}
    o.textContent+=msg+"\\n";
  }
  window.addEventListener('error',function(e){show('ERROR: '+(e.message||e.type)+' @ '+((e.filename||'').split('/').pop())+':'+e.lineno+(e.error&&e.error.stack?'\\n'+String(e.error.stack).slice(0,700):''))},true);
  window.addEventListener('unhandledrejection',function(e){show('REJECTION: '+String(e.reason&&e.reason.stack||e.reason).slice(0,700))});
  var t=0,iv=setInterval(function(){
    t++;
    if(document.querySelectorAll('#lockScreen').length>0){
      clearInterval(iv);show('BOOT OK: lockScreen mounted after '+t+'s');
      setTimeout(function(){var o=document.getElementById('__dbg');if(o)o.remove()},4000);
      return;
    }
    if(t>=8){
      clearInterval(iv);
      var f=(self.__next_f||[]).length;
      var res=performance.getEntriesByType('resource').filter(function(r){return r.responseStatus>=400}).map(function(r){return r.responseStatus+' '+r.name}).join('\\n');
      show('NO MOUNT after '+t+'s | __next_f='+f+' | readyState='+document.readyState+' | failed:\\n'+(res||'(none)'));
    }
  },1000);
})();`,
      }}
    />
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-theme="dark">
      <head>
        <DebugProbe />
        <ThemeScript />
      </head>
      <body className="min-h-full antialiased">{children}</body>
    </html>
  );
}