"use client";

import { ExpenseForm } from "@/components/expense-form";

export default function NuevoGastoPage() {
  return (
    <div className="stack">
      <h2 className="section-title">Registrar gasto</h2>
      <ExpenseForm />
    </div>
  );
}
