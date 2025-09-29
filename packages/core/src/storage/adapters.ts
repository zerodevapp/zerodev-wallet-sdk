import WindowWrapper from "../polyfills/window.js";
import type { StorageAdapter } from "./manager.js";

export function createWebStorageAdapter(storage: Storage = WindowWrapper.localStorage): StorageAdapter {
  return {
    getItem(key: string): string | null {
      return storage.getItem(key);
    },

    setItem(key: string, value: string): void {
      storage.setItem(key, value);
    },

    removeItem(key: string): void {
      storage.removeItem(key);
    }
  };
}
