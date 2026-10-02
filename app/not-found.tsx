import Link from "next/link";
export default function NotFound() {
  return (
    <main className="not-found">
      <span className="eyebrow">KIDDYMEDS</span>
      <h1>Let’s get you back home.</h1>
      <p>We couldn’t find this page. Your care records are still here.</p>
      <Link className="button primary" href="/">
        Back to overview
      </Link>
    </main>
  );
}
