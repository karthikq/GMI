import Link from "next/link";

export default function NotFound() {
  return (
    <div className="notice">
      <h1>Page not found</h1>
      <p>The story may have moved, or the address is mistyped.</p>
      <Link href="/" className="button">
        Back to the front page
      </Link>
    </div>
  );
}
