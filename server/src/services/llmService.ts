import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";
import Groq from "groq-sdk";
import { config } from "../config";
import {
  AnalyzeJobRequest,
  JobReadinessReport,
  JobReadinessReportSchema,
  CoreRequirement,
  GapAnalysisItem,
} from "../types/schema";
import { buildSystemPrompt, buildUserPrompt } from "./promptBuilder";

/**
 * Calculates a precise, mathematically grounded score based on core requirements.
 * - Must-have requirements carry 75% of the total score.
 * - Nice-to-have requirements carry 25% of the total score.
 * - Matched = 100%, Weak = 45%, Missing = 0%.
 */
export function calculateScoreFromRequirements(requirements: CoreRequirement[]): number {
  if (!requirements || requirements.length === 0) return 50;

  const mustHaves = requirements.filter((r) => r.importance === "must_have");
  const niceToHaves = requirements.filter((r) => r.importance === "nice_to_have");

  const getPoints = (status: "matched" | "weak" | "missing") => {
    if (status === "matched") return 1.0;
    if (status === "weak") return 0.45;
    return 0.0;
  };

  let mustScore = 0;
  if (mustHaves.length > 0) {
    const totalMustPoints = mustHaves.reduce((acc, r) => acc + getPoints(r.userStatus), 0);
    mustScore = totalMustPoints / mustHaves.length;
  }

  let niceScore = 0;
  if (niceToHaves.length > 0) {
    const totalNicePoints = niceToHaves.reduce((acc, r) => acc + getPoints(r.userStatus), 0);
    niceScore = totalNicePoints / niceToHaves.length;
  }

  let finalRatio = 0;
  if (mustHaves.length > 0 && niceToHaves.length > 0) {
    finalRatio = mustScore * 0.75 + niceScore * 0.25;
  } else if (mustHaves.length > 0) {
    finalRatio = mustScore;
  } else {
    finalRatio = niceScore;
  }

  // Strong penalty if all or almost all must-haves are missing
  if (mustHaves.length > 0 && mustScore === 0) {
    finalRatio = Math.min(finalRatio, 0.2);
  }

  return Math.max(5, Math.min(98, Math.round(finalRatio * 100)));
}

/**
 * Ensures the match percentage strictly reflects the requirements evidence,
 * preventing generic 90%+ scores when critical skills are missing.
 */
function alignScoreWithEvidence(report: JobReadinessReport): JobReadinessReport {
  const computed = calculateScoreFromRequirements(report.coreRequirements);
  if (Math.abs(report.matchScorePercentage - computed) > 10) {
    console.log(
      `[LLMService] Aligning score from LLM (${report.matchScorePercentage}%) to evidence-based score (${computed}%)`
    );
    report.matchScorePercentage = computed;
  }
  return report;
}

/**
 * Service to orchestrate LLM completion with structured JSON output enforcement.
 */
export class LLMService {
  private groqClient: Groq | null = null;
  private geminiClient: GoogleGenerativeAI | null = null;
  private openaiClient: OpenAI | null = null;

  public async analyzeJob(data: AnalyzeJobRequest): Promise<JobReadinessReport> {
    const provider = config.llmProvider;
    const groqKey = config.groqApiKey;
    const geminiKey = config.geminiApiKey;
    const openaiKey = config.openaiApiKey;

    // 1. Try configured provider
    if (provider === "groq" && groqKey) {
      try {
        return await this.callGroq(data);
      } catch (err: any) {
        console.warn(`[LLMService] Groq API call failed: ${err.message}`);
        if (!config.allowMockFallback) throw err;
      }
    } else if (provider === "gemini" && geminiKey) {
      try {
        return await this.callGemini(data);
      } catch (err: any) {
        console.warn(`[LLMService] Gemini API call failed: ${err.message}`);
        if (!config.allowMockFallback) throw err;
      }
    } else if (provider === "openai" && openaiKey) {
      try {
        return await this.callOpenAI(data);
      } catch (err: any) {
        console.warn(`[LLMService] OpenAI API call failed: ${err.message}`);
        if (!config.allowMockFallback) throw err;
      }
    }

    // 2. Cascade through other available API keys if primary failed or was not configured
    if (groqKey) {
      try {
        return await this.callGroq(data);
      } catch (err: any) {
        console.warn(`[LLMService] Fallback to Groq failed: ${err.message}`);
      }
    }

    if (geminiKey) {
      try {
        return await this.callGemini(data);
      } catch (err: any) {
        console.warn(`[LLMService] Fallback to Gemini failed: ${err.message}`);
      }
    }

    if (openaiKey) {
      try {
        return await this.callOpenAI(data);
      } catch (err: any) {
        console.warn(`[LLMService] Fallback to OpenAI failed: ${err.message}`);
      }
    }

    // 3. Fallback / Mock heuristic generator
    if (config.allowMockFallback) {
      console.log("[LLMService] Generating heuristic analysis (Demo/Fallback Mode)");
      return this.generateHeuristicReport(data);
    }

    throw new Error(
      `No valid LLM API key configured. Please set GROQ_API_KEY, GEMINI_API_KEY, or OPENAI_API_KEY in server/.env, or enable ALLOW_MOCK_FALLBACK=true.`
    );
  }

