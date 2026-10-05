export interface VideoNote {
  id: string;
  videoTitle: string;
  videoUrl: string;
  notes: string;
  timestamp: Date; // When the note was created/updated
  position: number; // Position in the video (seconds)
  startTime?: Date; // When video watching started
  endTime?: Date; // When video watching ended
  durationWatched?: number; // Duration watched in seconds
  createdAt: Date;
  updatedAt: Date;
}

export interface DayData {
  date: Date;
  videos: VideoNote[];
}

// A video note ranked in the "Top Videos" list, carrying the calendar
// day it was last watched on so the UI can link to that day's page.
export interface TopVideoNote extends VideoNote {
  watchDay: { year: number; month: number; day: number };
}

// One saved watch entry of a video in its history: the note as stored
// on the given day.
export interface VideoHistoryEntry {
  video: VideoNote;
  day: { year: number; month: number; day: number };
  date: Date;
}

export interface MonthData {
  month: number;
  year: number;
  days: DayData[];
}

export interface YearData {
  year: number;
  months: MonthData[];
}

// Progress tracking types
export interface DailyProgress {
  date: Date;
  totalTimeWatched: number; // in seconds
  videosWatched: number;
  notesTaken: number;
  longestSession: number; // in seconds
  dayOfWeek: string;
}

export interface WeeklyProgress {
  weekStart: Date;
  weekEnd: Date;
  totalTime: number;
  totalDays: number;
  dailyBreakdown: DailyProgress[];
  averageTime: number;
  longestStreak: number;
}

export interface ProgressStats {
  today: DailyProgress;
  yesterday: DailyProgress;
  thisWeek: WeeklyProgress;
  thisMonth: number; // total time this month in seconds
  allTime: number; // total time all-time in seconds
  averagePerDay: number;
  bestDay: DailyProgress;
  currentStreak: number;
}

// Motivation types
export interface MotivationMessage {
  type: 'achievement' | 'encouragement' | 'tip' | 'milestone';
  text: string;
  emoji: string;
  progress: number; // 0-100 percentage
}

// Navigation types
export type NavigationOption = 'current-year' | 'current-month' | 'today' | 'yesterday';

// Helper to create unique ID
export function generateId(): string {
  return Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
}

// Helper to get date string for storage key
export function getDateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Helper to get month key
export function getMonthKey(year: number, month: number): string {
  return `${year}-${month.toString().padStart(2, '0')}`;
}

// Helper to get year key
export function getYearKey(year: number): string {
  return year.toString();
}

// Helper to calculate time watched between start and end
export function calculateTimeWatched(startTime: Date | undefined, endTime: Date | undefined, position: number = 0): number {
  if (!startTime || !endTime) return position; // Fallback to position if no timestamps
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.max(Math.floor(diffMs / 1000), position);
}

// Helper to format duration
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

// Total number of bundled video thumbnails (public/assets/thumbnails/thumb-N.svg)
export const THUMBNAIL_COUNT = 100;

// Helper to get a unique thumbnail path (1..100) for a video id.
// Deterministic per id, so a video keeps the same thumbnail, and it
// cycles/repeats after 100 videos. Falls back to the title when there is no id.
export function getVideoThumbnail(idOrSeed: string | undefined | null): string {
  const seed = idOrSeed || 'video';
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  const index = (Math.abs(hash) % THUMBNAIL_COUNT) + 1;
  return `assets/thumbnails/thumb-${index}.svg`;
}

// Helper to get the real thumbnail of a YouTube video from any YouTube
// link (youtu.be/ID, watch?v=ID, shorts/embed/live/ID). Returns null when
// the URL is not a YouTube video, so callers can fall back to the
// bundled placeholder thumbnails.
export function getYouTubeThumbnailUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  const patterns = [
    /youtu\.be\/([\w-]{11})/,
    /[?&]v=([\w-]{11})/,
    /youtube\.com\/(?:shorts|embed|live|v)\/([\w-]{11})/
  ];
  for (const pattern of patterns) {
    const match = trimmed.match(pattern);
    if (match) return `https://i.ytimg.com/vi/${match[1]}/hqdefault.jpg`;
  }
  return null;
}

// Helper to get progress message
export function getProgressMessage(stats: ProgressStats): MotivationMessage[] {
  const messages: MotivationMessage[] = [];
  
  // Today's progress
  const todayPercent = Math.min((stats.today.totalTimeWatched / 3600) * 10, 100); // 10 hours = 100%
  
  if (stats.today.totalTimeWatched >= 7200) { // 2+ hours
    messages.push({
      type: 'achievement',
      text: `Amazing! You've watched over 2 hours today!`,
      emoji: '🏆',
      progress: 100
    });
  } else if (stats.today.totalTimeWatched >= 3600) { // 1+ hour
    messages.push({
      type: 'achievement',
      text: `Great job! Over 1 hour of learning today!`,
      emoji: '🎯',
      progress: todayPercent
    });
  } else if (stats.today.totalTimeWatched > 0) {
    messages.push({
      type: 'encouragement',
      text: `Good start! Keep going to reach your daily goal!`,
      emoji: '💪',
      progress: todayPercent
    });
  }
  
  // Streak motivation
  if (stats.currentStreak >= 7) {
    messages.push({
      type: 'milestone',
      text: `Incredible! ${stats.currentStreak}-day streak! Keep it going!`,
      emoji: '🔥',
      progress: 100
    });
  } else if (stats.currentStreak >= 3) {
    messages.push({
      type: 'encouragement',
      text: `Nice streak! ${stats.currentStreak} days in a row!`,
      emoji: '✨',
      progress: (stats.currentStreak / 7) * 100
    });
  }
  
  // Weekly progress
  if (stats.thisWeek.totalTime >= 25200) { // 7+ hours
    messages.push({
      type: 'milestone',
      text: `Weekly champion! Over 7 hours this week!`,
      emoji: '🌟',
      progress: 100
    });
  }
  
  // Tips
  if (stats.today.totalTimeWatched === 0 && new Date().getHours() < 18) {
    messages.push({
      type: 'tip',
      text: `Today's a great day to learn something new!`,
      emoji: '💡',
      progress: 0
    });
  }
  
  // Ensure at least one message
  if (messages.length === 0) {
    messages.push({
      type: 'encouragement',
      text: `Every minute of learning counts!`,
      emoji: '📚',
      progress: stats.allTime > 0 ? Math.min((stats.allTime / 86400) * 100, 100) : 0
    });
  }
  
  return messages;
}

// Helper to get random motivation emoji
export function getRandomEmoji(): string {
  const emojis = ['🎯', '🏆', '🔥', '✨', '🌟', '💪', '📚', '💡', '🚀', '🌈', '🌱', '🌻', '🎉', '🎊', '🎓'];
  return emojis[Math.floor(Math.random() * emojis.length)];
}