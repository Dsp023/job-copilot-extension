// ===================================================================
// JobCopilot AI - Production SaaS Client Controller
// ===================================================================

const DEFAULT_API_ENDPOINT = "http://localhost:3001";

// State
let currentJob = {
  title: "",
  company: "",
  text: "",
  source: ""
};

let userResume = "";
let apiEndpoint = DEFAULT_API_ENDPOINT;
let currentReport = null;
let currentFilter = "all";

// DOM Elements
const navTabButtons = document.querySelectorAll(".nav-tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const syncPill = document.getElementById("sync-pill");
const syncLabel = document.getElementById("sync-label");

// Scanner Tab Elements
const heroScanner = document.getElementById("hero-scanner");
const scanPageBtn = document.getElementById("scan-page-btn");
const loadSampleJdBtn = document.getElementById("load-sample-jd-btn");
const resumeWarningBanner = document.getElementById("resume-warning-banner");
const goToProfileBtn = document.getElementById("go-to-profile-btn");

const scannedCard = document.getElementById("scanned-card");
const displayRoleTitle = document.getElementById("display-role-title");
const displayCompanyName = document.getElementById("display-company-name");
const displaySourceBadge = document.getElementById("display-source-badge");
const displayCharCount = document.getElementById("display-char-count");
const toggleJdPreviewBtn = document.getElementById("toggle-jd-preview-btn");
const jdPreviewDrawer = document.getElementById("jd-preview-drawer");
const rawJdTextarea = document.getElementById("raw-jd-textarea");
const rescanBtn = document.getElementById("rescan-btn");
const runAnalysisBtn = document.getElementById("run-analysis-btn");

const loadingPanel = document.getElementById("loading-panel");
const loadingStepTitle = document.getElementById("loading-step-title");
const loadingStepSub = document.getElementById("loading-step-sub");

const errorPanel = document.getElementById("error-panel");
const errorHeadline = document.getElementById("error-headline");
const errorBody = document.getElementById("error-body");
const errorRetryAction = document.getElementById("error-retry-action");

// Results Dashboard Elements
const resultsDashboard = document.getElementById("results-dashboard");
const scoreRadialProgress = document.getElementById("score-radial-progress");
const scorePercentageNum = document.getElementById("score-percentage-num");
const scoreTierBadge = document.getElementById("score-tier-badge");
const reportRoleTitle = document.getElementById("report-role-title");
const reportCompanyName = document.getElementById("report-company-name");
const reportStatsLine = document.getElementById("report-stats-line");

const segmentedBtns = document.querySelectorAll(".segment-btn");
const reportSections = document.querySelectorAll(".report-section");

const countAll = document.getElementById("count-all");
const countMatched = document.getElementById("count-matched");
const countWeak = document.getElementById("count-weak");
const countMissing = document.getElementById("count-missing");
const chipFilterBtns = document.querySelectorAll(".chip-filter-btn");
const skillsDeck = document.getElementById("skills-deck");

const gapsContainer = document.getElementById("gaps-container");
const interviewContainer = document.getElementById("interview-container");
const checklistContainer = document.getElementById("checklist-container");
const copyChecklistBtn = document.getElementById("copy-checklist-btn");
const exportMarkdownBtn = document.getElementById("export-markdown-btn");
const scanNewBtn = document.getElementById("scan-new-btn");

// Profile Tab Elements
const profileResumeTextarea = document.getElementById("profile-resume-textarea");
const profileWordCount = document.getElementById("profile-word-count");
const profileCharCount = document.getElementById("profile-char-count");
const saveResumeBtn = document.getElementById("save-resume-btn");
const profileSaveStatus = document.getElementById("profile-save-status");
const loadSampleProfileBtn = document.getElementById("load-sample-profile-btn");
const clearProfileBtn = document.getElementById("clear-profile-btn");
const profileProgressFill = document.getElementById("profile-progress-fill");
const profileStrengthLabel = document.getElementById("profile-strength-label");

// Advanced Settings Elements
const toggleAdvancedBtn = document.getElementById("toggle-advanced-btn");
const advancedSettingsDrawer = document.getElementById("advanced-settings-drawer");
const apiEndpointInput = document.getElementById("api-endpoint-input");

// ===================================================================
// Initialization
// ===================================================================

document.addEventListener("DOMContentLoaded", async () => {
  setupNavigation();
  setupEventListeners();
  await loadStoredProfile();
  await checkConnectionSilent();
});

function setupNavigation() {
  navTabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTabId = btn.getAttribute("data-tab");
      switchTab(targetTabId);
    });
  });

  goToProfileBtn.addEventListener("click", () => {
    switchTab("tab-profile");
  });
}

