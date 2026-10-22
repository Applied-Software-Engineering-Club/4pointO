export function getCanvasApiToken() {
  const token = process.env.CANVAS_API_TOKEN?.trim();

  if (!token) {
    throw new Error("Set CANVAS_API_TOKEN in .env to call the Canvas API.");
  }

  return token;
}
