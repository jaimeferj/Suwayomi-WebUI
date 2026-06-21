/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import type { SliceCreator } from '@/lib/zustand/Zustand.types.ts';

export interface ReaderOcrStoreSlice {
    ocr: {
        isVisible: boolean;
        isManualRegionMode: boolean;
        redoPageKey: number;
        setIsVisible: (visible: boolean) => void;
        toggleIsVisible: () => void;
        setIsManualRegionMode: (enabled: boolean) => void;
        requestRedo: () => void;
        reset: () => ReaderOcrStoreSlice;
    };
}

const DEFAULT_STATE = {
    isVisible: false,
    isManualRegionMode: false,
    redoPageKey: 0,
} satisfies Pick<ReaderOcrStoreSlice['ocr'], 'isVisible' | 'isManualRegionMode' | 'redoPageKey'>;

export const createReaderOcrStoreSlice = <T extends ReaderOcrStoreSlice>(
    ...[createActionName, set, get]: Parameters<SliceCreator<T>>
): ReaderOcrStoreSlice => ({
    ocr: {
        ...DEFAULT_STATE,
        setIsVisible: (visible) =>
            set(
                (draft) => {
                    draft.ocr.isVisible = visible;
                },
                undefined,
                createActionName('setIsVisible'),
            ),
        toggleIsVisible: () =>
            set(
                (draft) => {
                    draft.ocr.isVisible = !draft.ocr.isVisible;
                },
                undefined,
                createActionName('toggleIsVisible'),
            ),
        setIsManualRegionMode: (enabled) =>
            set(
                (draft) => {
                    draft.ocr.isManualRegionMode = enabled;
                },
                undefined,
                createActionName('setIsManualRegionMode'),
            ),
        requestRedo: () =>
            set(
                (draft) => {
                    draft.ocr.redoPageKey = draft.ocr.redoPageKey + 1;
                },
                undefined,
                createActionName('requestRedo'),
            ),
        reset: () => ({ ocr: { ...get().ocr, ...DEFAULT_STATE } }),
    },
});