function switchTab(tabId) {
  navTabButtons.forEach(b => {
    b.classList.toggle("active", b.getAttribute("data-tab") === tabId);
  });
  tabContents.forEach(pane => {
    pane.classList.toggle("active", pane.id === tabId);
  });
}

// Stored Profile Data
async function loadStoredProfile() {
  return new Promise((resolve) => {
    chrome.storage.local.get(["userResume", "apiEndpoint"], (res) => {
      if (res.userResume) {
        userResume = res.userResume;
        profileResumeTextarea.value = userResume;
        updateProfileMetrics();
      }

      if (res.apiEndpoint) {
        apiEndpoint = res.apiEndpoint;
        apiEndpointInput.value = apiEndpoint;
      } else {
        apiEndpointInput.value = DEFAULT_API_ENDPOINT;
      }

      checkResumeRequirement();
      resolve();
    });
  });
}

function updateProfileMetrics() {
  const text = profileResumeTextarea.value.trim();
  profileCharCount.innerText = text.length;
  const words = text ? text.split(/\s+/).filter(Boolean).length : 0;
  profileWordCount.innerText = words;

  // Profile strength indicator
  if (words >= 100) {
    profileProgressFill.style.width = "100%";
    profileStrengthLabel.innerText = "Strong (100%) ✓";
    profileStrengthLabel.style.color = "#10b981";
  } else if (words >= 30) {
    profileProgressFill.style.width = "60%";
    profileStrengthLabel.innerText = "Moderate (60%)";
    profileStrengthLabel.style.color = "#f59e0b";
  } else {
    profileProgressFill.style.width = "20%";
    profileStrengthLabel.innerText = "Incomplete";
    profileStrengthLabel.style.color = "#ef4444";
  }
}

function checkResumeRequirement() {
  const hasResume = userResume && userResume.trim().length >= 20;
  resumeWarningBanner.style.display = hasResume ? "none" : "flex";
  return hasResume;
}