  /**
   * Groq Structured Output (LPU inference)
   */
  private async callGroq(data: AnalyzeJobRequest): Promise<JobReadinessReport> {
    const apiKey = config.groqApiKey;
    this.groqClient = new Groq({ apiKey });

    const modelsToTry = [
      config.groqModel,
      "openai/gpt-oss-120b",
      "openai/gpt-oss-20b",
      "llama-3.3-70b-versatile",
      "llama-3.1-8b-instant",
    ].filter(Boolean);

    let lastError: any = null;

    for (const model of modelsToTry) {
      try {
        console.log(`[LLMService] Calling Groq with model: ${model}`);
        const completion = await this.groqClient.chat.completions.create({
          model,
          response_format: { type: "json_object" },
          temperature: 0.2,
          messages: [
            { role: "system", content: buildSystemPrompt() },
            { role: "user", content: buildUserPrompt(data) },
          ],
        });

        const content = completion.choices[0]?.message?.content;
        if (!content) {
          throw new Error("Groq returned an empty response.");
        }

        const parsedJson = this.cleanAndParseJson(content);
        const report = JobReadinessReportSchema.parse(parsedJson);
        return alignScoreWithEvidence(report);
      } catch (err: any) {
        lastError = err;
        console.warn(`[LLMService] Groq attempt with model ${model} failed: ${err.message}`);

        // Try extracting and repairing failed_generation if Groq's JSON validator was overly strict
        const recovered = this.recoverFailedGeneration(err);
        if (recovered) {
          try {
            const report = JobReadinessReportSchema.parse(recovered);
            console.log(`[LLMService] Successfully recovered valid JSON from failed_generation payload!`);
            return alignScoreWithEvidence(report);
          } catch (valErr) {
            // Proceed to next model
          }
        }

        // If error is model not found or json validate failed, try next model in list
        continue;
      }
    }

    throw lastError || new Error("All Groq model attempts failed.");
  }

