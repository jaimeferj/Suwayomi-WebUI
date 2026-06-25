/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { createRoot } from 'react-dom/client';
import { useEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { I18nProvider } from '@lingui/react';
import { i18n } from '@lingui/core';
import { OcrOverlay } from '@/features/reader/overlay/ocr/OcrOverlay';
import { useOcrStore, pageKey } from '@/features/ocr/OcrStore';
import { getReaderStore } from '@/features/reader/stores/ReaderStore';

declare global {
    interface Window {
        __OCR_TEST__?: {
            ready: boolean;
            error?: string;
            lines: string[];
            lastRequest?: { imageUrl: string; payload: unknown };
            setVisible: (visible: boolean) => void;
            setEnabled: (enabled: boolean) => void;
            setEndpoint: (endpoint: string) => void;
            clearPages: () => void;
        };
    }
}

i18n.loadAndActivate({ locale: 'en', messages: {} });

const theme = createTheme({
    palette: { mode: 'dark' },
});

interface PageSpec {
    pageIndex: number;
    imageUrl: string;
    mockText: string;
    mockColumns?: string[];
    vertical?: boolean;
    box?: { x: number; y: number; width: number; height: number };
}

const PAGES: PageSpec[] = [
    {
        pageIndex: 0,
        imageUrl: '/fixtures/01.jpg',
        mockText: '立川で見た〝穴〟の下の巨大な眼は',
        vertical: true,
    },
    {
        pageIndex: 1,
        imageUrl: '/fixtures/02.jpg',
        mockText: '実戦剣術も一流です',
        vertical: true,
    },
    {
        pageIndex: 2,
        imageUrl: '/fixtures/01.jpg',
        mockText: '王は 誰だ？',
        mockColumns: ['王は', '誰だ？'],
        vertical: true,
        box: { x: 0.55, y: 0.1, width: 0.25, height: 0.8 },
    },
];

function mockLine(spec: PageSpec) {
    if (spec.vertical) {
        const box = spec.box ?? { x: 0.55, y: 0.1, width: 0.25, height: 0.8 };
        const sourceLines = spec.mockColumns ?? spec.mockText.split(/\s+/).filter(Boolean);
        return {
            text: spec.mockText,
            tightBoundingBox: box,
            forcedOrientation: 'vertical' as const,
            isMerged: false,
            sourceLines,
            blockFontSize: 24,
        };
    }
    const y = spec.pageIndex === 0 ? 0.15 : 0.2;
    return {
        text: spec.mockText,
        tightBoundingBox: { x: 0.1, y, width: 0.8, height: 0.18 },
        forcedOrientation: 'horizontal' as const,
        isMerged: false,
    };
}

const TestPage = ({ spec, onLines }: { spec: PageSpec; onLines: (texts: string[]) => void }) => {
    const wrapperRef = useRef<HTMLDivElement | null>(null);
    const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
    const [inViewport, setInViewport] = useState(false);
    const key = pageKey('test-manga', 'test-chapter', spec.pageIndex);
    const pageState = useOcrStore((state) => state.pages[key]);
    const lines = pageState?.result?.lines ?? [];
    const onLinesRef = useRef(onLines);
    onLinesRef.current = onLines;

    useEffect(() => {
        onLinesRef.current(lines.map((line) => line.text));
    }, [lines]);

    useEffect(() => {
        if (!wrapperRef.current) {
            return;
        }
        const el = wrapperRef.current;
        const observer = new IntersectionObserver((entries) => setInViewport(entries[0].isIntersecting), {
            rootMargin: '0px',
        });
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    return (
        <Box
            ref={wrapperRef}
            data-testid={`page-${spec.pageIndex}`}
            data-page-url={spec.imageUrl}
            sx={{ position: 'relative', display: 'inline-block', m: 2 }}
        >
            <img
                ref={setImageEl}
                src={spec.imageUrl}
                alt={`page-${spec.pageIndex}`}
                data-testid={`img-${spec.pageIndex}`}
                style={{ display: 'block', maxWidth: 480, height: 'auto' }}
                crossOrigin="anonymous"
            />
            {imageEl && (
                <OcrOverlay
                    mangaId="test-manga"
                    chapterId="test-chapter"
                    pageIndex={spec.pageIndex}
                    pageUrl={spec.imageUrl}
                    imageRef={imageEl}
                    inViewport={inViewport}
                />
            )}
        </Box>
    );
};

const TestHarness = () => {
    const linesRef = useRef<Record<number, string[]>>({});

    useEffect(() => {
        const realFetch = window.fetch.bind(window);
        const handleFetch: typeof window.fetch = async (input, init) => {
            let url: string;
            if (typeof input === 'string') {
                url = input;
            } else if (input instanceof URL) {
                url = input.toString();
            } else {
                ({ url } = input);
            }
            if (url.includes('/ocr/page') && init?.method === 'POST' && init.body) {
                const payload = JSON.parse(init.body as string) as { image_url?: string; page_index?: number };
                const pageIndex = payload.page_index ?? 0;
                const spec = PAGES[pageIndex];
                if (spec) {
                    window.__OCR_TEST__!.lastRequest = { imageUrl: payload.image_url ?? '', payload };
                    return new Response(
                        JSON.stringify({
                            img_width: 800,
                            img_height: 1200,
                            cached: false,
                            backend: 'mock',
                            lines: [mockLine(spec)],
                        }),
                        { status: 200, headers: { 'Content-Type': 'application/json' } },
                    );
                }
            }
            if (url.includes('/ocr/status')) {
                return new Response(JSON.stringify({ backend: 'mock', ready: true, error: null, cache_entries: 0 }), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
            return realFetch(input, init);
        };
        window.fetch = handleFetch;

        window.__OCR_TEST__ = {
            ready: false,
            lines: [],
            setVisible: (visible) => {
                getReaderStore().ocr.setIsVisible(visible);
            },
            setEnabled: (enabled) => {
                useOcrStore.getState().setSettings({ enabled });
            },
            setEndpoint: (endpoint) => {
                useOcrStore.getState().setSettings({ endpoint });
            },
            clearPages: () => {
                useOcrStore.setState({ pages: {} });
            },
        };

        return () => {
            window.fetch = realFetch;
        };
    }, []);

    const handleLines = (pageIndex: number, texts: string[]) => {
        const previous = linesRef.current[pageIndex];
        if (previous && previous.length === texts.length && previous.every((t, i) => t === texts[i])) {
            return;
        }
        linesRef.current[pageIndex] = texts;
        const flat = ([] as string[]).concat(...Object.values(linesRef.current));
        if (window.__OCR_TEST__) {
            window.__OCR_TEST__.lines = flat;
            window.__OCR_TEST__.ready = flat.length >= PAGES.length;
        }
    };

    return (
        <div data-testid="test-harness">
            {PAGES.map((spec) => (
                <TestPage key={spec.pageIndex} spec={spec} onLines={(texts) => handleLines(spec.pageIndex, texts)} />
            ))}
        </div>
    );
};

const container = document.getElementById('root')!;
const root = createRoot(container);
root.render(
    <I18nProvider i18n={i18n}>
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <TestHarness />
        </ThemeProvider>
    </I18nProvider>,
);
