import type { LocalAccount } from "viem/accounts";
import { toViemAccount } from "../adapters/viem.js";
import { IframeStamper } from "@turnkey/iframe-stamper";
import { IndexedDbStamper } from "@turnkey/indexed-db-stamper";
import {
  AuthClient,
  getStorageValue,
  removeStorageValue,
  type Session,
  SessionType,
  StorageKeys,
  storeSession,
} from "../utils/storage.js";
import { DEFAULT_IFRAME_CONTAINER_ID, DEFAULT_IFRAME_ELEMENT_ID, DEFAULT_ORGANIZATION_ID, DEFAULT_SESSION_EXPIRATION_IN_SECONDS } from "../constants.js";
import { parseSession, normalizeTimestamp } from "../utils/utils.js";
import { DoorwayClient } from "../client/DoorwayClient.js";

export interface DoorwayConfig {
  organizationId?: string;
  proxyBaseUrl?: string;
  iframeUrl?: string;
  iframeContainer?: HTMLElement | null;
  iframeElementId?: string;
  appId: string;
  apiKey: string;
}

export type EmailCustomization = {
  /** @description A template for the URL to be used in a magic link button, e.g. `https://dapp.xyz/%s`. The auth bundle will be interpolated into the `%s`. */
  magicLinkTemplate?: string;
}


export type AuthParams =
  | {
      type: "email";
      email: string;
      emailCustomization?: EmailCustomization
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
  const { appId, apiKey } = config;

  const iframeStamper = new IframeStamper({
    iframeContainer:
      config.iframeContainer ||
      document.getElementById(DEFAULT_IFRAME_CONTAINER_ID),
    iframeUrl: config.iframeUrl || "https://auth.turnkey.com",
    iframeElementId:
      config.iframeElementId || DEFAULT_IFRAME_ELEMENT_ID,
  });
  if (!iframeStamper.iframePublicKey) {
    await iframeStamper.init();
  }

  const indexedDbStamper = new IndexedDbStamper();
  await indexedDbStamper.init();

  let currentClient: DoorwayClient | null = null;

  let authIframeClient = new DoorwayClient(
    {
      proxyBaseUrl: config.proxyBaseUrl || "http://localhost:3001/api/v1",
      baseUrl: "https://api.turnkey.com",
    },
    iframeStamper
  );
  let indexedDbClient = new DoorwayClient(
    {
      proxyBaseUrl: config.proxyBaseUrl || "http://localhost:3001/api/v1",
      baseUrl: "https://api.turnkey.com",
    },
    indexedDbStamper
  );

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
          let _session = parseSession(session)
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
      const publicKey = await (
        authIframeClient.stamper as IframeStamper
      ).getEmbeddedPublicKey();
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

            const targetPublicKey = await (
              authIframeClient.stamper as IframeStamper
            ).getEmbeddedPublicKey();

            const data = await authIframeClient.requestProxy(
              "auth/email-magic",
              {
                email,
                emailCustomization,
                targetPublicKey,
                appId,
              },
              apiKey
            );

            return data;
          } else if ("bundle" in params) {
            const { bundle } = params;
            await (
              authIframeClient.stamper as IframeStamper
            ).injectCredentialBundle(bundle);

            const whoAmI = await authIframeClient.getWhoami({
              organizationId: config.organizationId || DEFAULT_ORGANIZATION_ID,
            });
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
          }
          break;
        }
        case "oauth": {
          const { credential } = params;
          const compressedPublicKey = await indexedDbStamper.getPublicKey();
          console.log("compressedPublicKey in sdk", compressedPublicKey);
          const data = await indexedDbClient.requestProxy(
            "auth/oauth",
            {
              oidcToken: credential,
              provider: "google",
              targetPublicKey: compressedPublicKey,
              appId,
            },
            apiKey
          );

          console.log("data.turnkeySession", data.turnkeySession);
          if (data.turnkeySession) {
            await storeSession(data.turnkeySession, AuthClient.IndexedDb);
          }
          currentClient = indexedDbClient;
          break;
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
      });
    },
  };
}
