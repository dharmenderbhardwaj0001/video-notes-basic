import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { StorageService } from '../storage.service';
import { VideoNote, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';

@Component({
  selector: 'app-categories',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './categories.component.html',
  styleUrls: ['./categories.component.scss']
})
export class CategoriesComponent implements OnInit {
  categories: string[] = [];
  categoryImages = new Map<string, string>();

  constructor(private storage: StorageService, private router: Router) {}

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.categories = this.storage.getVideoCategories();
    this.categoryImages = new Map(
      this.categories.map(category => {
        const latestVideo = this.storage.getVideosByCategory(category)[0];
        return [category, this.getThumbnail(latestVideo)];
      })
    );
  }

  getThumbnail(video: VideoNote | undefined): string {
    if (!video) return getVideoThumbnail('category');
    return getYouTubeThumbnailUrl(video.videoUrl)
      ?? getVideoThumbnail(video.id || video.videoUrl || video.videoTitle);
  }

  openCategory(category: string): void {
    this.router.navigate(['/categories', category]);
  }

  openExercises(): void {
    this.router.navigate(['/exercises']);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}
