/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import type { ComponentProps } from 'react';
import { ReaderPage } from '@/features/reader/viewer/components/ReaderPage.tsx';
import { OcrOverlay } from '@/features/reader/overlay/ocr/OcrOverlay.tsx';
import { OcrRegionSelector } from '@/features/reader/overlay/ocr/OcrRegionSelector.tsx';
import { useInViewport } from '@/features/ocr/useInViewport.ts';
import { useReaderOcrStore } from '@/features/reader/stores/ReaderStore.ts';
import { useOcrStore } from '@/features/ocr/OcrStore.ts';

export type OcrPageWrapperProps = Omit<ComponentProps<typeof ReaderPage>, 'setRef'> & {
    setRef?: ComponentProps<typeof ReaderPage>['setRef'];
    mangaId?: string;
    chapterId?: string;
    rootMargin?: string;
};

const OcrPageWrapperBase = ({
    pageIndex,
    mangaId,
    chapterId,
    setRef,
    src,
    rootMargin = '400px 0px',
    ...rest
}: OcrPageWrapperProps) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [imageEl, setImageEl] = useState<HTMLElement | null>(null);
    const isVisible = useReaderOcrStore((state) => state.isVisible);
    const isManualRegionMode = useReaderOcrStore((state) => state.isManualRegionMode);
    const ocrEnabled = useOcrStore((state) => state.settings.enabled);

    const handleSetRef = useCallback(
        (pagesIndex: number, ref: HTMLElement | null) => {
            setImageEl(ref);
            setRef?.(pagesIndex, ref);
        },
        [setRef],
    );

    const inViewport = useInViewport(wrapperRef.current, { rootMargin });

    return (
        <Box
            ref={wrapperRef}
            sx={{
                position: 'relative',
                display: 'inline-block',
                flex: '0 0 auto',
                maxWidth: '100%',
                verticalAlign: 'top',
                lineHeight: 0,
            }}
        >
            <ReaderPage {...rest} src={src} pageIndex={pageIndex} setRef={handleSetRef} />
            <OcrOverlay
                mangaId={mangaId}
                chapterId={chapterId}
                pageIndex={pageIndex}
                pageUrl={src}
                imageRef={imageEl}
                inViewport={inViewport}
            />
            {ocrEnabled && isVisible && isManualRegionMode && (
                <OcrRegionSelector
                    pageUrl={src}
                    mangaId={mangaId}
                    chapterId={chapterId}
                    pageIndex={pageIndex}
                    containerRef={wrapperRef}
                />
            )}
        </Box>
    );
};

export const OcrPageWrapper = memo(OcrPageWrapperBase);
