/**
 * Numeric input parsing. Kept free of database and React imports so it stays
 * unit-testable in plain Node.
 */

/**
 * Parse a number typed into a text field, or null when it is not a usable quantity.
 *
 * The comma-to-dot swap matters: on a German or French keyboard the decimal separator
 * is a comma, and `Number.parseFloat('1,5')` silently yields `1` rather than failing,
 * which would log a fifth of the intended amount without any visible error.
 */
export function parsePositiveNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * As above, but zero is a legitimate answer.
 *
 * Nutrition fields need this: a food with no fat is not a food with a missing fat value,
 * and refusing to accept `0` would force the user to leave the field blank instead.
 */
export function parseNonNegativeNumber(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
