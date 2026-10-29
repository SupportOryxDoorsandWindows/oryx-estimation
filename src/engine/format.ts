const aed = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 })
const num = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 6 })

/** AED with thousands separators and no decimals. Values are already whole after rounding. */
export const fmtAed = (n: number) => aed.format(Math.trunc(n))
export const fmtNum = (n: number) => num.format(n)
