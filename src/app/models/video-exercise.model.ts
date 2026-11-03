import { VideoNote, getVideoKey, generateId } from './video-note.model';

/** One exercise point of a video, numbered 1..MAX_EXERCISE_POINTS. */
export interface ExercisePoint {
  /** Position of the point in the list (1-based). */
  number: number;
  text: string;
  completed: boolean;
}

/**
 * The practical exercises of one video. Exercises belong to the video, not
 * to a single day of its watch history, so every saved entry of the video
 * gets the same copy and they all show the same progress.
 */
export interface VideoExercise {
  videoId: string;
  videoTitle: string;
  videoUrl: string;
  category?: string;
  points: ExercisePoint[];
  createdAt: Date;
  updatedAt: Date;
}

/** Exercises can be written as points 1 to 20. */
export const MAX_EXERCISE_POINTS = 20;

/** Progress of a video's exercises, in percent (0-100). */
export function getExerciseProgress(exercises: Pick<VideoExercise, 'points'> | null | undefined): number {
  const points = exercises?.points ?? [];
  if (points.length === 0) return 0;
  const done = points.filter(point => point.completed).length;
  return Math.round((done / points.length) * 100);
}

/** True when every written exercise point is marked completed. */
export function isExerciseCompleted(exercises: Pick<VideoExercise, 'points'> | null | undefined): boolean {
  const points = exercises?.points ?? [];
  return points.length > 0 && points.every(point => point.completed);
}

/** Number of written exercise points. */
export function getExercisePointCount(exercises: Pick<VideoExercise, 'points'> | null | undefined): number {
  return exercises?.points?.length ?? 0;
}

/**
 * Trims the points, drops empty ones and renumbers them 1..N, so the list
 * always reads as points 1 to 20 without gaps.
 */
export function normalizeExercisePoints(points: ExercisePoint[]): ExercisePoint[] {
  return points
    .filter(point => (point.text || '').trim().length > 0)
    .slice(0, MAX_EXERCISE_POINTS)
    .map((point, index) => ({
      number: index + 1,
      text: point.text.trim(),
      completed: point.completed === true
    }));
}

/** An empty list of exercise points, one slot per allowed point. */
export function createEmptyExercisePoints(): ExercisePoint[] {
  return Array.from({ length: MAX_EXERCISE_POINTS }, (_, index) => ({
    number: index + 1,
    text: '',
    completed: false
  }));
}

/** Copies a video's exercises onto `video` (the video itself is unchanged). */
export function withExercises<T extends VideoNote>(video: T, exercises: VideoExercise | null | undefined): T {
  if (!exercises) return video;
  return {
    ...video,
    exercises: {
      points: exercises.points.map(point => ({ ...point })),
      updatedAt: exercises.updatedAt
    }
  } as T;
}

/**
 * Picks the most recently updated exercises of a video from several copies
 * (the same video keeps one copy per saved entry).
 */
export function getLatestExercises(
  copies: (VideoExercise | undefined | null)[]
): VideoExercise | null {
  let latest: VideoExercise | null = null;
  let latestTime = -1;
  for (const copy of copies) {
    if (!copy) continue;
    const time = new Date(copy.updatedAt || 0).getTime();
    if (isNaN(time)) continue;
    if (time > latestTime) {
      latest = copy;
      latestTime = time;
    }
  }
  return latest;
}

/** Builds a new exercise record for a video. */
export function createExercises(video: Pick<VideoNote, 'id' | 'videoTitle' | 'videoUrl' | 'category'>, points: ExercisePoint[]): VideoExercise {
  const now = new Date();
  return {
    videoId: video.id,
    videoTitle: video.videoTitle || '',
    videoUrl: video.videoUrl || '',
    category: video.category,
    points: normalizeExercisePoints(points),
    createdAt: now,
    updatedAt: now
  };
}

/** Stable identity of a video's exercises (URL, or title when there is none). */
export function getExerciseVideoKey(video: Pick<VideoNote, 'videoUrl' | 'videoTitle' | 'id'>): string {
  return getVideoKey(video) || video.id || generateId();
}
