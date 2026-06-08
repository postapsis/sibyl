/*
 * Author: Jamius Siam
 * Since: 06/06/2026
 */
export function isValidHttpUrl(value: string): boolean {
  if (!URL.canParse(value)) {
    return false;
  }

  const protocol = new URL(value).protocol;
  return protocol === "http:" || protocol === "https:";
}

export const exit = (code?: number): never => process.exit(code);
