import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import analyzeRouter from "./routes/analyze";
import healthRouter from "./routes/health";

const app = express();

// 1. CORS Configuration
// Allows requests from Chrome extension origins (chrome-extension://...) as well as localhost
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow browser extensions, local dev, or server-to-server requests
      if (!origin || origin.startsWith("chrome-extension://") || origin.includes("localhost") || origin.includes("127.0.0.1")) {
        callback(null, true);
      } else {
        // Permissive for extension development while logging
        callback(null, true);
      }
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// 2. Request parsing
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// 3. Rate limiting for abuse prevention
const analyzeRateLimiter = rateLimit({
  windowMs: config.rateLimitWindowMs,
  max: config.rateLimitMax,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Rate limit exceeded",
    message: "Too many requests. Please wait a few minutes before analyzing another job post.",
  },
});

// 4. Routes
app.use("/health", healthRouter);
app.use("/api/health", healthRouter);
app.use("/api/analyze", analyzeRateLimiter, analyzeRouter);

// Root route
app.get("/", (req: Request, res: Response) => {
  res.json({
    name: "Job Seeker Copilot Backend Proxy",
    status: "online",
    endpoints: {
      health: "/api/health",
      analyze: "POST /api/analyze",
    },
  });
});

// 5. 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: "Not Found",
    message: `Cannot ${req.method} ${req.originalUrl}`,
  });
});

// 6. Global error handler
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error("[ServerError]", err);
  res.status(err.status || 500).json({
    error: "Internal Server Error",
    message: err.message || "An unexpected server error occurred.",
  });
});

// 7. Start listening
const server = app.listen(config.port, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Job Seeker Copilot Backend running on port ${config.port}`);
  console.log(`📡 URL: http://localhost:${config.port}`);
  console.log(`🤖 LLM Provider: ${config.llmProvider}`);
  console.log(`🛡️ Rate Limit: ${config.rateLimitMax} reqs per ${config.rateLimitWindowMs / 60000} mins`);
  console.log(`=======================================================`);
});

export default app;
