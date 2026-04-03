import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // API Proxy for Yahoo Finance
  app.get("/api/kospi", async (req, res) => {
    const { start, end } = req.query;
    
    if (!start || !end) {
      return res.status(400).json({ error: "Start and end timestamps are required" });
    }

    try {
      // KOSPI symbol is ^KS11
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/%5EKS11?period1=${start}&period2=${end}&interval=1d`;
      const response = await axios.get(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });

      const chartData = response.data.chart.result[0];
      if (!chartData) {
        return res.json({ timestamps: [], indicators: [] });
      }

      const timestamps = chartData.timestamp || [];
      const quotes = chartData.indicators.quote[0];
      const adjClose = chartData.indicators.adjclose[0].adjclose;

      const result = timestamps.map((ts: number, index: number) => ({
        date: ts * 1000,
        open: quotes.open[index],
        high: quotes.high[index],
        low: quotes.low[index],
        close: quotes.close[index],
        adjClose: adjClose[index],
        volume: quotes.volume[index]
      }));

      res.json(result);
    } catch (error: any) {
      console.error("Error fetching KOSPI data:", error.message);
      res.status(500).json({ error: "Failed to fetch KOSPI data" });
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
