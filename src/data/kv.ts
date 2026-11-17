// Almacén clave-valor mínimo que necesita la capa de acceso. En el teléfono lo implementa `expoKV.ts` sobre
// `expo-sqlite/kv-store`; en las pruebas, `memoryKV()`.

export interface KV {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getAllKeys(): string[];
}

/** Almacén en memoria para pruebas. `failOn` permite simular fallos de escritura en una clave. */
export function memoryKV(initial: [string, string][] = [], opts: { failOn?: (key: string) => boolean } = {}): KV & {
  dump(): [string, string][];
} {
  const m = new Map(initial);
  return {
    getItem: (k) => (m.has(k) ? m.get(k)! : null),
    setItem: (k, v) => {
      if (opts.failOn?.(k)) throw new Error(`fallo simulado al escribir ${k}`);
      m.set(k, v);
    },
    removeItem: (k) => {
      m.delete(k);
    },
    getAllKeys: () => [...m.keys()],
    dump: () => [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)),
  };
}
