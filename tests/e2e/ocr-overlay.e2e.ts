/*
 * Copyright (C) Contributors to the Suwayomi project
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/.
 */

import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const expectedTexts = {
    page0: '立川で見た〝穴〟の下の巨大な眼は',
    page1: '実戦剣術も一流です',
    page2: '王は 誰だ？',
} as const;

const waitForHarness = async (page: Page) => {
    await page.waitForFunction(
        () =>
            typeof window.__OCR_TEST__ !== 'undefined' &&
            (window.__OCR_TEST__ as { ready?: boolean } | undefined)?.ready === true,
        undefined,
        { timeout: 30_000 },
    );
};

const scrollPageIntoView = async (page: Page, pageIndex: number) => {
    await page.evaluate((idx) => {
        const el = document.querySelector(`[data-testid="page-${idx}"]`);
        if (el) {
            el.scrollIntoView({ block: 'center', inline: 'center' });
        }
    }, pageIndex);
};

test.describe('OCR overlay in front of manga reader UI', () => {
    test('renders OCR text from /ocr/page requests on top of the manga page image', async ({ page }) => {
        await page.goto('/');

        // Wait for harness to register its bridge
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined, undefined, { timeout: 10_000 });

        // Enable OCR + show overlay
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8766');
            window.__OCR_TEST__!.setVisible(true);
        });

        // Allow OCR requests to complete
        await waitForHarness(page);

        const lines = await page.evaluate(() => window.__OCR_TEST__!.lines);
        expect(lines).toContain(expectedTexts.page0);
        expect(lines).toContain(expectedTexts.page1);

        const lastRequest = await page.evaluate(() => window.__OCR_TEST__!.lastRequest);
        expect(lastRequest?.payload).toMatchObject({
            manga_id: 'test-manga',
            chapter_id: 'test-chapter',
            page_index: expect.any(Number),
        });
        expect(lastRequest?.imageUrl).toMatch(/\/fixtures\/(01|02)\.jpg$/);

        // Verify that the OCR text is visible in the actual DOM (overlay in front of image)
        const overlayTexts = await page.locator('[data-ocr-text]').allTextContents();
        expect(overlayTexts.some((text) => text.includes(expectedTexts.page0))).toBe(true);
        expect(overlayTexts.some((text) => text.includes(expectedTexts.page1))).toBe(true);

        // Vertical text must be rendered as multiple inferred columns with vertical writing mode
        const verticalOrientations = await page.locator('[data-ocr-text][data-ocr-orientation="vertical"]').count();
        expect(verticalOrientations).toBeGreaterThan(0);
        const columnNodes = await page.locator('[data-ocr-column]').count();
        expect(columnNodes).toBeGreaterThan(0);

        // OCR overlay must render above the image (z-index > 0)
        const overlayZIndex = await page
            .locator('[data-ocr-overlay]')
            .first()
            .evaluate((node) => getComputedStyle(node).zIndex);
        expect(Number(overlayZIndex)).toBeGreaterThan(0);
    });

    test('renders whitespace-separated vertical columns right-to-left (王は on the right, 誰だ？ on the left)', async ({
        page,
    }) => {
        const page2Text = expectedTexts.page2;

        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.clearPages();
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8766');
            window.__OCR_TEST__!.setVisible(true);
        });

        // Bring the 王は page into the viewport so its overlay renders.
        await scrollPageIntoView(page, 2);

        // Wait until OCR for the 王は page has produced lines.
        await page.waitForFunction(
            (needle) => {
                const lines = window.__OCR_TEST__?.lines ?? [];
                return lines.some((text) => text.includes(needle));
            },
            page2Text,
            { timeout: 30_000 },
        );

        await page.waitForSelector('[data-testid="page-2"] [data-ocr-text]', { timeout: 10_000 });

        const pageLocator = page.locator('[data-testid="page-2"]');
        const textBox = pageLocator.locator('[data-ocr-text]').first();
        await expect(textBox).toBeVisible();
        await expect(textBox).toHaveAttribute('data-ocr-orientation', 'vertical');
        await expect(textBox).toHaveAttribute('data-ocr-columns', '2');

        const textBoxMetrics = await textBox.evaluate((node) => {
            const rect = node.getBoundingClientRect();
            const style = window.getComputedStyle(node);
            return {
                left: rect.left,
                right: rect.right,
                width: rect.width,
                paddingLeft: parseFloat(style.paddingLeft) || 0,
                paddingRight: parseFloat(style.paddingRight) || 0,
                columnGap: parseFloat(style.columnGap || style.gap) || 0,
            };
        });
        expect(textBoxMetrics.columnGap).toBeGreaterThan(0);
        expect(textBoxMetrics.paddingLeft).toBeGreaterThanOrEqual(0);
        expect(textBoxMetrics.paddingRight).toBeGreaterThanOrEqual(0);

        const columnBoxes = await pageLocator.locator('[data-ocr-column]').evaluateAll((nodes) =>
            nodes.map((node) => {
                const rect = node.getBoundingClientRect();
                return {
                    text: node.getAttribute('data-ocr-column-text') ?? '',
                    x: rect.x,
                    width: rect.width,
                };
            }),
        );

        expect(columnBoxes).toHaveLength(2);
        const rightColumn = columnBoxes.find((col) => col.text === '王は');
        const leftColumn = columnBoxes.find((col) => col.text === '誰だ？');
        expect(rightColumn).toBeDefined();
        expect(leftColumn).toBeDefined();
        expect(rightColumn!.x).toBeGreaterThan(leftColumn!.x);
        expect(leftColumn!.x).toBeGreaterThan(0);
        expect(rightColumn!.width).toBeGreaterThan(0);
        expect(leftColumn!.width).toBeGreaterThan(0);

        const separation = rightColumn!.x - (leftColumn!.x + leftColumn!.width);
        expect(separation).toBeGreaterThanOrEqual(textBoxMetrics.columnGap - 0.5);
        const leftPad = leftColumn!.x - textBoxMetrics.left;
        const rightPad = textBoxMetrics.right - (rightColumn!.x + rightColumn!.width);
        expect(leftPad).toBeCloseTo(textBoxMetrics.paddingLeft, 0);
        expect(rightPad).toBeCloseTo(textBoxMetrics.paddingRight, 0);
    });

    test('persists enabled/visible settings across reloads via localStorage', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
            window.__OCR_TEST__!.setEndpoint('http://example.test:9999');
        });

        await page.reload();
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        const persisted = await page.evaluate(() => {
            const raw = window.localStorage.getItem('ocr.settings.v1');
            return raw ? (JSON.parse(raw) as { enabled?: boolean; endpoint?: string }) : null;
        });

        expect(persisted?.enabled).toBe(true);
        expect(persisted?.endpoint).toBe('http://example.test:9999');
    });

    test('Download OCR menu item sends persist=true on /ocr/page', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8766');
            window.__OCR_TEST__!.setCurrentPage(1);
        });

        // Open the OCR menu and click "Download OCR for current page"
        await page.locator('[aria-label="OCR menu"]').first().click();
        await page.locator('[data-testid="ocr-download-page"]').click();

        // Wait for the persist request to land
        await page.waitForFunction(() => (window.__OCR_TEST__!.persistRequests?.length ?? 0) > 0, undefined, {
            timeout: 5_000,
        });

        const persistRequests = await page.evaluate(() => window.__OCR_TEST__!.persistRequests ?? []);
        expect(persistRequests).toHaveLength(1);
        const request = persistRequests[0]!;
        expect(request.imageUrl).toBe('/fixtures/02.jpg');
        expect(request.payload).toMatchObject({
            manga_id: '1',
            chapter_id: '100',
            page_index: 1,
            persist: true,
        });
    });

    test('AI learning controls do not trigger reader navigation', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);

        const textBox = page.locator('[data-ocr-text]').first();
        await textBox.hover();
        const toolbar = page.getByTestId('ocr-learning-toolbar').first();
        await expect(toolbar).toBeVisible();
        await expect(page.locator('.MuiTooltip-popper')).toHaveCount(0);
        const learnButton = toolbar.getByRole('button', { name: 'Learn' });
        const textBoxBounds = await textBox.boundingBox();
        const learnButtonBounds = await learnButton.boundingBox();
        expect(learnButtonBounds?.height).toBeGreaterThanOrEqual(44);
        expect(textBoxBounds).not.toBeNull();
        expect(learnButtonBounds).not.toBeNull();
        await page.mouse.move(
            textBoxBounds!.x + textBoxBounds!.width / 2,
            textBoxBounds!.y + textBoxBounds!.height / 2,
        );
        await page.mouse.move(
            learnButtonBounds!.x + learnButtonBounds!.width / 2,
            learnButtonBounds!.y + learnButtonBounds!.height / 2,
            { steps: 10 },
        );
        await expect(toolbar).toBeVisible();
        await page.mouse.click(
            learnButtonBounds!.x + learnButtonBounds!.width / 2,
            learnButtonBounds!.y + learnButtonBounds!.height / 2,
        );

        await expect(page.getByRole('complementary', { name: 'AI learning panel' })).toBeVisible();
        await page.getByRole('button', { name: 'Grammar' }).click();
        await expect(page.getByText('Respuesta grammar')).toBeVisible();

        const navigationClicks = await page.evaluate(() => window.__OCR_TEST__!.navigationClicks);
        expect(navigationClicks).toBe(0);
    });

    test('AI learning controls are available by touch', async ({ browser }) => {
        const context = await browser.newContext({
            viewport: { width: 390, height: 844 },
            hasTouch: true,
            isMobile: true,
        });
        const page = await context.newPage();
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);

        const textBox = page.locator('[data-ocr-text]').first();
        await textBox.tap();
        const toolbar = page.getByTestId('ocr-learning-toolbar').first();
        await expect(toolbar).toBeVisible();
        await toolbar.getByRole('button', { name: 'Learn' }).tap();
        await expect(page.getByRole('complementary', { name: 'AI learning panel' })).toBeVisible();
        const learningModes = page.getByRole('group', { name: 'Learning mode' });
        await expect(learningModes).toBeVisible();
        const modeWidths = await learningModes.evaluate((element) => ({
            client: element.clientWidth,
            scroll: element.scrollWidth,
        }));
        expect(modeWidths.scroll).toBeLessThanOrEqual(modeWidths.client);
        await expect(learningModes.getByRole('button')).toHaveCount(5);
        expect(await page.evaluate(() => window.__OCR_TEST__!.navigationClicks)).toBe(0);

        await context.close();
    });

    test('AI learning controls are keyboard accessible', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);

        const textBox = page.locator('[data-ocr-text]').first();
        await textBox.focus();
        const toolbar = page.getByTestId('ocr-learning-toolbar').first();
        await expect(toolbar).toBeVisible();
        await page.keyboard.press('Tab');
        await expect(toolbar.getByRole('button', { name: 'Copy' })).toBeFocused();
        await page.keyboard.press('Tab');
        await expect(toolbar.getByRole('button', { name: 'Learn' })).toBeFocused();
        await page.keyboard.press('Enter');
        await expect(page.getByRole('complementary', { name: 'AI learning panel' })).toBeVisible();
    });

    test('AI learning request can recover from a transient failure', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
            window.__OCR_TEST__!.aiFailuresRemaining = 1;
        });
        await waitForHarness(page);

        const textBox = page.locator('[data-ocr-text]').first();
        await textBox.hover();
        await page.getByTestId('ocr-learning-toolbar').first().getByRole('button', { name: 'Learn' }).click();
        const panel = page.getByRole('complementary', { name: 'AI learning panel' });
        await expect(panel.getByText('Temporary AI failure')).toBeVisible();
        await panel.getByRole('button', { name: 'Retry' }).click();
        await expect(panel.getByText('Respuesta translate')).toBeVisible();
    });

    test('AI learning panel remembers its width and collapsed state', async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);

        const openPanel = async () => {
            const textBox = page.locator('[data-ocr-text]').first();
            await textBox.hover();
            await page.getByTestId('ocr-learning-toolbar').first().getByRole('button', { name: 'Learn' }).click();
            return page.getByRole('complementary', { name: 'AI learning panel' });
        };

        let panel = await openPanel();
        const resizeHandle = page.getByRole('separator', { name: 'Resize AI learning panel' });
        const initialBounds = await panel.boundingBox();
        expect(initialBounds).not.toBeNull();
        await resizeHandle.hover();
        await page.mouse.down();
        await page.mouse.move(initialBounds!.x + 80, initialBounds!.y + initialBounds!.height / 2);
        await page.mouse.up();

        const resizedBounds = await panel.boundingBox();
        expect(resizedBounds).not.toBeNull();
        expect(resizedBounds!.width).toBeLessThan(initialBounds!.width);
        const storedWidth = await page.evaluate(() => Number(localStorage.getItem('ocr.ai-panel-width.v1')));
        expect(storedWidth).toBeCloseTo(resizedBounds!.width, 0);

        await panel.getByRole('button', { name: 'Collapse AI learning panel' }).click();
        await expect(panel.getByRole('button', { name: 'Expand AI learning panel' })).toBeVisible();

        await page.reload();
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);
        panel = await openPanel();
        await expect(panel.getByRole('button', { name: 'Expand AI learning panel' })).toBeVisible();
        await panel.getByRole('button', { name: 'Expand AI learning panel' }).click();
        await expect(panel.getByRole('button', { name: 'Collapse AI learning panel' })).toBeVisible();
        expect((await panel.boundingBox())?.width).toBeCloseTo(storedWidth, 0);
    });

    test('renders the 8-column forced-vertical regression as 8 right-to-left vertical columns that fit the box', async ({
        page,
    }) => {
        const regressionText = 'けった のは ぼくだ けど、 ボールの 持ち主は おま えだ。';
        const expectedColumns = ['けった', 'のは', 'ぼくだ', 'けど、', 'ボールの', '持ち主は', 'おま', 'えだ。'];

        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);

        await page.evaluate(() => {
            window.__OCR_TEST__!.clearPages();
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8766');
            window.__OCR_TEST__!.setVisible(true);
        });

        await scrollPageIntoView(page, 3);

        await page.waitForFunction(
            (needle) => {
                const lines = window.__OCR_TEST__?.lines ?? [];
                return lines.some((text) => text.includes(needle));
            },
            regressionText,
            { timeout: 30_000 },
        );

        await page.waitForSelector('[data-testid="page-3"] [data-ocr-text]', { timeout: 10_000 });

        const pageLocator = page.locator('[data-testid="page-3"]');
        const textBox = pageLocator.locator('[data-ocr-text]').first();
        await expect(textBox).toBeVisible();
        await expect(textBox).toHaveAttribute('data-ocr-orientation', 'vertical');
        await expect(textBox).toHaveAttribute('data-ocr-columns', '8');
        await expect(textBox).not.toHaveAttribute('data-ocr-orientation', 'horizontal');

        const overlayText = (await textBox.textContent())?.replaceAll(/\s+/g, '') ?? '';
        const expectedText = regressionText.replaceAll(/\s+/g, '');
        expect(overlayText).toBe(expectedText);

        const columnTexts = await pageLocator
            .locator('[data-ocr-column]')
            .evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-ocr-column-text') ?? ''));
        expect(columnTexts).toEqual(expectedColumns);

        const columnRects = await pageLocator.locator('[data-ocr-column]').evaluateAll((nodes) =>
            nodes.map((node) => {
                const r = node.getBoundingClientRect();
                return { x: r.x, y: r.y, width: r.width, height: r.height };
            }),
        );
        for (let i = 1; i < columnRects.length; i += 1) {
            expect(columnRects[i].x).toBeLessThan(columnRects[i - 1].x);
        }
        expect(columnRects[0].x).toBeGreaterThan(columnRects[columnRects.length - 1].x);

        const dataFontSize = Number.parseFloat((await textBox.getAttribute('data-ocr-font-size')) ?? '0');
        const dataLineBoxHeight = Number.parseFloat((await textBox.getAttribute('data-ocr-line-box-height')) ?? '0');
        const dataLineBoxWidth = Number.parseFloat((await textBox.getAttribute('data-ocr-line-box-width')) ?? '0');
        const dataSideMargin = Number.parseFloat((await textBox.getAttribute('data-ocr-side-margin')) ?? '0');
        const dataColumnGap = Number.parseFloat((await textBox.getAttribute('data-ocr-column-gap')) ?? '0');
        // Fill-derived font size: 200×240 / 8 cols / L=3 / blockFontSize=28
        // gives fontSize=20, lineBoxHeight=24, lineBoxWidth=21.
        expect(dataFontSize).toBeCloseTo(20, 1);
        expect(dataLineBoxHeight).toBeCloseTo(24, 1);
        expect(dataLineBoxWidth).toBeCloseTo(21, 1);
        expect(dataFontSize).toBeLessThanOrEqual(28);
        expect(dataColumnGap).toBeGreaterThan(0);
        expect(dataSideMargin).toBeGreaterThanOrEqual(0);

        const styles = await pageLocator.locator('[data-ocr-column]').evaluateAll((nodes) =>
            nodes.map((node) => {
                const computed = getComputedStyle(node);
                return {
                    writingMode: computed.writingMode,
                    textOrientation: computed.textOrientation,
                    fontSize: Number.parseFloat(computed.fontSize),
                    lineHeightPx: Number.parseFloat(computed.lineHeight) || 0,
                };
            }),
        );
        for (const style of styles) {
            expect(style.writingMode).toBe('vertical-rl');
            expect(style.textOrientation).toBe('upright');
            // The per-column computed style must match the data attribute so
            // the fill-derived metrics flow into the rendered DOM.
            expect(style.fontSize).toBeCloseTo(dataFontSize, 1);
            expect(style.lineHeightPx).toBeCloseTo(dataLineBoxHeight, 0);
        }

        const boxRect = await textBox.evaluate((node) => {
            const r = node.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
        });
        for (const rect of columnRects) {
            expect(rect.width).toBeGreaterThan(0);
            expect(rect.height).toBeGreaterThan(0);
            expect(rect.x).toBeGreaterThanOrEqual(boxRect.x - 0.5);
            expect(rect.x + rect.width).toBeLessThanOrEqual(boxRect.x + boxRect.width + 0.5);
            expect(rect.y).toBeGreaterThanOrEqual(boxRect.y - 0.5);
            expect(rect.y + rect.height).toBeLessThanOrEqual(boxRect.y + boxRect.height + 0.5);
        }

        // Rendered-DOM width-fit invariant: sum of column widths + gaps + 2 ×
        // side margin must not exceed the OCR box width. The fill-derived
        // font size for the 8-column case leaves no headroom, so this pins
        // the formula against any future regression that lets the columns
        // overflow the OCR box at the rendered level.
        const totalColumnWidth = columnRects.reduce((acc, rect) => acc + rect.width, 0);
        const expectedGapsWidth = (columnRects.length - 1) * dataColumnGap;
        const expectedWidth = totalColumnWidth + expectedGapsWidth + 2 * dataSideMargin;
        expect(expectedWidth).toBeLessThanOrEqual(boxRect.width + 0.5);

        // Box-fill invariant: every column visually fills the OCR box height
        // (the renderer sets `height: 100%` on each column), so the longest
        // column's rendered height must equal the box's interior height
        // (allowing 1 px for subpixel rounding).
        const longestColumnRect = columnRects.reduce((acc, rect) => (rect.height > acc.height ? rect : acc));
        expect(longestColumnRect.height).toBeGreaterThanOrEqual(boxRect.height - 2 * dataSideMargin - 1);
        expect(longestColumnRect.height).toBeLessThanOrEqual(boxRect.height + 1);

        const overflow = await pageLocator
            .locator('[data-ocr-text]')
            .first()
            .evaluate((node) => {
                const computed = getComputedStyle(node);
                return {
                    scrollWidth: node.scrollWidth,
                    clientWidth: node.clientWidth,
                    scrollHeight: node.scrollHeight,
                    clientHeight: node.clientHeight,
                    overflowX: computed.overflowX,
                    overflowY: computed.overflowY,
                };
            });
        // The text box clips to the OCR box when not hovered; the columns
        // themselves must not need internal scrollbars (allowing 1px for
        // browser subpixel rounding).
        expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth + 1);
        expect(overflow.scrollHeight).toBeLessThanOrEqual(overflow.clientHeight + 1);

        const columnOverflows = await pageLocator.locator('[data-ocr-column]').evaluateAll((nodes) =>
            nodes.map((node) => ({
                scrollWidth: node.scrollWidth,
                clientWidth: node.clientWidth,
                scrollHeight: node.scrollHeight,
                clientHeight: node.clientHeight,
            })),
        );
        for (const o of columnOverflows) {
            expect(o.scrollWidth).toBeLessThanOrEqual(o.clientWidth + 1);
            expect(o.scrollHeight).toBeLessThanOrEqual(o.clientHeight + 1);
        }
    });

    test('AI learning panel uses an explicit readable Japanese font size and a body1 response font size', async ({
        page,
    }) => {
        await page.goto('/');
        await page.waitForFunction(() => window.__OCR_TEST__ !== undefined);
        await page.evaluate(() => {
            window.__OCR_TEST__!.setEnabled(true);
            window.__OCR_TEST__!.setAiEnabled(true);
            window.__OCR_TEST__!.setVisible(true);
        });
        await waitForHarness(page);

        const textBox = page.locator('[data-ocr-text]').first();
        await textBox.hover();
        const toolbar = page.getByTestId('ocr-learning-toolbar').first();
        await expect(toolbar).toBeVisible();
        await toolbar.getByRole('button', { name: 'Learn' }).click();
        const panel = page.getByRole('complementary', { name: 'AI learning panel' });
        await expect(panel).toBeVisible();
        await expect(panel.getByText('Respuesta translate')).toBeVisible();

        const japaneseFontSize = await panel
            .locator('p[lang="ja"]')
            .first()
            .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
        expect(japaneseFontSize).toBeGreaterThanOrEqual(18);

        const responseFontSize = await panel
            .locator('section')
            .first()
            .locator('p')
            .first()
            .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
        expect(responseFontSize).toBeGreaterThanOrEqual(16);

        const responseLabelFontSize = await panel
            .locator('section')
            .first()
            .locator('h2, h3, h4, h5, h6, [class*="MuiTypography-subtitle"]')
            .first()
            .evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
        expect(responseLabelFontSize).toBeGreaterThanOrEqual(14);
    });
});
