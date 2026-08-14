const cron = require('node-cron');

// KNOWN BUGS
// Bug 1 — Timezone hardcoded to America/New_York: the cron schedule uses a fixed timezone
//   that is not configurable via environment variable. Deployments in other regions will run
//   jobs at unexpected local times. The timezone should be read from process.env.CRON_TIMEZONE
//   with a sensible default (e.g. UTC).
//
// Bug 2 — No error handling inside the cron callback: if console.log or any future logic
//   inside the helloJob callback throws, the exception propagates out of the node-cron
//   scheduler uncaught. The callback should be wrapped in a try/catch to prevent a single
//   failed execution from silently stopping future runs.
//
// Bug 3 — stopCronJobs() is exported but never called on shutdown: index.js registers
//   SIGTERM/SIGINT handlers that clear the token cleanup interval, but neither handler calls
//   stopCronJobs(). Active cron jobs therefore keep the event loop alive after the signal is
//   received, delaying process exit. The signal handlers should call stopCronJobs() before
//   process.exit().

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
