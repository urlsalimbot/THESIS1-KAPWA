/**
 * The shared decorative background for public and auth pages.
 *
 * Rendered once per layout rather than copy-pasted per page (it previously
 * appeared as an identical stack of three blurred blobs on nine pages).
 * Both layers are `pointer-events-none` decoration only; the content that
 * follows must be `relative` to paint above it.
 */
export function PublicBackground() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="brand-aura absolute inset-0" />
      <div className="brand-grid absolute inset-0" />
    </div>
  );
}
