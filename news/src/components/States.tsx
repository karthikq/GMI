export function Offline() {
  return (
    <div className="notice">
      <h1>We can&apos;t reach the content store</h1>
      <p>
        The database connection failed — check <code>MONGODB_URI</code> is set in the deployed
        environment and that MongoDB Atlas allows connections from this host, then reload.
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
