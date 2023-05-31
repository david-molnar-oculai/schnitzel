const Sentry = require('@sentry/serverless');
const config = require('config');
const schnitzel = require('./schnitzel');

if (!config.sentryDsn) {
  throw new Error('Missing Sentry DSN');
}

const runWithCheckIn = (action) => {
  return async (...args) => {
    let checkInId;
    try {
      checkInId = Sentry.AWSLambda.captureCheckIn({
        monitorSlug: "schnitzel",
        status: "in_progress",
      });
      await action(...args);
      Sentry.AWSLambda.captureCheckIn({
        checkInId,
        monitorSlug: "schnitzel",
        status: "ok",
      });
    } catch (error) {
      Sentry.AWSLambda.captureCheckIn({
        checkInId,
        monitorSlug: "schnitzel",
        status: "error",
      });
      throw error;
    }
  }
}

Sentry.AWSLambda.init({
  dsn: config.sentryDsn,
  tracesSampleRate: 1.0,
});

exports.handler = Sentry.AWSLambda.wrapHandler(async (...args) => {
  await runWithCheckIn(schnitzel)(...args);
}, {
  timeoutWarningLimit: 60 * 1000,
});
