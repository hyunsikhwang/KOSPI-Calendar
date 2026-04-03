import React from 'react';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, subMonths, addMonths, getUnixTime, startOfDay } from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, Loader2, Calendar } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import axios from 'axios';
import { KOSPIData, DayData } from './types';
import { cn, formatNumber, getKSTDate } from './lib/utils';

export default function App() {
  const [currentDate, setCurrentDate] = React.useState(getKSTDate());
  const [kospiData, setKospiData] = React.useState<KOSPIData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMonthData = React.useCallback(async (date: Date) => {
    setLoading(true);
    setError(null);
    try {
      // Fetch a bit more to get the previous close for the first day of the month
      const start = getUnixTime(startOfMonth(subMonths(date, 1)));
      const end = getUnixTime(endOfMonth(date));
      
      const response = await axios.get<KOSPIData[]>(`/api/kospi?start=${start}&end=${end}`);
      setKospiData(response.data);
    } catch (err) {
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    fetchMonthData(currentDate);
  }, [currentDate, fetchMonthData]);

  const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
  const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToToday = () => setCurrentDate(getKSTDate());

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

  const currentMonthData = React.useMemo(() => {
    return kospiData.filter(d => isSameMonth(new Date(d.date), currentDate));
  }, [kospiData, currentDate]);

  const stats = React.useMemo(() => {
    if (currentMonthData.length === 0) return null;

    let upDays = 0;
    let downDays = 0;
    let totalAbsChange = 0;

    currentMonthData.forEach(d => {
      const dataIndex = kospiData.findIndex(kd => kd.date === d.date);
      if (dataIndex > 0) {
        const prevClose = kospiData[dataIndex - 1].close;
        const diff = d.close - prevClose;
        if (diff > 0) upDays++;
        else if (diff < 0) downDays++;
        totalAbsChange += Math.abs(diff);
      }
    });

    const firstDay = currentMonthData[0];
    const lastDay = currentMonthData[currentMonthData.length - 1];
    const firstDayIndex = kospiData.findIndex(kd => kd.date === firstDay.date);
    const firstPrevClose = firstDayIndex > 0 ? kospiData[firstDayIndex - 1].close : firstDay.open;

    const monthlyChange = lastDay.close - firstPrevClose;
    const monthlyChangePercent = (monthlyChange / firstPrevClose) * 100;
    const avgDailyChange = totalAbsChange / currentMonthData.length;

    return {
      totalTradingDays: currentMonthData.length,
      upDays,
      downDays,
      monthlyChange,
      monthlyChangePercent,
      avgDailyChange
    };
  }, [currentMonthData, kospiData]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <span className="bg-blue-600 text-white p-1.json rounded">KOSPI</span>
              지수 캘린더
            </h1>
            <p className="text-slate-500 mt-1">야후 파이낸스 실시간 데이터를 기반으로 한 지수 변동 현황</p>
          </div>

          <div className="flex items-center gap-2">
            <button 
              onClick={goToToday}
              className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl shadow-sm border border-slate-200 transition-all text-sm font-medium active:scale-95"
            >
              <Calendar className="w-4 h-4 text-blue-600" />
              오늘
            </button>
            <div className="flex items-center bg-white rounded-xl shadow-sm border border-slate-200 p-1">
              <button 
                onClick={prevMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="px-4 font-semibold text-lg min-w-[140px] text-center">
                {format(currentDate, 'yyyy년 MM월', { locale: ko })}
              </div>
              <button 
                onClick={nextMonth}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                aria-label="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Monthly Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">영업일수</p>
            <p className="text-xl font-bold text-slate-900">{stats?.totalTradingDays ?? '-'}일</p>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">상승 / 하락</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-red-500">{stats?.upDays ?? '-'}</span>
              <span className="text-slate-300">/</span>
              <span className="text-xl font-bold text-blue-500">{stats?.downDays ?? '-'}</span>
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">월간 변동폭</p>
            <div className={cn(
              "text-xl font-bold",
              (stats?.monthlyChange ?? 0) > 0 ? "text-red-500" : (stats?.monthlyChange ?? 0) < 0 ? "text-blue-500" : "text-slate-900"
            )}>
              {stats ? (stats.monthlyChange > 0 ? '+' : '') + formatNumber(stats.monthlyChange) : '-'}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <p className="text-xs font-medium text-slate-500 mb-1">월간 수익률</p>
            <div className={cn(
              "text-xl font-bold",
              (stats?.monthlyChangePercent ?? 0) > 0 ? "text-red-500" : (stats?.monthlyChangePercent ?? 0) < 0 ? "text-blue-500" : "text-slate-900"
            )}>
              {stats ? (stats.monthlyChangePercent > 0 ? '+' : '') + formatNumber(stats.monthlyChangePercent) + '%' : '-'}
            </div>
          </div>
          <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 col-span-2 md:col-span-1">
            <p className="text-xs font-medium text-slate-500 mb-1">일평균 변동폭</p>
            <p className="text-xl font-bold text-slate-900">{stats ? formatNumber(stats.avgDailyChange) : '-'}p</p>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 text-blue-600 animate-spin" />
                <p className="font-medium text-slate-600">데이터 로딩 중...</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-red-500 font-medium">{error}</p>
              <button 
                onClick={() => fetchMonthData(currentDate)}
                className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                다시 시도
              </button>
            </div>
          )}

          {/* Days of Week Header */}
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50/50">
            {daysOfWeek.map((day, idx) => (
              <div 
                key={day} 
                className={cn(
                  "py-3 text-center text-sm font-bold uppercase tracking-wider",
                  idx === 0 ? "text-red-500" : idx === 6 ? "text-blue-500" : "text-slate-500"
                )}
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 auto-rows-fr">
            <AnimatePresence mode="wait">
              {calendarDays.map((date) => {
                const dayData = getDayData(date);
                const isToday = isSameDay(date, getKSTDate());
                const diff = dayData.kospi && dayData.prevClose ? dayData.kospi.close - dayData.prevClose : 0;
                const diffPercent = dayData.prevClose ? (diff / dayData.prevClose) * 100 : 0;
                const isUp = diff > 0;
                const isDown = diff < 0;

                return (
                  <motion.div
                    key={date.toString()}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={cn(
                      "min-h-[120px] p-2 border-r border-b border-slate-100 transition-colors group",
                      !dayData.isCurrentMonth && "bg-slate-50/30",
                      isToday && "bg-blue-50/30"
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <span className={cn(
                        "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors",
                        isToday ? "bg-blue-600 text-white" : 
                        !dayData.isCurrentMonth ? "text-slate-300" :
                        date.getDay() === 0 ? "text-red-500" :
                        date.getDay() === 6 ? "text-blue-500" : "text-slate-600"
                      )}>
                        {format(date, 'd')}
                      </span>
                    </div>

                    {dayData.kospi ? (
                      <div className="space-y-1">
                        <div className="text-lg font-bold tracking-tight text-slate-800">
                          {formatNumber(dayData.kospi.close)}
                        </div>
                        <div className={cn(
                          "flex items-center gap-1 text-xs font-bold",
                          isUp ? "text-red-500" : isDown ? "text-blue-500" : "text-slate-400"
                        )}>
                          {isUp ? <TrendingUp className="w-3 h-3" /> : isDown ? <TrendingDown className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
                          <span>{isUp ? '▲' : isDown ? '▼' : ''} {formatNumber(Math.abs(diff))}</span>
                          <span className="opacity-80">({formatNumber(diffPercent)}%)</span>
                        </div>
                        <div className="hidden md:block text-[10px] text-slate-400 mt-1">
                          H: {formatNumber(dayData.kospi.high, 1)} / L: {formatNumber(dayData.kospi.low, 1)}
                        </div>
                      </div>
                    ) : dayData.isCurrentMonth && !loading ? (
                      <div className="h-full flex items-center justify-center">
                        <span className="text-[10px] text-slate-300 font-medium italic">No Data</span>
                      </div>
                    ) : null}
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>

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
            데이터 출처: Yahoo Finance (^KS11) • 기준 시간: 한국 표준시 (KST)
          </div>
        </footer>
      </div>
    </div>
  );
}
