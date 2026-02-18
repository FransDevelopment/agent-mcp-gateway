/**
 * Minimal Chrome Extension API type declarations.
 * Covers only the APIs used by agent-gateway.
 * Replace with @types/chrome when npm registry is available.
 */

declare namespace chrome {
  namespace runtime {
    function sendMessage(message: any): Promise<any>;
    function sendMessage(extensionId: string, message: any): Promise<any>;

    const onMessage: {
      addListener(
        callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void
      ): void;
    };

    const onMessageExternal: {
      addListener(
        callback: (message: any, sender: MessageSender, sendResponse: (response?: any) => void) => boolean | void
      ): void;
    };

    const onInstalled: {
      addListener(callback: (details: { reason: 'install' | 'update' | 'chrome_update' }) => void): void;
    };

    interface MessageSender {
      tab?: tabs.Tab;
      url?: string;
      id?: string;
    }
  }

  namespace tabs {
    interface Tab {
      id?: number;
      url?: string;
      title?: string;
    }

    function sendMessage(tabId: number, message: any): Promise<any>;

    const onRemoved: {
      addListener(callback: (tabId: number, removeInfo: { windowId: number }) => void): void;
    };

    const onUpdated: {
      addListener(
        callback: (tabId: number, changeInfo: { url?: string; status?: string }, tab: Tab) => void
      ): void;
    };
  }

  namespace storage {
    interface StorageArea {
      get(keys: string | string[]): Promise<Record<string, unknown>>;
      set(items: Record<string, unknown>): Promise<void>;
    }

    const local: StorageArea;
    const sync: StorageArea;
  }
}

// CSS.escape
interface CSS {
  escape(value: string): string;
}
