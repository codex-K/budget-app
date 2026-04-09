/**
 * Converts an amount + frequency to a monthly figure.
 * One-off items return 0 — they are NOT recurring monthly commitments.
 * Use toActual() when calculating real spending within a specific month.
 */
export const toMonthly = (amount, frequency) => {
  const n = parseFloat(amount) || 0
  if (frequency === 'weekly') return n * 52 / 12
  if (frequency === 'fortnightly') return n * 26 / 12
  if (frequency === 'yearly') return n / 12
  if (frequency === 'one-off') return 0
  return n
}

/**
 * Returns the actual amount spent in a given period.
 * Unlike toMonthly, one-off items are included at face value.
 * Use this for dashboard totals, history, and budget limit calculations.
 */
export const toActual = (amount, frequency) => {
  if (frequency === 'one-off') return parseFloat(amount) || 0
  return toMonthly(amount, frequency)
}

/**
 * Formats a number as AUD currency string.
 */
export const fmt = (n) =>
  parseFloat(n || 0).toLocaleString('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
