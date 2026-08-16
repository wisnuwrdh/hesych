import "fake-indexeddb/auto";

// Minimal localStorage shim for the node test environment.
const store = new Map<string, string>();
const shim: Storage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => {
    store.set(k, String(v));
  },
  removeItem: (k: string) => {
    store.delete(k);
  },
  clear: () => store.clear(),
  key: (i: number) => Array.from(store.keys())[i] ?? null,
  get length() {
    return store.size;
  },
};
(globalThis as unknown as { localStorage: Storage }).localStorage = shim;