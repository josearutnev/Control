"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useHousehold } from "./household-provider";
import { Field } from "./ui";
import { EXPENSE_TYPES, todayISO } from "@/lib/format";
import { saveExpense } from "@/lib/save";
import type { Expense, ExpenseType } from "@/lib/types";

export function ExpenseForm({ initial }: { initial?: Expense }) {
  const router = useRouter();
  const { supabase, household, me, members, expenseCategories, paymentMethods, refresh } = useHousehold();
  const activeCategories = expenseCategories.filter((category) => category.active && category.slug !== "supermercado");
  const activeMethods = paymentMethods.filter((method) => method.active);
  const [date, setDate] = useState(initial?.occurred_on ?? todayISO());
  const [description, setDescription] = useState(initial?.description ?? "");
  const [categoryId, setCategoryId] = useState(initial?.category_id ?? activeCategories[0]?.id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [paidBy, setPaidBy] = useState(initial?.paid_by ?? me.id);
  const [paymentMethodId, setPaymentMethodId] = useState(initial?.payment_method_id ?? activeMethods[0]?.id ?? "");
  const [expenseType, setExpenseType] = useState<ExpenseType>(initial?.expense_type ?? "variable");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [receipt, setReceipt] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const result = await saveExpense(supabase, household.id, {
      id: initial?.id,
      date,
      description,
      categoryId,
      amount,
      paidBy,
      paymentMethodId,
      expenseType,
      notes,
      receipt,
    });
    setSaving(false);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    await refresh();
    router.push(result.receiptWarning ? `/gastos/${result.expenseId}` : "/gastos");
  }

  return (
    <form className="stack" onSubmit={onSubmit}>
      <Field label="Qué fue">
        <input className="input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="Cena, cine, reparación…" required />
      </Field>
      <Field label="Categoría">
        <select className="select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)} required>
          {activeCategories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Monto">
        <input className="input" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0.00" required />
      </Field>
      <Field label="Fecha">
        <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
      </Field>
      <div className="split">
        <Field label="Quién pagó">
          <select className="select" value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.display_name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Método">
          <select className="select" value={paymentMethodId} onChange={(event) => setPaymentMethodId(event.target.value)}>
            {activeMethods.map((method) => (
              <option key={method.id} value={method.id}>
                {method.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Tipo">
        <select className="select" value={expenseType} onChange={(event) => setExpenseType(event.target.value as ExpenseType)}>
          {EXPENSE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Nota, si hace falta">
        <textarea className="textarea" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
      <Field label="Foto del comprobante, opcional">
        <input className="input" type="file" accept="image/*" capture="environment" onChange={(event) => setReceipt(event.target.files?.[0] ?? null)} />
      </Field>
      {error ? <p className="error">{error}</p> : null}
      <button className="btn btn-primary btn-block" type="submit" disabled={saving}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
