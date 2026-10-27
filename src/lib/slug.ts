const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ў: "u", қ: "q", ғ: "g", ҳ: "h",
};

export const RESERVED_SLUGS = new Set([
  "api", "admin", "dashboard", "login", "register", "logout", "onboarding",
  "pricing", "features", "about", "support", "help", "docs", "blog", "terms",
  "privacy", "b", "s", "static", "assets", "public", "app", "www", "mail",
  "uzbook", "account", "settings", "new", "create",
]);

export function slugify(input: string): string {
  const lower = input.toLowerCase().trim();
  let out = "";
  for (const char of lower) {
    if (TRANSLIT[char] !== undefined) out += TRANSLIT[char];
    else if (/[a-z0-9]/.test(char)) out += char;
    else out += "-";
  }
  return out
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9][a-z0-9-]{1,46}[a-z0-9]$/.test(slug) && !RESERVED_SLUGS.has(slug);
}

export function suggestSlug(name: string): string {
  const base = slugify(name) || "salon";
  if (!RESERVED_SLUGS.has(base)) return base;
  return `${base}-1`;
}
