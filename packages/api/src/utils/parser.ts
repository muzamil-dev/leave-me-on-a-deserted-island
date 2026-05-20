import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import yaml from 'yaml';

export const BrokerStepSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('navigate'),
    url: z.string(),
  }),
  z.object({
    action: z.literal('fill'),
    selector: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal('click'),
    selector: z.string(),
  }),
  z.object({
    action: z.literal('select'),
    selector: z.string(),
    value: z.string(),
  }),
  z.object({
    action: z.literal('solve_captcha'),
    type: z.enum(['recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile']),
  }),
  z.object({
    action: z.literal('wait_for'),
    selector: z.string(),
    timeout: z.number().optional(),
  }),
]);

export const BrokerDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  base_url: z.string(),
  opt_out_url: z.string(),
  search_url: z.string().optional(),
  method: z.enum(['form', 'email', 'link']),
  captcha: z.enum(['none', 'recaptcha_v2', 'recaptcha_v3', 'hcaptcha', 'turnstile']).default('none'),
  confirm_email: z.boolean().default(false),
  recheck_days: z.number().default(90),
  requires_account: z.boolean().default(false),
  requires_id_verification: z.boolean().default(false),
  steps: z.array(BrokerStepSchema),
  search_steps: z.array(BrokerStepSchema).optional(),
  result_list_selector: z.string().optional(),
  result_link_selector: z.string().optional(),
  result_filter: z.string().optional(),
  success_indicator: z.object({
    type: z.enum(['text_contains', 'url_contains', 'element_exists']),
    value: z.string(),
  }),
  find_indicator: z.object({
    type: z.enum(['text_contains', 'url_contains', 'element_exists']),
    value: z.string(),
  }).optional(),
  notes: z.string().optional(),
});

export type BrokerDefinition = z.infer<typeof BrokerDefinitionSchema>;


export function loadBrokers(definitionsPath: string): BrokerDefinition[] {
  if (!fs.existsSync(definitionsPath)) {
    console.warn(`Broker definitions path not found: ${definitionsPath}`);
    return [];
  }

  const files = fs.readdirSync(definitionsPath).filter(f => f.endsWith('.yaml') || f.endsWith('.yml'));
  const brokers: BrokerDefinition[] = [];

  for (const file of files) {
    try {
      const content = fs.readFileSync(path.join(definitionsPath, file), 'utf8');
      const parsed = yaml.parse(content);
      const broker = BrokerDefinitionSchema.parse(parsed);
      brokers.push(broker);
    } catch (error: any) {
      console.error(`Failed to parse broker definition: ${file}`);
      if (error.errors) {
        console.error('Validation errors:', JSON.stringify(error.errors, null, 2));
      } else {
        console.error(error.message);
      }
    }
  }

  return brokers;
}
