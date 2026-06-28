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
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8765');
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
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8765');
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
            window.__OCR_TEST__!.setEndpoint('http://127.0.0.1:8765');
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

        await expect(page.getByRole('dialog')).toBeVisible();
        await page.getByRole('button', { name: 'Grammar' }).click();
        await expect(page.getByText('Respuesta grammar')).toBeVisible();

        const navigationClicks = await page.evaluate(() => window.__OCR_TEST__!.navigationClicks);
        expect(navigationClicks).toBe(0);
    });
});
