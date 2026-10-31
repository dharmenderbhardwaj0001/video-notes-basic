import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { CategorySelectComponent } from '../shared/category-select/category-select.component';
import { StorageService } from '../storage.service';
import { VideoNote, formatDuration, generateId, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';

@Component({
  selector: 'app-category-videos',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent, CategorySelectComponent],
  templateUrl: './category-videos.component.html',
  styleUrls: ['./category-videos.component.scss']
})
export class CategoryVideosComponent implements OnInit {
  category = '';
  videos: VideoNote[] = [];
  categoryOptions: string[] = [];

  // Add Video dialog
  showVideoDialog: boolean = false;

  currentVideo: Partial<VideoNote> = {
    videoTitle: '',
    videoUrl: '',
    category: '',
    notes: '',
    position: 0
  };

  // Split position inputs for the dialog (null = empty field)
  positionHours: number | null = null;
  positionMinutes: number | null = null;
  positionSeconds: number | null = null;

  // Action passed to the shared header (Add Video button)
  addVideoAction = (): void => this.openAddVideoDialog();

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.categoryOptions = this.storage.getVideoCategories();
    this.route.paramMap.subscribe(params => {
      this.category = params.get('category') || '';
      this.loadVideos();
    });
  }

  private loadVideos(): void {
    this.videos = this.storage.getVideosByCategory(this.category);
  }

  getThumbnail(video: VideoNote): string {
    return getYouTubeThumbnailUrl(video.videoUrl)
      ?? getVideoThumbnail(video.id || video.videoUrl || video.videoTitle);
  }

  formatDuration(seconds: number): string {
    return formatDuration(seconds);
  }

  formatDate(date: Date): string {
    return new Date(date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  openVideoHistory(video: VideoNote): void {
    this.router.navigate(['/video-history', video.id]);
  }

  openAddVideoDialog(): void {
    this.categoryOptions = this.storage.getVideoCategories();
    this.currentVideo = {
      videoTitle: '',
      videoUrl: '',
      category: this.category,
      notes: '',
      position: 0
    };
    this.setPositionInputs(0);
    this.showVideoDialog = true;
  }

  closeVideoDialog(): void {
    this.showVideoDialog = false;
    this.currentVideo = {
      videoTitle: '',
      videoUrl: '',
      category: '',
      notes: '',
      position: 0
    };
    this.setPositionInputs(0);
  }

  // Split a total number of seconds into hours/minutes/seconds inputs.
  // Zero parts stay empty so the fields never show a prefilled "0".
  private setPositionInputs(totalSeconds: number): void {
    const total = Math.max(0, Math.floor(totalSeconds || 0));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    this.positionHours = hours > 0 ? hours : null;
    this.positionMinutes = minutes > 0 ? minutes : null;
    this.positionSeconds = seconds > 0 ? seconds : null;
  }

  // Combine the hours/minutes/seconds inputs into currentVideo.position.
  updatePosition(): void {
    const h = Math.max(0, Math.floor(Number(this.positionHours) || 0));
    const m = Math.max(0, Math.floor(Number(this.positionMinutes) || 0));
    const s = Math.max(0, Math.floor(Number(this.positionSeconds) || 0));
    this.currentVideo.position = h * 3600 + m * 60 + s;
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

  // Saves the video on today's date so it also appears in the calendar.
  saveVideo(): void {
    if (!this.isFormValid()) return;

    this.updatePosition();

    const { year, month, day } = this.storage.getCurrentDateInfo();

    this.storage.saveVideoNote(year, month, day, {
      ...this.currentVideo,
      videoTitle: (this.currentVideo.videoTitle || '').trim(),
      // Keep the video in this category if the field was cleared.
      category: (this.currentVideo.category || '').trim() || this.category,
      timestamp: new Date(),
      createdAt: new Date(),
      id: generateId()
    });

    this.closeVideoDialog();
    this.loadVideos();
  }

  goToCategories(): void {
    this.router.navigate(['/categories']);
  }
}
