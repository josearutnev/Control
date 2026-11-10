import { addDays, daysBetween, roundMoney } from "./format";

export type PurchasePoint = {
  date: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  spent?: number;
};

export type DepletionPoint = {
  date: string;
};

export type EstimateBasis = "agotado" | "recompra";
export type Confidence = "baja" | "media" | "alta";
export type ProductStatus = "sin_compras" | "en_uso" | "agotado";

export type ProductInsight = {
  lastPurchase: string | null;
  previousPurchase: string | null;
  daysBetweenLastPurchases: number | null;
  averageDurationDays: number | null;
  durationSamples: number;
  averageRepurchaseDays: number | null;
  repurchaseSamples: number;
  averageUnitPrice: number | null;
  totalSpent: number;
  purchaseCount: number;
  estimatedNextDate: string | null;
  estimateBasis: EstimateBasis | null;
  confidence: Confidence | null;
  status: ProductStatus;
  lastDepletion: string | null;
};

function average(values: number[]) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidence(samples: number): Confidence | null {
  if (samples <= 0) return null;
  if (samples === 1) return "baja";
  if (samples < 4) return "media";
  return "alta";
}

export function buildInsight(
  purchases: PurchasePoint[],
  depletions: DepletionPoint[],
): ProductInsight {
  const buys = [...purchases]
    .filter((purchase) => purchase.date)
    .sort((a, b) => a.date.localeCompare(b.date));
  const ends = depletions
    .map((event) => event.date.slice(0, 10))
    .filter(Boolean)
    .sort();

  const base: ProductInsight = {
    lastPurchase: null,
    previousPurchase: null,
    daysBetweenLastPurchases: null,
    averageDurationDays: null,
    durationSamples: 0,
    averageRepurchaseDays: null,
    repurchaseSamples: 0,
    averageUnitPrice: null,
    totalSpent: 0,
    purchaseCount: 0,
    estimatedNextDate: null,
    estimateBasis: null,
    confidence: null,
    status: "sin_compras",
    lastDepletion: ends.at(-1) ?? null,
  };

  if (buys.length === 0) return base;

  const gaps: number[] = [];
  for (let index = 1; index < buys.length; index += 1) {
    const gap = daysBetween(buys[index - 1].date, buys[index].date);
    if (gap > 0) gaps.push(gap);
  }

  const perUnitDurations: number[] = [];
  const paired = new Set<number>();
  let lastCycleDepleted = false;

  for (let index = 0; index < buys.length; index += 1) {
    const start = buys[index].date.slice(0, 10);
    const next = buys[index + 1]?.date.slice(0, 10);
    let found = -1;
    for (let cursor = 0; cursor < ends.length; cursor += 1) {
      if (paired.has(cursor)) continue;
      const depletion = ends[cursor];
      if (depletion <= start) continue;
      if (next && depletion > next) break;
      found = cursor;
      break;
    }
    if (found < 0) continue;
    paired.add(found);
    if (index === buys.length - 1) lastCycleDepleted = true;
    const days = daysBetween(start, ends[found]);
    const quantity = buys[index].quantity > 0 ? buys[index].quantity : 1;
    if (days >= 1) perUnitDurations.push(days / quantity);
  }

  const last = buys[buys.length - 1];
  const previous = buys.length > 1 ? buys[buys.length - 2] : null;
  const lastDate = last.date.slice(0, 10);
  const unpairedDepletion = ends.some(
    (date, index) => !paired.has(index) && date >= lastDate,
  );
  const status: ProductStatus =
    lastCycleDepleted || unpairedDepletion ? "agotado" : "en_uso";
  const averageDurationDays = average(perUnitDurations);
  const averageRepurchaseDays = average(gaps);
  const prices = buys
    .map((purchase) => purchase.unitPrice)
    .filter((price) => Number.isFinite(price) && price >= 0);

  let estimatedNextDate: string | null = null;
  let estimateBasis: EstimateBasis | null = null;
  let estimateConfidence: Confidence | null = null;

  if (status === "en_uso" && averageDurationDays && averageDurationDays > 0) {
    const quantity = last.quantity > 0 ? last.quantity : 1;
    estimatedNextDate = addDays(lastDate, averageDurationDays * quantity);
    estimateBasis = "agotado";
    estimateConfidence = confidence(perUnitDurations.length);
  } else if (status === "en_uso" && averageRepurchaseDays && averageRepurchaseDays > 0) {
    estimatedNextDate = addDays(lastDate, averageRepurchaseDays);
    estimateBasis = "recompra";
    estimateConfidence = confidence(gaps.length);
  }

  return {
    lastPurchase: lastDate,
    previousPurchase: previous ? previous.date.slice(0, 10) : null,
    daysBetweenLastPurchases: previous ? daysBetween(previous.date, lastDate) : null,
    averageDurationDays,
    durationSamples: perUnitDurations.length,
    averageRepurchaseDays,
    repurchaseSamples: gaps.length,
    averageUnitPrice: average(prices),
    totalSpent: roundMoney(
      buys.reduce((sum, purchase) => {
        const spent = purchase.spent ?? purchase.unitPrice * purchase.quantity;
        return sum + (Number.isFinite(spent) ? spent : 0);
      }, 0),
    ),
    purchaseCount: buys.length,
    estimatedNextDate,
    estimateBasis,
    confidence: estimateConfidence,
    status,
    lastDepletion: ends.at(-1) ?? null,
  };
}

export function needsRestock(insight: ProductInsight, today: string) {
  if (insight.status === "agotado") return true;
  if (!insight.estimatedNextDate) return false;
  return insight.estimatedNextDate <= addDays(today, 7);
}

export function durationLabel(days: number | null) {
  if (days === null) return "Sin agotados";
  const rounded = Math.round(days);
  return rounded === 1 ? "1 día" : `${rounded} días`;
}

export function confidenceLabel(confidence: Confidence | null) {
  if (confidence === "baja") return "basada en 1 registro";
  if (confidence === "media") return "basada en pocos registros";
  if (confidence === "alta") return "basada en varios registros";
  return "";
}
