import { chromium } from 'playwright-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';

chromium.use(StealthPlugin());

export async function launchBrowser() {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  ];

  const browser = await chromium.launch({
    headless: true, // Keep true for Docker but with max stability
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--window-size=1920,1080',
    ]
  });

  const context = await browser.newContext({
    userAgent: userAgents[Math.floor(Math.random() * userAgents.length)],
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    hasTouch: true,
    isMobile: false,
  });

  return { browser, context };
}
