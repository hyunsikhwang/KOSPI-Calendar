import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Index Data (Naver for Korea, Yahoo for International)
  app.get("/api/index-data", async (req, res) => {
    const { start, end, symbol = "^KS11" } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end timestamps are required" });
    }

    const symbolStr = symbol as string;

    // Utilize Naver Finance fchart API as the primary feed for Korean indices
    if (symbolStr === "^KS11" || symbolStr === "^KS200" || symbolStr === "^KQ11") {
      try {
        const naverSymbol = symbolStr === "^KS11" ? "KOSPI" : (symbolStr === "^KS200" ? "KPI200" : "KOSDAQ");
        const count = 2000; // Covers multiple years of trading days
        const url = `https://fchart.stock.naver.com/sise.nhn?symbol=${naverSymbol}&timeframe=day&count=${count}&requestType=0`;
        
        const response = await axios.get(url);
        const xml = response.data;
        const regex = /<item data="([^"]+)"/g;
        let match;
        const results = [];
        
        const startSec = Number(start);
        const endSec = Number(end);

        while ((match = regex.exec(xml)) !== null) {
          const parts = match[1].split('|');
          if (parts.length >= 6) {
            const rawDateStr = parts[0];
            const year = parseInt(rawDateStr.substring(0, 4), 10);
            const month = parseInt(rawDateStr.substring(4, 6), 10);
            const day = parseInt(rawDateStr.substring(6, 8), 10);
            
            const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            const dateMs = Date.UTC(year, month - 1, day);
            const sec = dateMs / 1000;
            
            if (sec >= startSec && sec <= endSec) {
              results.push({
                date: dateMs,
                dateStr,
                open: parseFloat(parts[1]) || 0,
                high: parseFloat(parts[2]) || 0,
                low: parseFloat(parts[3]) || 0,
                close: parseFloat(parts[4]) || 0,
                adjClose: parseFloat(parts[4]) || 0,
                volume: parseInt(parts[5], 10) || 0,
                isMissing: false
              });
            }
          }
        }
        return res.json(results);
      } catch (fallbackError: any) {
        console.warn(`Naver Finance failed for ${symbolStr}, falling back to Yahoo Finance:`, fallbackError.message);
      }
    }

    // Yahoo Finance API proxy for international indices (GSPC, IXIC, DJI, RUT, N225, HSI)
    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbolStr)}?period1=${start}&period2=${end}&interval=1d`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const chartData = response.data.chart.result[0];
      if (!chartData) {
        return res.json([]);
      }

      const timestamps = chartData.timestamp || [];
      const quotes = chartData.indicators.quote[0];
      const adjCloseArray = chartData.indicators.adjclose?.[0]?.adjclose || [];

      // Determine the timezone of the target exchange to correctly calculate the local date string
      const timezoneMap: Record<string, string> = {
        '^KS11': 'Asia/Seoul',
        '^KS200': 'Asia/Seoul',
        '^KQ11': 'Asia/Seoul',
        '^GSPC': 'America/New_York',
        '^IXIC': 'America/New_York',
        '^DJI': 'America/New_York',
        '^RUT': 'America/New_York',
        '^N225': 'Asia/Tokyo',
        '^HSI': 'Asia/Hong_Kong'
      };

      const timezone = chartData.meta?.timezone || timezoneMap[symbolStr] || "Asia/Seoul";

      const rawResult = [];

      for (let index = 0; index < timestamps.length; index++) {
        const ts = timestamps[index];
        const open = quotes.open[index];
        const high = quotes.high[index];
        const low = quotes.low[index];
        const close = quotes.close[index];
        const adjClose = adjCloseArray[index];
        const volume = quotes.volume[index];

        const isMissing = (close === null || close === 0) && (adjClose === null || adjClose === 0);

        let dateStr = "";
        try {
          const parts = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit'
          }).formatToParts(new Date(ts * 1000));

          const year = parts.find(p => p.type === 'year')?.value;
          const month = parts.find(p => p.type === 'month')?.value;
          const day = parts.find(p => p.type === 'day')?.value;
          dateStr = `${year}-${month}-${day}`;
        } catch (e: any) {
          const d = new Date(ts * 1000);
          const year = d.getUTCFullYear();
          const month = String(d.getUTCMonth() + 1).padStart(2, '0');
          const day = String(d.getUTCDate()).padStart(2, '0');
          dateStr = `${year}-${month}-${day}`;
        }

        rawResult.push({
          date: ts * 1000,
          dateStr,
          open: open || adjClose || close || 0,
          high: high || adjClose || close || 0,
          low: low || adjClose || close || 0,
          close: close || adjClose || 0,
          adjClose: adjClose || 0,
          volume: volume || 0,
          isMissing
        });
      }

      // Linear interpolation fallback for any missing days in the Yahoo chart (if any)
      for (let i = 0; i < rawResult.length; i++) {
        if (rawResult[i].isMissing) {
          let prevValid = null;
          let prevIdx = -1;
          for (let j = i - 1; j >= 0; j--) {
            if (!rawResult[j].isMissing && rawResult[j].close > 0) {
              prevValid = rawResult[j];
              prevIdx = j;
              break;
            }
          }

          let nextValid = null;
          let nextIdx = -1;
          for (let j = i + 1; j < rawResult.length; j++) {
            if (!rawResult[j].isMissing && rawResult[j].close > 0) {
              nextValid = rawResult[j];
              nextIdx = j;
              break;
            }
          }

          if (prevValid && nextValid) {
            const steps = nextIdx - prevIdx;
            const step = i - prevIdx;
            const r = step / steps;

            rawResult[i].close = prevValid.close + (nextValid.close - prevValid.close) * r;
            rawResult[i].open = prevValid.open + (nextValid.open - prevValid.open) * r;
            rawResult[i].high = prevValid.high + (nextValid.high - prevValid.high) * r;
            rawResult[i].low = prevValid.low + (nextValid.low - prevValid.low) * r;
            rawResult[i].volume = Math.round(prevValid.volume + (nextValid.volume - prevValid.volume) * r);
          } else if (prevValid) {
            rawResult[i].close = prevValid.close;
            rawResult[i].open = prevValid.open;
            rawResult[i].high = prevValid.high;
            rawResult[i].low = prevValid.low;
            rawResult[i].volume = prevValid.volume;
          } else if (nextValid) {
            rawResult[i].close = nextValid.close;
            rawResult[i].open = nextValid.open;
            rawResult[i].high = nextValid.high;
            rawResult[i].low = nextValid.low;
            rawResult[i].volume = nextValid.volume;
          }
        }
      }

      const filteredResult = rawResult.filter((item: any) => item.close !== null && item.close > 0);
      res.json(filteredResult);
    } catch (error: any) {
      console.error(`Error fetching data for ${symbolStr}:`, error.message);
      res.status(500).json({ error: "Failed to fetch index data" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
