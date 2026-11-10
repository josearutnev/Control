"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";
import { messageFromError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export default function EntrarPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="app-frame auth-screen">
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          const supabase = createClient();
          const { error: signError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
          setBusy(false);
          if (signError) {
            setError(messageFromError(signError));
            return;
          }
          router.replace("/inicio");
        }}
      >
        <div>
          <p className="brand-mark">Hogar</p>
          <p className="brand-sub">Los gastos de los dos, en un solo lugar.</p>
        </div>
        <Field label="Correo">
          <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Contraseña">
          <input className="input" type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        {error ? <p className="error">{error}</p> : null}
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? "Entrando…" : "Entrar"}
        </button>
        <Link href="/registro" className="btn btn-ghost btn-block">
          Crear cuenta
        </Link>
      </form>
    </main>
  );
}
