"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ConfirmButton, Field } from "@/components/ui";
import { useHousehold } from "@/components/household-provider";
import { INCOME_KINDS, currentMonthInSantoDomingo, formatDate, formatMoney, monthRange, parseAmount, todayISO } from "@/lib/format";
import { fetchBudgets, fetchIncomes, fetchRecurring } from "@/lib/records";
import type { Budget, ExpenseType, Income, IncomeKind, RecurringExpense } from "@/lib/types";

export default function ConfiguracionPage() {
  const router = useRouter();
  const { supabase, household, me, members, expenseCategories, productCategories, paymentMethods, refresh } = useHousehold();
  const [name, setName] = useState(household.name);
  const [displayName, setDisplayName] = useState(me.display_name);
  const [message, setMessage] = useState("");
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [incomeDescription, setIncomeDescription] = useState("");
  const [incomeAmount, setIncomeAmount] = useState("");
  const [incomeKind, setIncomeKind] = useState<IncomeKind>("aporte");
  const [incomeMember, setIncomeMember] = useState(me.id);
  const [incomeDate, setIncomeDate] = useState(todayISO());
  const [budgetAmounts, setBudgetAmounts] = useState<Record<string, string>>({});
  const [recurringDescription, setRecurringDescription] = useState("");
  const [recurringAmount, setRecurringAmount] = useState("");
  const [recurringCategory, setRecurringCategory] = useState("");
  const [recurringDay, setRecurringDay] = useState("1");
  const now = currentMonthInSantoDomingo();

  useEffect(() => {
    let cancelled = false;
    const range = monthRange(now.year, now.month);
    void Promise.all([
      fetchIncomes(supabase, household.id),
      fetchBudgets(supabase, household.id, now.year, now.month),
      fetchRecurring(supabase, household.id),
    ]).then(([nextIncomes, nextBudgets, nextRecurring]) => {
      if (cancelled) return;
      setIncomes(nextIncomes.filter((income) => income.occurred_on >= range.start && income.occurred_on <= range.end));
      setBudgets(nextBudgets);
      setRecurring(nextRecurring);
      const amounts: Record<string, string> = {};
      for (const budget of nextBudgets) {
        amounts[budget.category_id ?? "total"] = String(budget.amount);
      }
      setBudgetAmounts(amounts);
    });
    return () => {
      cancelled = true;
    };
  }, [household.id, now.month, now.year, supabase]);

  async function reloadLists() {
    const range = monthRange(now.year, now.month);
    const [nextIncomes, nextBudgets, nextRecurring] = await Promise.all([
      fetchIncomes(supabase, household.id),
      fetchBudgets(supabase, household.id, now.year, now.month),
      fetchRecurring(supabase, household.id),
    ]);
    setIncomes(nextIncomes.filter((income) => income.occurred_on >= range.start && income.occurred_on <= range.end));
    setBudgets(nextBudgets);
    setRecurring(nextRecurring);
  }

  return (
    <div className="stack">
      <h2 className="section-title">Configuración</h2>
      {message ? <p className="ok">{message}</p> : null}
      <section className="card stack">
        <h2>Hogar</h2>
        <Field label="Nombre">
          <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const { error } = await supabase.from("households").update({ name: name.trim() }).eq("id", household.id);
            setMessage(error ? "No se pudo cambiar el nombre." : "Nombre actualizado.");
            await refresh();
          }}
        >
          Guardar nombre
        </button>
        <p className="hint">Código para invitar a la otra persona. Solo caben dos.</p>
        <p className="code">{household.invite_code}</p>
        <div className="split">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(household.invite_code);
              setMessage("Código copiado.");
            }}
          >
            Copiar
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              const { data, error } = await supabase.rpc("regenerate_invite_code");
              setMessage(error ? "No se pudo cambiar el código." : `Nuevo código: ${data}`);
              await refresh();
            }}
          >
            Nuevo código
          </button>
        </div>
        <ul className="list">
          {members.map((member) => (
            <li key={member.id}>
              <div className="list-button">
                <strong>{member.display_name}</strong>
                <p className="hint">{member.role === "owner" ? "Creó el hogar" : "Integrante"}</p>
              </div>
            </li>
          ))}
        </ul>
        <Field label="Tu nombre en los gastos">
          <input className="input" value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
        </Field>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={async () => {
            const { error } = await supabase.from("household_members").update({ display_name: displayName.trim() }).eq("id", me.id);
            setMessage(error ? "No se pudo cambiar tu nombre." : "Nombre actualizado.");
            await refresh();
          }}
        >
          Guardar mi nombre
        </button>
      </section>

      <CategoryEditor
        title="Categorías de gasto"
        rows={expenseCategories}
        locked={(row) => Boolean(row.is_system)}
        onAdd={async (value) => {
          await supabase.from("expense_categories").insert({ household_id: household.id, name: value, kind: "household", sort_order: 50 });
          await refresh();
        }}
        onRename={async (id, value) => {
          await supabase.from("expense_categories").update({ name: value }).eq("id", id);
          await refresh();
        }}
        onToggle={async (id, active) => {
          await supabase.from("expense_categories").update({ active }).eq("id", id);
          await refresh();
        }}
      />
      <CategoryEditor
        title="Categorías de producto"
        rows={productCategories.map((category) => ({ ...category, is_system: false }))}
        locked={() => false}
        onAdd={async (value) => {
          await supabase.from("product_categories").insert({ household_id: household.id, name: value, sort_order: 50 });
          await refresh();
        }}
        onRename={async (id, value) => {
          await supabase.from("product_categories").update({ name: value }).eq("id", id);
          await refresh();
        }}
        onToggle={async (id, active) => {
          await supabase.from("product_categories").update({ active }).eq("id", id);
          await refresh();
        }}
      />
      <CategoryEditor
        title="Métodos de pago"
        rows={paymentMethods.map((method) => ({ ...method, is_system: false }))}
        locked={() => false}
        onAdd={async (value) => {
          await supabase.from("payment_methods").insert({ household_id: household.id, name: value, sort_order: 50 });
          await refresh();
        }}
        onRename={async (id, value) => {
          await supabase.from("payment_methods").update({ name: value }).eq("id", id);
          await refresh();
        }}
        onToggle={async (id, active) => {
          await supabase.from("payment_methods").update({ active }).eq("id", id);
          await refresh();
        }}
      />

      <section className="card stack">
        <h2>Ingresos de este mes</h2>
        <Field label="Descripción">
          <input className="input" value={incomeDescription} onChange={(event) => setIncomeDescription(event.target.value)} placeholder="Sueldo, aporte…" />
        </Field>
        <div className="split">
          <Field label="Monto">
            <input className="input" inputMode="decimal" value={incomeAmount} onChange={(event) => setIncomeAmount(event.target.value)} />
          </Field>
          <Field label="Fecha">
            <input className="input" type="date" value={incomeDate} onChange={(event) => setIncomeDate(event.target.value)} />
          </Field>
        </div>
        <Field label="Tipo">
          <select className="select" value={incomeKind} onChange={(event) => setIncomeKind(event.target.value as IncomeKind)}>
            {INCOME_KINDS.map((kind) => (
              <option key={kind.value} value={kind.value}>
                {kind.label}
              </option>
            ))}
          </select>
        </Field>
        {incomeKind === "aporte" ? (
          <Field label="De quién">
            <select className="select" value={incomeMember} onChange={(event) => setIncomeMember(event.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const amount = parseAmount(incomeAmount);
            if (!incomeDescription.trim() || amount === null) {
              setMessage("Escribe el ingreso y el monto.");
              return;
            }
            const { error } = await supabase.from("incomes").insert({
              household_id: household.id,
              occurred_on: incomeDate,
              description: incomeDescription.trim(),
              amount,
              kind: incomeKind,
              member_id: incomeKind === "aporte" ? incomeMember : null,
            });
            if (error) {
              setMessage("No se pudo guardar el ingreso.");
              return;
            }
            setIncomeDescription("");
            setIncomeAmount("");
            setMessage("Ingreso guardado.");
            await reloadLists();
          }}
        >
          Agregar ingreso
        </button>
        <ul className="list">
          {incomes.map((income) => (
            <li key={income.id}>
              <div className="list-button">
                <div className="row">
                  <strong>{income.description}</strong>
                  <span className="amount">{formatMoney(income.amount)}</span>
                </div>
                <p className="hint">
                  {formatDate(income.occurred_on)} · {income.member_name ?? INCOME_KINDS.find((kind) => kind.value === income.kind)?.label}
                </p>
                <ConfirmButton
                  label="Quitar"
                  title="Quitar este ingreso"
                  message="Deja de contar en el balance del mes."
                  className="btn btn-ghost"
                  onConfirm={async () => {
                    await supabase.from("incomes").delete().eq("id", income.id);
                    await reloadLists();
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="card stack">
        <h2>Presupuesto de {now.month}/{now.year}</h2>
        <Field label="Tope del mes">
          <input
            className="input"
            inputMode="decimal"
            value={budgetAmounts.total ?? ""}
            placeholder="Opcional"
            onChange={(event) => setBudgetAmounts((current) => ({ ...current, total: event.target.value }))}
          />
        </Field>
        {expenseCategories.filter((category) => category.active).map((category) => (
          <Field key={category.id} label={category.name}>
            <input
              className="input"
              inputMode="decimal"
              value={budgetAmounts[category.id] ?? ""}
              placeholder="Sin tope"
              onChange={(event) => setBudgetAmounts((current) => ({ ...current, [category.id]: event.target.value }))}
            />
          </Field>
        ))}
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const rows = [
              { category_id: null, amount: parseAmount(budgetAmounts.total ?? "") },
              ...expenseCategories.map((category) => ({
                category_id: category.id,
                amount: parseAmount(budgetAmounts[category.id] ?? ""),
              })),
            ].filter((row) => row.amount !== null && row.amount > 0);
            const { error: deleteError } = await supabase
              .from("budgets")
              .delete()
              .eq("household_id", household.id)
              .eq("year", now.year)
              .eq("month", now.month);
            if (deleteError) {
              setMessage("No se pudo guardar el presupuesto.");
              return;
            }
            if (rows.length > 0) {
              const { error } = await supabase.from("budgets").insert(
                rows.map((row) => ({
                  household_id: household.id,
                  year: now.year,
                  month: now.month,
                  category_id: row.category_id,
                  amount: row.amount,
                })),
              );
              if (error) {
                setMessage("No se pudo guardar el presupuesto.");
                return;
              }
            }
            setMessage("Presupuesto guardado.");
            await reloadLists();
          }}
        >
          Guardar presupuesto
        </button>
        {budgets.length === 0 ? <p className="hint">Si lo dejas vacío, el inicio no marca excesos.</p> : null}
      </section>

      <section className="card stack">
        <h2>Gastos que se repiten</h2>
        <p className="hint">No se crean solos. Tú confirmas cada mes.</p>
        <Field label="Descripción">
          <input className="input" value={recurringDescription} onChange={(event) => setRecurringDescription(event.target.value)} placeholder="Luz, internet…" />
        </Field>
        <div className="split">
          <Field label="Monto">
            <input className="input" inputMode="decimal" value={recurringAmount} onChange={(event) => setRecurringAmount(event.target.value)} />
          </Field>
          <Field label="Día">
            <input className="input" inputMode="numeric" value={recurringDay} onChange={(event) => setRecurringDay(event.target.value)} />
          </Field>
        </div>
        <Field label="Categoría">
          <select className="select" value={recurringCategory} onChange={(event) => setRecurringCategory(event.target.value)}>
            <option value="">Elegir</option>
            {expenseCategories.filter((category) => category.active).map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </Field>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            const amount = parseAmount(recurringAmount);
            const day = Number(recurringDay);
            if (!recurringDescription.trim() || amount === null || !recurringCategory || day < 1 || day > 28) {
              setMessage("Revisa la descripción, el monto, la categoría y un día del 1 al 28.");
              return;
            }
            const { error } = await supabase.from("recurring_expenses").insert({
              household_id: household.id,
              description: recurringDescription.trim(),
              amount,
              category_id: recurringCategory,
              day_of_month: day,
              expense_type: "fijo" satisfies ExpenseType,
              paid_by: me.id,
            });
            if (error) {
              setMessage("No se pudo guardar el gasto recurrente.");
              return;
            }
            setRecurringDescription("");
            setRecurringAmount("");
            setMessage("Quedó guardado. Puedes registrarlo cada mes.");
            await reloadLists();
          }}
        >
          Agregar recurrente
        </button>
        <ul className="list">
          {recurring.map((item) => (
            <li key={item.id}>
              <div className="list-button stack">
                <div className="row">
                  <strong>{item.description}</strong>
                  <span className="amount">{formatMoney(item.amount)}</span>
                </div>
                <p className="hint">Día {item.day_of_month}</p>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={async () => {
                    const range = monthRange(now.year, now.month);
                    const { data: existing } = await supabase
                      .from("expenses")
                      .select("id")
                      .eq("recurring_id", item.id)
                      .gte("occurred_on", range.start)
                      .lte("occurred_on", range.end)
                      .maybeSingle();
                    if (existing) {
                      setMessage("Ese gasto ya está registrado este mes.");
                      return;
                    }
                    const day = String(item.day_of_month).padStart(2, "0");
                    const { error } = await supabase.from("expenses").insert({
                      household_id: household.id,
                      occurred_on: `${now.year}-${String(now.month).padStart(2, "0")}-${day}`,
                      description: item.description,
                      category_id: item.category_id,
                      amount: item.amount,
                      paid_by: item.paid_by ?? me.id,
                      payment_method_id: item.payment_method_id,
                      expense_type: item.expense_type,
                      source: "manual",
                      recurring_id: item.id,
                    });
                    setMessage(error ? "No se pudo registrar este mes." : "Registrado en los gastos del mes.");
                  }}
                >
                  Registrar este mes
                </button>
                <ConfirmButton
                  label="Quitar plantilla"
                  title="Quitar este recurrente"
                  message="No borra los gastos que ya registraste."
                  className="btn btn-ghost"
                  onConfirm={async () => {
                    await supabase.from("recurring_expenses").delete().eq("id", item.id);
                    await reloadLists();
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      </section>

      <p className="hint">Moneda: peso dominicano (RD$). Fechas en día/mes/año. Zona: República Dominicana.</p>
      <button
        type="button"
        className="btn btn-ghost btn-block"
        onClick={async () => {
          await supabase.auth.signOut();
          router.replace("/entrar");
        }}
      >
        Cerrar sesión
      </button>
    </div>
  );
}

function CategoryEditor({
  title,
  rows,
  locked,
  onAdd,
  onRename,
  onToggle,
}: {
  title: string;
  rows: { id: string; name: string; active: boolean; is_system?: boolean }[];
  locked: (row: { is_system?: boolean }) => boolean;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: string, name: string) => Promise<void>;
  onToggle: (id: string, active: boolean) => Promise<void>;
}) {
  const [draft, setDraft] = useState("");
  return (
    <section className="card stack">
      <h2>{title}</h2>
      {rows.map((row) => (
        <div className="row" key={row.id}>
          <input
            className="input"
            defaultValue={row.name}
            disabled={locked(row)}
            onBlur={(event) => {
              const value = event.target.value.trim();
              if (value && value !== row.name) void onRename(row.id, value);
            }}
          />
          <button type="button" className="btn btn-ghost" disabled={locked(row)} onClick={() => void onToggle(row.id, !row.active)}>
            {row.active ? "Activa" : "Inactiva"}
          </button>
        </div>
      ))}
      <div className="split">
        <input className="input" value={draft} placeholder="Nueva" onChange={(event) => setDraft(event.target.value)} />
        <button
          type="button"
          className="btn btn-secondary"
          onClick={async () => {
            if (draft.trim().length < 2) return;
            await onAdd(draft.trim());
            setDraft("");
          }}
        >
          Agregar
        </button>
      </div>
    </section>
  );
}
