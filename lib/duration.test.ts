import assert from "node:assert/strict";
import test from "node:test";
import { addDays, monthRange, parseAmount, shiftMonth } from "./format";
import { buildInsight } from "./duration";

test("el rango de febrero respeta el año bisiesto", () => {
  assert.deepEqual(monthRange(2026, 2), { start: "2026-02-01", end: "2026-02-28" });
  assert.deepEqual(monthRange(2024, 2), { start: "2024-02-01", end: "2024-02-29" });
  assert.deepEqual(shiftMonth(2026, 1, -1), { year: 2025, month: 12 });
});

test("interpreta montos como se escriben en el teléfono", () => {
  assert.equal(parseAmount("1500"), 1500);
  assert.equal(parseAmount("1,250.50"), 1250.5);
  assert.equal(parseAmount("1250,50"), 1250.5);
  assert.equal(parseAmount("RD$ 80"), 80);
  assert.equal(parseAmount(""), null);
  assert.equal(parseAmount("-5"), null);
});

test("suma días de calendario sin correr la fecha", () => {
  assert.equal(addDays("2026-11-01", 24), "2026-11-25");
});

test("sin marcar agotado solo calcula el ritmo de recompra", () => {
  const insight = buildInsight(
    [
      { date: "2026-11-01", quantity: 1, unit: "unidad", unitPrice: 100 },
      { date: "2026-11-25", quantity: 1, unit: "unidad", unitPrice: 110 },
    ],
    [],
  );
  assert.equal(insight.averageDurationDays, null);
  assert.equal(insight.daysBetweenLastPurchases, 24);
  assert.equal(Math.round(insight.averageRepurchaseDays ?? 0), 24);
  assert.equal(insight.estimateBasis, "recompra");
  assert.equal(insight.estimatedNextDate, "2026-12-19");
  assert.equal(insight.status, "en_uso");
});

test("un agotado cierra el ciclo y no usa la siguiente compra como fin", () => {
  const insight = buildInsight(
    [
      { date: "2026-11-01", quantity: 1, unit: "unidad", unitPrice: 80 },
      { date: "2026-11-25", quantity: 1, unit: "unidad", unitPrice: 80 },
    ],
    [{ date: "2026-11-24" }],
  );
  assert.equal(Math.round(insight.averageDurationDays ?? 0), 23);
  assert.equal(insight.status, "en_uso");
  assert.equal(insight.estimateBasis, "agotado");
  assert.equal(insight.estimatedNextDate, "2026-12-18");
});

test("si se agota el mismo día de la recompra, la duración es de la compra anterior", () => {
  const insight = buildInsight(
    [
      { date: "2026-11-01", quantity: 1, unit: "unidad", unitPrice: 90 },
      { date: "2026-11-25", quantity: 1, unit: "unidad", unitPrice: 95 },
    ],
    [{ date: "2026-11-25" }],
  );
  assert.equal(Math.round(insight.averageDurationDays ?? 0), 24);
  assert.equal(insight.status, "en_uso");
  assert.equal(insight.lastPurchase, "2026-11-25");
});

test("marcar agotado después de la última compra no inventa una fecha futura", () => {
  const insight = buildInsight(
    [{ date: "2026-11-01", quantity: 1, unit: "unidad", unitPrice: 70, spent: 70 }],
    [{ date: "2026-11-25" }],
  );
  assert.equal(insight.status, "agotado");
  assert.equal(insight.estimatedNextDate, null);
  assert.equal(Math.round(insight.averageDurationDays ?? 0), 24);
  assert.equal(insight.totalSpent, 70);
});

test("dos unidades alargan la estimación de la compra siguiente", () => {
  const insight = buildInsight(
    [
      { date: "2026-10-01", quantity: 2, unit: "unidad", unitPrice: 50 },
      { date: "2026-10-25", quantity: 1, unit: "unidad", unitPrice: 50 },
    ],
    [{ date: "2026-10-25" }],
  );
  assert.equal(Math.round(insight.averageDurationDays ?? 0), 12);
  assert.equal(insight.estimatedNextDate, "2026-11-06");
});
