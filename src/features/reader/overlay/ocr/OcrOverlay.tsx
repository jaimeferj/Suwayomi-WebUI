/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { memo, useCallback, useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import { useLingui } from '@lingui/react/macro';
import { useReaderChaptersStore, useReaderOcrStore, useReaderStore } from '@/features/reader/stores/ReaderStore.ts';
import { OcrTextBox } from '@/features/ocr/OcrTextBox.tsx';
import { AnkiCardDialog } from '@/features/ocr/AnkiCardDialog.tsx';
import { AiExplainDialog } from '@/features/ocr/AiExplainDialog.tsx';
import { useOcrStore, pageKey } from '@/features/ocr/OcrStore.ts';
import { bboxKey } from '@/features/ocr/BBox.utils.ts';
import type { OcrLine } from '@/features/ocr/Ocr.types.ts';
import type { AiLearningAction, AiLearningContext } from '@/features/ocr/AiApi.ts';

export interface OcrOverlayProps {
    mangaId?: string;
    chapterId?: string;
    pageIndex: number;
    pageUrl: string;
    imageRef: HTMLElement | null;
    inViewport?: boolean;
}

const OcrOverlayBase = ({ mangaId, chapterId, pageIndex, pageUrl, imageRef, inViewport = true }: OcrOverlayProps) => {
    const { t } = useLingui();
    const isVisible = useReaderOcrStore((state) => state.isVisible);
    const redoKey = useReaderOcrStore((state) => state.redoPageKey);
    const settings = useOcrStore((state) => state.settings);
    const ensurePage = useOcrStore((state) => state.ensurePage);
    const redoPage = useOcrStore((state) => state.redoPage);
    const api = useOcrStore((state) => state.api);
    const key = pageKey(mangaId, chapterId, pageIndex);

    const pageState = useOcrStore((state) => state.pages[key]);
    const lines: OcrLine[] | undefined = pageState?.result?.lines;

    const overlayActive = isVisible && settings.enabled;
    const fetchEnabled = overlayActive && inViewport;
    const lastRedoKey = useRef(redoKey);

    const { currentChapter } = useReaderChaptersStore();
    const { manga } = useReaderStore();
    const mangaTitle = manga?.title;
    const chapterTitle = currentChapter?.name;

    const [ankiLine, setAnkiLine] = useState<OcrLine | null>(null);
    const [learningRequest, setLearningRequest] = useState<{
        line: OcrLine;
        action: AiLearningAction;
        context: AiLearningContext;
    } | null>(null);

    useEffect(() => {
        if (!fetchEnabled) {
            return;
        }
        if (lastRedoKey.current !== redoKey) {
            lastRedoKey.current = redoKey;
            const loader = () =>
                api.ocrPage({
                    image_url: pageUrl,
                    manga_id: mangaId,
                    chapter_id: chapterId,
                    page_index: pageIndex,
                    language: settings.language,
                    force: true,
                });
            void redoPage(key, loader);
            return;
        }
        if (!pageState || pageState.status === 'idle') {
            const loader = () =>
                api.ocrPage({
                    image_url: pageUrl,
                    manga_id: mangaId,
                    chapter_id: chapterId,
                    page_index: pageIndex,
                    language: settings.language,
                });
            void ensurePage(key, loader);
        }
    }, [
        fetchEnabled,
        key,
        pageState,
        redoKey,
        api,
        pageUrl,
        mangaId,
        chapterId,
        pageIndex,
        settings.language,
        ensurePage,
        redoPage,
    ]);

    const handleAnkiClose = useCallback(() => setAnkiLine(null), []);
    const handleExplainClose = useCallback(() => setLearningRequest(null), []);

    if (!overlayActive) {
        return (
            <>
                <AnkiCardDialog
                    open={false}
                    onClose={handleAnkiClose}
                    initialText=""
                    mangaTitle={mangaTitle}
                    chapterTitle={chapterTitle}
                    pageIndex={pageIndex}
                />
                <AiExplainDialog
                    open={false}
                    text=""
                    action="translate"
                    onActionChange={() => undefined}
                    onClose={handleExplainClose}
                />
            </>
        );
    }

    const imageRect = imageRef ? imageRef.getBoundingClientRect() : null;
    const wrapperEl = imageRef?.parentElement;
    const wrapperRect = wrapperEl ? wrapperEl.getBoundingClientRect() : null;
    const offsetLeft = imageRect && wrapperRect ? imageRect.left - wrapperRect.left : 0;
    const offsetTop = imageRect && wrapperRect ? imageRect.top - wrapperRect.top : 0;
    const containerWidth = imageRect?.width ?? 0;
    const containerHeight = imageRect?.height ?? 0;

    return (
        <>
            <Box
                sx={{
                    position: 'absolute',
                    left: offsetLeft,
                    top: offsetTop,
                    width: containerWidth,
                    height: containerHeight,
                    pointerEvents: 'none',
                    zIndex: 2,
                }}
                data-ocr-overlay=""
                data-in-viewport={inViewport ? 'true' : 'false'}
            >
                {(lines ?? []).map((line, lineIndex, pageLines) => (
                    <OcrTextBox
                        key={`${key}-${bboxKey(line.tightBoundingBox)}`}
                        line={line}
                        containerWidth={containerWidth}
                        containerHeight={containerHeight}
                        showOnHover={settings.showOnHover}
                        ankiEnabled={settings.ankiEnabled}
                        aiEnabled={settings.aiEnabled}
                        onCreateAnkiCard={settings.ankiEnabled ? () => setAnkiLine(line) : undefined}
                        onLearn={
                            settings.aiEnabled
                                ? (action) =>
                                      setLearningRequest({
                                          line,
                                          action,
                                          context: {
                                              previous_line: pageLines[lineIndex - 1]?.text,
                                              next_line: pageLines[lineIndex + 1]?.text,
                                          },
                                      })
                                : undefined
                        }
                    />
                ))}
                {pageState?.status === 'loading' && (
                    <Box
                        sx={{ position: 'absolute', top: 8, right: 8, color: 'common.white' }}
                    >{t`Recognising text…`}</Box>
                )}
                {pageState?.status === 'error' && (
                    <Box sx={{ position: 'absolute', top: 8, right: 8, color: 'error.main' }}>
                        {pageState.error ?? t`OCR error`}
                    </Box>
                )}
            </Box>
            <AnkiCardDialog
                open={ankiLine !== null}
                onClose={handleAnkiClose}
                initialText={ankiLine?.text ?? ''}
                mangaTitle={mangaTitle}
                chapterTitle={chapterTitle}
                pageIndex={pageIndex}
            />
            <AiExplainDialog
                open={learningRequest !== null}
                text={learningRequest?.line.text ?? ''}
                action={learningRequest?.action ?? 'translate'}
                context={learningRequest?.context}
                onActionChange={(action) =>
                    setLearningRequest((request) => (request ? { ...request, action } : request))
                }
                onClose={handleExplainClose}
            />
        </>
    );
};

export const OcrOverlay = memo(OcrOverlayBase);
