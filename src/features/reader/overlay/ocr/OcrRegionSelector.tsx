/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { useCallback, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import { useLingui } from '@lingui/react/macro';
import { useOcrStore } from '@/features/ocr/OcrStore';
import { clampBBox } from '@/features/ocr/BBox.utils';
import type { BBox } from '@/features/ocr/BBox.utils';
import type { OcrRegionResult } from '@/features/ocr/Ocr.types';

export interface OcrRegionSelectorProps {
    pageUrl: string;
    mangaId?: string;
    chapterId?: string;
    pageIndex: number;
    containerRef: React.RefObject<HTMLDivElement | null>;
    disabled?: boolean;
}

interface DragState {
    startX: number;
    startY: number;
    x: number;
    y: number;
}

const MIN_REGION_SIZE = 0.02;

export const OcrRegionSelector = ({
    pageUrl,
    mangaId,
    chapterId,
    pageIndex,
    containerRef,
    disabled,
}: OcrRegionSelectorProps) => {
    const { t } = useLingui();
    const settings = useOcrStore((state) => state.settings);
    const api = useOcrStore((state) => state.api);
    const recognizeRegion = useOcrStore((state) => state.recognizeRegion);
    const [drag, setDrag] = useState<DragState | null>(null);
    const [result, setResult] = useState<OcrRegionResult | null>(null);
    const regionKey = useMemo(
        () => `region:${mangaId ?? '_'}:${chapterId ?? '_'}:${pageIndex}`,
        [mangaId, chapterId, pageIndex],
    );

    const handlePointerDown = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (disabled) {
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;
            setDrag({ startX: x, startY: y, x, y });
            setResult(null);
            (event.target as Element).setPointerCapture(event.pointerId);
        },
        [containerRef, disabled],
    );

    const handlePointerMove = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!drag) {
                return;
            }
            const rect = containerRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }
            const x = (event.clientX - rect.left) / rect.width;
            const y = (event.clientY - rect.top) / rect.height;
            setDrag({ ...drag, x, y });
        },
        [containerRef, drag],
    );

    const finishDrag = useCallback(
        async (finalDrag: DragState) => {
            const bbox: BBox = clampBBox({
                x: Math.min(finalDrag.startX, finalDrag.x),
                y: Math.min(finalDrag.startY, finalDrag.y),
                width: Math.abs(finalDrag.x - finalDrag.startX),
                height: Math.abs(finalDrag.y - finalDrag.startY),
            });
            if (bbox.width < MIN_REGION_SIZE || bbox.height < MIN_REGION_SIZE) {
                return;
            }
            const loader = () =>
                api.recognizeRegion({
                    image_url: pageUrl,
                    region: bbox,
                    language: settings.language,
                });
            await recognizeRegion(regionKey, loader);
            const state = useOcrStore.getState();
            setResult(state.regions[regionKey]?.result ?? null);
        },
        [api, pageUrl, settings.language, regionKey, recognizeRegion],
    );

    const handlePointerUp = useCallback(
        (event: React.PointerEvent<HTMLDivElement>) => {
            if (!drag) {
                return;
            }
            (event.target as Element).releasePointerCapture?.(event.pointerId);
            void finishDrag(drag);
            setDrag(null);
        },
        [drag, finishDrag],
    );

    if (disabled) {
        return null;
    }

    const previewBox =
        drag &&
        clampBBox({
            x: Math.min(drag.startX, drag.x),
            y: Math.min(drag.startY, drag.y),
            width: Math.abs(drag.x - drag.startX),
            height: Math.abs(drag.y - drag.startY),
        });

    return (
        <Box
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            sx={{
                position: 'absolute',
                inset: 0,
                cursor: 'crosshair',
                zIndex: 3,
                pointerEvents: 'auto',
                backgroundColor: 'transparent',
            }}
            data-ocr-region-selector=""
        >
            {previewBox && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: `${previewBox.x * 100}%`,
                        top: `${previewBox.y * 100}%`,
                        width: `${previewBox.width * 100}%`,
                        height: `${previewBox.height * 100}%`,
                        border: '2px dashed rgba(255,255,255,0.9)',
                        backgroundColor: 'rgba(255,255,255,0.1)',
                    }}
                />
            )}
            {result && (
                <Box
                    sx={{
                        position: 'absolute',
                        left: `${result.tightBoundingBox.x * 100}%`,
                        top: `${(result.tightBoundingBox.y + result.tightBoundingBox.height) * 100}%`,
                        transform: 'translateY(4px)',
                        maxWidth: `${result.tightBoundingBox.width * 100}%`,
                        backgroundColor: 'background.paper',
                        color: 'text.primary',
                        p: 1,
                        borderRadius: 1,
                        boxShadow: 2,
                        typography: 'body2',
                        whiteSpace: 'pre-wrap',
                    }}
                    onClick={() => setResult(null)}
                >
                    {result.text || t`No text recognised`}
                </Box>
            )}
        </Box>
    );
};
