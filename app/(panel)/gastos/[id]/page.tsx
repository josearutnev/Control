"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { ConfirmButton } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { fetchExpense } from "@/lib/records";
import type { Expense } from "@/lib/types";

export default function GastoDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { supabase, refresh } = useHousehold();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [editing, setEditing] = useState(false);
  const [receiptUrl, setReceiptUrl] = useState("");
  const [message, setMessage] = useState("Cargando…");

  useEffect(() => {
    let cancelled = false;
    void fetchExpense(supabase, params.id)
      .then(async (row) => {
        if (cancelled) return;
        if (!row || row.source !== "manual") {
          setMessage("No encontré ese gasto.");
          return;
        }
        setExpense(row);
        if (row.receipt_path) {
          const { data } = await supabase.storage.from("receipts").createSignedUrl(row.receipt_path, 60 * 60);
          if (!cancelled && data?.signedUrl) setReceiptUrl(data.signedUrl);
        }
      })
      .catch(() => {
        if (!cancelled) setMessage("No se pudo abrir el gasto.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, supabase]);

  if (!expense) return <p>{message}</p>;

  return (
    <div className="stack">
      <Link href="/gastos" className="hint">
        Volver a gastos
      </Link>
      {editing ? (
        <ExpenseForm initial={expense} />
      ) : (
        <article className="card stack">
          <h2>{expense.description}</h2>
          <p className="stat-value">{expense.amount.toLocaleString("es-DO", { style: "currency", currency: "DOP" })}</p>
          <p className="hint">
            {expense.category_name} · {expense.payer_name ?? "Sin persona"} · {expense.method_name ?? "Sin método"} · {expense.expense_type}
          </p>
          {expense.notes ? <p>{expense.notes}</p> : null}
          {receiptUrl ? (
            <a className="btn btn-secondary" href={receiptUrl} target="_blank" rel="noreferrer">
              Ver comprobante
            </a>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(true)}>
            Editar
          </button>
          <ConfirmButton
            label="Eliminar"
            title="Eliminar este gasto"
            message="El resumen del mes se va a recalcular."
            onConfirm={async () => {
              await supabase.from("expenses").delete().eq("id", expense.id);
              await refresh();
              router.push("/gastos");
            }}
          />
        </article>
      )}
    </div>
  );
}
