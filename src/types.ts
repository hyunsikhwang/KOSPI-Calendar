export interface KOSPIData {
  date: number;
  dateStr?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjClose: number;
  volume: number;
}

export interface DayData {
  date: Date;
  isCurrentMonth: boolean;
  kospi?: KOSPIData;
  prevClose?: number;
}