// Silent Cloud Connection Check
async function checkConnectionSilent() {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${apiEndpoint}/api/health`, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.ok) {
      syncLabel.innerText = "Online";
      syncPill.querySelector(".sync-dot").style.background = "#10b981";
      syncPill.querySelector(".sync-dot").style.boxShadow = "0 0 8px #10b981";
      return true;
    }
  } catch {
    syncLabel.innerText = "Offline";
    syncPill.querySelector(".sync-dot").style.background = "#ef4444";
    syncPill.querySelector(".sync-dot").style.boxShadow = "none";
    return false;
  }
}

// ===================================================================
// Event Listeners
// ===================================================================

function setupEventListeners() {
  // Scanner actions
  scanPageBtn.addEventListener("click", scanCurrentPage);
  rescanBtn.addEventListener("click", scanCurrentPage);
  loadSampleJdBtn.addEventListener("click", loadSampleJobPost);
  runAnalysisBtn.addEventListener("click", executeMatchAnalysis);
  errorRetryAction.addEventListener("click", executeMatchAnalysis);

  // Toggle raw JD preview
  toggleJdPreviewBtn.addEventListener("click", () => {
    const isHidden = jdPreviewDrawer.style.display === "none";
    jdPreviewDrawer.style.display = isHidden ? "block" : "none";
    toggleJdPreviewBtn.innerText = isHidden ? "Hide Text ▲" : "Preview Text ▼";
  });

  rawJdTextarea.addEventListener("input", () => {
    currentJob.text = rawJdTextarea.value.trim();
    displayCharCount.innerText = `${currentJob.text.length} characters extracted`;
  });

  // Profile actions
  saveResumeBtn.addEventListener("click", () => {
    userResume = profileResumeTextarea.value.trim();
    chrome.storage.local.set({ userResume }, () => {
      profileSaveStatus.style.display = "flex";
      checkResumeRequirement();
      setTimeout(() => {
        profileSaveStatus.style.display = "none";
      }, 2500);
    });
  });

  profileResumeTextarea.addEventListener("input", updateProfileMetrics);
  loadSampleProfileBtn.addEventListener("click", loadSampleResume);
  clearProfileBtn.addEventListener("click", clearResumeProfile);

  // Advanced settings toggle
  toggleAdvancedBtn.addEventListener("click", () => {
    const isHidden = advancedSettingsDrawer.style.display === "none";
    advancedSettingsDrawer.style.display = isHidden ? "block" : "none";
  });

  apiEndpointInput.addEventListener("change", () => {
    apiEndpoint = apiEndpointInput.value.trim() || DEFAULT_API_ENDPOINT;
    chrome.storage.local.set({ apiEndpoint });
    checkConnectionSilent();
  });

  // Segmented section toggles
  segmentedBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      segmentedBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      const targetSection = btn.getAttribute("data-section");

      if (targetSection === "all-sections") {
        reportSections.forEach(sec => sec.style.display = "block");
      } else {
        reportSections.forEach(sec => {
          sec.style.display = sec.id === targetSection ? "block" : "none";
        });
        const activeElem = document.getElementById(targetSection);
        if (activeElem) activeElem.scrollIntoView({ behavior: "smooth" });
      }
    });
  });

  // Filter skills buttons
  chipFilterBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      chipFilterBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentFilter = btn.getAttribute("data-filter");
      filterSkillChips();
    });
  });

  // Copy utilities
  copyChecklistBtn.addEventListener("click", copyResumeChecklist);
  exportMarkdownBtn.addEventListener("click", exportFullReportMarkdown);

  // Scan new job
  scanNewBtn.addEventListener("click", () => {
    resultsDashboard.style.display = "none";
    if (currentJob.text) {
      scannedCard.style.display = "block";
    } else {
      heroScanner.style.display = "block";
    }
  });
}

// ===================================================================
// Job Post Page Scanner
// ===================================================================

async function scanCurrentPage() {
  scanPageBtn.disabled = true;
  rescanBtn.disabled = true;
  scanPageBtn.innerHTML = "<span>⏳</span> Scanning Page...";
  errorPanel.style.display = "none";

  try {
    const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (!tab || !tab.id) {
      throw new Error("Unable to identify active browser tab.");
    }

    let response;
    try {
      response = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PAGE_TEXT" });
    } catch {
      // Content script injection fallback
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["content.js"]
      });
      response = await chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_PAGE_TEXT" });
    }

    if (response && response.text && response.text.length >= 20) {
      setJobScanned({
        title: response.title || tab.title || "Target Role",
        company: response.company || (new URL(tab.url)).hostname.replace("www.", ""),
        text: response.text,
        source: response.source || "Active Tab"
      });
    } else {
      throw new Error("No readable job post found on this page. Try highlighting the job description manually and scan again.");
    }
  } catch (err) {
    showErrorAlert("Scanning Notice", err.message);
  } finally {
    scanPageBtn.disabled = false;
    rescanBtn.disabled = false;
    scanPageBtn.innerHTML = "<span>⚡</span> Scan Active Job Post";
  }
}

function setJobScanned(job) {
  currentJob = job;
  heroScanner.style.display = "none";
  scannedCard.style.display = "block";

  displayRoleTitle.innerText = currentJob.title;
  displayCompanyName.innerText = currentJob.company;
  displaySourceBadge.innerText = currentJob.source;
  displayCharCount.innerText = `${currentJob.text.length.toLocaleString()} characters extracted`;
  rawJdTextarea.value = currentJob.text;

  checkResumeRequirement();
}

// ===================================================================
// Match Analysis Pipeline
// ===================================================================

async function executeMatchAnalysis() {
  if (!currentJob.text || currentJob.text.length < 20) {
    showErrorAlert("Missing Job Post", "Please scan a job post first.");
    return;
  }

  if (!checkResumeRequirement()) {
    switchTab("tab-profile");
    return;
  }

  // Loading state
  runAnalysisBtn.disabled = true;
  errorPanel.style.display = "none";
  resultsDashboard.style.display = "none";
  loadingPanel.style.display = "block";

  loadingStepTitle.innerText = "Analyzing Job Requirements...";
  loadingStepSub.innerText = "Extracting core qualifications and competencies...";

  const t1 = setTimeout(() => {
    loadingStepTitle.innerText = "Comparing Against Profile...";
    loadingStepSub.innerText = "Evaluating candidate match against must-haves...";
  }, 1200);

  const t2 = setTimeout(() => {
    loadingStepTitle.innerText = "Generating Interview & Resume Strategy...";
    loadingStepSub.innerText = "Synthesizing custom talking points and ATS tweaks...";
  }, 2600);

  try {
    const payload = {
      jobTitle: currentJob.title || "Software Engineer",
      companyName: currentJob.company || "Target Company",
      jobDescription: currentJob.text,
      userResume: userResume.trim()
    };

    const response = await fetch(`${apiEndpoint}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    clearTimeout(t1);
    clearTimeout(t2);

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.message || `Analysis engine returned status ${response.status}`);
    }

    const report = await response.json();
    currentReport = report;

    loadingPanel.style.display = "none";
    renderDashboardReport(report);
  } catch (err) {
    loadingPanel.style.display = "none";
    showErrorAlert("Analysis Engine Alert", err.message);
    checkConnectionSilent();
  } finally {
    runAnalysisBtn.disabled = false;
  }
}

