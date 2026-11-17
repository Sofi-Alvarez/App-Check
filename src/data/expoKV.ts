// Implementación del almacén sobre `expo-sqlite/kv-store`, el mismo que usa hoy la app. Usa solo las funciones
// síncronas que ya usa `store.ts` (verificadas en los tipos de expo-sqlite 58.0.15).

import Storage from 'expo-sqlite/kv-store';
import type { KV } from './kv';

export const expoKV: KV = {
  getItem: (k) => Storage.getItemSync(k),
  setItem: (k, v) => Storage.setItemSync(k, v),
  removeItem: (k) => {
    Storage.removeItemSync(k);
  },
  getAllKeys: () => Storage.getAllKeysSync(),
};
