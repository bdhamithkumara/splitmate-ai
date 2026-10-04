export function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      currencyDisplay: "code",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    // unknown currency code
    return `${currency} ${amount.toLocaleString("en", { maximumFractionDigits: 2 })}`;
  }
}
