chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "EXTRACT_PAGE_TEXT") {
    const result = extractJobDetails();
    sendResponse(result);
    return true;
  }
});

function extractJobDetails() {
  const hostname = window.location.hostname;

  // 1. Priority: User highlighted text
  const selectedText = window.getSelection().toString().trim();
  if (selectedText.length > 50) {
    return {
      title: document.title || "Selected Text",
      company: hostname,
      text: selectedText,
      source: "Manual Selection"
    };
  }

  // 2. Site-Specific Selectors
  let title = "";
  let company = "";
  let jdElement = null;

  if (hostname.includes("wellfound.com")) {
    title = document.querySelector("h1")?.innerText?.trim() || "";
    company = document.querySelector("a[href*='/startups/'], h2")?.innerText?.trim() || "";
    // Target main job post container
    jdElement = document.querySelector("main") || document.querySelector("[class*='styles_jobDescription']");
  } 
  else if (hostname.includes("linkedin.com")) {
    title = document.querySelector(".job-details-jobs-unified-top-card__job-title, h1")?.innerText?.trim() || "";
    company = document.querySelector(".job-details-jobs-unified-top-card__primary-description a, .job-details-jobs-unified-top-card__company-name")?.innerText?.trim() || "";
    jdElement = document.querySelector("#job-details, .jobs-description-content__text, .jobs-box__html-content");
  } 
  else if (hostname.includes("indeed.com")) {
    title = document.querySelector("[data-testid='jobsearch-JobInfoHeader-title'], h1")?.innerText?.trim() || "";
    company = document.querySelector("[data-testid='inlineHeader-companyName']")?.innerText?.trim() || "";
    jdElement = document.querySelector("#jobDescriptionText");
  } 
  else if (hostname.includes("greenhouse.io")) {
    title = document.querySelector(".app-title, h1")?.innerText?.trim() || "";
    company = document.querySelector(".company-name")?.innerText?.trim() || "";
    jdElement = document.querySelector("#content, #main");
  } 
  else if (hostname.includes("lever.co")) {
    title = document.querySelector(".posting-headline h2")?.innerText?.trim() || "";
    company = document.querySelector(".main-header-logo")?.getAttribute("alt") || "";
    jdElement = document.querySelector(".posting-page, .section-wrapper");
  }

  // 3. Fallback: Generic Clean Extraction
  if (!jdElement) {
    jdElement = document.querySelector("main") || document.querySelector("article") || document.body;
  }

  if (!title) {
    title = document.querySelector("h1")?.innerText?.trim() || document.title;
  }

  const cleanText = cleanDomElement(jdElement);

  return {
    title: sanitizeString(title),
    company: sanitizeString(company) || hostname,
    text: cleanText,
    source: jdElement === document.body ? "Body (Cleaned)" : "Targeted Container"
  };
}

// Clone element and strip nav, footer, script, and button noise
function cleanDomElement(el) {
  if (!el) return "";
  const clone = el.cloneNode(true);

  // Tags to remove
  const noiseSelectors = [
    "nav", "header", "footer", "script", "style", "noscript", 
    "svg", "button", "input", "form", "iframe", "aside",
    "[role='navigation']", "[role='banner']", "[aria-hidden='true']"
  ];

  noiseSelectors.forEach(selector => {
    clone.querySelectorAll(selector).forEach(node => node.remove());
  });

  return clone.innerText
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Collapse multi-blank lines
    .trim();
}

function sanitizeString(str) {
  return str.replace(/\s+/g, " ").trim();
}