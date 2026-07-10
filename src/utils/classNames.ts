/** Joins truthy class names together, filtering out falsy values. */
export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}
