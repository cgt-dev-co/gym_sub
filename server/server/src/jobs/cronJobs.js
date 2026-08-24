const cron = require('node-cron');

// KNOWN BUGS
// Bug 1 — FIXED: Timezone is now configurable via CRON_TIMEZONE env var, defaulting to
//   'UTC'. Set CRON_TIMEZONE in your .env to override for region-specific deployments.
//
// Bug 2 — FIXED: The helloJob callback is wrapped in try/catch so a single failed
//   execution does not propagate uncaught or silently stop future runs.
//
// Bug 3 — FIXED: index.js SIGTERM/SIGINT handlers now call stopCronJobs() before
//   process.exit(), ensuring cron jobs are stopped and the event loop drains cleanly.

const CRON_TIMEZONE = process.env.CRON_TIMEZONE || 'UTC';

// Print "hello" every 2 hours
const helloJob = cron.schedule('0 */2 * * *', () => {
  try {
    console.log('hello');
    console.log(`Cron job executed at: ${new Date().toISOString()}`);
  } catch (error) {
    console.error('Error in helloJob cron callback:', error);
  }
}, {
  scheduled: true,
  timezone: CRON_TIMEZONE
});

// Start all cron jobs
const startCronJobs = () => {
  console.log('Starting cron jobs...');
  helloJob.start();
  console.log('Cron job initialized: Print "hello" every 2 hours');
};

// Stop all cron jobs
const stopCronJobs = () => {
  console.log('Stopping cron jobs...');
  helloJob.stop();
};

module.exports = { startCronJobs, stopCronJobs };
