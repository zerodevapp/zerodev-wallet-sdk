
/** Base stamper that transport depends on */
export type Stamp = {
  stampHeaderName: string;
  stampHeaderValue: string;
};

export type Stamper = {
  /** retrieve public key compressed or otherwise as per the stamper */
  getPublicKey: () => Promise<string | null>;
  /** produce Turnkey header value for a given request body */
  stamp: (payload: string) => Promise<Stamp>;
  /** clear local state (embedded key, IDB keypair, etc.) */
  clear: () => Promise<void>;
};

export type IframeStamper = Stamper & {
  injectCredentialBundle(bundle: string): Promise<boolean>
};

export type IndexedDbStamper = Stamper;