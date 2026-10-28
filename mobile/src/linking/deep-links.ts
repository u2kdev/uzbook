export type ParsedDeepLink =
  | { type: "salon"; slug: string }
  | { type: "booking"; token: string }
  | { type: "owner_today" }
  | { type: "unknown"; url: string };

export function parseDeepLink(url: string | null): ParsedDeepLink | null {
  if (!url) return null;

  try {
    const cleaned = url.replace(/^[a-zA-Z0-9]+:\/\//, "");
    const parts = cleaned.split("?")[0].split("/").filter(Boolean);

    if (parts[0] === "salon" && parts[1]) {
      return { type: "salon", slug: parts[1] };
    }
    if (parts[0] === "booking" && parts[1]) {
      return { type: "booking", token: parts[1] };
    }
    if (parts[0] === "b" && parts[1]) {
      return { type: "booking", token: parts[1] };
    }
    if (parts[0] === "owner" && parts[1] === "today") {
      return { type: "owner_today" };
    }

    return { type: "unknown", url };
  } catch {
    return { type: "unknown", url };
  }
}
