// Currency -> locale so the decimal/grouping separators match convention
// (e.g. EUR renders "10,50 €", USD "$10.50"). Falls back to the runtime locale.
const CURRENCY_LOCALE: Record<string, string> = {
  USD: "en-US",
  EUR: "de-DE",
  GBP: "en-GB",
  INR: "en-IN",
  JPY: "ja-JP",
  CHF: "de-CH",
  CNY: "zh-CN",
  CAD: "en-CA",
  AUD: "en-AU",
  BRL: "pt-BR",
  SGD: "en-SG",
  AED: "en-AE",
  SEK: "sv-SE",
  NOK: "nb-NO",
  DKK: "da-DK",
  NZD: "en-NZ",
  ZAR: "en-ZA",
  MXN: "es-MX"
};

/** Format integer minor units (cents) as a localized currency string. */
export function formatMoney(cents: number, currency = "USD"): string {
  const code = (currency || "USD").toUpperCase();
  const locale = CURRENCY_LOCALE[code];
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: code }).format(cents / 100);
  } catch {
    // Unknown/invalid currency code — fall back to a plain number.
    return (cents / 100).toFixed(2);
  }
}

/**
 * Parse a user-entered amount into integer cents. Lenient about separators:
 * accepts "10.50", "10,50", "1.234,56", "1,234.56", "€10,50", etc.
 * Returns null for empty/invalid/negative input.
 */
export function parseAmountToCents(raw: string): number | null {
  if (raw == null) return null;
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned || cleaned === "-") return null;

  const lastDot = cleaned.lastIndexOf(".");
  const lastComma = cleaned.lastIndexOf(",");
  const decPos = Math.max(lastDot, lastComma);

  let intPart: string;
  let fracPart: string;
  if (decPos === -1) {
    intPart = cleaned.replace(/[.,]/g, "");
    fracPart = "0";
  } else {
    intPart = cleaned.slice(0, decPos).replace(/[.,]/g, "");
    fracPart = cleaned.slice(decPos + 1).replace(/[.,]/g, "") || "0";
  }

  const value = Number(`${intPart || "0"}.${fracPart}`);
  if (!Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100);
}

/** Convert cents to a plain editable amount string (e.g. 1050 -> "10.50"). */
export function centsToAmount(cents: number): string {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

/**
 * A locale-appropriate example amount for input placeholders
 * (e.g. USD -> "10.50", EUR -> "10,50").
 */
export function amountPlaceholder(currency = "USD"): string {
  const code = (currency || "USD").toUpperCase();
  const locale = CURRENCY_LOCALE[code];
  try {
    const parts = new Intl.NumberFormat(locale, { minimumFractionDigits: 2 }).formatToParts(10.5);
    const decimal = parts.find((p) => p.type === "decimal")?.value ?? ".";
    return `10${decimal}50`;
  } catch {
    return "10.50";
  }
}
