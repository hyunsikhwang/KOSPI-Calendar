export interface KOSPIData {
  date: number;
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
