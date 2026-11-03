import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { StorageService } from '../storage.service';
import { VideoNote, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';
import { getExerciseProgress, getExercisePointCount } from '../models/video-exercise.model';

/** A video with its exercise progress, as shown in the list. */
interface ExerciseCard {
  video: VideoNote;
  progress: number;
  total: number;
  completed: number;
}

type ExerciseFilter = 'all' | 'pending' | 'completed';

@Component({
  selector: 'app-exercises',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './exercises.component.html',
  styleUrls: ['./exercises.component.scss']
})
export class ExercisesComponent implements OnInit {
  /** Every video that has exercises written. */
  cards: ExerciseCard[] = [];
  /** Videos after the active filter is applied. */
  filteredCards: ExerciseCard[] = [];
  filter: ExerciseFilter = 'all';
  showFilterMenu: boolean = false;

  readonly filters: { id: ExerciseFilter; label: string }[] = [
    { id: 'all', label: 'All videos' },
    { id: 'pending', label: 'Pending exercises' },
    { id: 'completed', label: 'Completed exercises' }
  ];

  constructor(private storage: StorageService, private router: Router) {}

  ngOnInit(): void {
    this.loadExercises();
  }

  loadExercises(): void {
    this.cards = this.storage.getVideosWithExercises().map(entry => {
      const total = getExercisePointCount(entry.exercises);
      return {
        video: entry.video,
        progress: getExerciseProgress(entry.exercises),
        total,
        completed: entry.exercises.points.filter(point => point.completed).length
      };
    });
    this.applyFilter();
  }

  get activeFilterLabel(): string {
    return this.filters.find(option => option.id === this.filter)?.label ?? 'All videos';
  }

  get pendingCount(): number {
    return this.cards.filter(card => card.progress < 100).length;
  }

  setFilter(filter: ExerciseFilter): void {
    this.filter = filter;
    this.applyFilter();
  }

  selectFilter(filter: ExerciseFilter): void {
    this.showFilterMenu = false;
    this.setFilter(filter);
  }

  // "Pending exercises" only keeps videos with points still to complete.
  private applyFilter(): void {
    switch (this.filter) {
      case 'pending':
        this.filteredCards = this.cards.filter(card => card.progress < 100);
        break;
      case 'completed':
        this.filteredCards = this.cards.filter(card => card.progress === 100);
        break;
      default:
        this.filteredCards = this.cards.slice();
    }
  }

  getThumbnail(video: VideoNote): string {
    return getYouTubeThumbnailUrl(video.videoUrl)
      ?? getVideoThumbnail(video.id || video.videoUrl || video.videoTitle);
  }

  formatDate(date: Date | string | undefined): string {
    if (!date) return '';
    return new Date(date).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' });
  }

  openExercises(card: ExerciseCard): void {
    this.router.navigate(['/exercises', card.video.id]);
  }

  goToCategories(): void {
    this.router.navigate(['/categories']);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}
