import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { StorageService } from './storage.service';
import { UserService } from './user.service';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(),
    // Load data from the files on disk before the app starts.
    // Services are injected via deps because the initializer function
    // itself does not run in an injection context.
    {
      provide: APP_INITIALIZER,
      multi: true,
      useFactory: (storage: StorageService, user: UserService) => async () => {
        await storage.loadFromDisk();
        await user.loadFromDisk();
      },
      deps: [StorageService, UserService]
    },
    StorageService
  ]
};
