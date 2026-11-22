export function Offline() {
  return (
    <div className="notice">
      <h1>We can&apos;t reach the news server</h1>
      <p>
        Start the backend with <code>npm run dev</code> in the <code>server</code> folder, then
        reload this page.
      </p>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="skeleton" aria-busy="true" aria-label="Loading">
      <div />
      <div />
      <div />
    </div>
  );
}
