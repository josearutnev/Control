"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="app-frame auth-screen stack">
      <h1 className="brand-mark">Algo salió mal</h1>
      <button type="button" className="btn btn-primary" onClick={() => reset()}>
        Reintentar
      </button>
    </main>
  );
}
