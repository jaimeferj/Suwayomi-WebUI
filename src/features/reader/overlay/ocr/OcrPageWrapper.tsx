/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import type { ComponentProps } from 'react';
import { ReaderPage } from '@/features/reader/viewer/components/ReaderPage.tsx';
import { OcrOverlay } from '@/features/reader/overlay/ocr/OcrOverlay.tsx';

export type OcrPageWrapperProps = Omit<ComponentProps<typeof ReaderPage>, 'setRef'> & {
    setRef?: ComponentProps<typeof ReaderPage>['setRef'];
    mangaId?: string;
    chapterId?: string;
};

const OcrPageWrapperBase = ({ pageIndex, mangaId, chapterId, setRef, src, ...rest }: OcrPageWrapperProps) => {
    const [imageEl, setImageEl] = useState<HTMLElement | null>(null);

    const handleSetRef = useCallback(
        (pagesIndex: number, ref: HTMLElement | null) => {
            setImageEl(ref);
            setRef?.(pagesIndex, ref);
        },
        [setRef],
    );

    return (
        <Box
            sx={{
                position: 'relative',
                display: 'inline-block',
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
            />
        </Box>
    );
};

export const OcrPageWrapper = memo(OcrPageWrapperBase);
