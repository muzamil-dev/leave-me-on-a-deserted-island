import { BrokerDefinition } from './parser';

export interface Profile {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  city?: string;
  state?: string;
  zip?: string;
  dob_month?: number;
  dob_year?: number;
  aliases?: string[];
  address_history?: string[];
}

export async function executeBroker(page: any, broker: BrokerDefinition, profile: Profile) {
  console.log(`Starting opt-out for ${broker.name}...`);

  try {
    for (const step of broker.steps) {
      await executeStep(page, step, profile);
      await page.waitForTimeout(1500 + Math.random() * 2000);
    }

    const isSuccess = await verifySuccess(page, broker);
    if (isSuccess) {
      console.log(`Successfully submitted opt-out for ${broker.name}`);
      return { status: 'submitted' };
    } else {
      const currentUrl = page.url();
      console.error(`Success indicator not found for ${broker.name}. Current URL: ${currentUrl}`);
      const body = await page.textContent('body');
      console.error(`Page content snippet: ${body?.substring(0, 500)}`);
      const screenshotPath = `screenshots/${broker.id}_failed_${Date.now()}.png`;
      await page.screenshot({ path: screenshotPath });
      return { status: 'failed', error: `Success indicator not found. On page: ${currentUrl}`, screenshotPath };
    }
  } catch (error: any) {
    console.error(`Error during opt-out for ${broker.name}:`, error.message);
    const screenshotPath = `screenshots/${broker.id}_error_${Date.now()}.png`;
    await page.screenshot({ path: screenshotPath });
    return { status: 'failed', error: error.message, screenshotPath };
  }
}

async function executeStep(page: any, step: any, profile: Profile) {
  const interpolate = (str: string) => {
    return str.replace(/{{profile\.(.*?)}}/g, (_, key) => {
      const val = (profile as any)[key];
      return val !== undefined ? val : '';
    });
  };

  switch (step.action) {
    case 'navigate':
      await page.goto(interpolate(step.url), { waitUntil: 'domcontentloaded', timeout: 60000 });
      break;
    case 'fill':
      await page.fill(step.selector, interpolate(step.value));
      break;
    case 'click':
      await page.click(step.selector);
      break;
    case 'select':
      await page.selectOption(step.selector, interpolate(step.value));
      break;
    case 'wait_for':
      await page.waitForSelector(step.selector, { timeout: step.timeout || 30000 });
      break;
    case 'solve_captcha':
      console.log(`[TODO] Solve ${step.type} captcha`);
      break;
  }
}

async function verifySuccess(page: any, broker: BrokerDefinition) {
  const { type, value } = broker.success_indicator;
  switch (type) {
    case 'text_contains':
      const content = await page.textContent('body');
      return content?.toLowerCase().includes(value.toLowerCase());
    case 'url_contains':
      return page.url().includes(value);
    case 'element_exists':
      try {
        await page.waitForSelector(value, { timeout: 15000 });
        return true;
      } catch {
        return false;
      }
    default:
      return false;
  }
}
