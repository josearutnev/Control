"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ConfirmButton } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { formatDate, formatMoney } from "@/lib/format";
import { fetchTripItems } from "@/lib/records";
import type { Expense, TripItem } from "@/lib/types";

export default function CompraDetallePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { supabase, refresh } = useHousehold();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [message, setMessage] = useState("Cargando la compra…");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from("shopping_trips")
        .select("id, expense_id")
        .eq("id", params.id)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        setMessage("No encontré esa compra.");
        return;
      }
      const { fetchExpense } = await import("@/lib/records");
      const row = await fetchExpense(supabase, data.expense_id);
      const tripItems = await fetchTripItems(supabase, data.id);
      if (cancelled || !row) return;
      setExpense(row);
      setItems(tripItems);
    })().catch(() => {
      if (!cancelled) setMessage("No se pudo abrir la compra.");
    });
    return () => {
      cancelled = true;
    };
  }, [params.id, supabase]);

  if (!expense) return <p>{message}</p>;
  const sum = items.reduce((total, item) => total + item.subtotal, 0);

  return (
    <div className="stack">
      <Link href="/supermercado" className="hint">
        Volver a supermercado
      </Link>
      <article className="card stack">
        <h2>{expense.store_name}</h2>
        <p className="stat-value">{formatMoney(expense.amount)}</p>
        <p className="hint">
          {formatDate(expense.occurred_on)} · {expense.payer_name} · {expense.method_name}
        </p>
        {expense.notes ? <p>{expense.notes}</p> : null}
        {items.length > 0 && Math.abs(sum - expense.amount) > 0.009 ? (
          <p className="hint">Los productos suman {formatMoney(sum)}. El total guardado es el del ticket.</p>
        ) : null}
      </article>
      {items.length === 0 ? <p className="empty">Esta compra no tiene productos detallados.</p> : null}
      <ul className="list">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/productos/${item.product_id}`}>
              <div className="row">
                <strong>{item.product_name}</strong>
                <span className="amount">{formatMoney(item.subtotal)}</span>
              </div>
              <p className="hint">
                {item.quantity} {item.unit} · {formatMoney(item.unit_price)} c/u
              </p>
            </Link>
          </li>
        ))}
      </ul>
      <Link className="btn btn-secondary btn-block" href={`/compra/${expense.id}`}>
        Editar
      </Link>
      <ConfirmButton
        label="Eliminar compra"
        title="Eliminar esta compra"
        message="Se quitan el gasto y los productos de esta visita. El catálogo se conserva."
        onConfirm={async () => {
          await supabase.from("expenses").delete().eq("id", expense.id);
          await refresh();
          router.push("/supermercado");
        }}
      />
    </div>
  );
}
