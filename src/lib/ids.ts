import { customAlphabet } from "nanoid";

const alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Short, URL-friendly id for things people see in URLs (projects). */
export const shortId = customAlphabet(alphabet, 10);

/** Long random id for secrets that act as bearer tokens (workspace cookie). */
export const secretId = customAlphabet(alphabet + "ABCDEFGHIJKLMNOPQRSTUVWXYZ", 32);

/** General-purpose row id. */
export const rowId = customAlphabet(alphabet, 16);

export function slugify(input: string) {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "app"
  );
}
