import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { showStartupFailure, startupFailureCause } from './startup-failure';

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  const cause = startupFailureCause(err);
  if (cause) {
    showStartupFailure(document, cause, () => window.location.reload());
  }
  console.error(err);
});
