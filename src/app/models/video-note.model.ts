export interface VideoNote {
  id: string;
  videoTitle: string;
  videoUrl: string;
  notes: string;
  timestamp: Date; // When the note was created/updated
  position: number; // Position in the video (seconds)
  createdAt: Date;
  updatedAt: Date;
}

export interface DayData {
  date: Date;
  videos: VideoNote[];
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