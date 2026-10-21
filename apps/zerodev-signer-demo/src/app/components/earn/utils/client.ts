import { createEarnClient } from "@zerodev/earn";

/**
 * Shared Earn client. The server authenticates by project id, so this can be a
 * separate ZeroDev project from the wallet's when the Earn allowlist differs.
 * `serverUrl` left blank means ZeroDev's hosted server.
 */
export const earn = createEarnClient({
  projectId:
    process.env.NEXT_PUBLIC_EARN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_ZERODEV_PROJECT_ID ||
    "",
  serverUrl: process.env.NEXT_PUBLIC_EARN_SERVER_URL,
});