  /**
   * Recovers payload if Groq generated the full JSON but hit an escape-character validator warning
   */
  private recoverFailedGeneration(err: any): any | null {
    try {
      let rawFailed: string | null = null;
      if (err?.error?.failed_generation) {
        rawFailed = err.error.failed_generation;
      } else if (err?.message && err.message.includes("failed_generation")) {
        const parsed = JSON.parse(err.message.slice(err.message.indexOf("{")));
        if (parsed?.error?.failed_generation) {
          rawFailed = parsed.error.failed_generation;
        }
      }

      if (rawFailed) {
        // Clean double-escaped quotes like \\"
        const cleaned = rawFailed.replace(/\\\\"/g, '"');
        return JSON.parse(cleaned);
      }
    } catch {
      // Recovery fallback failed
    }
    return null;
  }

  /**
   * Google Gemini Structured Output
   */
  private async callGemini(data: AnalyzeJobRequest): Promise<JobReadinessReport> {
    if (!this.geminiClient) {
      this.geminiClient = new GoogleGenerativeAI(config.geminiApiKey);
    }

    const model = this.geminiClient.getGenerativeModel({
      model: config.geminiModel,
      systemInstruction: buildSystemPrompt(),
      generationConfig: {
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const userPrompt = buildUserPrompt(data);
    const result = await model.generateContent(userPrompt);
    const responseText = result.response.text();

    const parsedJson = this.cleanAndParseJson(responseText);
    const report = JobReadinessReportSchema.parse(parsedJson);
    return alignScoreWithEvidence(report);
  }

  /**
   * OpenAI Structured Output
   */
  private async callOpenAI(data: AnalyzeJobRequest): Promise<JobReadinessReport> {
    if (!this.openaiClient) {
      this.openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
    }

    const completion = await this.openaiClient.chat.completions.create({
      model: config.openaiModel,
      response_format: { type: "json_object" },
      temperature: 0.2,
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: buildUserPrompt(data) },
      ],
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    const parsedJson = this.cleanAndParseJson(content);
    const report = JobReadinessReportSchema.parse(parsedJson);
    return alignScoreWithEvidence(report);
  }

  /**
   * Cleans potential markdown wrapping and parses JSON
   */
  private cleanAndParseJson(raw: string): any {
    let clean = raw.trim();
    if (clean.startsWith("```json")) {
      clean = clean.replace(/^```json\s*/, "").replace(/```\s*$/, "");
    } else if (clean.startsWith("```")) {
      clean = clean.replace(/^```\s*/, "").replace(/```\s*$/, "");
    }
    return JSON.parse(clean);
  }

  /**
   * Heuristic fallback generator that parses actual JD and resume keywords
   * and builds a complete, highly realistic report matching the schema.
   */
  public generateHeuristicReport(data: AnalyzeJobRequest): JobReadinessReport {
    const jdLower = data.jobDescription.toLowerCase();
    const resumeLower = data.userResume.toLowerCase();

    // Catalog of known technical skills & competencies to detect
    const skillCatalog = [
      { name: "TypeScript", patterns: ["typescript", "ts"] },
      { name: "JavaScript", patterns: ["javascript", "js", "ecmascript"] },
      { name: "React", patterns: ["react", "react.js", "reactjs"] },
      { name: "Node.js", patterns: ["node", "node.js", "nodejs", "express"] },
      { name: "Next.js", patterns: ["next.js", "nextjs"] },
      { name: "Python", patterns: ["python", "django", "fastapi", "flask"] },
      { name: "SQL & Databases", patterns: ["sql", "postgres", "postgresql", "mysql", "database"] },
      { name: "NoSQL / MongoDB", patterns: ["nosql", "mongodb", "dynamodb", "redis"] },
      { name: "Docker & Containers", patterns: ["docker", "container", "containers"] },
      { name: "Kubernetes", patterns: ["kubernetes", "k8s"] },
      { name: "AWS / Cloud", patterns: ["aws", "cloud", "gcp", "azure", "s3", "ec2", "lambda"] },
      { name: "CI/CD & DevOps", patterns: ["ci/cd", "github actions", "devops", "jenkins"] },
      { name: "REST APIs", patterns: ["rest", "api", "restful", "endpoints"] },
      { name: "GraphQL", patterns: ["graphql", "apollo"] },
      { name: "System Design", patterns: ["system design", "distributed systems", "microservices", "scalability"] },
      { name: "Unit & Integration Testing", patterns: ["jest", "testing", "unit test", "cypress", "playwright"] },
      { name: "Git & Version Control", patterns: ["git", "github", "version control"] },
      { name: "Agile & Scrum", patterns: ["agile", "scrum", "sprints"] },
      { name: "Performance Optimization", patterns: ["performance", "optimization", "caching", "latency"] },
      { name: "Security & Auth", patterns: ["security", "oauth", "jwt", "authentication", "authorization"] },
    ];

    // Detect skills present in JD
    const detectedInJd = skillCatalog.filter((item) =>
      item.patterns.some((p) => jdLower.includes(p))
    );

    // If few detected, fallback to standard defaults
    const targetSkills =
      detectedInJd.length >= 4 ? detectedInJd : skillCatalog.slice(0, 8);

    const coreRequirements: CoreRequirement[] = targetSkills.slice(0, 10).map((skill, idx) => {
      const inResume = skill.patterns.some((p) => resumeLower.includes(p));
      const isMustHave = idx < 5 || jdLower.includes("must") || jdLower.includes("required");

      let userStatus: "matched" | "weak" | "missing";
      if (inResume) {
        userStatus = "matched";
      } else {
        // Only classify as weak if adjacent or partial, otherwise missing
        userStatus = "missing";
      }

      return {
        skill: skill.name,
        importance: isMustHave ? "must_have" : "nice_to_have",
        userStatus,
      };
    });

    // Calculate score mathematically using requirements evidence (no hardcoded 92% cap!)
    const matchScorePercentage = calculateScoreFromRequirements(coreRequirements);

    // Identify gaps
    const gapSkills = coreRequirements.filter(
      (r) => r.userStatus === "missing" || r.userStatus === "weak"
    );

    const gapAnalysis: GapAnalysisItem[] = gapSkills.slice(0, 4).map((g) => ({
      missingSkill: g.skill,
      quickSummaryToKnow: `Key industry standard for ${g.skill} in modern production stacks; interviewers probe architecture, tradeoffs, and failure modes.`,
      recommendedAction: `Complete a targeted 2-hour refresher on ${g.skill} best practices and integrate a brief reference into your recent project highlights.`,
      priority: g.importance === "must_have" ? "high" : "medium",
    }));

    if (gapAnalysis.length === 0) {
      gapAnalysis.push({
        missingSkill: "Advanced Production Observability",
        quickSummaryToKnow: "Monitoring metrics, tracing with OpenTelemetry, and structured logging in production distributed environments.",
        recommendedAction: "Review key metrics (SLIs/SLOs, latency percentiles) to demonstrate senior-level operational readiness.",
        priority: "low",
      });
    }

    // Interview questions tailored to role
    const interviewPrep = [
      {
        probableQuestion: `Can you walk us through how you've architected or scaled applications relevant to our tech stack at ${data.companyName}?`,
        reasoning: `The role emphasizes production reliability and practical hands-on engineering under real-world constraints.`,
        suggestedTalkingPoint: `Use the STAR format: highlight a specific challenge, explain the architectural decision you made, and quantify the result (e.g. latency, throughput, or team velocity).`,
      },
      {
        probableQuestion: gapSkills[0]
          ? `How would you approach working with ${gapSkills[0].skill} if our team relies heavily on it?`
          : `How do you handle technical debt while keeping feature velocity high?`,
        reasoning: `Assesses adaptability and how quickly you bridge domain or tooling gaps in a fast-paced environment.`,
        suggestedTalkingPoint: `Emphasize strong fundamentals, rapid onboarding ability, and how your experience with adjacent tools translates directly.`,
      },
      {
        probableQuestion: `Tell us about a time you diagnosed a complex production issue or performance bottleneck.`,
        reasoning: `Senior interviewers at ${data.companyName} want to see your debugging methodology and systematic problem-solving instincts.`,
        suggestedTalkingPoint: `Detail your root-cause analysis workflow: telemetry analysis, hypothesis testing, targeted fix, and preventative post-mortem measures.`,
      },
    ];

    // Resume action items
    const resumeActionItems = [
      `Explicitly mirror key phrasing from ${data.companyName}'s JD in your summary and most recent experience bullets.`,
      `Add quantified metrics (e.g., "% latency reduction", "X active users", "Y deployments/week") to your strongest project bullets.`,
      gapSkills[0]
        ? `Clarify familiarity with ${gapSkills[0].skill} by referencing adjacent frameworks or self-directed projects.`
        : `Highlight system design or end-to-end ownership in your primary project description.`,
      `Ensure your tech stack section prominently lists core requirements: ${coreRequirements.slice(0, 4).map((c) => c.skill).join(", ")}.`,
    ];

    return {
      roleTitle: data.jobTitle || "Software Engineer",
      companyName: data.companyName || "Target Company",
      matchScorePercentage,
      coreRequirements,
      gapAnalysis,
      interviewPrep,
      resumeActionItems,
    };
  }
}

export const llmService = new LLMService();
