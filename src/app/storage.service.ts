import { Injectable } from '@angular/core';
import { 
  VideoNote, DayData, MonthData, YearData, generateId, getDateKey, 
  calculateTimeWatched, formatDuration, DailyProgress, ProgressStats, 
  WeeklyProgress, MotivationMessage, getProgressMessage
} from './models/video-note.model';

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