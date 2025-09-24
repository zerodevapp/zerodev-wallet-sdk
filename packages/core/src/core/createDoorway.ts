import type { LocalAccount } from "viem/accounts";
import { toViemAccount } from "../adapters/viem.js";
import {
  AuthClient,
  getStorageValue,
  removeStorageValue,
  type Session,
  SessionType,
  StorageKeys,
  storeSession,
} from "../utils/storage.js";
import {
  DEFAULT_IFRAME_CONTAINER_ID,
  DEFAULT_IFRAME_ELEMENT_ID,
  DEFAULT_SESSION_EXPIRATION_IN_SECONDS,
} from "../constants.js";
import { parseSession, normalizeTimestamp } from "../utils/utils.js";
import { createIframeStamper } from "../stampers/iframeStamper.js";
import { createIndexedDbStamper } from "../stampers/indexedDbStamper.js";
import { createClient, doorwayTransport, type DoorwayClient } from "../client/createClient.js";
import type { IframeStamper } from "../stampers/types.js";
import type { EmailCustomization } from "../actions/auth/index.js";
export interface DoorwayConfig {
  organizationId?: string;
  proxyBaseUrl?: string;
  iframeUrl?: string;
  iframeContainer?: HTMLElement | null;
  iframeElementId?: string;
  projectId: string;
}

// Re-export EmailCustomization for convenience
export type { EmailCustomization } from "../actions/auth/index.js";

export type AuthParams =
  | {
      type: "email";
      email: string;
      emailCustomization?: EmailCustomization;
    }
  | {
      type: "email";
      bundle: string;
    }
  | {
      type: "oauth";
      provider: string;
      redirectUrl?: string;
      credential: string;
    };

export interface DoorwaySDK {
  client: DoorwayClient | null;
  auth: (params: AuthParams) => Promise<any>;

  getPublicKeys: () => Promise<{
    publicKey: string | null;
    compressedPublicKey: string | null;
  }>;

  getSession: () => Promise<Session | undefined>;

  logout: () => Promise<boolean>;

  toAccount: () => Promise<LocalAccount>;
}

export async function createDoorway(
  config: DoorwayConfig
): Promise<DoorwaySDK> {
  const { projectId } = config;

  const iframeStamper = await createIframeStamper({
    iframeContainer:
      config.iframeContainer ||
      document.getElementById(DEFAULT_IFRAME_CONTAINER_ID),
    iframeUrl: config.iframeUrl || "https://auth.turnkey.com",
    iframeElementId: config.iframeElementId || DEFAULT_IFRAME_ELEMENT_ID,
  });

  const indexedDbStamper = await createIndexedDbStamper();

  let currentClient: DoorwayClient | null = null;

  let authIframeClient = createClient({
    stamper: iframeStamper,
    transport: doorwayTransport({
      baseUrl: config.proxyBaseUrl || "http://localhost:3001/api/v1",
    }),
  });

  let indexedDbClient = createClient({
    stamper: indexedDbStamper,
    transport: doorwayTransport({
      baseUrl: config.proxyBaseUrl || "http://localhost:3001/api/v1",
    }),
  });

  const session = await getStorageValue(StorageKeys.Session);
  console.log("session", session);
  const authClient = await getStorageValue(StorageKeys.Client);
  console.log("authClient", authClient);

  if (session && authClient) {
    switch (authClient) {
      case AuthClient.Iframe:
        if (typeof session === "object") {
          let expiry = normalizeTimestamp(session.expiry) || 0;
          if (expiry > Date.now() && session.token) {
            try {
              await (
                authIframeClient.stamper as IframeStamper
              ).injectCredentialBundle(session.token);
              currentClient = authIframeClient;
            } catch (error) {
              console.error("Failed to inject credential bundle:", error);
            }
          }
        }
        break;
      case AuthClient.IndexedDb:
        if (typeof session === "string") {
          let _session = parseSession(session);
          let expiry = normalizeTimestamp(_session.expiry) || 0;
          if (expiry > Date.now() && _session.token) {
            currentClient = indexedDbClient;
          }
        }
        break;
      default:
        break;
    }
  }

  const getSession = async () => {
    const currentSession = await getStorageValue(StorageKeys.Session);
    let session;
    if (typeof currentSession === "string") {
      session = parseSession(currentSession);
    } else {
      session = currentSession;
    }
    if (session && normalizeTimestamp(session.expiry) > Date.now()) {
      return session;
    }
    await removeStorageValue(StorageKeys.Session);
    return undefined;
  };

  const logout = async () => {
    await removeStorageValue(StorageKeys.Client);
    await removeStorageValue(StorageKeys.Session);
    return true;
  };

  return {
    client: currentClient,
    async getPublicKeys() {
      const publicKey = await iframeStamper.getPublicKey();
      const compressedPublicKey = await indexedDbStamper.getPublicKey();
      return {
        publicKey,
        compressedPublicKey,
      };
    },
    async auth(params: AuthParams) {
      switch (params.type) {
        case "email": {
          const { type } = params;

          if (type === "email" && "email" in params) {
            const { email, emailCustomization } = params;

            const targetPublicKey =
              await authIframeClient.stamper.getPublicKey();

            if (!targetPublicKey) {
              throw new Error("Failed to get public key");
            }

            const data = await authIframeClient.authenticateWithEmail({
              email,
              ...(emailCustomization && { emailCustomization }),
              targetPublicKey,
              projectId,
            });

            return data;
          } else if ("bundle" in params) {
            const { bundle } = params;
            await (
              authIframeClient.stamper as IframeStamper
            ).injectCredentialBundle(bundle);

            const whoAmI = await authIframeClient.getWhoami({
              organizationId: config.organizationId || "",
              projectId,
            });
            console.log({ whoAmI });
            const session: Session = {
              sessionType: SessionType.READ_WRITE,
              userId: whoAmI.userId,
              organizationId: whoAmI.organizationId,
              expiry:
                Date.now() +
                Number(DEFAULT_SESSION_EXPIRATION_IN_SECONDS) * 1000,
              token: bundle,
            };
            await storeSession(session, AuthClient.Iframe);
            currentClient = authIframeClient;
            return whoAmI;
          }
          throw new Error("Email authentication requires either email or bundle parameter");
        }
        case "oauth": {
          const { credential } = params;
          const targetPublicKey = await indexedDbStamper.getPublicKey();
          console.log("compressedPublicKey in sdk", targetPublicKey);

          if (!targetPublicKey) {
            throw new Error("Failed to get public key");
          }

          const data = await indexedDbClient.authenticateWithOAuth({
            oidcToken: credential,
            provider: "google",
            targetPublicKey,
            projectId,
          });

          console.log("data.turnkeySession", data.turnkeySession);
          if (data.turnkeySession) {
            await storeSession(data.turnkeySession, AuthClient.IndexedDb);
          }
          currentClient = indexedDbClient;
          return data;
        }
        default:
          throw new Error(`Unknown auth type: ${(params as any).type}`);
      }
    },

    getSession,

    logout,

    async toAccount(): Promise<LocalAccount> {
      const session = await getSession();
      if (!session) {
        throw new Error("No active session");
      }
      console.log("session", session);
      if (!currentClient) {
        throw new Error("No client");
      }
      console.log("currentCLient", currentClient);

      return toViemAccount({
        client: currentClient,
        organizationId: session.organizationId,
        projectId,
      });
    },
  };
}
