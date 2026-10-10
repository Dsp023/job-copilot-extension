import { Router, Request, Response } from "express";
import { config } from "../config";

const router = Router();

router.get("/", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    service: "Job Seeker Copilot Backend Proxy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    provider: config.llmProvider,
    groqConfigured: Boolean(config.groqApiKey),
    geminiConfigured: Boolean(config.geminiApiKey),
    openaiConfigured: Boolean(config.openaiApiKey),
    mockFallbackAllowed: config.allowMockFallback,
  });
});

export default router;
