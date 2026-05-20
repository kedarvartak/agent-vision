import type { BrowserTabSnapshot, UpsertBrowserTabSnapshotInput } from "./types.js";

const nowIso = (): string => new Date().toISOString();

export class BrowserTabRegistry {
  private readonly tabs = new Map<string, BrowserTabSnapshot>();

  upsert(input: UpsertBrowserTabSnapshotInput): BrowserTabSnapshot {
    const timestamp = nowIso();
    const existing = this.tabs.get(input.tabId);
    const active = input.active ?? existing?.active ?? false;

    if (active) {
      for (const [tabId, tab] of this.tabs.entries()) {
        if (tabId !== input.tabId && tab.active) {
          this.tabs.set(tabId, {
            ...tab,
            active: false,
            updatedAt: timestamp
          });
        }
      }
    }

    const imageBuffer = Buffer.from(input.image.bytesBase64, "base64");
    const snapshot: BrowserTabSnapshot = {
      tabId: input.tabId,
      title: input.title,
      url: input.url,
      browserName: input.browserName,
      active,
      capturedAt: input.capturedAt ?? timestamp,
      updatedAt: timestamp,
      image: {
        mimeType: input.image.mimeType ?? "image/png",
        bytesBase64: input.image.bytesBase64,
        width: input.image.width,
        height: input.image.height,
        byteLength: imageBuffer.byteLength,
        sourceWidth: input.image.width,
        sourceHeight: input.image.height,
        backend: "browser-tab-snapshot",
        persisted: false
      }
    };

    this.tabs.set(input.tabId, snapshot);
    return snapshot;
  }

  remove(tabId: string): boolean {
    return this.tabs.delete(tabId);
  }

  get(tabId: string): BrowserTabSnapshot | undefined {
    return this.tabs.get(tabId);
  }

  list(): BrowserTabSnapshot[] {
    return [...this.tabs.values()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  }
}
