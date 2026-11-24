// Password strength rules shared by the sign-up / change-password forms (live
// checklist) and the server actions (authoritative check). Keep this module
// free of Node imports so client components can use it.

export const PASSWORD_MAX = 128;

export const PASSWORD_RULES: { id: string; label: string; test: (password: string) => boolean }[] = [
  { id: "length", label: "At least 8 characters", test: (p) => p.length >= 8 },
  { id: "upper", label: "One uppercase letter", test: (p) => /[A-Z]/.test(p) },
  { id: "lower", label: "One lowercase letter", test: (p) => /[a-z]/.test(p) },
  { id: "number", label: "One number", test: (p) => /[0-9]/.test(p) },
  { id: "symbol", label: "One symbol (e.g. ! @ # $)", test: (p) => /[^A-Za-z0-9\s]/.test(p) },
];

// Returns the first unmet rule as a message, or null when the password is valid.
export function passwordProblem(password: string): string | null {
  if (password.length > PASSWORD_MAX) return `Password can be at most ${PASSWORD_MAX} characters.`;
  const failed = PASSWORD_RULES.find((rule) => !rule.test(password));
  return failed ? `Password needs: ${failed.label.toLowerCase()}.` : null;
}
