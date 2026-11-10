"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Delta, MonthSwitcher } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { needsRestock } from "@/lib/duration";
import { currentYearMonth, formatDate, formatMoney, monthLabel, monthRange, shiftMonth, todayISO } from "@/lib/format";
import { loadProductStats, type ProductStat } from "@/lib/product-stats";
import { fetchBudgets, fetchExpenses, fetchIncomes } from "@/lib/records";
import type { Budget, Expense, Income } from "@/lib/types";

export default function InicioPage() {
  const { supabase, household } = useHousehold();
  const [cursor, setCursor] = useState(() => currentYearMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [products, setProducts] = useState<ProductStat[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    const previous = shiftMonth(cursor.year, cursor.month, -1);
    const currentRange = monthRange(cursor.year, cursor.month);
    const previousRange = monthRange(previous.year, previous.month);
    let cancelled = false;
    void Promise.all([
      fetchExpenses(supabase, household.id, previousRange.start, currentRange.end),
      fetchIncomes(supabase, household.id, previousRange.start, currentRange.end),
      fetchBudgets(supabase, household.id, cursor.year, cursor.month),
      loadProductStats(supabase, household.id),
    ])
      .then(([nextExpenses, nextIncomes, nextBudgets, nextProducts]) => {
        if (cancelled) return;
        setExpenses(nextExpenses);
        setIncomes(nextIncomes);
        setBudgets(nextBudgets);
        setProducts(nextProducts);
      })
      .catch(() => {
        if (!cancelled) setError("No se pudo cargar el resumen.");
      });
    return () => {
      cancelled = true;
    };
  }, [cursor.month, cursor.year, household.id, supabase]);

  const currentRange = monthRange(cursor.year, cursor.month);
  const previous = shiftMonth(cursor.year, cursor.month, -1);
  const previousRange = monthRange(previous.year, previous.month);
  const inMonth = (date: string, range: { start: string; end: string }) => date >= range.start && date <= range.end;
  const currentExpenses = expenses.filter((expense) => inMonth(expense.occurred_on, currentRange));
  const previousExpenses = expenses.filter((expense) => inMonth(expense.occurred_on, previousRange));
  const sum = (rows: { amount: number }[]) => rows.reduce((total, row) => total + row.amount, 0);
  const spent = sum(currentExpenses);
  const spentBefore = sum(previousExpenses);
  const market = sum(currentExpenses.filter((expense) => expense.source === "shopping"));
  const marketBefore = sum(previousExpenses.filter((expense) => expense.source === "shopping"));
  const other = spent - market;
  const otherBefore = spentBefore - marketBefore;
  const income = sum(incomes.filter((row) => inMonth(row.occurred_on, currentRange)));
  const incomeBefore = sum(incomes.filter((row) => inMonth(row.occurred_on, previousRange)));
  const trips = currentExpenses.filter((expense) => expense.source === "shopping").length;
  const tripsBefore = previousExpenses.filter((expense) => expense.source === "shopping").length;
  const balance = income - spent;
  const balanceBefore = incomeBefore - spentBefore;
  const today = todayISO();
  const soon = products
    .filter((product) => product.active && needsRestock(product.insight, today))
    .sort((a, b) => (a.insight.estimatedNextDate ?? "0000").localeCompare(b.insight.estimatedNextDate ?? "0000"))
    .slice(0, 4);
  const totalBudget = budgets.find((budget) => budget.category_id === null);
  const over = budgets.filter((budget) => {
    if (!budget.category_id) return false;
    const categorySpent = currentExpenses
      .filter((expense) => expense.category_id === budget.category_id)
      .reduce((total, expense) => total + expense.amount, 0);
    return categorySpent > budget.amount;
  });

  return (
    <div className="stack">
      <MonthSwitcher
        label={monthLabel(cursor.year, cursor.month)}
        onPrevious={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
        onNext={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
      />
      <div className="actions">
        <Link className="btn btn-primary btn-block" href="/gasto">
          Registrar gasto
        </Link>
        <Link className="btn btn-secondary btn-block" href="/compra">
          Nueva compra
        </Link>
      </div>
      {error ? <p className="error">{error}</p> : null}
      <div className="stat-grid">
        <article className="card">
          <span className="stat-label">Gastos del mes</span>
          <p className="stat-value">{formatMoney(spent)}</p>
          <Delta current={spent} previous={spentBefore} />
        </article>
        <article className="card">
          <span className="stat-label">Supermercado</span>
          <p className="stat-value">{formatMoney(market)}</p>
          <Delta current={market} previous={marketBefore} />
        </article>
        <article className="card">
          <span className="stat-label">Otros gastos</span>
          <p className="stat-value">{formatMoney(other)}</p>
          <Delta current={other} previous={otherBefore} />
        </article>
        <article className="card">
          <span className="stat-label">Ingresos</span>
          <p className="stat-value">{formatMoney(income)}</p>
          <Delta current={income} previous={incomeBefore} higherIsBetter />
        </article>
        <article className="card">
          <span className="stat-label">Balance</span>
          <p className="stat-value">{formatMoney(balance)}</p>
          <Delta current={balance} previous={balanceBefore} higherIsBetter />
        </article>
        <article className="card">
          <span className="stat-label">Compras</span>
          <p className="stat-value">{trips}</p>
          <Delta current={trips} previous={tripsBefore} money={false} />
        </article>
      </div>
      {totalBudget && spent > totalBudget.amount ? (
        <p className="banner">Este mes van {formatMoney(spent - totalBudget.amount)} por encima del presupuesto.</p>
      ) : null}
      {over.length > 0 ? (
        <p className="banner">
          Hay categorías por encima de su presupuesto:{" "}
          {over
            .map((budget) => expenses.find((expense) => expense.category_id === budget.category_id)?.category_name)
            .filter(Boolean)
            .join(", ")}
          .
        </p>
      ) : null}
      {soon.length > 0 ? (
        <section className="stack">
          <h2 className="section-title">Puede hacer falta reponer</h2>
          <ul className="list">
            {soon.map((product) => (
              <li key={product.productId}>
                <Link href={`/productos/${product.productId}`}>
                  <strong>{product.name}</strong>
                  <p className="hint">
                    {product.insight.status === "agotado"
                      ? "Marcado como agotado."
                      : `Estimación alrededor del ${formatDate(product.insight.estimatedNextDate ?? "")}. No es una fecha segura.`}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <section className="stack">
        <h2 className="section-title">Últimos movimientos</h2>
        {currentExpenses.length === 0 ? <p className="empty">Este mes todavía no tiene gastos.</p> : null}
        <ul className="list">
          {currentExpenses.slice(0, 6).map((expense) => (
            <li key={expense.id}>
              <Link href={expense.source === "shopping" && expense.trip_id ? `/supermercado/${expense.trip_id}` : `/gastos/${expense.id}`}>
                <div className="row">
                  <strong>{expense.source === "shopping" ? expense.store_name : expense.description}</strong>
                  <span className="amount">{formatMoney(expense.amount)}</span>
                </div>
                <p className="hint">
                  {formatDate(expense.occurred_on)} · {expense.category_name}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
