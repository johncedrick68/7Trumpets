export function parsePHPMinor(value: string): number | null {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) return null;

  const minor = Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
  return Number.isSafeInteger(minor) ? minor : null;
}

export function formatMinorUnitsToPHP(minorUnits: number): string {
  const isNegative = minorUnits < 0;
  const absMinor = Math.abs(minorUnits);
  const pesos = Math.floor(absMinor / 100);
  const centavos = absMinor % 100;
  const formattedPesos = pesos.toLocaleString("en-PH");
  const formattedCentavos = centavos.toString().padStart(2, "0");
  return `${isNegative ? "-" : ""}₱${formattedPesos}.${formattedCentavos}`;
}