// ===================================================================
// Render Report Dashboard
// ===================================================================

function renderDashboardReport(report) {
  resultsDashboard.style.display = "block";

  // 1. Radial Score Dial
  const score = Math.max(0, Math.min(100, Math.round(report.matchScorePercentage)));
  scorePercentageNum.innerText = `${score}%`;
  reportRoleTitle.innerText = report.roleTitle;
  reportCompanyName.innerText = report.companyName;

  // SVG Radial stroke offset (circumference ~ 194.8)
  const circumference = 2 * Math.PI * 31;
  const offset = circumference - (score / 100) * circumference;
  scoreRadialProgress.style.strokeDashoffset = offset;

  // Grade color & badge
  let ringColor = "#10b981";
  let tierText = "Top Tier Fit";
  let tierClass = "tier-strong";

  if (score < 55) {
    ringColor = "#ef4444";
    tierText = "Upskilling Recommended";
    tierClass = "tier-needs-work";
  } else if (score < 75) {
    ringColor = "#f59e0b";
    tierText = "Competitive Fit";
    tierClass = "tier-moderate";
  }

  scoreRadialProgress.style.stroke = ringColor;
  scorePercentageNum.style.color = ringColor;
  scoreTierBadge.innerText = tierText;
  scoreTierBadge.className = `tier-pill ${tierClass}`;

  const totalSkills = report.coreRequirements.length;
  const matchedSkills = report.coreRequirements.filter(s => s.userStatus === "matched").length;
  reportStatsLine.innerText = `${matchedSkills} of ${totalSkills} core qualifications matched`;

  // 2. Render Core Requirements
  renderRequirementsSection(report.coreRequirements);

  // 3. Render Gap Plan
  renderGapsSection(report.gapAnalysis);

  // 4. Render Interview Prep
  renderInterviewSection(report.interviewPrep);

  // 5. Render Resume Checklist
  renderChecklistSection(report.resumeActionItems);

  // Reset segmented nav
  segmentedBtns.forEach(b => b.classList.toggle("active", b.getAttribute("data-section") === "all-sections"));
  reportSections.forEach(s => s.style.display = "block");

  // Smooth scroll
  resultsDashboard.scrollIntoView({ behavior: "smooth" });
}

function renderRequirementsSection(skills) {
  const matched = skills.filter(s => s.userStatus === "matched").length;
  const weak = skills.filter(s => s.userStatus === "weak").length;
  const missing = skills.filter(s => s.userStatus === "missing").length;

  countAll.innerText = skills.length;
  countMatched.innerText = matched;
  countWeak.innerText = weak;
  countMissing.innerText = missing;

  skillsDeck.innerHTML = "";

  skills.forEach(skill => {
    const chip = document.createElement("div");
    chip.className = `skill-tag ${skill.userStatus}`;
    chip.setAttribute("data-status", skill.userStatus);

    const icon = skill.userStatus === "matched" ? "✓" : (skill.userStatus === "weak" ? "⚠" : "✕");
    const importanceTag = skill.importance === "must_have" ? "Must" : "Bonus";

    chip.innerHTML = `
      <span>${icon}</span>
      <span>${escapeHtml(skill.skill)}</span>
      <span class="tag-badge">${importanceTag}</span>
    `;

    skillsDeck.appendChild(chip);
  });

  filterSkillChips();
}

