export function isSjsuEmail(email: string) {
  const [local, domain, ...extra] = email.trim().split("@");
  return extra.length === 0 && Boolean(local) && domain?.toLowerCase() === "sjsu.edu";
}
