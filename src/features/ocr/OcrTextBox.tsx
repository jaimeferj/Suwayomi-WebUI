/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback, useState } from 'react';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import type { OcrLine } from '@/features/ocr/Ocr.types.ts';
import { getOcrTextLayout } from '@/features/ocr/OcrLayout.ts';

export interface OcrTextBoxProps {
    line: OcrLine;
    containerWidth: number;
    containerHeight: number;
}

const OcrTextBoxBase = ({ line, containerWidth, containerHeight }: OcrTextBoxProps) => {
    const [hovered, setHovered] = useState(false);

    const handleCopy = useCallback(() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(line.text);
        }
    }, [line.text]);

    const layout = getOcrTextLayout({
        text: line.text,
        box: {
            width: containerWidth * line.tightBoundingBox.width,
            height: containerHeight * line.tightBoundingBox.height,
        },
        forcedOrientation: line.forcedOrientation,
    });

    return (
        <Tooltip title={line.text} placement="top" disableInteractive open={hovered}>
            <Box
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={handleCopy}
                sx={{
                    position: 'absolute',
                    left: `${line.tightBoundingBox.x * 100}%`,
                    top: `${line.tightBoundingBox.y * 100}%`,
                    width: `${line.tightBoundingBox.width * 100}%`,
                    height: `${line.tightBoundingBox.height * 100}%`,
                    writingMode: layout.orientation === 'vertical' ? 'vertical-rl' : 'horizontal-tb',
                    fontSize: `${layout.fontSize}px`,
                    lineHeight: 1,
                    color: hovered ? 'common.white' : 'transparent',
                    backgroundColor: hovered ? 'rgba(0,0,0,0.6)' : 'transparent',
                    border: hovered ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                    cursor: 'pointer',
                    pointerEvents: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: layout.orientation === 'vertical' ? 'flex-start' : 'center',
                    userSelect: 'text',
                    overflow: 'hidden',
                    whiteSpace: 'pre',
                }}
                data-ocr-text=""
            >
                {line.text}
            </Box>
        </Tooltip>
    );
};

export const OcrTextBox = memo(OcrTextBoxBase);