function filterSkillChips() {
  const chips = skillsDeck.querySelectorAll(".skill-tag");
  chips.forEach(chip => {
    const status = chip.getAttribute("data-status");
    if (currentFilter === "all" || status === currentFilter) {
      chip.style.display = "inline-flex";
    } else {
      chip.style.display = "none";
    }
  });
}

function renderGapsSection(gaps) {
  gapsContainer.innerHTML = "";

  if (!gaps || gaps.length === 0) {
    gapsContainer.innerHTML = `
      <div style="font-size: 12px; color: var(--success); padding: 4px 0;">
        ✓ Excellent alignment! No major high-priority skill gaps identified.
      </div>
    `;
    return;
  }

  gaps.forEach(gap => {
    const card = document.createElement("div");
    card.className = "gap-card";

    const pClass = gap.priority === "high" ? "tier-needs-work" : (gap.priority === "medium" ? "tier-moderate" : "tier-strong");

    card.innerHTML = `
      <div class="gap-top">
        <span class="gap-name">${escapeHtml(gap.missingSkill)}</span>
        <span class="gap-badge ${pClass}">${(gap.priority || "Medium").toUpperCase()}</span>
      </div>
      <div class="gap-summary-text">${escapeHtml(gap.quickSummaryToKnow)}</div>
      <div class="gap-action-box"><strong>Target Prep:</strong> ${escapeHtml(gap.recommendedAction)}</div>
    `;

    gapsContainer.appendChild(card);
  });
}

function renderInterviewSection(questions) {
  interviewContainer.innerHTML = "";

  if (!questions || questions.length === 0) {
    interviewContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">No questions generated.</div>`;
    return;
  }

  questions.forEach((q, idx) => {
    const box = document.createElement("div");
    box.className = `accordion-box ${idx === 0 ? "open" : ""}`;

    box.innerHTML = `
      <button class="accordion-header-btn">
        <span class="accordion-title">Q${idx + 1}: ${escapeHtml(q.probableQuestion)}</span>
        <span class="accordion-arrow">▼</span>
      </button>
      <div class="accordion-pane">
        <div class="coach-box">
          <div class="coach-label">Recruiter Psychology</div>
          <div class="coach-text">${escapeHtml(q.reasoning)}</div>
        </div>
        <div class="coach-box">
          <div class="coach-label">STAR Response Strategy</div>
          <div class="coach-text">${escapeHtml(q.suggestedTalkingPoint)}</div>
        </div>
      </div>
    `;

    box.querySelector(".accordion-header-btn").addEventListener("click", () => {
      box.classList.toggle("open");
    });

    interviewContainer.appendChild(box);
  });
}

function renderChecklistSection(actions) {
  checklistContainer.innerHTML = "";

  if (!actions || actions.length === 0) {
    checklistContainer.innerHTML = `<div style="font-size: 12px; color: var(--text-muted);">No tweaks required.</div>`;
    return;
  }

  actions.forEach((text, i) => {
    const row = document.createElement("div");
    row.className = "check-item";

    row.innerHTML = `
      <input type="checkbox" id="chk-${i}">
      <label for="chk-${i}" class="check-label">${escapeHtml(text)}</label>
    `;

    const input = row.querySelector("input");
    input.addEventListener("change", () => {
      row.classList.toggle("done", input.checked);
    });

    checklistContainer.appendChild(row);
  });
}

// ===================================================================
// Copy & Export Utilities
// ===================================================================

function copyResumeChecklist() {
  if (!currentReport || !currentReport.resumeActionItems) return;
  const list = currentReport.resumeActionItems.map(item => `- [ ] ${item}`).join("\n");
  navigator.clipboard.writeText(list);
  copyChecklistBtn.innerText = "✓ Copied";
  setTimeout(() => {
    copyChecklistBtn.innerText = "Copy";
  }, 2000);
}

