import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { VideoNote, generateId, getVideoThumbnail } from '../models/video-note.model';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-day',
  standalone: true,
  imports: [FormsModule, CommonModule, HeaderComponent],
  templateUrl: './day.component.html',
  styleUrls: ['./day.component.scss']
})
export class DayComponent implements OnInit {
  year: number = 0;
  month: number = 0;
  day: number = 0;
  
  monthName: string = '';
  dayName: string = '';
  daySuffix: string = '';
  dayStats: string = '';
  
  videos: VideoNote[] = [];
  dayStatsObj: any = null;

  // Dialog states
  showVideoDialog: boolean = false;
  showDeleteDialog: boolean = false;
  editingVideo: VideoNote | null = null;
  videoToDelete: VideoNote | null = null;
  
  currentVideo: Partial<VideoNote> = {
    videoTitle: '',
    videoUrl: '',
    notes: '',
    position: 0
  };

  // Split position inputs for the dialog
  positionHours: number = 0;
  positionMinutes: number = 0;
  positionSeconds: number = 0;

  // Action passed to the shared header (Add Video button)
  addVideoAction = (): void => this.openAddVideoDialog();

  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
  
  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  private colors = [
    '#e8f5e8', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5',
    '#e1f5fe', '#e8f5e9', '#fff8e1', '#f5f5f5'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = parseInt(params['year']);
      this.month = parseInt(params['month']);
      this.day = parseInt(params['day']);
      
      this.monthName = this.monthNames[this.month - 1];
      const date = new Date(this.year, this.month - 1, this.day);
      this.dayName = this.dayNames[date.getDay()];
      this.daySuffix = this.getDaySuffix(this.day);
      
      this.loadVideos();
    });
  }

  private getDaySuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  private loadVideos(): void {
    this.videos = this.storage.getVideoNotesForDay(this.year, this.month, this.day);
    this.updateDayStats();
  }

  private updateDayStats(): void {
    const totalVideos = this.videos.length;
    const totalNotes = this.videos.filter(v => v.notes && v.notes.trim().length > 0).length;
    const totalTime = this.videos.reduce((total, video) => total + video.position, 0);
    const continueWatching = this.videos.filter(v => v.position > 0).length;

    this.dayStatsObj = {
      totalVideos,
      totalNotes,
      totalTime: this.formatDuration(totalTime),
      continueWatching
    };

    // Create subtitle
    const notesText = totalNotes > 0 ? ` • ${totalNotes} with notes` : '';
    const continueText = continueWatching > 0 ? ` • ${continueWatching} to continue` : '';
    this.dayStats = `${totalVideos} videos${notesText}${continueText}`;
  }

  getRandomColor(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.colors[Math.abs(hash) % this.colors.length];
  }

  // Thumbnail for a video (used when the video has no title)
  getThumbnail(video: VideoNote): string {
    return getVideoThumbnail(video.id || video.videoUrl || video.videoTitle);
  }

  getShortUrl(url: string): string {
    if (!url) return 'No URL';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  getShortNotes(notes: string): string {
    return notes.length > 100 ? notes.substring(0, 100) + '...' : notes;
  }

  formatTimestamp(date: Date): string {
    const d = new Date(date);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  formatPosition(seconds: number): string {
    return this.formatDuration(seconds);
  }

  formatDuration(seconds: number): string {
    if (seconds === 0) return '0s';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  }

  refreshVideos(): void {
    this.loadVideos();
  }

  openAddVideoDialog(): void {
    this.editingVideo = null;
    this.currentVideo = {
      videoTitle: '',
      videoUrl: '',
      notes: '',
      position: 0
    };
    this.setPositionInputs(0);
    this.showVideoDialog = true;
  }

  editVideo(video: VideoNote): void {
    this.editingVideo = video;
    this.currentVideo = {
      ...video
    };
    this.setPositionInputs(video.position || 0);
    this.showVideoDialog = true;
  }

  // Split a total number of seconds into hours/minutes/seconds inputs
  private setPositionInputs(totalSeconds: number): void {
    const total = Math.max(0, Math.floor(totalSeconds || 0));
    this.positionHours = Math.floor(total / 3600);
    this.positionMinutes = Math.floor((total % 3600) / 60);
    this.positionSeconds = total % 60;
  }

  // Combine the hours/minutes/seconds inputs into currentVideo.position
  updatePosition(): void {
    const h = Math.max(0, Math.floor(Number(this.positionHours) || 0));
    const m = Math.max(0, Math.floor(Number(this.positionMinutes) || 0));
    const s = Math.max(0, Math.floor(Number(this.positionSeconds) || 0));
    this.positionHours = h;
    this.positionMinutes = m;
    this.positionSeconds = s;
    this.currentVideo.position = h * 3600 + m * 60 + s;
  }

  closeVideoDialog(): void {
    this.showVideoDialog = false;
    this.currentVideo = {
      videoTitle: '',
      videoUrl: '',
      notes: '',
      position: 0
    };
    this.setPositionInputs(0);
    this.editingVideo = null;
  }

  saveVideo(): void {
    if (!this.isFormValid()) return;

    this.updatePosition();

    const title = (this.currentVideo.videoTitle || '').trim();

    const videoData = {
      ...this.currentVideo,
      // No title required — fall back to a friendly placeholder so a
      // unique thumbnail is shown instead.
      videoTitle: title,
      timestamp: this.editingVideo ? this.editingVideo.timestamp : new Date(),
      createdAt: this.editingVideo ? this.editingVideo.createdAt : new Date(),
      id: this.editingVideo?.id || generateId()
    };

    this.storage.saveVideoNote(this.year, this.month, this.day, videoData);
    this.closeVideoDialog();
    this.loadVideos();
  }

  // A title is optional: allow saving as long as a URL, a title, a position,
  // or notes were provided. A missing title shows the thumbnail instead.
  isFormValid(): boolean {
    return !!(
      (this.currentVideo.videoTitle && this.currentVideo.videoTitle.trim().length > 0) ||
      (this.currentVideo.videoUrl && this.currentVideo.videoUrl.trim().length > 0) ||
      (this.currentVideo.notes && this.currentVideo.notes.trim().length > 0) ||
      (this.currentVideo.position && this.currentVideo.position > 0)
    );
  }

  deleteVideo(video: VideoNote): void {
    this.videoToDelete = video;
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
    this.videoToDelete = null;
  }

  confirmDeleteVideo(): void {
    if (this.videoToDelete) {
      this.storage.deleteVideoNote(this.year, this.month, this.day, this.videoToDelete.id);
      this.closeDeleteDialog();
      this.loadVideos();
    }
  }

  continueVideo(video: VideoNote): void {
    // Start tracking session when continuing
    const updatedVideo = this.storage.startVideoSession(video.id, this.year, this.month, this.day);
    if (updatedVideo) {
      // Replace the video in our list
      const index = this.videos.findIndex(v => v.id === video.id);
      if (index >= 0) {
        this.videos[index] = updatedVideo;
      }
    }
    
    // Open video detail for continuation
    this.router.navigate([
      '/year', this.year, 
      'month', this.month, 
      'day', this.day, 
      'video', video.id
    ]);
  }

  goBack(): void {
    this.router.navigate(['/year', this.year, 'month', this.month]);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  goToYear(): void {
    this.router.navigate(['/year', this.year]);
  }

  goToMonth(): void {
    this.router.navigate(['/year', this.year, 'month', this.month]);
  }
}