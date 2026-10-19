import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import {
  VideoNote, formatDuration,
  getVideoThumbnail, getYouTubeThumbnailUrl, getVideoProgress, isWatchEntry
} from '../models/video-note.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../header/header.component';

/** One watch entry inside a day of the history timeline. */
interface WatchEntry {
  video: VideoNote;
  timeLabel: string;
  /** Watch time this entry added, measured from the previous furthest point. */
  watchTime: number;
  /** Furthest point reached in the video when this entry was saved. */
  seenUntil: number;
}

/** Every watch entry of a video on one calendar day. */
interface DayGroup {
  year: number;
  month: number;
  day: number;
  date: Date;
  dateLabel: string;
  relativeLabel: string;
  /** Watch time summed over all entries of that day. */
  totalWatched: number;
  /** Furthest position reached that day. */
  position: number;
  hasNotes: boolean;
  isToday: boolean;
  entries: WatchEntry[];
}

@Component({
  selector: 'app-video-history',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './video-history.component.html',
  styleUrls: ['./video-history.component.scss']
})
export class VideoHistoryComponent implements OnInit {
  videoId: string = '';
  /** Days this video was watched on, newest day first. */
  days: DayGroup[] = [];
  latestVideo: VideoNote | null = null;
  today: Date = new Date();

  // "Add time" dialog state
  showAddDialog: boolean = false;
  newDate: string = '';
  addHours: number | null = null;
  addMinutes: number | null = null;
  addSeconds: number | null = null;
  /** Point in the video the form reports as "watched till", in seconds. */
  addDuration: number = 0;
  /** Furthest point already reached on the chosen day, before this entry. */
  dayProgress: number = 0;

