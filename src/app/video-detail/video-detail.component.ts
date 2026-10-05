import { Component, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { VideoNote, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';
import { Location } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-video-detail',
  standalone: true,
  imports: [FormsModule, CommonModule, HeaderComponent],
  templateUrl: './video-detail.component.html',
  styleUrls: ['./video-detail.component.scss']
})
export class VideoDetailComponent implements OnInit, OnDestroy {
  year: number = 0;
  month: number = 0;
  day: number = 0;
  videoId: string = '';
  
  monthName: string = '';
  daySuffix: string = '';
  
  video: VideoNote | null = null;
  
  // Player state
  isPlaying: boolean = false;
  currentPosition: number = 0;
  duration: number = 0;
  currentProgress: number = 0;
  
  // Notes editing
  editingNotes: boolean = false;
  currentNotes: string = '';
  
  // Dialog state
  showDeleteDialog: boolean = false;

  // Action passed to the shared header (Save Position button)
  savePositionAction = (): void => this.autoSavePosition();
  
  private autoSaveInterval: any;
  private positionUpdateInterval: any;
  
  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];

  private colors = [
    '#e8f5e8', '#e3f2fd', '#fff3e0', '#fce4ec', '#f3e5f5',
    '#e1f5fe', '#e8f5e9', '#fff8e1', '#f5f5f5'
  ];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = parseInt(params['year']);
      this.month = parseInt(params['month']);
      this.day = parseInt(params['day']);
      this.videoId = params['videoId'];
      
      this.monthName = this.monthNames[this.month - 1];
      this.daySuffix = this.getDaySuffix(this.day);
      
      this.loadVideo();
    });

    // Simulate auto-saving position every 30 seconds
    this.autoSaveInterval = setInterval(() => {
      this.autoSavePosition();
    }, 30000);

    // Simulate position update while playing
    this.positionUpdateInterval = setInterval(() => {
      if (this.isPlaying && this.currentPosition < this.duration) {
        this.currentPosition += 1;
        this.updateProgress();
      }
    }, 1000);
  }

  ngOnDestroy(): void {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
    }
    if (this.positionUpdateInterval) {
      clearInterval(this.positionUpdateInterval);
    }
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

  private loadVideo(): void {
    const videos = this.storage.getVideoNotesForDay(this.year, this.month, this.day);
    this.video = videos.find(v => v.id === this.videoId) || null;
    
    if (this.video) {
      this.currentPosition = this.video.position || 0;
      this.currentNotes = this.video.notes || '';
      this.updateProgress();
      
      // Set duration (for demo purposes, we'll use a default or calculate from position)
      this.duration = this.video.position ? this.video.position * 2 : 3600; // Default 1 hour if no position
    }
  }

  getRandomColor(id: string): string {
    if (!id) return '#f5f5f5';
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return this.colors[Math.abs(hash) % this.colors.length];
  }

  // Real YouTube thumbnail when the video has a YouTube URL, else the
  // bundled placeholder thumbnail.
  getThumbnail(): string {
    return getYouTubeThumbnailUrl(this.video?.videoUrl)
      ?? getVideoThumbnail(this.video?.id || this.video?.videoUrl || this.video?.videoTitle);
  }

  getShortUrl(url: string | undefined): string {
    if (!url) return 'No URL';
    try {
      const urlObj = new URL(url);
      return urlObj.hostname;
    } catch {
      return url.length > 30 ? url.substring(0, 30) + '...' : url;
    }
  }

  formatDate(date: Date | undefined): string {
    if (!date) return 'Unknown';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  formatPosition(seconds: number | undefined): string {
    if (!seconds) return '0s';
    
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

  updateProgress(): void {
    if (this.duration > 0) {
      this.currentProgress = (this.currentPosition / this.duration) * 100;
    }
  }

  playPause(): void {
    this.isPlaying = !this.isPlaying;
  }

  updatePosition(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.currentPosition = parseInt(input.value) || 0;
    this.updateProgress();
  }

  updateManualPosition(): void {
    this.updateProgress();
  }

  autoSavePosition(): void {
    if (!this.video) return;
    
    // Save the current position
    const updatedVideo = this.storage.saveCurrentPosition(
      this.video.id, 
      this.year, 
      this.month, 
      this.day, 
      this.currentPosition
    );
    
    if (updatedVideo) {
      this.video = updatedVideo;
      // Show a brief notification
      this.showSaveNotification();
    }
  }

  showSaveNotification(): void {
    // For now, just console log. We can add a proper notification system later
    console.log('Position saved:', this.currentPosition + ' seconds');
  }

  toggleEditNotes(): void {
    this.editingNotes = !this.editingNotes;
    this.currentNotes = this.video?.notes || '';
  }

  saveNotes(): void {
    if (!this.video || !this.currentNotes.trim()) return;
    
    const updatedVideo = this.storage.saveVideoNote(this.year, this.month, this.day, {
      ...this.video,
      notes: this.currentNotes,
      updatedAt: new Date()
    });
    
    if (updatedVideo) {
      this.video = updatedVideo;
      this.editingNotes = false;
    }
  }

  cancelEditNotes(): void {
    this.editingNotes = false;
    this.currentNotes = this.video?.notes || '';
  }

  editVideo(): void {
    // Navigate back to day with edit mode
    this.router.navigate([
      '/year', this.year, 
      'month', this.month, 
      'day', this.day
    ], {
      state: { editVideoId: this.videoId }
    });
  }

  deleteVideo(): void {
    this.showDeleteDialog = true;
  }

  closeDeleteDialog(): void {
    this.showDeleteDialog = false;
  }

  confirmDelete(): void {
    if (this.video) {
      this.storage.deleteVideoNote(this.year, this.month, this.day, this.video.id);
      this.closeDeleteDialog();
      this.router.navigate(['/year', this.year, 'month', this.month, 'day', this.day]);
    }
  }

  goBack(): void {
    this.location.back();
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  goToYear(): void {
    this.router.navigate(['/year', this.year]);
  }

  goToMonth(): void {
    this.router.navigate(['/year', this.year, 'month', this.month]);
  }

  goToDay(): void {
    this.router.navigate(['/year', this.year, 'month', this.month, 'day', this.day]);
  }
}