import cron from 'node-cron';
import { v4 as uuidv4 } from 'uuid';
import { run } from './orchestrator';

export function setupScheduler() {
  const schedule = process.env.SCHEDULE_CRON || '0 2 1 * *';
  
  console.log(`Setting up scheduler with cron: ${schedule}`);
  
  cron.schedule(schedule, async () => {
    console.log('Scheduled run starting...');
    try {
      const runId = uuidv4();
      await run(runId);
      console.log('Scheduled run completed successfully.');
    } catch (error) {
      console.error('Scheduled run failed:', error);
    }
  });
}
