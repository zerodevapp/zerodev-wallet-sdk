// Clears all locally-stored ZeroDev/Turnkey wallet session state: localStorage,
// sessionStorage, and the Turnkey/ZeroDev IndexedDB databases. Used to recover
// from a stale/stuck session that never finishes reconnecting (the session
// lives in IndexedDB, so clearing localStorage alone is not enough).

async function deleteZeroDevIndexedDbState() {
  if (typeof indexedDB === "undefined") return;

  const indexedDbWithDatabases = indexedDB as IDBFactory & {
    databases?: () => Promise<Array<{ name?: string }>>;
  };
  const databases = await indexedDbWithDatabases.databases?.();
  if (!databases) return;

  await Promise.all(
    databases
      .map((database) => database.name)
      .filter((name): name is string => {
        if (!name) return false;
        const normalized = name.toLowerCase();
        return normalized.includes("turnkey") || normalized.includes("zerodev");
      })
      .map(
        (name) =>
          new Promise<void>((resolve) => {
            const request = indexedDB.deleteDatabase(name);
            request.onsuccess = () => resolve();
            request.onerror = () => resolve();
            request.onblocked = () => resolve();
          }),
      ),
  );
}

export async function clearWalletBrowserState() {
  if (typeof window === "undefined") return;

  const storedSessionKeys = JSON.parse(
    localStorage.getItem("@zerodev/sessions") || "[]",
  ) as unknown;

  const keysToRemove = [
    "zerodev-wallet",
    "zerodev:auth:otpSession",
    "@zerodev/active_session",
    "@zerodev/sessions",
    "wagmi.store",
    "wagmi.recentConnectorId",
    "wagmi.connected",
  ];

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }

  if (Array.isArray(storedSessionKeys)) {
    for (const key of storedSessionKeys) {
      if (typeof key === "string") localStorage.removeItem(key);
    }
  }

  await deleteZeroDevIndexedDbState();
}
