import { test, expect } from '@playwright/test';
import {
  login,
  gotoGame,
  parseMoney,
  headerCashLocator,
  dismissBootScreen,
  dismissDevOverlay,
} from './helpers';

test.describe('THE WIRE — voice commands (mocked)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      type MockRecognitionInstance = {
        continuous: boolean;
        interimResults: boolean;
        lang: string;
        onresult: ((event: SpeechRecognitionEvent) => void) | null;
        onerror: ((event: { error: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
        abort: () => void;
      };

      class MockSpeechRecognition implements MockRecognitionInstance {
        continuous = false;
        interimResults = true;
        lang = 'en-AU';
        onresult = null;
        onerror = null;
        onend = null;

        start() {
          (window as unknown as { __wireSpeechTrigger?: (text: string) => void }).__wireSpeechTrigger =
            (text: string) => {
              this.onresult?.({
                resultIndex: 0,
                results: [
                  {
                    isFinal: true,
                    length: 1,
                    0: { transcript: text },
                    item: () => ({ transcript: text, confidence: 1 }),
                  },
                ],
              } as unknown as SpeechRecognitionEvent);
              this.onend?.();
            };
        }

        stop() {
          this.onend?.();
        }

        abort() {
          this.onerror?.({ error: 'aborted' });
          this.onend?.();
        }
      }

      (window as unknown as { SpeechRecognition: typeof MockSpeechRecognition }).SpeechRecognition =
        MockSpeechRecognition;
      (window as unknown as { webkitSpeechRecognition: typeof MockSpeechRecognition }).webkitSpeechRecognition =
        MockSpeechRecognition;
    });
  });

  async function enableWire(page: import('@playwright/test').Page) {
    await page.getByRole('button', { name: 'More menu' }).click();
    await page
      .getByRole('dialog', { name: 'More' })
      .getByRole('link', { name: 'Settings', exact: true })
      .click();
    await page.waitForURL(/\/settings/);
    const onButton = page.locator('.g-settings-wire-toggle').getByRole('button', { name: 'ON', exact: true });
    if ((await onButton.getAttribute('aria-pressed')) !== 'true') {
      await onButton.click();
      await expect(onButton).toHaveAttribute('aria-pressed', 'true');
    }
    await gotoGame(page, '/command');
  }

  test('mocked voice buy shows YOU SAID and requires Confirm', async ({ page }) => {
    await login(page);
    await dismissBootScreen(page);
    await dismissDevOverlay(page);
    await enableWire(page);

    await page.getByTestId('wire-fab').click();
    await expect(page.getByTestId('wire-voice-unavailable')).toHaveCount(0);
    await dismissDevOverlay(page);

    await page.locator('[data-testid="wire-mic"]').evaluate((el) => {
      (el as HTMLButtonElement).click();
    });
    await expect(page.getByTestId('wire-status')).toContainText('NETWORK LISTENING', { timeout: 5000 });

    await page.evaluate(() => {
      (window as unknown as { __wireSpeechTrigger?: (text: string) => void }).__wireSpeechTrigger?.(
        'buy 10 aks',
      );
    });

    await expect(page.getByTestId('wire-you-said')).toContainText('YOU SAID');
    await expect(page.getByTestId('wire-you-said')).toContainText('buy 10 aks');
    await expect(page.getByTestId('wire-confirm')).toBeVisible();
    await expect(page.getByTestId('wire-confirm-purchase')).toBeVisible();

    const cashBefore = parseMoney(await headerCashLocator(page).textContent());
    await page.getByTestId('wire-confirm-purchase').click();
    await expect(page.getByTestId('wire-result')).toContainText('ORDER COMPLETE');
    const cashAfter = parseMoney(await headerCashLocator(page).textContent());
    expect(cashAfter).toBeLessThan(cashBefore);
  });
});
