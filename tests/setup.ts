// Global test setup

// ── localStorage stub for Node environment ────────────────────────────────────
// SaveService uses localStorage, which doesn't exist in Node.
// This minimal in-memory implementation satisfies the interface.
if (typeof localStorage === 'undefined') {
  const store: Record<string, string> = {};
  const localStorageStub = {
    getItem:    (k: string) => store[k] ?? null,
    setItem:    (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear:      () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i: number) => Object.keys(store)[i] ?? null,
  };
  Object.defineProperty(globalThis, 'localStorage', { value: localStorageStub });
}
