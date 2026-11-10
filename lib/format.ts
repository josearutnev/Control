export const UNITS = [
  "unidad",
  "libra",
  "kilo",
  "litro",
  "paquete",
  "caja",
  "onza",
  "galón",
] as const;

export const EXPENSE_TYPES = [
  { value: "fijo", label: "Fijo" },
  { value: "variable", label: "Variable" },
  { value: "extraordinario", label: "Extraordinario" },
] as const;

export const INCOME_KINDS = [
  { value: "aporte", label: "Aporte" },
  { value: "hogar", label: "Ingreso del hogar" },
  { value: "extraordinario", label: "Extraordinario" },
] as const;

const MONTHS = [
  "enero",
  "febrero",
  "marzo",
  "abril",
  "mayo",
  "junio",
  "julio",
  "agosto",
  "septiembre",
  "octubre",
  "noviembre",
  "diciembre",
];

export function formatMoney(value: number) {
  return new Intl.NumberFormat("es-DO", {
    style: "currency",
    currency: "DOP",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

export function formatDate(iso: string) {
  const [year, month, day] = iso.slice(0, 10).split("-");
  if (!year || !month || !day) return iso;
  return `${day}/${month}/${year}`;
}

export function monthLabel(year: number, month: number) {
  return `${MONTHS[month - 1] ?? ""} ${year}`;
}

export function currentYearMonth(now = new Date()) {
  const { year, month } = currentMonthInSantoDomingo(now);
  return { year, month };
}

export function currentMonthInSantoDomingo(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santo_Domingo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);
  return { year, month, day };
}

export function todayISO(now = new Date()) {
  const { year, month, day } = currentMonthInSantoDomingo(now);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function monthRange(year: number, month: number) {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const endDate = new Date(Date.UTC(year, month, 0));
  const end = endDate.toISOString().slice(0, 10);
  return { start, end };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1 };
}

export function daysBetween(earlier: string, later: string) {
  const start = Date.parse(`${earlier.slice(0, 10)}T00:00:00Z`);
  const end = Date.parse(`${later.slice(0, 10)}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000);
}

export function addDays(date: string, days: number) {
  const value = new Date(`${date.slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + Math.round(days));
  return value.toISOString().slice(0, 10);
}

export function parseAmount(raw: string): number | null {
  let text = raw.trim().replace(/rd\$/gi, "").replace(/\s/g, "");
  if (!text) return null;
  if (text.includes(",") && text.includes(".")) {
    if (text.lastIndexOf(",") > text.lastIndexOf(".")) {
      text = text.replace(/\./g, "").replace(",", ".");
    } else {
      text = text.replace(/,/g, "");
    }
  } else if (text.includes(",")) {
    const parts = text.split(",");
    if (parts.length === 2 && parts[1].length <= 2) {
      text = `${parts[0].replace(/\./g, "")}.${parts[1]}`;
    } else {
      text = text.replace(/,/g, "");
    }
  }
  const amount = Number(text);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function normalizeName(name: string) {
  return name
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export function num(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? amount : 0;
}

export function roundMoney(value: number) {
  return Math.round(value * 100) / 100;
}

export function messageFromError(error: { message?: string; code?: string } | null) {
  const text = error?.message ?? "";
  if (!error) return "No se pudo completar. Intenta de nuevo.";
  if (/invalid login credentials/i.test(text)) return "Correo o contraseña incorrectos.";
  if (/email not confirmed/i.test(text)) {
    return "Falta confirmar el correo. Revisa tu bandeja de entrada.";
  }
  if (/already registered/i.test(text)) return "Ese correo ya tiene cuenta. Entra con tu contraseña.";
  if (
    text.startsWith("Necesitas") ||
    text.startsWith("Ya perteneces") ||
    text.startsWith("Escribe") ||
    text.startsWith("Código") ||
    text.startsWith("Ese hogar") ||
    text.startsWith("No perteneces") ||
    text.startsWith("No se pudo")
  ) {
    return text;
  }
  if (error.code === "PGRST205" || /schema cache/i.test(text)) {
    return "Falta crear las tablas en Supabase.";
  }
  return "No se pudo completar. Revisa los datos e intenta de nuevo.";
}
