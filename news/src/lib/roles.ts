export type Role = "admin" | "editor" | "journalist" | "subscriber" | "reader";

// Granted only by admin invitation; these roles can write and review stories.
export const EDITORIAL_ROLES: Role[] = ["admin", "editor", "journalist"];
export const INVITABLE_ROLES = EDITORIAL_ROLES;

export function isEditorial(role?: string): boolean {
  return EDITORIAL_ROLES.includes(role as Role);
}

// Older accounts store "editorial"; treat it as editor. Readers on a paid
// plan count as subscribers even if their role was never updated.
export function normalizeRole(role?: string, plan?: string): Role {
  if (role === "editorial") return "editor";
  if (role === "admin" || role === "editor" || role === "journalist") return role;
  if (plan && plan !== "free") return "subscriber";
  if (role === "subscriber") return "subscriber";
  return "reader";
}
