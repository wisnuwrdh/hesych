// Shared renderer for legal/utility pages ported verbatim from the legacy
// static site (privacy/terms/upgrade). Each page ships its original scoped
// <style> and body markup unchanged - pixel-faithful migration.
export function LegalPage({ css, body }: { css: string; body: string }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <div dangerouslySetInnerHTML={{ __html: body }} />
    </>
  );
}
