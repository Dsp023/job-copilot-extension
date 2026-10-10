import dotenv from "dotenv";

dotenv.config();

export function refreshEnv() {
  dotenv.config();
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  llmProvider: "groq" | "gemini" | "openai" | "mock";
  groqApiKey: string;
  groqModel: string;
  geminiApiKey: string;
  geminiModel: string;
  openaiApiKey: string;
  openaiModel: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  allowMockFallback: boolean;
}

export const config: ServerConfig = {
  get port(): number {
    return parseInt(process.env.PORT || "3001", 10);
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || "development";
  },
  get llmProvider(): "groq" | "gemini" | "openai" | "mock" {
    refreshEnv();
    if (process.env.LLM_PROVIDER) {
      return process.env.LLM_PROVIDER as any;
    }
    return process.env.GROQ_API_KEY ? "groq" : "gemini";
  },
  get groqApiKey(): string {
    refreshEnv();
    return process.env.GROQ_API_KEY || "";
  },
  get groqModel(): string {
    return process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  },
  get geminiApiKey(): string {
    refreshEnv();
    return process.env.GEMINI_API_KEY || "";
  },
  get geminiModel(): string {
    return process.env.GEMINI_MODEL || "gemini-1.5-flash";
  },
  get openaiApiKey(): string {
    refreshEnv();
    return process.env.OPENAI_API_KEY || "";
  },
  get openaiModel(): string {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  },
  get rateLimitWindowMs(): number {
    return parseInt(process.env.RATE_LIMIT_WINDOW_MS || "900000", 10);
  },
  get rateLimitMax(): number {
    return parseInt(process.env.RATE_LIMIT_MAX || "60", 10);
  },
  get allowMockFallback(): boolean {
    return process.env.ALLOW_MOCK_FALLBACK !== "false";
  },
};
