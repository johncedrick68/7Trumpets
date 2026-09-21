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

export function safeAdminRedirectPath(value: string | null | undefined, fallback = "/admin") {
  const path = safeRedirectPath(value, fallback);
  return path === "/admin" || path.startsWith("/admin/") ? path : fallback;
}

export function safeCustomerRedirectPath(value: string | null | undefined, fallback = "/account") {
  const path = safeRedirectPath(value, fallback);
  return path === "/admin" || path.startsWith("/admin/") || path.startsWith("/mfa/")
    ? fallback
    : path;
}
