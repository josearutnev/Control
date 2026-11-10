"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Bars, MonthSwitcher } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { durationLabel } from "@/lib/duration";
import { downloadCsv } from "@/lib/csv";
import { currentYearMonth, formatDate, formatMoney, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import { loadProductStats, type ProductStat } from "@/lib/product-stats";
import { fetchExpenses } from "@/lib/records";
import type { Expense } from "@/lib/types";

type SortKey = "duracion" | "rapido" | "frecuencia" | "gasto";

export default function EstadisticasPage() {
  const { supabase, household } = useHousehold();
  const [cursor, setCursor] = useState(() => currentYearMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [sort, setSort] = useState<SortKey>("rapido");

  useEffect(() => {
    const start = monthRange(shiftMonth(cursor.year, cursor.month, -11).year, shiftMonth(cursor.year, cursor.month, -11).month).start;
    const end = monthRange(cursor.year, cursor.month).end;
    let cancelled = false;
    void Promise.all([fetchExpenses(supabase, household.id, start, end), loadProductStats(supabase, household.id)])
      .then(([rows, stats]) => {
        if (cancelled) return;
        setExpenses(rows);
        setProducts(stats);
      })
      .catch(() => {
        if (!cancelled) {
          setExpenses([]);
          setProducts([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [cursor.month, cursor.year, household.id, supabase]);

  const range = monthRange(cursor.year, cursor.month);
  const monthExpenses = expenses.filter((expense) => expense.occurred_on >= range.start && expense.occurred_on <= range.end);
  const byCategory = new Map<string, number>();
  const byMember = new Map<string, number>();
  for (const expense of monthExpenses) {
    const category = expense.category_name ?? "Sin categoría";
    byCategory.set(category, (byCategory.get(category) ?? 0) + expense.amount);
    const member = expense.payer_name ?? "Sin persona";
    byMember.set(member, (byMember.get(member) ?? 0) + expense.amount);
  }
  const market = monthExpenses.filter((expense) => expense.source === "shopping").reduce((total, expense) => total + expense.amount, 0);
  const other = monthExpenses.reduce((total, expense) => total + expense.amount, 0) - market;
  const tripCount = monthExpenses.filter((expense) => expense.source === "shopping").length;
  const months = Array.from({ length: 6 }, (_, index) => shiftMonth(cursor.year, cursor.month, index - 5));
  const trend = months.map((month) => {
    const bounds = monthRange(month.year, month.month);
    const total = expenses
      .filter((expense) => expense.occurred_on >= bounds.start && expense.occurred_on <= bounds.end)
      .reduce((sum, expense) => sum + expense.amount, 0);
    return { label: monthLabel(month.year, month.month).slice(0, 3), value: total };
  });
  const topBought = [...products].sort((a, b) => b.insight.purchaseCount - a.insight.purchaseCount).slice(0, 5);
  const topSpent = [...products].sort((a, b) => b.insight.totalSpent - a.insight.totalSpent).slice(0, 5);
  const durationRows = [...products].sort((a, b) => {
    if (sort === "duracion") return (b.insight.averageDurationDays ?? -1) - (a.insight.averageDurationDays ?? -1);
    if (sort === "rapido") {
      return (a.insight.averageDurationDays ?? Number.POSITIVE_INFINITY) - (b.insight.averageDurationDays ?? Number.POSITIVE_INFINITY);
    }
    if (sort === "frecuencia") return b.insight.purchaseCount - a.insight.purchaseCount;
    return b.insight.totalSpent - a.insight.totalSpent;
  });

  function exportRows(rows: Expense[], filename: string) {
    downloadCsv(filename, [
      ["Fecha", "Descripción", "Categoría", "Monto", "Quién pagó", "Método", "Tipo", "Supermercado", "Notas"],
      ...rows.map((expense) => [
        formatDate(expense.occurred_on),
        expense.description,
        expense.category_name ?? "",
        String(expense.amount),
        expense.payer_name ?? "",
        expense.method_name ?? "",
        expense.expense_type,
        expense.store_name ?? "",
        expense.notes ?? "",
      ]),
    ]);
  }

  return (
    <div className="stack">
      <h2 className="section-title">Estadísticas</h2>
      <MonthSwitcher
        label={monthLabel(cursor.year, cursor.month)}
        onPrevious={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
        onNext={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
      />
      <div className="split">
        <button type="button" className="btn btn-secondary" onClick={() => exportRows(monthExpenses, `hogar-${range.start}.csv`)}>
          Exportar mes
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => exportRows(expenses, "hogar-historial.csv")}>
          Exportar 12 meses
        </button>
      </div>
      <section className="card stack">
        <h2>Por categoría</h2>
        <Bars
          items={[...byCategory.entries()]
            .map(([label, value]) => ({ label, value }))
            .sort((a, b) => b.value - a.value)}
        />
      </section>
      <section className="card stack">
        <h2>Últimos 6 meses</h2>
        <Bars items={trend} />
      </section>
      <section className="card stack">
        <h2>Supermercado y el resto</h2>
        <Bars
          items={[
            { label: "Supermercado", value: market },
            { label: "Otros gastos", value: other },
          ]}
        />
        <p className="hint">
          Promedio por visita: {tripCount ? formatMoney(market / tripCount) : "todavía no hay compras"}.
        </p>
      </section>
      <section className="card stack">
        <h2>Quién pagó</h2>
        <Bars items={[...byMember.entries()].map(([label, value]) => ({ label, value }))} />
      </section>
      <section className="card stack">
        <h2>Productos más comprados</h2>
        <ul className="list">
          {topBought.map((product) => (
            <li key={product.productId}>
              <Link href={`/productos/${product.productId}`}>
                <div className="row">
                  <strong>{product.name}</strong>
                  <span>{product.insight.purchaseCount}</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section className="card stack">
        <h2>Productos con mayor gasto</h2>
        <Bars items={topSpent.map((product) => ({ label: product.name, value: product.insight.totalSpent }))} />
        <p className="hint">Este gasto sale del precio de cada producto, no del redondeo del ticket.</p>
      </section>
      <section className="card stack">
        <h2>Duración</h2>
        <div className="sorts">
          <button type="button" className={sort === "duracion" ? "active" : ""} onClick={() => setSort("duracion")}>
            Más duran
          </button>
          <button type="button" className={sort === "rapido" ? "active" : ""} onClick={() => setSort("rapido")}>
            Se agotan rápido
          </button>
          <button type="button" className={sort === "frecuencia" ? "active" : ""} onClick={() => setSort("frecuencia")}>
            Frecuencia
          </button>
          <button type="button" className={sort === "gasto" ? "active" : ""} onClick={() => setSort("gasto")}>
            Gasto
          </button>
        </div>
        <div className="table">
          <div className="table-head">
            <span>Producto</span>
            <span>Última</span>
            <span>Duración</span>
          </div>
          {durationRows.slice(0, 12).map((product) => (
            <div className="table-row" key={product.productId}>
              <Link href={`/productos/${product.productId}`}>{product.name}</Link>
              <span>{product.insight.lastPurchase ? formatDate(product.insight.lastPurchase) : "—"}</span>
              <span>{durationLabel(product.insight.averageDurationDays)}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
