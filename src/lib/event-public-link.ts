export function eventTitleSlug(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);

  return slug || "event";
}

export function eventPublicPath(id: number, title: string) {
  return `/event/${eventTitleSlug(title)}-${id}`;
}

export function eventIdFromPublicSlug(slug: string) {
  const match = slug.match(/-(\d+)$/);
  if (!match) return null;

  const id = Number(match[1]);
  return Number.isInteger(id) && id > 0 ? id : null;
}
