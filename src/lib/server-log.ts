import "server-only";

import { randomUUID } from "node:crypto";

export function logServerError(operation: string, category: string) {
  const correlationId = randomUUID();
  console.error(JSON.stringify({ level: "error", operation, category, correlationId }));
  return correlationId;
}
