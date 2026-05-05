import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Yahoo Finance
  app.get("/api/index-data", async (req, res) => {
    const { start, end, symbol = "^KS11" } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end timestamps are required" });
    }

    try {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol as string)}?period1=${start}&period2=${end}&interval=1d`;
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

      const result = timestamps.map((ts: number, index: number) => {
        const open = quotes.open[index];
        const high = quotes.high[index];
        const low = quotes.low[index];
        const close = quotes.close[index];
        const adjClose = adjCloseArray[index];
        const volume = quotes.volume[index];

        // Fallback to adjClose if close is null or 0
        const finalClose = (close === null || close === 0) ? adjClose : close;

        return {
          date: ts * 1000,
          open: open || finalClose,
          high: high || finalClose,
          low: low || finalClose,
          close: finalClose,
          adjClose: adjClose,
          volume: volume || 0
        };
      }).filter((item: any) => item.close !== null && item.close > 0);

      res.json(result);
    } catch (error: any) {
      console.error(`Error fetching data for ${symbol}:`, error.message);
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
