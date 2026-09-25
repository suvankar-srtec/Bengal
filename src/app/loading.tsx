export default function Loading() {
  return <div className="global-route-loading" role="status" aria-live="polite">
    <span className="global-route-spinner" />
    <strong>Loading…</strong>
  </div>;
}
