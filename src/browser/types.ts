import type { CaptureBundle, CaptureCommand, CaptureImage } from "../types/capture.js";
import type { CaptureSession } from "../types/session.js";

export type BrowserTabSnapshot = {
  tabId: string;
  title: string;
  url?: string;
  browserName?: string;
  active: boolean;
  capturedAt: string;
  updatedAt: string;
  image: CaptureImage;
};

export type UpsertBrowserTabSnapshotInput = {
  tabId: string;
  title: string;
  url?: string;
  browserName?: string;
  active?: boolean;
  image: {
    mimeType?: "image/png";
    bytesBase64: string;
    width: number;
    height: number;
  };
  capturedAt?: string;
};

export type BrowserTabCandidate = {
  tabId: string;
  title: string;
  url?: string;
  browserName?: string;
  active: boolean;
  updatedAt: string;
  matchScore: number;
  matchReason: string;
};

export type BrowserTabResolution =
  | {
      status: "resolved";
      tab: BrowserTabSnapshot;
      candidateCount: number;
    }
  | {
      status: "ambiguous";
      query?: string;
      candidates: BrowserTabCandidate[];
    }
  | {
      status: "not_found";
      query?: string;
      candidates: BrowserTabCandidate[];
    };

export type SeeBrowserTabResult =
  | {
      status: "completed";
      sessionId: string;
      command: CaptureCommand;
      matchedTab: BrowserTabCandidate;
      captureSession: CaptureSession;
      result: CaptureBundle;
    }
  | {
      status: "ambiguous" | "not_found";
      command: CaptureCommand;
      query?: string;
      candidates: BrowserTabCandidate[];
      message: string;
    };
