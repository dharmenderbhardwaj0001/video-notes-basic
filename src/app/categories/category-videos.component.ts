import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { StorageService } from '../storage.service';
import { VideoNote, formatDuration, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';

@Component({
  selector: 'app-category-videos',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './category-videos.component.html',
  styleUrls: ['./category-videos.component.scss']
})
export class CategoryVideosComponent implements OnInit {
  category = '';
  videos: VideoNote[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      this.category = params.get('category') || '';
      this.videos = this.storage.getVideosByCategory(this.category);
    });
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

  goToCategories(): void {
    this.router.navigate(['/categories']);
  }
}
