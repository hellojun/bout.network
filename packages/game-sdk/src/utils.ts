/**
 * Deep-clone a value, safely serialising any bigint fields to strings
 * so they survive the JSON round-trip.
 */
export function deepClone<T>(obj: T): T {
  return JSON.parse(
    JSON.stringify(obj, (_key, value) =>
      typeof value === 'bigint' ? value.toString() : value,
    ),
  )
}
