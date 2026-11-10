"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { projectRef } from "@/lib/supabase/env";

function PrepararContenido() {
  const router = useRouter();
  const params = useSearchParams();
  const motivo = params.get("motivo");
  const [sql, setSql] = useState("");
  const [copied, setCopied] = useState(false);
  const ref = projectRef();

  useEffect(() => {
    void fetch("/schema")
      .then((response) => response.text())
      .then(setSql)
      .catch(() => setSql(""));
  }, []);

  return (
    <main className="app-frame auth-screen">
      <div className="stack">
        <div>
          <p className="brand-mark">Falta un paso</p>
          <p className="brand-sub">
            {motivo === "vercel"
              ? "La aplicación no tiene la dirección de Supabase."
              : "Hay que crear las tablas una sola vez."}
          </p>
        </div>
        <div className="stack">
          <p>1. Pulsa copiar y abre el editor SQL de Supabase.</p>
          <p>2. Pega todo el texto y pulsa Run.</p>
          <p>
            3. En Authentication → URL configuration, Site URL: <strong>https://control-adl25.vercel.app</strong>
          </p>
          <p>4. En Redirect URLs agrega https://control-adl25.vercel.app/** y http://localhost:3000/**.</p>
          <p>5. Vuelve aquí y pulsa Ya lo ejecuté.</p>
        </div>
        <div className="split">
          <button
            type="button"
            className="btn btn-primary"
            disabled={!sql}
            onClick={async () => {
              await navigator.clipboard.writeText(sql);
              setCopied(true);
            }}
          >
            {copied ? "Copiado" : "Copiar SQL"}
          </button>
          <a className="btn btn-secondary" href={`https://supabase.com/dashboard/project/${ref}/sql/new`} target="_blank" rel="noreferrer">
            Abrir editor
          </a>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => router.push("/")}>
          Ya lo ejecuté
        </button>
      </div>
    </main>
  );
}

export default function PrepararPage() {
  return (
    <Suspense fallback={<main className="screen">Cargando…</main>}>
      <PrepararContenido />
    </Suspense>
  );
}
