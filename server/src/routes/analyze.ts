import { Router, Request, Response } from "express";
import { ZodError } from "zod";
import { AnalyzeJobRequestSchema } from "../types/schema";
import { llmService } from "../services/llmService";

const router = Router();

router.post("/", async (req: Request, res: Response): Promise<void> => {
  try {
    // 1. Validate request body with Zod
    const validationResult = AnalyzeJobRequestSchema.safeParse(req.body);

    if (!validationResult.success) {
      const issueMessages = validationResult.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      );
      res.status(400).json({
        error: "Validation failed",
        message: "Invalid job analysis request payload.",
        details: issueMessages,
      });
      return;
    }

    const validData = validationResult.data;

    // 2. Execute LLM analysis & schema pipeline
    const report = await llmService.analyzeJob(validData);

    // 3. Return structured report
    res.status(200).json(report);
  } catch (error: any) {
    console.error("[AnalyzeRoute] Error during analysis:", error);

    if (error instanceof ZodError) {
      res.status(502).json({
        error: "Schema validation error",
        message: "LLM output failed schema enforcement.",
        details: error.issues,
      });
      return;
    }

    res.status(500).json({
      error: "Analysis failed",
      message: error.message || "An unexpected error occurred while analyzing the job description.",
    });
  }
});

export default router;
