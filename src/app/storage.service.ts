import { Injectable } from '@angular/core';
import { VideoNote, DayData, MonthData, YearData, generateId, getDateKey, getMonthKey, getYearKey } from './models/video-note.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private readonly STORAGE_KEY = 'video_notes_app';

  constructor() {}

  // Initialize storage with default structure if not exists
  private initializeStorage(): void {
    const existingData = localStorage.getItem(this.STORAGE_KEY);
    if (!existingData) {
      const initialData: YearData[] = [];
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(initialData));
    }
  }

  // Get all data from storage
  private getAllData(): YearData[] {
    this.initializeStorage();
    const data = localStorage.getItem(this.STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }

  // Save all data to storage
  private saveAllData(data: YearData[]): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  }

  // Get year data
  getYear(year: number): YearData | null {
    const data = this.getAllData();
    return data.find(y => y.year === year) || null;
  }

  // Get month data within a year
  getMonth(year: number, month: number): MonthData | null {
    const yearData = this.getYear(year);
    if (!yearData) return null;
    return yearData.months.find(m => m.month === month) || null;
  }

  // Get day data within a month
  getDay(year: number, month: number, day: number): DayData | null {
    const monthData = this.getMonth(year, month);
    if (!monthData) return null;
    
    const targetDate = new Date(year, month - 1, day);
    return monthData.days.find(d => {
      const dayDate = new Date(d.date);
      return dayDate.getDate() === day && 
             dayDate.getMonth() === month - 1 && 
             dayDate.getFullYear() === year;
    }) || null;
  }

  // Add or update video note for a specific day
  saveVideoNote(year: number, month: number, day: number, videoNote: Partial<VideoNote>): VideoNote {
    const allData = this.getAllData();
    const targetDate = new Date(year, month - 1, day);
    const dateKey = getDateKey(targetDate);

    // Find or create year
    let yearData = allData.find(y => y.year === year);
    if (!yearData) {
      yearData = { year, months: [] };
      allData.push(yearData);
    }

    // Find or create month
    let monthData = yearData.months.find(m => m.month === month);
    if (!monthData) {
      monthData = { month, year, days: [] };
      yearData.months.push(monthData);
    }

    // Find or create day
    let dayData = monthData.days.find(d => getDateKey(new Date(d.date)) === dateKey);
    if (!dayData) {
      dayData = { date: targetDate, videos: [] };
      monthData.days.push(dayData);
    }

    // Create new video note with timestamp
    const now = new Date();
    const newVideoNote: VideoNote = {
      id: videoNote.id || generateId(),
      videoTitle: videoNote.videoTitle || '',
      videoUrl: videoNote.videoUrl || '',
      notes: videoNote.notes || '',
      timestamp: videoNote.timestamp || now,
      position: videoNote.position || 0,
      createdAt: videoNote.createdAt || now,
      updatedAt: now
    };

    // If this is an update, replace existing note
    if (videoNote.id) {
      const existingIndex = dayData.videos.findIndex(v => v.id === videoNote.id);
      if (existingIndex >= 0) {
        dayData.videos[existingIndex] = newVideoNote;
      } else {
        dayData.videos.push(newVideoNote);
      }
    } else {
      dayData.videos.push(newVideoNote);
    }

    // Sort videos by timestamp
    dayData.videos.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // Save all data
    this.saveAllData(allData);
    
    return newVideoNote;
  }

  // Delete video note
  deleteVideoNote(year: number, month: number, day: number, videoId: string): boolean {
    const allData = this.getAllData();
    const targetDate = new Date(year, month - 1, day);
    const dateKey = getDateKey(targetDate);

    const yearIndex = allData.findIndex(y => y.year === year);
    if (yearIndex === -1) return false;

    const monthIndex = allData[yearIndex].months.findIndex(m => m.month === month);
    if (monthIndex === -1) return false;

    const dayIndex = allData[yearIndex].months[monthIndex].days.findIndex(
      d => getDateKey(new Date(d.date)) === dateKey
    );
    if (dayIndex === -1) return false;

    const videoIndex = allData[yearIndex].months[monthIndex].days[dayIndex].videos.findIndex(
      v => v.id === videoId
    );
    if (videoIndex === -1) return false;

    // Remove the video note
    allData[yearIndex].months[monthIndex].days[dayIndex].videos.splice(videoIndex, 1);

    // Clean up empty days
    if (allData[yearIndex].months[monthIndex].days[dayIndex].videos.length === 0) {
      allData[yearIndex].months[monthIndex].days.splice(dayIndex, 1);
    }

    // Clean up empty months
    if (allData[yearIndex].months[monthIndex].days.length === 0) {
      allData[yearIndex].months.splice(monthIndex, 1);
    }

    // Clean up empty years
    if (allData[yearIndex].months.length === 0) {
      allData.splice(yearIndex, 1);
    }

    this.saveAllData(allData);
    return true;
  }

  // Get all video notes for a specific day
  getVideoNotesForDay(year: number, month: number, day: number): VideoNote[] {
    const dayData = this.getDay(year, month, day);
    return dayData ? dayData.videos : [];
  }

  // Automatically save current position and timestamp for a video
  saveCurrentPosition(videoId: string, year: number, month: number, day: number, position: number): VideoNote | null {
    const videoNotes = this.getVideoNotesForDay(year, month, day);
    const videoNote = videoNotes.find(v => v.id === videoId);
    
    if (!videoNote) return null;

    return this.saveVideoNote(year, month, day, {
      ...videoNote,
      position,
      updatedAt: new Date(),
      timestamp: new Date() // Update timestamp to current time
    });
  }

  // Get current date info
  getCurrentDateInfo(): { year: number, month: number, day: number } {
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
      day: now.getDate()
    };
  }

  // Get yesterday's date info
  getYesterdayDateInfo(): { year: number, month: number, day: number } {
    const now = new Date();
    const yesterday = new Date(now.setDate(now.getDate() - 1));
    return {
      year: yesterday.getFullYear(),
      month: yesterday.getMonth() + 1,
      day: yesterday.getDate()
    };
  }

  // Get all years available in storage
  getAllYears(): number[] {
    const data = this.getAllData();
    return data.map(y => y.year).sort((a, b) => b - a); // Sort descending
  }

  // Get all months for a year
  getAllMonthsForYear(year: number): number[] {
    const yearData = this.getYear(year);
    if (!yearData) return [];
    return yearData.months.map(m => m.month).sort((a, b) => a - b);
  }

  // Get all days for a month
  getAllDaysForMonth(year: number, month: number): number[] {
    const monthData = this.getMonth(year, month);
    if (!monthData) return [];
    return monthData.days.map(d => new Date(d.date).getDate()).sort((a, b) => a - b);
  }
}
