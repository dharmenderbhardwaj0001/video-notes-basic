import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HeaderComponent } from '../header/header.component';
import { StorageService } from '../storage.service';
import { VideoNote, getVideoThumbnail, getYouTubeThumbnailUrl } from '../models/video-note.model';
import {
  ExercisePoint, MAX_EXERCISE_POINTS, createEmptyExercisePoints,
  getExerciseProgress, normalizeExercisePoints
} from '../models/video-exercise.model';

@Component({
  selector: 'app-exercise-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, HeaderComponent],
  templateUrl: './exercise-detail.component.html',
  styleUrls: ['./exercise-detail.component.scss']
})
export class ExerciseDetailComponent implements OnInit {
  videoId: string = '';
  /** The newest saved entry of the video, used for its title and thumbnail. */
  video: VideoNote | null = null;
  /** Written exercise points, in order. */
  points: ExercisePoint[] = [];

  // Editor state: true while adding/editing points 1 to 20.
  isEditing: boolean = false;
  draftPoints: ExercisePoint[] = createEmptyExercisePoints();

  readonly maxPoints = MAX_EXERCISE_POINTS;

  // Action passed to the shared header (opens the exercise editor)
  editAction = (): void => this.startEditing();

  constructor(private route: ActivatedRoute, private router: Router, private storage: StorageService) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.videoId = params['videoId'] || '';
      this.loadExercises();
    });
  }

  loadExercises(): void {
    const history = this.storage.getVideoHistory(this.videoId);
    const latest = history[history.length - 1];
    this.video = latest ? latest.video : null;

    const exercises = this.storage.getVideoExercises(this.videoId);
    if (exercises) {
      this.points = exercises.points.map(point => ({ ...point }));
      this.video = this.video ?? {
        id: exercises.videoId,
        videoTitle: exercises.videoTitle,
        videoUrl: exercises.videoUrl,
        category: exercises.category,
        notes: '',
        position: 0,
        timestamp: exercises.updatedAt,
        createdAt: exercises.createdAt,
        updatedAt: exercises.updatedAt
      };
    } else {
      this.points = [];
    }
  }

  get progress(): number {
    return getExerciseProgress({ points: this.points });
  }

  get completedCount(): number {
    return this.points.filter(point => point.completed).length;
  }

  get isFullyCompleted(): boolean {
    return this.points.length > 0 && this.points.every(point => point.completed);
  }

  getThumbnail(): string {
    return getYouTubeThumbnailUrl(this.video?.videoUrl)
      ?? getVideoThumbnail(this.video?.id || this.videoId);
  }

  /** Marks one point completed, or clears the mark when tapped again. */
  togglePoint(point: ExercisePoint): void {
    if (this.isEditing) return;
    const completed = !point.completed;
    if (!this.storage.setExercisePointCompleted(this.videoId, point.number, completed)) return;
    point.completed = completed;
  }

  /** Marks every written point completed, or clears them all. */
  toggleAll(): void {
    if (this.isEditing || this.points.length === 0) return;
    const completed = !this.isFullyCompleted;
    const points = this.points.map(point => ({ ...point, completed }));
    if (!this.storage.saveVideoExercises(this.videoId, points)) return;
    this.loadExercises();
  }

  // ---- Editor ----

  startEditing(): void {
    // Existing points are loaded in order; the remaining slots stay empty so
    // the list always offers points 1 to 20.
    const empty = createEmptyExercisePoints();
    this.draftPoints = empty.map(slot => {
      const existing = this.points.find(point => point.number === slot.number);
      return existing ? { ...existing } : slot;
    });
    this.isEditing = true;
  }

  cancelEditing(): void {
    this.isEditing = false;
  }

  get draftCount(): number {
    return normalizeExercisePoints(this.draftPoints).length;
  }

  saveExercises(): void {
    const points = normalizeExercisePoints(this.draftPoints);
    if (points.length === 0) return;
    this.storage.saveVideoExercises(this.videoId, points);
    this.isEditing = false;
    this.loadExercises();
  }

  clearExercises(): void {
    this.isEditing = false;
    this.points = [];
    this.storage.saveVideoExercises(this.videoId, []);
  }

  openVideoHistory(): void {
    this.router.navigate(['/video-history', this.videoId]);
  }

  goToExercises(): void {
    this.router.navigate(['/exercises']);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }
}
