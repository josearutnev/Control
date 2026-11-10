"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";
import { messageFromError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export default function RegistroPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <main className="app-frame auth-screen">
      <form
        className="stack"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setError("");
          setInfo("");
          const supabase = createClient();
          const { data, error: signError } = await supabase.auth.signUp({
            email: email.trim(),
            password,
            options: {
              data: { display_name: name.trim() },
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });
          setBusy(false);
          if (signError) {
            setError(messageFromError(signError));
            return;
          }
          if (data.session) {
            router.replace("/bienvenida");
            return;
          }
          setInfo("Revisa tu correo para confirmar la cuenta. Después podrás entrar.");
        }}
      >
        <div>
          <p className="brand-mark">Crear cuenta</p>
          <p className="brand-sub">Cada uno entra con la suya y ven el mismo hogar.</p>
        </div>
        <Field label="Tu nombre">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} required minLength={2} />
        </Field>
        <Field label="Correo">
          <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </Field>
        <Field label="Contraseña">
          <input className="input" type="password" autoComplete="new-password" minLength={6} value={password} onChange={(event) => setPassword(event.target.value)} required />
        </Field>
        {error ? <p className="error">{error}</p> : null}
        {info ? <p className="ok">{info}</p> : null}
        <button className="btn btn-primary btn-block" disabled={busy} type="submit">
          {busy ? "Creando…" : "Crear cuenta"}
        </button>
        <Link href="/entrar" className="btn btn-ghost btn-block">
          Ya tengo cuenta
        </Link>
      </form>
    </main>
  );
}
