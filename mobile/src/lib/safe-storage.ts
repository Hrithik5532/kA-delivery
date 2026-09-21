/**
 * Key-value storage with in-memory fallback when AsyncStorage native module
 * is unavailable (web, Expo Go edge cases, SSR).
 */
const memory = new Map<string, string>();

let asyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
} | null = null;

let asyncStorageChecked = false;

function getAsyncStorage() {
  if (asyncStorageChecked) return asyncStorage;
  asyncStorageChecked = true;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@react-native-async-storage/async-storage');
    const storage = mod?.default ?? mod;
    if (storage?.getItem && storage?.setItem) {
      asyncStorage = storage;
    }
  } catch {
    asyncStorage = null;
  }
  return asyncStorage;
}

export async function safeGetItem(key: string): Promise<string | null> {
  const storage = getAsyncStorage();
  if (!storage) return memory.get(key) ?? null;
  try {
    return await storage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

export async function safeSetItem(key: string, value: string): Promise<void> {
  const storage = getAsyncStorage();
  if (!storage) {
    memory.set(key, value);
    return;
  }
  try {
    await storage.setItem(key, value);
  } catch {
    memory.set(key, value);
  }
}

export async function safeRemoveItem(key: string): Promise<void> {
  const storage = getAsyncStorage();
  memory.delete(key);
  if (!storage) return;
  try {
    await storage.removeItem(key);
  } catch {
    // memory fallback already cleared
  }
}
