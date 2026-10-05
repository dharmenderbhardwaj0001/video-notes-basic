import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { StorageService } from '../storage.service';
import { CommonModule } from '@angular/common';
import { HeaderComponent } from '../header/header.component';

@Component({
  selector: 'app-month',
  standalone: true,
  imports: [CommonModule, HeaderComponent],
  templateUrl: './month.component.html',
  styleUrls: ['./month.component.scss']
})
export class MonthComponent implements OnInit {
  year: number = 0;
  month: number = 0;
  monthName: string = '';
  days: number[] = [];
  monthStats: any = null;
  showCalendar: boolean = true;

  private monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 
                       'July', 'August', 'September', 'October', 'November', 'December'];
  
  private dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private storage: StorageService
  ) {}

  ngOnInit(): void {
    this.route.params.subscribe(params => {
      this.year = parseInt(params['year']);
      this.month = parseInt(params['month']);
      this.monthName = this.monthNames[this.month - 1];
      this.loadDays();
      this.loadMonthStats();
    });
  }

  private loadDays(): void {
    const allDays = this.storage.getAllDaysForMonth(this.year, this.month);
    if (allDays.length > 0) {
      // Use actual days with data
      this.days = allDays;
    } else {
      // Show all days in the month
      const date = new Date(this.year, this.month - 1, 1);
      const daysInMonth = new Date(this.year, this.month, 0).getDate();
      this.days = Array.from({length: daysInMonth}, (_, i) => i + 1);
    }
  }

  private loadMonthStats(): void {
    const allDays = this.storage.getAllDaysForMonth(this.year, this.month);
    let totalVideos = 0;
    let totalNotes = 0;
    const activeDays = allDays.length;

    allDays.forEach(day => {
      const dayVideos = this.storage.getVideoNotesForDay(this.year, this.month, day);
      totalVideos += dayVideos.length;
      totalNotes += dayVideos.filter(v => v.notes && v.notes.trim().length > 0).length;
    });

    const avgVideosPerDay = activeDays > 0 ? Math.round(totalVideos / activeDays) : 0;

    this.monthStats = {
      totalVideos,
      totalNotes,
      activeDays,
      avgVideosPerDay
    };
  }

  getDayName(day: number): string {
    const date = new Date(this.year, this.month - 1, day);
    return this.dayNames[date.getDay()];
  }

  getDaySuffix(day: number): string {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  }

  isToday(day: number): boolean {
    const today = new Date();
    return this.year === today.getFullYear() && 
           this.month === today.getMonth() + 1 && 
           day === today.getDate();
  }

  hasDataForDay(day: number): boolean {
    const videos = this.storage.getVideoNotesForDay(this.year, this.month, day);
    return videos.length > 0;
  }

  getDayStats(day: number): string {
    const videos = this.storage.getVideoNotesForDay(this.year, this.month, day);
    if (videos.length === 0) return 'No videos';
    
    const notes = videos.filter(v => v.notes && v.notes.trim().length > 0).length;
    return `${videos.length} videos • ${notes} notes`;
  }

  navigateToDay(day: number): void {
    this.router.navigate(['/year', this.year, 'month', this.month, 'day', day]);
  }

  goBack(): void {
    this.router.navigate(['/year', this.year]);
  }

  goHome(): void {
    this.router.navigate(['/dashboard']);
  }

  goToYear(): void {
    this.router.navigate(['/year', this.year]);
  }

  canGoToPreviousMonth(): boolean {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (this.year < currentYear) return true;
    if (this.year === currentYear && this.month > 1) return true;
    return false;
  }

  canGoToNextMonth(): boolean {
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    
    if (this.year < currentYear) return true;
    if (this.year === currentYear && this.month < currentMonth) return true;
    return false;
  }

  previousMonth(): void {
    if (this.month > 1) {
      this.router.navigate(['/year', this.year, 'month', this.month - 1]);
    } else {
      this.router.navigate(['/year', this.year - 1, 'month', 12]);
    }
  }

  nextMonth(): void {
    if (this.month < 12) {
      this.router.navigate(['/year', this.year, 'month', this.month + 1]);
    } else {
      this.router.navigate(['/year', this.year + 1, 'month', 1]);
    }
  }
}