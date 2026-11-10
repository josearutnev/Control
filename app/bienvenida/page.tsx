"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui";
import { messageFromError } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";

export default function BienvenidaPage() {
  const router = useRouter();
  const [householdName, setHouseholdName] = useState("Nuestro hogar");
  const [myName, setMyName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function createHousehold(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("create_household", {
      household_name: householdName,
      member_name: myName,
    });
    setBusy(false);
    if (rpcError) {
      setError(messageFromError(rpcError));
      return;
    }
    router.replace("/inicio");
  }

  async function joinHousehold(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("join_household", {
      code,
      member_name: myName,
    });
    setBusy(false);
    if (rpcError) {
      setError(messageFromError(rpcError));
      return;
    }
    router.replace("/inicio");
  }

  return (
    <main className="app-frame auth-screen">
      <div className="stack">
        <div>
          <p className="brand-mark">Tu hogar</p>
          <p className="brand-sub">Uno crea el hogar y el otro entra con el código.</p>
        </div>
        <form className="card stack" onSubmit={createHousehold}>
          <h2>Crear el hogar</h2>
          <Field label="Nombre del hogar">
            <input className="input" value={householdName} onChange={(event) => setHouseholdName(event.target.value)} />
          </Field>
          <Field label="Tu nombre">
            <input className="input" value={myName} onChange={(event) => setMyName(event.target.value)} required minLength={2} />
          </Field>
          <button className="btn btn-primary btn-block" disabled={busy} type="submit">
            Crear
          </button>
        </form>
        <form className="card stack" onSubmit={joinHousehold}>
          <h2>Unirme con un código</h2>
          <Field label="Código">
            <input className="input" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} required />
          </Field>
          <Field label="Tu nombre">
            <input className="input" value={myName} onChange={(event) => setMyName(event.target.value)} required minLength={2} />
          </Field>
          <button className="btn btn-secondary btn-block" disabled={busy} type="submit">
            Unirme
          </button>
        </form>
        {error ? <p className="error">{error}</p> : null}
      </div>
    </main>
  );
}
