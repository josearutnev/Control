"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { TripForm } from "@/components/trip-form";
import { useHousehold } from "@/components/household-provider";
import { fetchExpense, fetchTripItems } from "@/lib/records";
import type { Expense, TripItem } from "@/lib/types";

export default function EditarCompraPage() {
  const params = useParams<{ id: string }>();
  const { supabase } = useHousehold();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [items, setItems] = useState<TripItem[]>([]);
  const [message, setMessage] = useState("Cargando la compra…");

  useEffect(() => {
    let cancelled = false;
    void fetchExpense(supabase, params.id)
      .then(async (row) => {
        if (cancelled) return;
        if (!row?.trip_id) {
          setMessage("No encontré esa compra.");
          return;
        }
        const tripItems = await fetchTripItems(supabase, row.trip_id);
        if (cancelled) return;
        setExpense(row);
        setItems(tripItems);
      })
      .catch(() => {
        if (!cancelled) setMessage("No se pudo abrir la compra.");
      });
    return () => {
      cancelled = true;
    };
  }, [params.id, supabase]);

  if (!expense) return <p>{message}</p>;
  return (
    <div className="stack">
      <h2 className="section-title">Editar compra</h2>
      <TripForm expense={expense} items={items} />
    </div>
  );
}