  // Action passed to the shared header (icon-only "Add time for today")
  addTimeAction = (): void => this.openAddDialog();

  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(private route: ActivatedRoute, private router: Router, private storage: StorageService) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.videoId = params['videoId'] || '';
      this.loadHistory();
    });
  }

  // Groups every saved entry of this video by day: newest day on top and
  // the newest entry first inside each day.
  //
  // Entries are walked oldest first so each session is measured against the
  // furthest point reached before it. `position` stores how far the video had
  // been watched, not how long it was watched, so adding up raw positions
  // would count the same footage once per day.
  loadHistory(): void {
    this.today = new Date();
    const entries = this.storage.getVideoHistory(this.videoId).slice().sort((a, b) =>
      a.date.getTime() - b.date.getTime() || this.entryTime(a.video) - this.entryTime(b.video)
    );

    // Sessions are the watch time each entry added on top of the progress
    // reached before it (see getVideoProgress).
    const sessions = getVideoProgress(entries.map(entry => entry.video)).sessions;

    const groups: DayGroup[] = [];
    const groupsByDate = new Map<string, DayGroup>();
    let position = 0;

    for (const [index, entry] of entries.entries()) {
      const dateKey = this.toDateKey(entry.day.year, entry.day.month, entry.day.day);
      let group = groupsByDate.get(dateKey);
      if (!group) {
        group = {
          year: entry.day.year,
          month: entry.day.month,
          day: entry.day.day,
          date: entry.date,
          dateLabel: this.formatFullDate(entry.date),
          relativeLabel: this.getRelativeDayLabel(entry.date),
          totalWatched: 0,
          position: 0,
          hasNotes: false,
          isToday: this.isSameDay(entry.date, this.today),
          entries: []
        };
        groupsByDate.set(dateKey, group);
        groups.push(group);
      }

      if (entry.video.notes && entry.video.notes.trim().length > 0) {
        group.hasNotes = true;
      }

      const previous = position;
      const reached = Math.max(previous, entry.video.position || 0);
      position = reached;

      // An entry that does not move the progress forward is just a note
      // placeholder: it keeps the day visible but is not a watch session.
      if (isWatchEntry(entry.video, previous)) {
        group.entries.push({
          video: entry.video,
          timeLabel: this.formatEntryTime(entry.video),
          watchTime: sessions[index],
          seenUntil: reached
        });
      }
      group.position = Math.max(group.position, reached);
      group.totalWatched = group.position;
    }

    this.days = groups.sort((a, b) => b.date.getTime() - a.date.getTime());
    for (const group of this.days) {
      group.entries.sort((a, b) => this.entryTime(b.video) - this.entryTime(a.video));
    }

    this.latestVideo = entries.length > 0
      ? entries[entries.length - 1].video
      : null;
  }

  // Real YouTube thumbnail when the video has a YouTube URL, else the
  // bundled placeholder thumbnail.
  getThumbnail(): string {
    const video = this.latestVideo;
    return getYouTubeThumbnailUrl(video?.videoUrl)
      ?? getVideoThumbnail(video?.id || video?.videoUrl || video?.videoTitle);
  }

  // Every day of the same video continues the same milestone, so the total is
  // the furthest point reached — not a sum of each day's progress.
  getTotalWatchTime(): number {
    return this.getLatestPosition();
  }

  getTotalSaves(): number {
    return this.days.reduce((total, group) => total + group.entries.length, 0);
  }

  // Progress reached today, including everything reached on earlier days.
  getTodayWatchTime(): number {
    const todayGroup = this.days.find(group => group.isToday);
    return todayGroup ? todayGroup.position : 0;
  }

  // Furthest position reached in the video, across every saved day.
  getLatestPosition(): number {
    return this.days.reduce((max, group) => Math.max(max, group.position), 0);
  }

  /** True when this entry starts a new day for the video. */
  isFirstEntry(group: DayGroup, entry: WatchEntry): boolean {
    return group.entries.length > 0 && group.entries[group.entries.length - 1] === entry;
  }

  /** Furthest point reached in the video on the given day. */
  private watchedOnDate(dateKey: string): number {
    return this.days
      .filter(group => this.toDateKey(group.year, group.month, group.day) === dateKey)
      .reduce((max, group) => Math.max(max, group.position), 0);
  }

  getSavesLabel(group: DayGroup): string {
    const count = group.entries.length || 1;
    return `${count} save${count !== 1 ? 's' : ''}`;
  }

  /** Day keys ("yyyy-MM-dd") this video was already watched on. */
  get watchedDateKeys(): string[] {
    return this.days.map(group => this.toDateKey(group.year, group.month, group.day));
  }

  get maxDate(): string {
    return this.toDateKey(this.today.getFullYear(), this.today.getMonth() + 1, this.today.getDate());
  }

  get selectedDayLabel(): string {
    const parts = (this.newDate || '').split('-').map(Number);
    if (parts.length !== 3 || parts.some(part => isNaN(part))) return 'Select a date';
    return this.formatFullDate(new Date(parts[0], parts[1] - 1, parts[2]));
  }

  /** True when the chosen date has no entry yet, so a new day starts. */
  get isNewDay(): boolean {
    return !!this.newDate && !this.watchedDateKeys.includes(this.newDate);
  }

  get canAdd(): boolean {
    return this.addDuration > 0 && !!this.newDate;
  }

  /**
   * The entry is invalid when it reports a point the video has already
   * passed: watch time only grows, so a later entry can never be less than
   * the furthest point reached before it.
   */
  get addGoesBackwards(): boolean {
    return this.addDuration > 0 && this.addDuration <= this.dayProgress;
  }

  /** Watch time this entry adds on top of the chosen day's progress. */
  get addSessionTime(): number {
    return Math.max(0, this.addDuration - this.dayProgress);
  }

  /** Furthest point reached on any day before the chosen one. */
  get addBaseline(): number {
    const target = this.newDate || '';
    return this.days
      .filter(group => this.toDateKey(group.year, group.month, group.day) < target)
      .reduce((max, group) => Math.max(max, group.position), 0);
  }

  openAddDialog(): void {
    // The app loads its data before booting, so "today" is always ready here.
    this.newDate = this.maxDate;
    this.addHours = null;
    this.addMinutes = null;
    this.addSeconds = null;
    this.addDuration = 0;
    this.syncDayProgress();
    this.showAddDialog = true;
  }

  /** Keeps the day's current progress in sync when the day changes. */
  onDateChange(): void {
    this.syncDayProgress();
  }

  // The starting point of the entry: a new day continues from wherever the
  // video was left off, an existing day from its latest entry.
  private syncDayProgress(): void {
    if (!this.newDate) {
      this.dayProgress = 0;
      return;
    }
    this.dayProgress = this.watchedDateKeys.includes(this.newDate)
      ? this.watchedOnDate(this.newDate)
      : this.getLatestPosition();
  }

  closeAddDialog(): void {
    this.showAddDialog = false;
    this.addHours = null;
    this.addMinutes = null;
    this.addSeconds = null;
    this.addDuration = 0;
    this.dayProgress = 0;
  }

  // Combine the hours/minutes/seconds inputs into a total number of seconds.
  // The raw input values are left untouched so typing/clearing a field never
  // re-inserts a "0" under the cursor.
  updateDuration(): void {
    const h = Math.max(0, Math.floor(Number(this.addHours) || 0));
    const m = Math.max(0, Math.floor(Number(this.addMinutes) || 0));
    const s = Math.max(0, Math.floor(Number(this.addSeconds) || 0));
    this.addDuration = h * 3600 + m * 60 + s;
  }

  // Saves a new watch entry for the same video on the chosen day. The entered
  // time IS the point watched till, so `position` is stored as-is and the
  // video's total is simply the furthest point across its days. Because watch
  // time only grows, an entry lower than the progress already reached is
  // rejected instead of lowering the total.
  addTime(): void {
    if (!this.latestVideo) return;
    this.updateDuration();
    if (!this.canAdd || this.addGoesBackwards) return;

    const [year, month, day] = this.newDate.split('-').map(Number);
    const now = new Date();

    this.storage.saveVideoNote(year, month, day, {
      videoTitle: this.latestVideo.videoTitle,
      videoUrl: this.latestVideo.videoUrl,
      notes: '',
      position: this.addDuration,
      startTime: now,
      endTime: now,
      durationWatched: this.addSessionTime
    });

    this.closeAddDialog();
    this.loadHistory();
  }

  goToDay(group: DayGroup): void {
    this.router.navigate(['/year', group.year, 'month', group.month, 'day', group.day]);
  }

  openVideo(group: DayGroup, entry: WatchEntry): void {
    this.router.navigate(['/year', group.year, 'month', group.month, 'day', group.day, 'video', entry.video.id]);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  // Keeps the "watched today" badge correct if the page stays open overnight.
  private readonly refreshTimer = window.setInterval(() => this.loadHistory(), 60 * 60 * 1000);

  private entryTime(video: VideoNote): number {
    const time = new Date(video.updatedAt || video.timestamp || 0).getTime();
    return isNaN(time) ? 0 : time;
  }

  private formatEntryTime(video: VideoNote): string {
    const date = new Date(video.timestamp || video.updatedAt);
    if (isNaN(date.getTime())) return '';
    const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return video.startTime ? `started ${time}` : `saved ${time}`;
  }

  private formatFullDate(date: Date): string {
    const weekday = this.dayNames[date.getDay()];
    const month = date.toLocaleDateString('en-US', { month: 'long' });
    return `${weekday}, ${month} ${date.getDate()}${this.getOrdinalSuffix(date.getDate())}, ${date.getFullYear()}`;
  }

  private getRelativeDayLabel(date: Date): string {
    if (this.isSameDay(date, this.today)) return 'Today';

    const yesterday = new Date(this.today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (this.isSameDay(date, yesterday)) return 'Yesterday';

    const startOfToday = new Date(this.today.getFullYear(), this.today.getMonth(), this.today.getDate());
    const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((startOfToday.getTime() - startOfDate.getTime()) / 86400000);
    return diffDays > 1 ? `${diffDays} days ago` : '';
  }

  private isSameDay(a: Date, b: Date): boolean {
    return a.getFullYear() === b.getFullYear() &&
           a.getMonth() === b.getMonth() &&
           a.getDate() === b.getDate();
  }

  private toDateKey(year: number, month: number, day: number): string {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  getNotesPreview(notes: string): string {
    if (!notes) return '';
    return notes.length > 160 ? notes.substring(0, 160) + '...' : notes;
  }

  formatWatchTime(seconds: number): string {
    return formatDuration(seconds);
  }

  private getOrdinalSuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }
}

