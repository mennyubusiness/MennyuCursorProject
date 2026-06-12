export function buildDirectionsUrl(address: string): string {
  const query = encodeURIComponent(address.trim());
  return `https://www.google.com/maps/search/?api=1&query=${query}`;
}

export function buildMailtoHref(email: string): string {
  return `mailto:${email.trim()}`;
}

export function buildTelHref(phone: string): string {
  return `tel:${phone.replace(/\s/g, "")}`;
}

export function formatInstagramHandle(urlOrHandle: string): string {
  return urlOrHandle
    .replace(/^@/, "")
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/$/, "");
}
