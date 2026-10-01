import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { FileStorageService } from './file-storage.service';
import { 
  VideoNote, DayData, MonthData, YearData, generateId, getDateKey, 
  calculateTimeWatched, formatDuration, DailyProgress, ProgressStats, 
  WeeklyProgress, MotivationMessage, getProgressMessage
} from './models/video-note.model';

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  /** Data file inside the connected storage folder. */
  private readonly DATA_FILE = 'video-notes.json';

  /** Old localStorage key from before file storage existed. */
  private readonly LEGACY_KEY = 'video_notes_app';

  /** In-memory dataset; components read from it synchronously. */
  private memoryData: YearData[] | null = null;

  /** True when the local Node persistence API (server.js) is reachable. */
  private apiAvailable: boolean = false;

  private readonly NOTES_API = '/api/notes';

  constructor(private fileStorage: FileStorageService, private http: HttpClient) {}

  /** True when data is being saved to a real file on the PC. */
  get storageConnected(): boolean {
    return this.apiAvailable || this.fileStorage.connected;
  }

  /** Name of the connected storage folder on the PC. */
  get storageFolderName(): string {
    return this.fileStorage.connected ? this.fileStorage.folderName : 'notes';
  }

  /**
   * Runs once at app startup, before any component reads data. Loads the
   * dataset from the local Node persistence API (notes/video-notes.json)
   * and, when a storage folder is connected, from the file-system copy.
   * The freshest copy wins; the old localStorage key is migrated one
   * last time and deleted.
   */
  async loadFromDisk(): Promise<void> {
    const legacy = this.readLegacyData();

    const fileData = (await this.fileStorage.init())
      ? await this.fileStorage.readFileAs<YearData[]>(this.DATA_FILE)
      : null;
    const apiData = await this.readApiData();

    // Pick the dataset with the most recent change; prefer the API on ties
    // because it is the primary storage while the dev server is running.
    const candidates: { data: YearData[], source: 'api' | 'file' | 'legacy' }[] = [
      { data: apiData ?? [], source: 'api' },
      { data: fileData ?? [], source: 'file' },
      { data: legacy, source: 'legacy' }
    ];
    let best = candidates[0];
    for (const candidate of candidates.slice(1)) {
      const candidateTime = this.getLatestUpdatedAt(candidate.data);
      const bestTime = this.getLatestUpdatedAt(best.data);
      if (candidateTime > bestTime ||
          (candidateTime === bestTime && candidate.data.length > best.data.length)) {
        best = candidate;
      }
    }
    this.memoryData = best.data;

    // Converge every store onto the winning dataset.
    this.saveAllData(best.data);
  }

  /** Reads the dataset from the Node API; null when the API is not running. */
  private async readApiData(): Promise<YearData[] | null> {
    try {
      const data = await firstValueFrom(this.http.get<YearData[]>(this.NOTES_API));
      this.apiAvailable = true;
      return Array.isArray(data) ? data : [];
    } catch {
      this.apiAvailable = false;
      return null;
    }
  }

  /**
   * Connects the storage folder on the PC. Must be triggered by a user
   * gesture (button click). The first time it opens the folder picker;
   * afterwards it re-grants access. Merges and flushes current data.
   */
  async connectStorage(): Promise<void> {
    await this.fileStorage.connect();
    const fileData = await this.fileStorage.readFileAs<YearData[]>(this.DATA_FILE);

    if (fileData && this.getLatestUpdatedAt(fileData) > this.getLatestUpdatedAt(this.getAllData())) {
      this.memoryData = fileData;
    }
    this.saveAllData(this.getAllData());
  }

  /**
   * One-time migration: reads the old localStorage copy and deletes the
   * key, so localStorage is never used again after startup.
   */
  private readLegacyData(): YearData[] {
    try {
      const raw = localStorage.getItem(this.LEGACY_KEY);
      if (!raw) return [];
      localStorage.removeItem(this.LEGACY_KEY);
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  /** Newest updatedAt across all video notes, used to compare two datasets. */
  private getLatestUpdatedAt(data: YearData[]): number {
    let latest = 0;
    for (const year of data) {
      for (const month of year?.months || []) {
        for (const day of month?.days || []) {
          for (const video of day?.videos || []) {
            const time = new Date(video?.updatedAt || 0).getTime();
            if (!isNaN(time) && time > latest) {
              latest = time;
            }
          }
        }
      }
    }
    return latest;
  }

  // Get the in-memory dataset
  private getAllData(): YearData[] {
    return this.memoryData ?? [];
  }

  // Save all data to the JSON file on the PC (notes/video-notes.json via
  // the Node API, plus the connected storage folder when available).
  // No localStorage involved.
  private saveAllData(data: YearData[]): void {
    this.memoryData = data;
    this.http.put(this.NOTES_API, data).subscribe({
      error: () => { this.apiAvailable = false; }
    });
    this.fileStorage.writeFile(this.DATA_FILE, data);
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
      startTime: videoNote.startTime,
      endTime: videoNote.endTime || now, // Default to now if not provided
      durationWatched: videoNote.durationWatched || 
        calculateTimeWatched(videoNote.startTime, videoNote.endTime || now, videoNote.position || 0),
      createdAt: videoNote.createdAt || now,
      updatedAt: now
    };

    // Calculate duration watched if we have start and end times
    if (newVideoNote.startTime && newVideoNote.endTime) {
      newVideoNote.durationWatched = calculateTimeWatched(
        newVideoNote.startTime, 
        newVideoNote.endTime, 
        newVideoNote.position
      );
    }

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

    // Update end time to current time
    const now = new Date();
    const updatedNote = {
      ...videoNote,
      position,
      endTime: now,
      updatedAt: now,
      timestamp: now,
      durationWatched: calculateTimeWatched(videoNote.startTime, now, position)
    };

    return this.saveVideoNote(year, month, day, updatedNote);
  }

  // Start tracking a video session
  startVideoSession(videoId: string, year: number, month: number, day: number): VideoNote | null {
    const videoNotes = this.getVideoNotesForDay(year, month, day);
    const videoNote = videoNotes.find(v => v.id === videoId);
    
    if (!videoNote) return null;

    const now = new Date();
    const updatedNote = {
      ...videoNote,
      startTime: now,
      updatedAt: now,
      timestamp: now
    };

    return this.saveVideoNote(year, month, day, updatedNote);
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

  // Get progress statistics
  getProgressStats(): ProgressStats {
    const allYears = this.getAllYears();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    const thisWeekStart = new Date(today);
    thisWeekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    
    const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    
    let allTimeTotal = 0;
    let dailyProgress: DailyProgress[] = [];
    let currentStreak = 0;
    let longestStreak = 0;
    let inStreak = false;

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    // Process all data
    allYears.forEach(year => {
      const allMonths = this.getAllMonthsForYear(year);
      allMonths.forEach(month => {
        const allDays = this.getAllDaysForMonth(year, month);
        allDays.forEach(day => {
          const videos = this.getVideoNotesForDay(year, month, day);
          const date = new Date(year, month - 1, day);
          
          const totalTime = videos.reduce((sum, video) => sum + (video.durationWatched || video.position || 0), 0);
          const notesCount = videos.filter(v => v.notes && v.notes.trim().length > 0).length;
          const longestSession = Math.max(...videos.map(v => v.durationWatched || v.position || 0), 0);
          
          allTimeTotal += totalTime;
          
          dailyProgress.push({
            date,
            totalTimeWatched: totalTime,
            videosWatched: videos.length,
            notesTaken: notesCount,
            longestSession,
            dayOfWeek: dayNames[date.getDay()]
          });
        });
      });
    });

    // Sort daily progress by date
    dailyProgress.sort((a, b) => b.date.getTime() - a.date.getTime());
    
    // Find today and yesterday progress
    const todayProgress = dailyProgress.find(dp => 
      dp.date.getDate() === today.getDate() && 
      dp.date.getMonth() === today.getMonth() &&
      dp.date.getFullYear() === today.getFullYear()
    ) || { date: today, totalTimeWatched: 0, videosWatched: 0, notesTaken: 0, longestSession: 0, dayOfWeek: dayNames[today.getDay()] };

    const yesterdayProgress = dailyProgress.find(dp => 
      dp.date.getDate() === yesterday.getDate() && 
      dp.date.getMonth() === yesterday.getMonth() &&
      dp.date.getFullYear() === yesterday.getFullYear()
    ) || { date: yesterday, totalTimeWatched: 0, videosWatched: 0, notesTaken: 0, longestSession: 0, dayOfWeek: dayNames[yesterday.getDay()] };

    // Calculate this week progress
    const thisWeekEnd = new Date(thisWeekStart);
    thisWeekEnd.setDate(thisWeekEnd.getDate() + 6); // End of week (Saturday)
    
    const thisWeekProgress: DailyProgress[] = dailyProgress.filter(dp => 
      dp.date >= thisWeekStart && dp.date <= thisWeekEnd
    );
    
    const thisWeekTotal = thisWeekProgress.reduce((sum, dp) => sum + dp.totalTimeWatched, 0);
    const thisWeekDays = thisWeekProgress.length;
    const thisWeekAvg = thisWeekDays > 0 ? thisWeekTotal / thisWeekDays : 0;

    // Calculate this month progress
    const thisMonthProgress: DailyProgress[] = dailyProgress.filter(dp => 
      dp.date >= thisMonthStart && dp.date <= today
    );
    const thisMonthTotal = thisMonthProgress.reduce((sum, dp) => sum + dp.totalTimeWatched, 0);

    // Calculate streaks
    const sortedByDate = [...dailyProgress].sort((a, b) => a.date.getTime() - b.date.getTime());
    let tempStreak = 0;
    let tempLongest = 0;
    
    for (let i = 0; i < sortedByDate.length; i++) {
      const nextDate = i + 1 < sortedByDate.length ? sortedByDate[i + 1].date : null;
      
      if (sortedByDate[i].totalTimeWatched > 0) {
        tempStreak++;
        tempLongest = Math.max(tempLongest, tempStreak);
      } else {
        tempStreak = 0;
      }
      
      // Check if next date is consecutive
      if (nextDate && sortedByDate[i].totalTimeWatched > 0) {
        const thisDate = sortedByDate[i].date;
        const tomorrow = new Date(thisDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        if (nextDate.getDate() === tomorrow.getDate() && 
            nextDate.getMonth() === tomorrow.getMonth() &&
            nextDate.getFullYear() === tomorrow.getFullYear()) {
          // Continue streak
        } else {
          tempStreak = 0;
        }
      }
    }
    
    // Calculate current streak from today backwards
    currentStreak = 0;
    let currentDate = new Date(today);
    
    for (let i = 0; i < 30; i++) { // Check last 30 days
      const progressOnDay = dailyProgress.find(dp => 
        dp.date.getDate() === currentDate.getDate() && 
        dp.date.getMonth() === currentDate.getMonth() &&
        dp.date.getFullYear() === currentDate.getFullYear()
      );
      
      if (progressOnDay && progressOnDay.totalTimeWatched > 0) {
        currentStreak++;
        currentDate.setDate(currentDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    longestStreak = tempLongest;

    // Find best day
    const bestDayProgress = dailyProgress.reduce((best, current) => 
      current.totalTimeWatched > best.totalTimeWatched ? current : best,
      { date: new Date(0), totalTimeWatched: 0, videosWatched: 0, notesTaken: 0, longestSession: 0, dayOfWeek: '' }
    );

    // Calculate average per day
    const daysWithData = dailyProgress.filter(dp => dp.totalTimeWatched > 0).length;
    const averagePerDay = daysWithData > 0 ? allTimeTotal / daysWithData : 0;

    return {
      today: todayProgress,
      yesterday: yesterdayProgress,
      thisWeek: {
        weekStart: thisWeekStart,
        weekEnd: thisWeekEnd,
        totalTime: thisWeekTotal,
        totalDays: thisWeekDays,
        dailyBreakdown: thisWeekProgress,
        averageTime: thisWeekAvg,
        longestStreak: tempLongest
      },
      thisMonth: thisMonthTotal,
      allTime: allTimeTotal,
      averagePerDay,
      bestDay: bestDayProgress,
      currentStreak
    };
  }

  // Get motivation messages for today
  getMotivationMessages(): MotivationMessage[] {
    const stats = this.getProgressStats();
    return getProgressMessage(stats);
  }

  // Get time watched for a specific day
  getTimeWatchedForDay(year: number, month: number, day: number): number {
    const videos = this.getVideoNotesForDay(year, month, day);
    return videos.reduce((sum, video) => sum + (video.durationWatched || video.position || 0), 0);
  }
}