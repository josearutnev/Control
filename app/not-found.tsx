import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-frame auth-screen stack">
      <h1 className="brand-mark">No está esta página</h1>
      <Link className="btn btn-primary" href="/inicio">
        Ir al inicio
      </Link>
    </main>
  );
}