function exportFullReportMarkdown() {
  if (!currentReport) return;
  const r = currentReport;

  const md = `# JobCopilot Readiness Assessment: ${r.roleTitle} @ ${r.companyName}
**Match Rating:** ${r.matchScorePercentage}%

## Core Requirements Breakdown
${r.coreRequirements.map(c => `- **${c.skill}**: ${c.userStatus.toUpperCase()} (${c.importance})`).join("\n")}

## Targeted Study Topics
${r.gapAnalysis.map(g => `### ${g.missingSkill} [${g.priority.toUpperCase()}]\n- **Concept:** ${g.quickSummaryToKnow}\n- **Action:** ${g.recommendedAction}`).join("\n\n")}

## Tailored Interview Coaching
${r.interviewPrep.map((q, i) => `### Q${i+1}: ${q.probableQuestion}\n- **Why Asked:** ${q.reasoning}\n- **Response Strategy:** ${q.suggestedTalkingPoint}`).join("\n\n")}

## ATS Resume Action Items
${r.resumeActionItems.map(a => `- [ ] ${a}`).join("\n")}
`;

  navigator.clipboard.writeText(md);
  exportMarkdownBtn.innerHTML = "<span>✓</span> Copied Report!";
  setTimeout(() => {
    exportMarkdownBtn.innerHTML = "<span>📋</span> Copy Full Report";
  }, 2000);
}

// ===================================================================
// Sample Demo Helpers
// ===================================================================

function loadSampleResume() {
  const sample = `Alex Rivera
Senior Full-Stack Engineer | alex.rivera@email.com | San Francisco, CA

SUMMARY
Senior Full-Stack Engineer with 5+ years of production experience building high-throughput cloud web applications with React, TypeScript, Node.js, and PostgreSQL. Experienced with containerized microservices (Docker, Kubernetes) and AWS deployments.

TECHNICAL EXPERTISE
- Languages: TypeScript, JavaScript, Python, SQL, HTML5/CSS3
- Frontend: React 18, Next.js, Redux Toolkit, Tailwind CSS, Jest, Cypress
- Backend: Node.js, Express, Fastify, REST APIs, GraphQL, Redis
- Data & Cloud: PostgreSQL, MongoDB, Docker, AWS (ECS, Lambda, S3, RDS), GitHub Actions CI/CD

PROFESSIONAL EXPERIENCE
Senior Software Engineer | HighScale Technologies (2022 - Present)
- Architected enterprise React/Next.js dashboard servicing 80,000+ daily active users.
- Designed distributed Node.js microservices reducing core API p99 latency by 42%.
- Streamlined CI/CD automation with Docker and GitHub Actions, cutting release cycles from 2 hours to 8 minutes.

Full-Stack Developer | Innovate Web Studios (2020 - 2022)
- Built interactive client applications using React, Node.js, and PostgreSQL.
- Implemented robust JWT auth workflows and role-based permissions.`;

  profileResumeTextarea.value = sample;
  userResume = sample;
  updateProfileMetrics();
  chrome.storage.local.set({ userResume: sample }, () => {
    profileSaveStatus.style.display = "flex";
    checkResumeRequirement();
    setTimeout(() => {
      profileSaveStatus.style.display = "none";
    }, 2500);
  });
}

function clearResumeProfile() {
  profileResumeTextarea.value = "";
  userResume = "";
  updateProfileMetrics();
  chrome.storage.local.set({ userResume: "" }, () => {
    checkResumeRequirement();
  });
}

function loadSampleJobPost() {
  setJobScanned({
    title: "Senior Full-Stack Engineer",
    company: "CloudVibe Systems",
    source: "Demo Job Post",
    text: `About CloudVibe Systems:
CloudVibe is building the next-generation developer platform for cloud-native microservices.

Role: Senior Full-Stack Engineer
Location: Remote (US / Global)

What You Will Build:
- Lead the engineering of core full-stack features using React, TypeScript, Node.js, and PostgreSQL.
- Architect high-throughput distributed microservices with Redis caching.
- Drive container adoption using Docker, Kubernetes, and AWS infrastructure (ECS, Lambda, S3).
- Implement robust CI/CD deployment pipelines using GitHub Actions.

Requirements:
- 4+ years of professional full-stack web engineering experience.
- Deep expertise in React and modern TypeScript.
- Strong proficiency with Node.js and building resilient RESTful & GraphQL APIs.
- Hands-on experience with PostgreSQL and relational database query optimization.
- Experience with Docker containers and AWS cloud infrastructure.

Nice to Have:
- Familiarity with Go or Rust.
- Open-source contributions or experience with observability tooling (Datadog, Prometheus).`
  });
}

function showErrorAlert(headline, message) {
  errorPanel.style.display = "flex";
  errorHeadline.innerText = headline;
  errorBody.innerText = message;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}