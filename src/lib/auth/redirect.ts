const internalOrigin = "http://internal.local";

export function safeRedirectPath(value: string | null | undefined, fallback = "/account") {
  if (
    !value ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(value)
  ) {
    return fallback;
  }

  try {
    const url = new URL(value, internalOrigin);
    return url.origin === internalOrigin
      ? `${url.pathname}${url.search}${url.hash}`
      : fallback;
  } catch {
    return fallback;
  }
}
