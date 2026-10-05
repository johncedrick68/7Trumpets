export function formatPHP(minorUnits: number, includeDecimals = false): string {
  const amount = minorUnits / 100;
  if (!includeDecimals && Number.isInteger(amount)) {
    return `₱${amount.toLocaleString('en-PH')}`;
  }
  return `₱${amount.toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
