import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import {
  VideoNote, formatDuration,
  getVideoThumbnail, getYouTubeThumbnailUrl
} from '../models/video-note.model';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HeaderComponent } from '../header/header.component';

/** One watch entry inside a day of the history timeline. */
interface WatchEntry {
  video: VideoNote;
  timeLabel: string;
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
  /** Total seconds of watch time about to be added. */
  addDuration: number = 0;

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
  loadHistory(): void {
    this.today = new Date();
    const entries = this.storage.getVideoHistory(this.videoId).slice().sort((a, b) =>
      b.date.getTime() - a.date.getTime() ||
      this.entryTime(b.video) - this.entryTime(a.video)
    );

    const groups: DayGroup[] = [];
    const groupsByDate = new Map<string, DayGroup>();

    for (const entry of entries) {
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

      group.entries.push({
        video: entry.video,
        timeLabel: this.formatEntryTime(entry.video)
      });
      group.entries.sort((a, b) => this.entryTime(b.video) - this.entryTime(a.video));

      group.totalWatched += this.watchTime(entry.video);
      group.position = Math.max(group.position, entry.video.position || 0);
      if (entry.video.notes && entry.video.notes.trim().length > 0) {
        group.hasNotes = true;
      }
    }

    this.days = groups;
    this.latestVideo = entries.length > 0 ? entries[0].video : null;
  }

  // Real YouTube thumbnail when the video has a YouTube URL, else the
  // bundled placeholder thumbnail.
  getThumbnail(): string {
    const video = this.latestVideo;
    return getYouTubeThumbnailUrl(video?.videoUrl)
      ?? getVideoThumbnail(video?.id || video?.videoUrl || video?.videoTitle);
  }

  getTotalWatchTime(): number {
    return this.days.reduce((total, group) => total + group.totalWatched, 0);
  }

  getTotalSaves(): number {
    return this.days.reduce((total, group) => total + group.entries.length, 0);
  }

  getTodayWatchTime(): number {
    const todayGroup = this.days.find(group => group.isToday);
    return todayGroup ? todayGroup.totalWatched : 0;
  }

  // Furthest position reached in the video, across every saved day.
  getLatestPosition(): number {
    return this.days.reduce((max, group) => Math.max(max, group.position), 0);
  }

  getSavesLabel(group: DayGroup): string {
    const count = group.entries.length;
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

  openAddDialog(): void {
    // The app loads its data before booting, so "today" is always ready here.
    this.newDate = this.maxDate;
    this.addHours = null;
    this.addMinutes = null;
    this.addSeconds = null;
    this.addDuration = 0;
    this.showAddDialog = true;
  }

  closeAddDialog(): void {
    this.showAddDialog = false;
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

  // Saves a new watch entry for the same video on the chosen day. The
  // position continues from the furthest point already reached.
  addTime(): void {
    if (!this.latestVideo) return;
    this.updateDuration();
    if (!this.canAdd) return;

    const parts = this.newDate.split('-').map(Number);
    const [year, month, day] = parts;
    const now = new Date();
    const reference = this.latestVideo;

    this.storage.saveVideoNote(year, month, day, {
      videoTitle: reference.videoTitle,
      videoUrl: reference.videoUrl,
      notes: '',
      position: this.getLatestPosition() + this.addDuration,
      startTime: now,
      endTime: now,
      durationWatched: this.addDuration
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

  private watchTime(video: VideoNote): number {
    return video.durationWatched ?? video.position ?? 0;
  }

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

