import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths, getUnixTime, startOfDay, setYear, setMonth, getYear, getMonth, addYears, subYears, isAfter, isSameYear } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2, Calendar, ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { KOSPIData, DayData } from './types';
import { cn, formatNumber, getKSTDate } from './lib/utils';

const INDICES = [
  { name: 'KOSPI', symbol: '^KS11', region: 'KR' },
  { name: 'KOSPI 200', symbol: '^KS200', region: 'KR' },
  { name: 'S&P 500', symbol: '^GSPC', region: 'US' },
  { name: 'Nasdaq', symbol: '^IXIC', region: 'US' },
  { name: 'Dow Jones', symbol: '^DJI', region: 'US' },
  { name: 'Nikkei 225', symbol: '^N225', region: 'JP' },
  { name: 'Hang Seng', symbol: '^HSI', region: 'HK' },
];

export default function App() {
  const [currentDate, setCurrentDate] = React.useState(getKSTDate());
  const [viewMode, setViewMode] = React.useState<'month' | 'year'>('month');
  const [selectedIndex, setSelectedIndex] = React.useState(INDICES[0]);
  const [kospiData, setKospiData] = React.useState<KOSPIData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [showYearPicker, setShowYearPicker] = React.useState(false);
  const [showMonthPicker, setShowMonthPicker] = React.useState(false);
  const [showIndexPicker, setShowIndexPicker] = React.useState(false);

  const fetchData = React.useCallback(async (date: Date, mode: 'month' | 'year', indexSymbol: string) => {
    setLoading(true);
    setError(null);
    try {
      let start, end;
      if (mode === 'month') {
        // Fetch a bit more to get the previous close for the first day of the month
        start = getUnixTime(startOfMonth(subMonths(date, 1)));
        end = getUnixTime(endOfMonth(date));
      } else {
        // Fetch the entire year plus the last month of the previous year for the first day's close
        const yearStart = setMonth(setYear(date, getYear(date)), 0);
        start = getUnixTime(startOfMonth(subMonths(yearStart, 1)));
        end = getUnixTime(endOfMonth(setMonth(setYear(date, getYear(date)), 11)));
      }
      
      const response = await axios.get<KOSPIData[]>(`/api/index-data?start=${start}&end=${end}&symbol=${encodeURIComponent(indexSymbol)}`);
      setKospiData(response.data);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchData(currentDate, viewMode, selectedIndex.symbol);
  }, [currentDate, viewMode, selectedIndex.symbol, fetchData]);

  const handleNext = () => {
    const today = getKSTDate();
    if (viewMode === 'month') {
      const nextMonth = addMonths(currentDate, 1);
      if (isAfter(startOfMonth(nextMonth), startOfMonth(today))) return;
      setCurrentDate(nextMonth);
    } else {
      const nextYear = addYears(currentDate, 1);
      if (getYear(nextYear) > getYear(today)) return;
      setCurrentDate(nextYear);
    }
  };

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(subMonths(currentDate, 1));
    } else {
      setCurrentDate(subYears(currentDate, 1));
    }
  };

  const isNextDisabled = React.useMemo(() => {
    const today = getKSTDate();
    if (viewMode === 'month') {
      return isSameMonth(currentDate, today) || isAfter(currentDate, today);
    } else {
      return getYear(currentDate) >= getYear(today);
    }
  }, [currentDate, viewMode]);

  const isNextYearDisabled = React.useMemo(() => {
    const today = getKSTDate();
    return getYear(currentDate) >= getYear(today);
  }, [currentDate]);

  const goToToday = () => {
    setCurrentDate(getKSTDate());
    setShowYearPicker(false);
    setShowMonthPicker(false);
  };

  const handleYearSelect = (year: number) => {
    setCurrentDate(setYear(currentDate, year));
    setShowYearPicker(false);
  };

  const handleMonthSelect = (month: number) => {
    setCurrentDate(setMonth(currentDate, month));
    setShowMonthPicker(false);
  };

  const years = React.useMemo(() => {
    const currentYear = getYear(getKSTDate());
    const range = [];
    for (let i = 1997; i <= currentYear; i++) {
      range.push(i);
    }
    return range.reverse();
  }, []);

  const months = Array.from({ length: 12 }, (_, i) => i);

  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart);
  const endDate = endOfWeek(monthEnd);

  const calendarDays = eachDayOfInterval({
    start: startDate,
    end: endDate,
  });

  const getDayData = (date: Date): DayData => {
    const dayStart = startOfDay(date).getTime();
    const data = kospiData.find(d => startOfDay(new Date(d.date)).getTime() === dayStart);
    
    // Find previous trading day's close
    let prevClose: number | undefined;
    if (data) {
      const dataIndex = kospiData.findIndex(d => d.date === data.date);
      if (dataIndex > 0) {
        prevClose = kospiData[dataIndex - 1].close;
      }
    }

    return {
      date,
      isCurrentMonth: isSameMonth(date, monthStart),
      kospi: data,
      prevClose
    };
  };

  const daysOfWeek = ['일', '월', '화', '수', '목', '금', '토'];

  const currentViewData = React.useMemo(() => {
    if (viewMode === 'month') {
      return kospiData.filter(d => isSameMonth(new Date(d.date), currentDate));
    } else {
      const year = getYear(currentDate);
      return kospiData.filter(d => getYear(new Date(d.date)) === year);
    }
  }, [kospiData, currentDate, viewMode]);

  const stats = React.useMemo(() => {
    if (currentViewData.length === 0) return null;

    let upDays = 0;
    let downDays = 0;
    let totalAbsChange = 0;
    let totalAbsPercentChange = 0;
    let validTradingDaysCount = 0;

    currentViewData.forEach(d => {
      if (!d.close || d.close <= 0) return;

      const dataIndex = kospiData.findIndex(kd => kd.date === d.date);
      if (dataIndex > 0) {
        const prevClose = kospiData[dataIndex - 1].close;
        if (!prevClose || prevClose <= 0) return;

        const diff = d.close - prevClose;
        const diffPercent = (diff / prevClose) * 100;
        
        if (diff > 0) upDays++;
        else if (diff < 0) downDays++;
        
        totalAbsChange += Math.abs(diff);
        totalAbsPercentChange += Math.abs(diffPercent);
        validTradingDaysCount++;
      }
    });

    const validData = currentViewData.filter(d => d.close && d.close > 0);
    if (validData.length === 0) return null;

    const firstDay = validData[0];
    const lastDay = validData[validData.length - 1];
    
    const firstDayIndex = kospiData.findIndex(kd => kd.date === firstDay.date);
    const firstPrevClose = firstDayIndex > 0 ? kospiData[firstDayIndex - 1].close : firstDay.open;

    let totalChange = 0;
    let totalChangePercent = 0;
    
    if (firstPrevClose && firstPrevClose > 0) {
      totalChange = lastDay.close - firstPrevClose;
      totalChangePercent = (totalChange / firstPrevClose) * 100;
    }

    const avgDailyChange = validTradingDaysCount > 0 ? totalAbsChange / validTradingDaysCount : 0;
    const avgDailyPercentChange = validTradingDaysCount > 0 ? totalAbsPercentChange / validTradingDaysCount : 0;

    return {
      totalTradingDays: validData.length,
      upDays,
      downDays,
      totalChange,
      totalChangePercent,
      avgDailyChange,
      avgDailyPercentChange
    };
  }, [currentViewData, kospiData]);

  const MonthCalendar = ({ date, compact = false }: { date: Date, compact?: boolean, key?: any }) => {
    const [activeTooltip, setActiveTooltip] = React.useState<string | null>(null);

    const monthStart = startOfMonth(date);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);

    const calendarDays = eachDayOfInterval({
      start: startDate,
      end: endDate,
    });

    const monthData = React.useMemo(() => {
      return kospiData.filter(d => isSameMonth(new Date(d.date), date));
    }, [date]);

    const monthStats = React.useMemo(() => {
      if (monthData.length === 0) return null;

      let upDays = 0;
      let downDays = 0;
      let totalAbsChange = 0;
      let totalAbsPercentChange = 0;
      let validTradingDaysCount = 0;

      monthData.forEach(d => {
        if (!d.close || d.close <= 0) return;

        const dataIndex = kospiData.findIndex(kd => kd.date === d.date);
        if (dataIndex > 0) {
          const prevClose = kospiData[dataIndex - 1].close;
          if (!prevClose || prevClose <= 0) return;

          const diff = d.close - prevClose;
          const diffPercent = (diff / prevClose) * 100;
          
          if (diff > 0) upDays++;
          else if (diff < 0) downDays++;
          
          totalAbsChange += Math.abs(diff);
          totalAbsPercentChange += Math.abs(diffPercent);
          validTradingDaysCount++;
        }
      });

      const validData = monthData.filter(d => d.close && d.close > 0);
      if (validData.length === 0) return null;

      const firstDay = validData[0];
      const lastDay = validData[validData.length - 1];
      
      const firstDayIndex = kospiData.findIndex(kd => kd.date === firstDay.date);
      const firstPrevClose = firstDayIndex > 0 ? kospiData[firstDayIndex - 1].close : firstDay.open;

      let totalChange = 0;
      let totalChangePercent = 0;
      
      if (firstPrevClose && firstPrevClose > 0) {
        totalChange = lastDay.close - firstPrevClose;
        totalChangePercent = (totalChange / firstPrevClose) * 100;
      }

      const avgDailyChange = validTradingDaysCount > 0 ? totalAbsChange / validTradingDaysCount : 0;
      const avgDailyPercentChange = validTradingDaysCount > 0 ? totalAbsPercentChange / validTradingDaysCount : 0;

      return {
        totalTradingDays: validData.length,
        upDays,
        downDays,
        totalChange,
        totalChangePercent,
        avgDailyChange,
        avgDailyPercentChange
      };
    }, [monthData]);

    const getDayData = (d: Date): DayData => {
      const dayStart = startOfDay(d).getTime();
      const data = kospiData.find(kd => startOfDay(new Date(kd.date)).getTime() === dayStart);
      
      let prevClose: number | undefined;
      if (data) {
        const dataIndex = kospiData.findIndex(kd => kd.date === data.date);
        if (dataIndex > 0) {
          prevClose = kospiData[dataIndex - 1].close;
        }
      }

      return {
        date: d,
        isCurrentMonth: isSameMonth(d, monthStart),
        kospi: data,
        prevClose
      };
    };

    return (
      <div className={cn("bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative", compact ? "shadow-md" : "shadow-lg")}>
        {compact && (
          <div className="bg-slate-50 border-b border-slate-100">
            <div className="py-2 px-4 text-center font-bold text-slate-700 border-b border-slate-100 text-sm md:text-base">
              {format(date, 'M월')}
            </div>
            {monthStats && (
              <div className="grid grid-cols-3 gap-px bg-slate-100 text-[7px] md:text-[8px]">
                <div className="bg-white p-1 text-center">
                  <div className="text-slate-400 truncate">영업/상승/하락</div>
                  <div className="font-bold truncate">{monthStats.totalTradingDays} / <span className="text-red-500">{monthStats.upDays}</span> / <span className="text-blue-500">{monthStats.downDays}</span></div>
                </div>
                <div className="bg-white p-1 text-center">
                  <div className="text-slate-400 truncate">변동폭/수익률</div>
                  <div className={cn("font-bold truncate", monthStats.totalChange > 0 ? "text-red-500" : monthStats.totalChange < 0 ? "text-blue-500" : "")}>
                    {formatNumber(monthStats.totalChange, 1)} ({formatNumber(monthStats.totalChangePercent, 1)}%)
                  </div>
                </div>
                <div className="bg-white p-1 text-center">
                  <div className="text-slate-400 truncate">일평균 변동</div>
                  <div className="font-bold truncate">{formatNumber(monthStats.avgDailyChange, 1)} / {formatNumber(monthStats.avgDailyPercentChange, 1)}%</div>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
          {daysOfWeek.map((day, idx) => (
            <div 
              key={day} 
              className={cn(
                "text-center font-bold uppercase tracking-wider",
                compact ? "py-1 text-[9px] md:text-[10px]" : "py-2 md:py-3 text-[10px] md:text-sm",
                idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-slate-500"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 auto-rows-fr">
          <AnimatePresence mode="wait">
            {calendarDays.map((d, index) => {
              const dayData = getDayData(d);
              const isToday = isSameDay(d, getKSTDate());
              
              // Only consider data valid if close is greater than 0
              const hasValidData = dayData.kospi && dayData.kospi.close > 0;
              const diff = hasValidData && dayData.prevClose ? dayData.kospi!.close - dayData.prevClose : 0;
              const diffPercent = dayData.prevClose && hasValidData ? (diff / dayData.prevClose) * 100 : 0;
              const isUp = diff > 0;
              const isDown = diff < 0;

              // Tooltip positioning logic
              const row = Math.floor(index / 7);
              const col = index % 7;
              const isFirstRow = row === 0;
              const isLastRow = row >= Math.floor(calendarDays.length / 7) - 1;
              const isLeftEdge = col === 0;
              const isRightEdge = col === 6;

              return (
                <motion.div
                  key={d.toString()}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={() => {
                    const dateStr = d.toISOString();
                    setActiveTooltip(activeTooltip === dateStr ? null : dateStr);
                  }}
                  className={cn(
                    "p-1 border-r border-b border-slate-100 transition-colors group relative cursor-pointer",
                    compact ? "min-h-[45px] md:min-h-[50px]" : "min-h-[75px] md:min-h-[120px] md:p-2",
                    !dayData.isCurrentMonth && "bg-slate-50/10",
                    isToday && "bg-blue-50/30",
                    activeTooltip === d.toISOString() && "bg-slate-100"
                  )}
                >
                  {dayData.isCurrentMonth && (
                    <>
                      <div className={cn("flex justify-between items-start", compact ? "mb-0" : "mb-1 md:mb-2")}>
                        <span className={cn(
                          "font-semibold flex items-center justify-center rounded-full transition-colors",
                          compact ? "text-[8px] md:text-[9px] w-3 h-3 md:w-3.5 md:h-3.5" : "text-[10px] md:text-sm w-5 h-5 md:w-7 md:h-7",
                          isToday ? "bg-blue-600 text-white" : 
                          d.getDay() === 0 ? "text-red-500" :
                          d.getDay() === 6 ? "text-blue-500" : "text-slate-600"
                        )}>
                          {format(d, 'd')}
                        </span>
                      </div>

                      {hasValidData ? (
                        <div className={compact ? "flex justify-center items-center h-3 md:h-4" : "space-y-0.5 md:space-y-1"}>
                          {!compact && (
                            <div className="hidden md:block text-[11px] md:text-lg font-bold tracking-tight text-slate-800">
                              {formatNumber(dayData.kospi!.close, 1)}
                            </div>
                          )}
                          <div className={cn(
                            "flex items-center gap-0.5 font-bold",
                            compact ? "text-[10px] md:text-[12px]" : "text-[10px] md:text-xs justify-center md:justify-start flex-col md:flex-row",
                            isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-slate-400"
                          )}>
                            {isUp ? <TrendingUp className="w-2.5 h-2.5 md:w-3 md:h-3" /> : isDown ? <TrendingDown className="w-2.5 h-2.5 md:w-3 md:h-3" /> : <Minus className="w-2.5 h-2.5 md:w-3 md:h-3" />}
                            <span className="truncate leading-none">{formatNumber(Math.abs(diff), 1)}</span>
                            {!compact && <span className="opacity-80 hidden md:inline">({formatNumber(diffPercent, 1)}%)</span>}
                          </div>
                          
                          {/* Dynamic Tooltip */}
                          <div className={cn(
                            "invisible group-hover:visible absolute z-20 w-48 p-3 bg-slate-900 text-white rounded-xl shadow-2xl pointer-events-none transition-all",
                            activeTooltip === d.toISOString() && "visible opacity-100",
                            compact ? "text-[10px]" : "text-xs",
                            isFirstRow ? "top-full mt-2" : "bottom-full mb-2",
                            isLeftEdge ? "left-0" : isRightEdge ? "right-0" : "left-1/2 -translate-x-1/2"
                          )}>
                            <div className="font-bold mb-2 pb-1 border-b border-slate-700 flex justify-between">
                              <span>{format(d, 'yyyy.MM.dd')}</span>
                              <span className={isUp ? "text-red-400" : isDown ? "text-blue-400" : ""}>
                                {isUp ? '상승' : isDown ? '하락' : '보합'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-y-1">
                              <span className="text-slate-400">시가</span>
                              <span className="text-right">{formatNumber(dayData.kospi!.open)}</span>
                              <span className="text-slate-400">고가</span>
                              <span className="text-red-400 text-right font-medium">{formatNumber(dayData.kospi!.high)}</span>
                              <span className="text-slate-400">저가</span>
                              <span className="text-blue-400 text-right font-medium">{formatNumber(dayData.kospi!.low)}</span>
                              <span className="text-slate-400">종가</span>
                              <span className="text-right font-bold">{formatNumber(dayData.kospi!.close)}</span>
                              <span className="text-slate-400">거래량</span>
                              <span className="text-right">{formatNumber(dayData.kospi!.volume, 0)}</span>
                            </div>
                            {/* Tooltip Arrow */}
                            <div className={cn(
                              "absolute border-8 border-transparent",
                              isFirstRow ? "bottom-full border-b-slate-900" : "top-full border-t-slate-900",
                              isLeftEdge ? "left-4" : isRightEdge ? "right-4" : "left-1/2 -translate-x-1/2"
                            )}></div>
                          </div>
                        </div>
                      ) : !loading ? (
                        <div className="h-full flex items-center justify-center">
                          <span className={cn("text-slate-300 font-medium italic", compact ? "hidden" : "text-[10px]")}>No Data</span>
                        </div>
                      ) : null}
                    </>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col lg:flex-row lg:items-center justify-between mb-6 md:mb-8 gap-4">
          <div className="text-center lg:text-left">
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-slate-900 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-2">
              <div className="relative group">
                <button 
                  onClick={() => setShowIndexPicker(!showIndexPicker)}
                  className="bg-blue-600 text-white px-3 py-1 rounded inline-flex items-center gap-2 hover:bg-blue-700 transition-colors shadow-lg active:scale-95"
                >
                  <span className="text-xl md:text-2xl">{selectedIndex.name}</span>
                  <ChevronDown className={cn("w-4 h-4 transition-transform", showIndexPicker && "rotate-180")} />
                </button>
                
                <AnimatePresence>
                  {showIndexPicker && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-2 overflow-hidden"
                    >
                      {INDICES.map(idx => (
                        <button
                          key={idx.symbol}
                          onClick={() => {
                            setSelectedIndex(idx);
                            setShowIndexPicker(false);
                          }}
                          className={cn(
                            "w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-between",
                            selectedIndex.symbol === idx.symbol ? "bg-blue-50 text-blue-600" : "hover:bg-slate-50 text-slate-700"
                          )}
                        >
                          <span>{idx.name}</span>
                          <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">{idx.region}</span>
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <span>지수 캘린더</span>
            </h1>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
            <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full sm:w-auto">
              <button
                onClick={() => setViewMode('year')}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  viewMode === 'year' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                Year
              </button>
              <button
                onClick={() => setViewMode('month')}
                className={cn(
                  "flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-sm font-bold transition-all",
                  viewMode === 'month' ? "bg-blue-600 text-white shadow-md" : "text-slate-500 hover:bg-slate-50"
                )}
              >
                Month
              </button>
            </div>
            
            <div className="flex items-center gap-2 w-full sm:w-auto justify-center">
              <button 
                onClick={goToToday}
                className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm border border-slate-200 transition-all text-sm font-medium active:scale-95"
              >
                <Calendar className="w-4 h-4 text-blue-600" />
                오늘
              </button>
              <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1 relative">
                <button 
                  onClick={handlePrev}
                  className="p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors"
                  aria-label="Previous"
                >
                  <ChevronLeft className="w-4 h-4 md:w-5 md:h-5" />
                </button>
                
                <div className="flex items-center px-1 md:px-2 gap-1">
                  <div className="relative">
                    <button 
                      onClick={() => {
                        setShowYearPicker(!showYearPicker);
                        setShowMonthPicker(false);
                      }}
                      className={cn(
                        "px-1.5 md:px-2 py-1 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1 font-semibold text-base md:text-lg",
                        showYearPicker && "bg-blue-50 text-blue-600"
                      )}
                    >
                      {format(currentDate, 'yyyy년')}
                      <ChevronDown className={cn("w-3 h-3 md:w-4 md:h-4 transition-transform", showYearPicker && "rotate-180")} />
                    </button>
                    
                    {/* Year Picker Dropdown */}
                    <AnimatePresence>
                      {showYearPicker && (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute top-full left-0 mt-2 w-48 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto"
                        >
                          {years.map(year => {
                            const isFuture = year > getYear(getKSTDate());
                            return (
                              <button
                                key={year}
                                onClick={() => !isFuture && handleYearSelect(year)}
                                disabled={isFuture}
                                className={cn(
                                  "py-2 rounded-lg text-sm font-medium transition-colors",
                                  getYear(currentDate) === year ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-600",
                                  isFuture && "opacity-30 cursor-not-allowed grayscale"
                                )}
                              >
                                {year}
                              </button>
                            );
                          })}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {viewMode === 'month' && (
                    <div className="relative">
                      <button 
                        onClick={() => {
                          setShowMonthPicker(!showMonthPicker);
                          setShowYearPicker(false);
                        }}
                        className={cn(
                          "px-1.5 md:px-2 py-1 rounded-md hover:bg-slate-100 transition-colors flex items-center gap-1 font-semibold text-base md:text-lg",
                          showMonthPicker && "bg-blue-50 text-blue-600"
                        )}
                      >
                        {format(currentDate, 'MM월')}
                        <ChevronDown className={cn("w-3 h-3 md:w-4 md:h-4 transition-transform", showMonthPicker && "rotate-180")} />
                      </button>

                      {/* Month Picker Dropdown */}
                      <AnimatePresence>
                        {showMonthPicker && (
                          <motion.div 
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 10 }}
                            className="absolute top-full left-0 mt-2 w-40 bg-white rounded-xl shadow-2xl border border-slate-200 z-50 p-4 grid grid-cols-2 gap-2"
                          >
                            {months.map(m => {
                              const today = getKSTDate();
                              const isFuture = isAfter(startOfMonth(setMonth(currentDate, m)), startOfMonth(today));
                              return (
                                <button
                                  key={m}
                                  onClick={() => !isFuture && handleMonthSelect(m)}
                                  disabled={isFuture}
                                  className={cn(
                                    "py-2 rounded-lg text-sm font-medium transition-colors",
                                    getMonth(currentDate) === m ? "bg-blue-600 text-white" : "hover:bg-slate-100 text-slate-600",
                                    isFuture && "opacity-30 cursor-not-allowed grayscale"
                                  )}
                                >
                                  {m + 1}월
                                </button>
                              );
                            })}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>

                <button 
                  onClick={handleNext}
                  disabled={isNextDisabled}
                  className={cn(
                    "p-1.5 md:p-2 hover:bg-slate-100 rounded-lg transition-colors",
                    isNextDisabled && "opacity-30 cursor-not-allowed"
                  )}
                  aria-label="Next"
                >
                  <ChevronRight className="w-4 h-4 md:w-5 md:h-5" />
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 md:gap-4 mb-6 md:mb-8">
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">{viewMode === 'month' ? '월간' : '연간'} 영업일수</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats?.totalTradingDays ?? '-'}일</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">상승 / 하락</p>
            <div className="flex items-baseline gap-2">
              <span className="text-lg md:text-xl font-bold text-red-500">{stats?.upDays ?? '-'}</span>
              <span className="text-slate-300">/</span>
              <span className="text-lg md:text-xl font-bold text-blue-500">{stats?.downDays ?? '-'}</span>
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">{viewMode === 'month' ? '월간' : '연간'} 변동폭</p>
            <div className={cn(
              "text-lg md:text-xl font-bold",
              (stats?.totalChange ?? 0) > 0 ? "text-red-500" : (stats?.totalChange ?? 0) < 0 ? "text-blue-500" : "text-slate-900"
            )}>
              {stats ? (stats.totalChange > 0 ? '+' : '') + formatNumber(stats.totalChange, 1) : '-'}
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">{viewMode === 'month' ? '월간' : '연간'} 수익률</p>
            <div className={cn(
              "text-lg md:text-xl font-bold",
              (stats?.totalChangePercent ?? 0) > 0 ? "text-red-500" : (stats?.totalChangePercent ?? 0) < 0 ? "text-blue-500" : "text-slate-900"
            )}>
              {stats ? (stats.totalChangePercent > 0 ? '+' : '') + formatNumber(stats.totalChangePercent, 1) + '%' : '-'}
            </div>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">일평균 변동폭</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats ? formatNumber(stats.avgDailyChange, 1) : '-'}p</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-[10px] md:text-xs font-medium text-slate-500 mb-1">일평균 변동률</p>
            <p className="text-lg md:text-xl font-bold text-slate-900">{stats ? formatNumber(stats.avgDailyPercentChange, 1) : '-'}%</p>
          </div>
        </div>

        {/* Calendar Grid */}
        <motion.div 
          className="relative"
          style={{ touchAction: viewMode === 'month' ? 'none' : 'pan-y' }}
          onPanEnd={(_event, info) => {
            const threshold = 50;
            const { offset } = info;
            const today = getKSTDate();
            
            if (Math.abs(offset.x) > Math.abs(offset.y)) {
              // Horizontal swipe
              if (offset.x > threshold) {
                // Swipe Right -> Previous
                if (viewMode === 'month') {
                  setCurrentDate(prev => subMonths(prev, 1));
                } else {
                  setCurrentDate(prev => subYears(prev, 1));
                }
              } else if (offset.x < -threshold) {
                // Swipe Left -> Next
                if (viewMode === 'month') {
                  const nextMonth = addMonths(currentDate, 1);
                  if (!isAfter(startOfMonth(nextMonth), startOfMonth(today))) {
                    setCurrentDate(nextMonth);
                  }
                } else {
                  const nextYear = addYears(currentDate, 1);
                  if (getYear(nextYear) <= getYear(today)) {
                    setCurrentDate(nextYear);
                  }
                }
              }
            } else if (viewMode === 'month') {
              // Vertical swipe - Only in Month mode to avoid scroll conflict in Year mode
              if (offset.y > threshold) {
                // Swipe Down -> Previous Year
                setCurrentDate(prev => subYears(prev, 1));
              } else if (offset.y < -threshold) {
                // Swipe Up -> Next Year
                const nextYear = addYears(currentDate, 1);
                if (getYear(nextYear) <= getYear(today)) {
                  setCurrentDate(nextYear);
                }
              }
            }
          }}
        >
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center rounded-2xl">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="font-medium text-slate-600">데이터 로딩 중...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-white p-8 text-center rounded-2xl border border-slate-200 shadow-xl">
              <p className="text-red-500 font-medium">{error}</p>
              <button 
                onClick={() => fetchData(currentDate, viewMode, selectedIndex.symbol)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {viewMode === 'month' ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={currentDate.toISOString()}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}
              >
                <MonthCalendar date={currentDate} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={getYear(currentDate)}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
              >
                {months.map(m => (
                  <MonthCalendar key={m} date={setMonth(currentDate, m)} compact />
                ))}
              </motion.div>
            </AnimatePresence>
          )}
        </motion.div>

        {/* Footer Info */}
        <footer className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-slate-500 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <span>상승</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-blue-500"></div>
              <span>하락</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-slate-300"></div>
              <span>보합/휴장</span>
            </div>
          </div>
          <div className="text-center md:text-right">
            데이터 출처: Yahoo Finance ({selectedIndex.symbol}) • 기준 시간: 한국 표준시 (KST)
          </div>
        </footer>

        {/* Mobile Floating Navigation Bar */}
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 md:hidden">
          <div className="bg-white/90 backdrop-blur-md border border-slate-200 shadow-2xl rounded-2xl p-2 flex items-center gap-1">
            <button 
              onClick={() => setCurrentDate(prev => subYears(prev, 1))}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 active:scale-90"
              aria-label="Previous Year"
            >
              <ChevronsLeft className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setCurrentDate(prev => subMonths(prev, 1))}
              className="p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 active:scale-90"
              aria-label="Previous Month"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>
            
            <button 
              onClick={goToToday}
              className="p-2.5 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors active:scale-95"
              aria-label="Today"
            >
              <Calendar className="w-5 h-5" />
            </button>
            
            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            <button 
              onClick={() => {
                const nextMonth = addMonths(currentDate, 1);
                const today = getKSTDate();
                if (!isAfter(startOfMonth(nextMonth), startOfMonth(today))) {
                  setCurrentDate(nextMonth);
                }
              }}
              disabled={isNextDisabled}
              className={cn(
                "p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 active:scale-90",
                isNextDisabled && "opacity-30 cursor-not-allowed"
              )}
              aria-label="Next Month"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
            <button 
              onClick={() => {
                const nextYear = addYears(currentDate, 1);
                const today = getKSTDate();
                if (getYear(nextYear) <= getYear(today)) {
                  setCurrentDate(nextYear);
                }
              }}
              disabled={isNextYearDisabled}
              className={cn(
                "p-2.5 hover:bg-slate-100 rounded-xl transition-colors text-slate-600 active:scale-90",
                isNextYearDisabled && "opacity-30 cursor-not-allowed"
              )}
              aria-label="Next Year"
            >
              <ChevronsRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
