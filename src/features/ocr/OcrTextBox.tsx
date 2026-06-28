/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback, useMemo, useState } from 'react';
import AddCardOutlinedIcon from '@mui/icons-material/AddCardOutlined';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import SchoolOutlinedIcon from '@mui/icons-material/SchoolOutlined';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import type { OcrLine } from '@/features/ocr/Ocr.types';
import type { AiLearningAction } from '@/features/ocr/AiApi';
import { getOcrTextLayout } from '@/features/ocr/OcrLayout';

export interface OcrTextBoxProps {
    line: OcrLine;
    containerWidth: number;
    containerHeight: number;
    showOnHover: boolean;
    ankiEnabled: boolean;
    aiEnabled: boolean;
    onCreateAnkiCard?: () => void;
    onLearn?: (action: AiLearningAction) => void;
}

const OcrTextBoxBase = ({
    line,
    containerWidth,
    containerHeight,
    showOnHover,
    ankiEnabled,
    aiEnabled,
    onCreateAnkiCard,
    onLearn,
}: OcrTextBoxProps) => {
    const [hovered, setHovered] = useState(false);
    const revealed = showOnHover ? hovered : true;

    const handleCopy = useCallback(() => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            void navigator.clipboard.writeText(line.text);
        }
    }, [line.text]);

    const stopReaderNavigation = useCallback((event: React.SyntheticEvent) => {
        event.stopPropagation();
    }, []);

    const layout = getOcrTextLayout({
        text: line.text,
        box: {
            width: containerWidth * line.tightBoundingBox.width,
            height: containerHeight * line.tightBoundingBox.height,
        },
        forcedOrientation: line.forcedOrientation,
        sourceLines: line.sourceLines ?? null,
        blockFontSize: line.blockFontSize ?? line.fontSize ?? null,
        lineCoords: line.lineCoords ?? null,
    });

    const isVertical = layout.orientation === 'vertical';
    const columns = layout.columns ?? [{ text: line.text, gapBefore: 0 }];
    const columnKeys = useMemo(() => columns.map((col, idx) => `${idx}-${col.text}`), [columns]);

    return (
        <Tooltip title={line.text} placement="top" disableInteractive open={hovered}>
            <Box
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
                onClick={stopReaderNavigation}
                onPointerDown={stopReaderNavigation}
                sx={{
                    position: 'absolute',
                    left: `${line.tightBoundingBox.x * 100}%`,
                    top: `${line.tightBoundingBox.y * 100}%`,
                    width: `${line.tightBoundingBox.width * 100}%`,
                    height: `${line.tightBoundingBox.height * 100}%`,
                    color: revealed ? 'common.white' : 'transparent',
                    backgroundColor: revealed ? 'rgba(0,0,0,0.6)' : 'transparent',
                    border: revealed ? '1px solid rgba(255,255,255,0.4)' : '1px solid transparent',
                    pointerEvents: 'auto',
                    overflow: hovered ? 'visible' : 'hidden',
                    display: 'flex',
                    flexDirection: isVertical ? 'row-reverse' : 'column',
                    alignItems: isVertical ? 'stretch' : 'center',
                    justifyContent: isVertical ? 'center' : 'center',
                    paddingLeft: isVertical ? `${layout.sideMargin}px` : 0,
                    paddingRight: isVertical ? `${layout.sideMargin}px` : 0,
                    gap: isVertical ? `${layout.columnGap}px` : 0,
                }}
                data-ocr-text=""
                data-ocr-orientation={layout.orientation}
                data-ocr-columns={layout.columnCount}
                data-ocr-side-margin={layout.sideMargin}
                data-ocr-column-gap={layout.columnGap}
                data-reader-interactive="true"
            >
                {columns.map((col, idx) => (
                    <Box
                        key={columnKeys[idx] ?? col.text}
                        sx={{
                            writingMode: isVertical ? 'vertical-rl' : 'horizontal-tb',
                            textOrientation: 'upright',
                            fontSize: `${layout.fontSize}px`,
                            lineHeight: 1,
                            whiteSpace: 'pre',
                            width: isVertical ? `${layout.fontSize}px` : 'auto',
                            height: isVertical ? '100%' : 'auto',
                            flexShrink: 0,
                            flexGrow: 0,
                            flexBasis: 'auto',
                            display: 'inline-block',
                            overflow: 'hidden',
                        }}
                        data-ocr-column=""
                        data-ocr-column-text={col.text}
                    >
                        {col.text}
                    </Box>
                ))}
                {hovered && (
                    <Paper
                        elevation={8}
                        sx={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            transform: 'translateY(-100%)',
                            zIndex: 10,
                            borderRadius: 2,
                            overflow: 'hidden',
                        }}
                        data-testid="ocr-learning-toolbar"
                    >
                        <Stack direction="row" sx={{ p: 0.5, gap: 0.5 }}>
                            <Button
                                size="small"
                                startIcon={<ContentCopyOutlinedIcon />}
                                onClick={handleCopy}
                                sx={{ minHeight: 44 }}
                            >
                                Copy
                            </Button>
                            {ankiEnabled && (
                                <Button
                                    size="small"
                                    startIcon={<AddCardOutlinedIcon />}
                                    onClick={onCreateAnkiCard}
                                    disabled={!onCreateAnkiCard}
                                    sx={{ minHeight: 44 }}
                                >
                                    Anki
                                </Button>
                            )}
                            {aiEnabled && (
                                <Button
                                    size="small"
                                    variant="contained"
                                    startIcon={<SchoolOutlinedIcon />}
                                    onClick={() => onLearn?.('translate')}
                                    disabled={!onLearn}
                                    sx={{ minHeight: 44 }}
                                >
                                    Learn
                                </Button>
                            )}
                        </Stack>
                    </Paper>
                )}
            </Box>
        </Tooltip>
    );
};

export const OcrTextBox = memo(OcrTextBoxBase);
