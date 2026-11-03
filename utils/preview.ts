/** Preview is an explicit, development-only data boundary, never an auth session. */
export function isLocalPreview() {
  return process.env.NODE_ENV === "development" && process.env.LOCAL_DEMO_PREVIEW === "true";
}
