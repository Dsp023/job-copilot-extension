# JobCopilot AI ⚡
### Production-Grade In-Browser Career Copilot (Chrome Extension + SaaS Cloud Backend)

**JobCopilot AI** is a production-ready Chrome Extension (Manifest V3) powered by a secure cloud LLM backend. Built for ambitious job seekers, it turns any browser window into a personal career coach.

While browsing job postings on **LinkedIn, Wellfound, Indeed, Greenhouse, Lever**, or any company careers portal, JobCopilot instantly scans the posting, analyzes qualifications against the candidate's stored resume, and delivers an executive readiness report.

---

## 🎨 Product UI Highlights (Consumer SaaS Level)

- **One-Click Page Scanner:** Automatically identifies job openings across all major job platforms with noise stripping and selection fallbacks.
- **Radial Match Score Dial:** Animated circular progress gauge color-coded with dynamic tier feedback (`Top Tier Fit`, `Competitive Fit`, `Upskilling Recommended`).
- **Segmented Deep Dives:** Filterable views across *Core Requirements*, *Targeted Study Topics*, *Interview Prep*, and *ATS Resume Tweaks*.
- **Interviewer Psychology & STAR Strategies:** Custom interview questions based on candidate gaps with talking points.
- **Interactive Action Checklist:** Checkable resume tweaks that track progress in real-time.
- **Private & Local-First:** Plaintext resumes are stored exclusively in the user's `chrome.storage.local` sandbox. No resume text is stored permanently on server disks.
- **Zero Developer Clutter:** All server diagnostics, raw debug endpoints, and developer tooling have been removed from the user interface.

---

## 🛠 System Architecture

```text
┌────────────────────────────────────────────────────────┐
│               Chrome Extension (Client)                │
│                                                        │
│  [Job Board Tab] ──(DOM)──> [content.js]               │
│                                   │                    │
│                          Clean JD + Metadata           │
│                                   │                    │
│  [sidepanel.html/css/js] <────────┘                    │
│          │                                             │
│   (JD Text + Resume from chrome.storage.local)         │
│          │                                             │
└──────────┼─────────────────────────────────────────────┘
           │ HTTPS POST /api/analyze
           ▼
┌────────────────────────────────────────────────────────┐
│             Node.js / TypeScript Backend (SaaS)        │
│                                                        │
│  ├── Express Cloud Proxy (CORS, Rate Limiting)         │
│  ├── Zod Request & Response Schema Validation          │
│  ├── High-Speed Inference via Groq, Gemini & OpenAI   │
│  └── Evidence-Based Mathematical Scoring Algorithm     │
└────────────────────────────────────────────────────────┘
```

---

## 🚀 Quick Start Guide

### 1. Launch the Cloud Backend Proxy

```bash
cd server
npm install
npm run dev
```

The backend starts on `http://localhost:3001`.

#### Environment Configuration (`server/.env`)

```env
PORT=3001
NODE_ENV=production

# LLM Provider: "groq" | "gemini" | "openai" | "mock"
LLM_PROVIDER=groq

# Groq API Configuration (Fastest Inference)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=openai/gpt-oss-120b

# Alternative: Google Gemini
GEMINI_API_KEY=your_gemini_key
GEMINI_MODEL=gemini-1.5-flash

# Alternative: OpenAI
OPENAI_API_KEY=your_openai_key
OPENAI_MODEL=gpt-4o-mini

# Security & Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=60
ALLOW_MOCK_FALLBACK=true
```

---

### 2. Load the Extension in Google Chrome

1. Open Google Chrome and navigate to `chrome://extensions`.
2. Toggle on **Developer mode** in the top-right corner.
3. Click **Load unpacked**.
4. Select the project directory:
   `c:\Users\nakka\Downloads\job-copilot-extension`
5. Pin **JobCopilot AI** in your toolbar and click it to open the side panel.

---

## 🚢 Shipping to Production (SaaS Playbook)

### 1. Deploy the Backend Proxy
Deploy the `server/` directory to any modern cloud container platform:
- **Render / Railway / Fly.io:**
  - Build command: `npm install && npm run build`
  - Start command: `npm start`
  - Set environment variables (`GROQ_API_KEY`, `NODE_ENV=production`, `PORT=8080`)
- **Custom Domain:** Point your API to `https://api.yourdomain.com`.

### 2. Update Extension Client API URL
In [sidepanel.js](file:///c:/Users/nakka/Downloads/job-copilot-extension/sidepanel.js#L5), set `DEFAULT_API_ENDPOINT` to your live domain:
```javascript
const DEFAULT_API_ENDPOINT = "https://api.yourdomain.com";
```

### 3. Package & Publish to Chrome Web Store
1. Create a `.zip` archive containing the root extension files:
   - `manifest.json`
   - `background.js`
   - `content.js`
   - `sidepanel.html`
   - `sidepanel.css`
   - `sidepanel.js`
2. Open the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Upload the `.zip` archive, complete store listings, screenshots, and submit for review!
