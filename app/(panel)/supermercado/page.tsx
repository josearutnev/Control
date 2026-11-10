"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonthSwitcher } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { currentYearMonth, formatDate, formatMoney, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import { fetchExpenses } from "@/lib/records";
import type { Expense } from "@/lib/types";

export default function SupermercadoPage() {
  const { supabase, household } = useHousehold();
  const [cursor, setCursor] = useState(() => currentYearMonth());
  const [trips, setTrips] = useState<Expense[]>([]);
  const [store, setStore] = useState("");
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    const range = monthRange(cursor.year, cursor.month);
    let cancelled = false;
    void (async () => {
      const rows = (await fetchExpenses(supabase, household.id, range.start, range.end)).filter(
        (row) => row.source === "shopping" && row.trip_id,
      );
      if (cancelled) return;
      setTrips(rows);
      const ids = rows.map((row) => row.trip_id).filter((id): id is string => Boolean(id));
      if (ids.length === 0) {
        setCounts({});
        return;
      }
      const { data } = await supabase.from("shopping_trip_items").select("trip_id").in("trip_id", ids);
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const item of data ?? []) {
        const tripId = String(item.trip_id);
        next[tripId] = (next[tripId] ?? 0) + 1;
      }
      setCounts(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [cursor.month, cursor.year, household.id, supabase]);

  const visible = trips.filter((trip) => !store || (trip.store_name ?? "").toLowerCase().includes(store.toLowerCase()));

  return (
    <div className="stack">
      <div className="row">
        <h2 className="section-title">Supermercado</h2>
        <Link className="btn btn-primary" href="/compra">
          Nueva
        </Link>
      </div>
      <MonthSwitcher
        label={monthLabel(cursor.year, cursor.month)}
        onPrevious={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
        onNext={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
      />
      <input className="input" value={store} placeholder="Filtrar por supermercado" onChange={(event) => setStore(event.target.value)} />
      {visible.length === 0 ? <p className="empty">No hay compras en este mes.</p> : null}
      <ul className="list">
        {visible.map((trip) => (
          <li key={trip.id}>
            <Link href={`/supermercado/${trip.trip_id}`}>
              <div className="row">
                <strong>{trip.store_name}</strong>
                <span className="amount">{formatMoney(trip.amount)}</span>
              </div>
              <p className="hint">
                {formatDate(trip.occurred_on)} · {counts[trip.trip_id ?? ""] ?? 0} productos · {trip.payer_name}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
