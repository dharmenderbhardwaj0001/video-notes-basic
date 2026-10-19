import { Routes } from '@angular/router';
import { LandingComponent } from './landing/landing.component';
import { WelcomeComponent } from './welcome/welcome.component';
import { YearComponent } from './year/year.component';
import { MonthComponent } from './month/month.component';
import { DayComponent } from './day/day.component';
import { VideoDetailComponent } from './video-detail/video-detail.component';
import { VideoHistoryComponent } from './video-history/video-history.component';
import { CategoriesComponent } from './categories/categories.component';
import { CategoryVideosComponent } from './categories/category-videos.component';

export const routes: Routes = [
  { path: '', component: LandingComponent, title: 'Video Notes' },
  { path: 'dashboard', component: WelcomeComponent, title: 'Video Notes - Welcome' },
  { path: 'categories', component: CategoriesComponent, title: 'Video Notes - Categories' },
  { path: 'categories/:category', component: CategoryVideosComponent, title: 'Video Notes - Category' },
  { path: 'year/:year', component: YearComponent, title: 'Video Notes - Year' },
  { path: 'year/:year/month/:month', component: MonthComponent, title: 'Video Notes - Month' },
  { path: 'year/:year/month/:month/day/:day', component: DayComponent, title: 'Video Notes - Day' },
  { path: 'year/:year/month/:month/day/:day/video/:videoId', component: VideoDetailComponent, title: 'Video Notes - Video Detail' },
  { path: 'video-history/:videoId', component: VideoHistoryComponent, title: 'Video Notes - Watch History' },
  { path: '**', redirectTo: '', pathMatch: 'full' }
];