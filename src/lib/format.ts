export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function fmtEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function fmtM2(value: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 }).format(value)} m²`;
}

export function fmtCm(value: number): string {
  return `${new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 }).format(value)} cm`;
}

export function fmtMeters(cm: number): string {
  return `${new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cm / 100)} m`;
}

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" }).format(d);
}
