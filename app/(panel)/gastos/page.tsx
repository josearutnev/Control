"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MonthSwitcher } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { currentYearMonth, formatDate, formatMoney, monthLabel, monthRange, shiftMonth } from "@/lib/format";
import { fetchExpenses } from "@/lib/records";
import type { Expense } from "@/lib/types";

export default function GastosPage() {
  const { supabase, household, expenseCategories, members, paymentMethods } = useHousehold();
  const [cursor, setCursor] = useState(() => currentYearMonth());
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categoryId, setCategoryId] = useState("");
  const [memberId, setMemberId] = useState("");
  const [methodId, setMethodId] = useState("");
  const [type, setType] = useState("");
  const [text, setText] = useState("");

  useEffect(() => {
    const range = monthRange(cursor.year, cursor.month);
    let cancelled = false;
    void fetchExpenses(supabase, household.id, range.start, range.end)
      .then((rows) => {
        if (!cancelled) setExpenses(rows.filter((row) => row.source === "manual"));
      })
      .catch(() => {
        if (!cancelled) setExpenses([]);
      });
    return () => {
      cancelled = true;
    };
  }, [cursor.month, cursor.year, household.id, supabase]);

  const visible = expenses.filter((expense) => {
    if (categoryId && expense.category_id !== categoryId) return false;
    if (memberId && expense.paid_by !== memberId) return false;
    if (methodId && expense.payment_method_id !== methodId) return false;
    if (type && expense.expense_type !== type) return false;
    if (text && !expense.description.toLowerCase().includes(text.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="stack">
      <div className="row">
        <h2 className="section-title">Gastos</h2>
        <Link className="btn btn-primary" href="/gasto">
          Nuevo
        </Link>
      </div>
      <MonthSwitcher
        label={monthLabel(cursor.year, cursor.month)}
        onPrevious={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
        onNext={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
      />
      <div className="filters">
        <input className="input" value={text} placeholder="Buscar" onChange={(event) => setText(event.target.value)} />
        <select className="select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
          <option value="">Todas las categorías</option>
          {expenseCategories.filter((category) => category.slug !== "supermercado").map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select className="select" value={memberId} onChange={(event) => setMemberId(event.target.value)}>
          <option value="">Quién pagó</option>
          {members.map((member) => (
            <option key={member.id} value={member.id}>
              {member.display_name}
            </option>
          ))}
        </select>
        <select className="select" value={methodId} onChange={(event) => setMethodId(event.target.value)}>
          <option value="">Método</option>
          {paymentMethods.map((method) => (
            <option key={method.id} value={method.id}>
              {method.name}
            </option>
          ))}
        </select>
        <select className="select" value={type} onChange={(event) => setType(event.target.value)}>
          <option value="">Tipo</option>
          <option value="fijo">Fijo</option>
          <option value="variable">Variable</option>
          <option value="extraordinario">Extraordinario</option>
        </select>
      </div>
      {visible.length === 0 ? <p className="empty">No hay gastos con esos filtros.</p> : null}
      <ul className="list">
        {visible.map((expense) => (
          <li key={expense.id}>
            <Link href={`/gastos/${expense.id}`}>
              <div className="row">
                <strong>{expense.description}</strong>
                <span className="amount">{formatMoney(expense.amount)}</span>
              </div>
              <p className="hint">
                {formatDate(expense.occurred_on)} · {expense.category_name} · {expense.payer_name}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
