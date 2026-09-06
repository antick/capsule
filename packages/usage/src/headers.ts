import { USAGE_USER_AGENT } from "@capsule/config";

export function usageHeaders(
  headers: Record<string, string> = {},
): Record<string, string> {
  return {
    Accept: "application/json",
    "User-Agent": USAGE_USER_AGENT,
    ...headers,
  };
}
