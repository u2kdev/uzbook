let memoryStore: Record<string, string> = {};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let secureStoreModule: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  secureStoreModule = require("expo-secure-store");
} catch {
  secureStoreModule = null;
}

export const Storage = {
  async getItem(key: string): Promise<string | null> {
    try {
      if (secureStoreModule?.getItemAsync) {
        return await secureStoreModule.getItemAsync(key);
      }
    } catch {
      // Fallback
    }
    return memoryStore[key] ?? null;
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      if (secureStoreModule?.setItemAsync) {
        await secureStoreModule.setItemAsync(key, value);
        return;
      }
    } catch {
      // Fallback
    }
    memoryStore[key] = value;
  },

  async deleteItem(key: string): Promise<void> {
    try {
      if (secureStoreModule?.deleteItemAsync) {
        await secureStoreModule.deleteItemAsync(key);
        return;
      }
    } catch {
      // Fallback
    }
    delete memoryStore[key];
  },

  clearMemory(): void {
    memoryStore = {};
  },
};
