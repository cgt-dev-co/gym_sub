const cron = require('node-cron');

// Print "hello" every 2 hours
const helloJob = cron.schedule('0 */2 * * *', () => {
  console.log('hello');
  console.log(`Cron job executed at: ${new Date().toISOString()}`);
}, {
  scheduled: true,
  timezone: "America/New_York"
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
