import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { VideoNote, VideoHistoryEntry, formatDuration, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-video-history',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './video-history.component.html',
  styleUrls: ['./video-history.component.scss']
})
export class VideoHistoryComponent implements OnInit {
  videoId: string = '';
  entries: VideoHistoryEntry[] = [];
  latestVideo: VideoNote | null = null;

  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(private route: ActivatedRoute, private router: Router, private storage: StorageService) {}

  ngOnInit(): void {
    this.videoId = this.route.snapshot.paramMap.get('videoId') || '';
    this.loadHistory();
  }

  loadHistory(): void {
    this.entries = this.storage.getVideoHistory(this.videoId);
    this.latestVideo = this.entries.length > 0
      ? this.entries[this.entries.length - 1].video
      : null;
  }

  // Real YouTube thumbnail when the video has a YouTube URL, else the
  // bundled placeholder thumbnail.
  getThumbnail(): string {
    const video = this.latestVideo;
    return getYouTubeThumbnailUrl(video?.videoUrl)
      ?? getVideoThumbnail(video?.id || video?.videoUrl || video?.videoTitle);
  }

  getTotalWatchTime(): number {
    return this.entries.reduce(
      (total, entry) => total + (entry.video.durationWatched ?? entry.video.position ?? 0), 0
    );
  }

  // Latest saved position in the video, e.g. "Watched till 26m 58s"
  getLatestPosition(): number {
    return this.entries.reduce(
      (max, entry) => Math.max(max, entry.video.position || 0), 0
    );
  }

  getDateLabel(entry: VideoHistoryEntry): string {
    const d = entry.date;
    const suffix = this.getOrdinalSuffix(d.getDate());
    return `${this.dayNames[d.getDay()]}, ${this.monthNames[d.getMonth()]} ${d.getDate()}${suffix}, ${d.getFullYear()}`;
  }

  getTimeOfDay(date: Date | string): string {
    return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  getNotesPreview(notes: string): string {
    return notes.length > 120 ? notes.substring(0, 120) + '...' : notes;
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }

  navigateToDay(entry: VideoHistoryEntry): void {
    this.router.navigate([
      '/year', entry.day.year,
      'month', entry.day.month,
      'day', entry.day.day
    ]);
  }

  goHome(): void {
    this.router.navigate(['']);
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
