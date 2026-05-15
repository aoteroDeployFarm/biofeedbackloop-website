/**
 * Recursively converts every `undefined` value in an object to `null`
 * before writing to Firestore. Uses JSON round-trip so it catches values
 * that are undefined in a spread, set explicitly to undefined, or missing
 * from an optional interface field.
 *
 * Safe for Firestore: all resulting values are JSON-serializable.
 */
export function toFirestore<T = Record<string, unknown>>(data: T): T {
  return JSON.parse(JSON.stringify(data, (_key, value) =>
    value === undefined ? null : value
  )) as T;
}
