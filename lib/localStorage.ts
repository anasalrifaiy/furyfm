import AsyncStorage from '@react-native-async-storage/async-storage';

// The web screens use synchronous localStorage; keep an in-memory copy that is persisted to AsyncStorage
const PREFIX = 'furyfm:';
const cache: Record<string, string> = {};

export async function installLocalStorage(): Promise<void> {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    entries.forEach(([k, v]) => {
      if (v != null) cache[k.slice(PREFIX.length)] = v;
    });
  } catch {
    // start with an empty store
  }

  (globalThis as any).localStorage = {
    getItem: (k: string) => (k in cache ? cache[k] : null),
    setItem: (k: string, v: string) => {
      cache[k] = String(v);
      AsyncStorage.setItem(PREFIX + k, String(v)).catch(() => {});
    },
    removeItem: (k: string) => {
      delete cache[k];
      AsyncStorage.removeItem(PREFIX + k).catch(() => {});
    },
    clear: () => {
      Object.keys(cache).forEach((k) => {
        delete cache[k];
        AsyncStorage.removeItem(PREFIX + k).catch(() => {});
      });
    },
  };
}
