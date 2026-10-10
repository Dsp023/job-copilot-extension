import { z } from "zod";

/**
 * Request body schema for POST /api/analyze
 */
export const AnalyzeJobRequestSchema = z.object({
  jobTitle: z
    .string()
    .min(1, "Job title is required")
    .max(200, "Job title cannot exceed 200 characters")
    .transform((val) => val.trim()),
  companyName: z
    .string()
    .min(1, "Company name is required")
    .max(200, "Company name cannot exceed 200 characters")
    .transform((val) => val.trim()),
  jobDescription: z
    .string()
    .min(20, "Job description must be at least 20 characters long")
    .max(50000, "Job description cannot exceed 50,000 characters")
    .transform((val) => val.trim()),
  userResume: z
    .string()
    .min(20, "User resume/profile must be at least 20 characters long")
    .max(50000, "User resume cannot exceed 50,000 characters")
    .transform((val) => val.trim()),
});

export type AnalyzeJobRequest = z.infer<typeof AnalyzeJobRequestSchema>;

/**
 * Single core requirement schema with resilient preprocessing
 */
export const CoreRequirementSchema = z.object({
  skill: z.string().min(1),
  importance: z.preprocess((val) => {
    const s = String(val || "").toLowerCase().trim();
    if (s.includes("must") || s.includes("req") || s === "high") return "must_have";
    return "nice_to_have";
  }, z.enum(["must_have", "nice_to_have"])),
  userStatus: z.preprocess((val) => {
    const s = String(val || "").toLowerCase().trim();
    if (s.includes("match") || s === "yes" || s === "true" || s === "have") return "matched";
    if (s.includes("weak") || s.includes("part") || s.includes("med") || s.includes("learn")) return "weak";
    return "missing";
  }, z.enum(["matched", "weak", "missing"])),
});

export type CoreRequirement = z.infer<typeof CoreRequirementSchema>;

/**
 * Single gap analysis item schema with resilient preprocessing
 */
export const GapAnalysisItemSchema = z.object({
  missingSkill: z.string().min(1),
  quickSummaryToKnow: z.string().min(1),
  recommendedAction: z.string().min(1),
  priority: z.preprocess((val) => {
    const s = String(val || "").toLowerCase().trim();
    if (s.includes("high")) return "high";
    if (s.includes("low")) return "low";
    return "medium";
  }, z.enum(["high", "medium", "low"])),
});

export type GapAnalysisItem = z.infer<typeof GapAnalysisItemSchema>;

/**
 * Single interview preparation question schema
 */
export const InterviewPrepItemSchema = z.object({
  probableQuestion: z.string().min(1),
  reasoning: z.string().min(1),
  suggestedTalkingPoint: z.string().min(1),
});

export type InterviewPrepItem = z.infer<typeof InterviewPrepItemSchema>;

/**
 * Full readiness report response schema
 */
export const JobReadinessReportSchema = z.object({
  roleTitle: z.string().min(1),
  companyName: z.string().min(1),
  matchScorePercentage: z.preprocess((val) => {
    const num = Number(val);
    if (isNaN(num)) return 50;
    return Math.max(0, Math.min(100, Math.round(num)));
  }, z.number().int().min(0).max(100)),
  coreRequirements: z.array(CoreRequirementSchema).min(1),
  gapAnalysis: z.array(GapAnalysisItemSchema),
  interviewPrep: z.array(InterviewPrepItemSchema).min(1),
  resumeActionItems: z.array(z.string().min(1)).min(1),
});

export type JobReadinessReport = z.infer<typeof JobReadinessReportSchema>;
