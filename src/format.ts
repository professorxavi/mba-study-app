/** "$4", "$4.50", "$1,250", "−$3". */
export function fmtMoney(dollars: number): string {
  const cents = Math.round(dollars * 100);
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents) / 100;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
