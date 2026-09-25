export type RelationValue<T> = T | T[] | null | undefined;

/** Normalize a PostgREST one-to-one or many-to-one embed. */
export function relationToOne<T>(value: RelationValue<T>): T | null {
  if (!Array.isArray(value)) return value ?? null;
  if (value.length > 1) {
    throw new Error("Expected a to-one relation but received multiple records.");
  }
  return value[0] ?? null;
}

/** Normalize a PostgREST one-to-many embed. */
export function relationToMany<T>(value: RelationValue<T>): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}
