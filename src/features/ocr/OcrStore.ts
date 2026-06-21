/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { create } from 'zustand';

import { OcrApi } from '@/features/ocr/OcrApi';
import type { OcrLine, OcrPageResult, OcrRegionResult, OcrSettings, OcrStatus } from '@/features/ocr/Ocr.types';

export type PageKey = string;

export interface OcrPageState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    result?: OcrPageResult;
    error?: string;
}

export interface OcrRegionState {
    status: 'idle' | 'loading' | 'ready' | 'error';
    result?: OcrRegionResult;
    error?: string;
}

export interface OcrStoreState {
    settings: OcrSettings;
    api: OcrApi;
    status?: OcrStatus;
    pages: Record<PageKey, OcrPageState>;
    regions: Record<string, OcrRegionState>;
    setSettings: (patch: Partial<OcrSettings>) => void;
    refreshStatus: () => Promise<void>;
    ensurePage: (key: PageKey, loader: () => Promise<OcrPageResult>) => Promise<void>;
    redoPage: (key: PageKey, loader: () => Promise<OcrPageResult>) => Promise<void>;
    clearPage: (key: PageKey) => void;
    recognizeRegion: (key: string, loader: () => Promise<OcrRegionResult>) => Promise<void>;
    clearRegion: (key: string) => void;
    purgeCache: (mangaId?: string, chapterId?: string) => Promise<number>;
    linesFor: (key: PageKey) => OcrLine[] | undefined;
}

export const DEFAULT_SETTINGS: OcrSettings = {
    enabled: false,
    endpoint: 'http://127.0.0.1:8765',
    language: 'ja',
    showOnHover: true,
    autoDetect: true,
};

export const useOcrStore = create<OcrStoreState>((set, get) => {
    const initialSettings: OcrSettings = { ...DEFAULT_SETTINGS };
    const api = new OcrApi({ endpoint: initialSettings.endpoint });

    return {
        settings: initialSettings,
        api,
        pages: {},
        regions: {},
        setSettings: (patch) => {
            const merged = { ...get().settings, ...patch };
            set({ settings: merged, api: new OcrApi({ endpoint: merged.endpoint }) });
        },
        refreshStatus: async () => {
            try {
                const status = await api.status();
                set({ status });
            } catch (error) {
                set({
                    status: {
                        backend: get().settings.endpoint,
                        ready: false,
                        error: error instanceof Error ? error.message : String(error),
                        cache_entries: 0,
                    },
                });
            }
        },
        ensurePage: async (key, loader) => {
            const existing = get().pages[key];
            if (existing?.status === 'ready' || existing?.status === 'loading') {
                return;
            }
            set((prev) => ({ pages: { ...prev.pages, [key]: { status: 'loading' } } }));
            try {
                const result = await loader();
                set((prev) => ({ pages: { ...prev.pages, [key]: { status: 'ready', result } } }));
            } catch (error) {
                set((prev) => ({
                    pages: {
                        ...prev.pages,
                        [key]: {
                            status: 'error',
                            error: error instanceof Error ? error.message : String(error),
                        },
                    },
                }));
            }
        },
        redoPage: async (key, loader) => {
            set((prev) => ({ pages: { ...prev.pages, [key]: { status: 'loading' } } }));
            try {
                const result = await loader();
                set((prev) => ({ pages: { ...prev.pages, [key]: { status: 'ready', result } } }));
            } catch (error) {
                set((prev) => ({
                    pages: {
                        ...prev.pages,
                        [key]: {
                            status: 'error',
                            error: error instanceof Error ? error.message : String(error),
                        },
                    },
                }));
            }
        },
        clearPage: (key) => {
            const next = { ...get().pages };
            delete next[key];
            set({ pages: next });
        },
        recognizeRegion: async (key, loader) => {
            set((prev) => ({ regions: { ...prev.regions, [key]: { status: 'loading' } } }));
            try {
                const result = await loader();
                set((prev) => ({ regions: { ...prev.regions, [key]: { status: 'ready', result } } }));
            } catch (error) {
                set((prev) => ({
                    regions: {
                        ...prev.regions,
                        [key]: {
                            status: 'error',
                            error: error instanceof Error ? error.message : String(error),
                        },
                    },
                }));
            }
        },
        clearRegion: (key) => {
            const next = { ...get().regions };
            delete next[key];
            set({ regions: next });
        },
        purgeCache: async (mangaId, chapterId) => {
            const response = await get().api.purgeCache({ manga_id: mangaId, chapter_id: chapterId });
            return response.removed;
        },
        linesFor: (key) => get().pages[key]?.result?.lines,
    };
});

export function pageKey(mangaId: string | undefined, chapterId: string | undefined, pageIndex: number): PageKey {
    return `${mangaId ?? '_'}::${chapterId ?? '_'}::${pageIndex}`;
}
