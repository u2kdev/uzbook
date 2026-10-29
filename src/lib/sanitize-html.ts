/**
 * Server-side HTML sanitizer for user-supplied rich text / custom HTML blocks.
 *
 * Strips all executable constructs (<script>, <iframe>, <object>, <embed>,
 * <form>, <style>, <link>, <meta>, <base>, <svg>, <math>, event handlers like
 * onclick/onerror, and dangerous URL protocols like javascript:/data:/vbscript:)
 * so that salon owners cannot inject Stored XSS on the shared platform origin.
 */

const ALLOWED_TAGS = new Set([
  "div",
  "span",
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "small",
  "mark",
  "blockquote",
  "code",
  "pre",
  "ul",
  "ol",
  "li",
  "dl",
  "dt",
  "dd",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "a",
  "img",
  "figure",
  "figcaption",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "details",
  "summary",
]);

const VOID_TAGS = new Set(["br", "hr", "img"]);

const GLOBAL_ATTRS = new Set(["class", "id", "title", "role", "dir", "lang"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target", "rel"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
  th: new Set(["colspan", "rowspan", "scope"]),
  td: new Set(["colspan", "rowspan"]),
  details: new Set(["open"]),
};

const BLOCKED_CONTAINER_TAGS =
  /<(script|style|iframe|object|embed|applet|form|input|button|select|textarea|meta|link|base|svg|math|template|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;

const BLOCKED_STANDALONE_TAGS =
  /<\/?(script|style|iframe|object|embed|applet|form|input|button|select|textarea|meta|link|base|svg|math|template|noscript)\b[^>]*\/?>/gi;

function isSafeUrl(url: string, allowRelative = true): boolean {
  const decoded = url
    .replace(/&#x([0-9a-f]+);?/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);?/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)))
    .replace(/[\u0000-\u0020]+/g, "")
    .trim();

  if (!decoded) return false;
  if (allowRelative && (decoded.startsWith("/") || decoded.startsWith("#"))) {
    return !decoded.startsWith("//");
  }

  try {
    const parsed = new URL(decoded);
    return (
      parsed.protocol === "https:" ||
      parsed.protocol === "http:" ||
      parsed.protocol === "mailto:" ||
      parsed.protocol === "tel:"
    );
  } catch {
    return false;
  }
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function sanitizeAttributes(tag: string, rawAttrs: string): string {
  const allowedForTag = TAG_ATTRS[tag];
  const attrRegex = /([a-zA-Z0-9_-]+)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  const safePairs: string[] = [];
  let hasTargetBlank = false;

  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(rawAttrs)) !== null) {
    const attrName = match[1].toLowerCase();
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";

    if (attrName.startsWith("on") || attrName === "style" || attrName === "srcdoc") {
      continue;
    }

    const isAllowed =
      GLOBAL_ATTRS.has(attrName) || Boolean(allowedForTag && allowedForTag.has(attrName));
    if (!isAllowed) continue;

    if (attrName === "href") {
      if (!isSafeUrl(rawValue, true)) continue;
      safePairs.push(`href="${escapeAttr(rawValue.trim())}"`);
      continue;
    }

    if (attrName === "src") {
      if (!isSafeUrl(rawValue, true)) continue;
      safePairs.push(`src="${escapeAttr(rawValue.trim())}"`);
      continue;
    }

    if (attrName === "target") {
      const target = rawValue.trim().toLowerCase();
      if (target === "_blank") {
        hasTargetBlank = true;
        safePairs.push('target="_blank"');
      }
      continue;
    }

    if (attrName === "rel") {
      continue;
    }

    if (attrName === "width" || attrName === "height" || attrName === "colspan" || attrName === "rowspan") {
      const num = parseInt(rawValue, 10);
      if (Number.isFinite(num) && num > 0 && num <= 4000) {
        safePairs.push(`${attrName}="${num}"`);
      }
      continue;
    }

    safePairs.push(`${attrName}="${escapeAttr(rawValue)}"`);
  }

  if (tag === "a" && hasTargetBlank) {
    safePairs.push('rel="noopener noreferrer nofollow"');
  }

  return safePairs.length > 0 ? " " + safePairs.join(" ") : "";
}

export function sanitizeHtml(input: unknown, maxLength = 20_000): string {
  if (typeof input !== "string" || !input.trim()) return "";

  let cleaned = input.slice(0, maxLength);

  // Remove HTML comments
  cleaned = cleaned.replace(/<!--[\s\S]*?-->/g, "");

  // Remove dangerous container blocks together with their inner content (loop for nested tricks)
  let prev: string;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(BLOCKED_CONTAINER_TAGS, "");
  } while (cleaned !== prev);

  cleaned = cleaned.replace(BLOCKED_STANDALONE_TAGS, "");

  // Sanitize remaining tags against the strict allowlist
  cleaned = cleaned.replace(/<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g, (full, rawTag: string, rawAttrs: string) => {
    const tag = rawTag.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return "";
    }

    const isClosing = full.startsWith("</");
    if (isClosing) {
      return VOID_TAGS.has(tag) ? "" : `</${tag}>`;
    }

    const attrs = sanitizeAttributes(tag, rawAttrs);
    return VOID_TAGS.has(tag) ? `<${tag}${attrs} />` : `<${tag}${attrs}>`;
  });

  return cleaned.trim();
}
