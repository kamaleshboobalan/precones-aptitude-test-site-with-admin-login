const loginView = document.querySelector("#login-view");
const dashboardView = document.querySelector("#dashboard-view");
const loginForm = document.querySelector("#login-form");
const loginError = document.querySelector("#login-error");
const dashboardError = document.querySelector("#dashboard-error");
const submissionDialog = document.querySelector("#submission-dialog");

let page = 1;
let totalPages = 1;
let searchTimer;

async function api(url, options = {}) {
  const response = await fetch(url, { credentials: "same-origin", ...options });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    if (response.status === 401) showLogin();
    throw new Error(data?.error || "The request could not be completed.");
  }
  return { response, data };
}

function showLogin() {
  dashboardView.hidden = true;
  loginView.hidden = false;
}

function showDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function formatAssessmentDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function initials(name) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join("") || "C";
}

function addCell(row, content, className) {
  const cell = document.createElement("td");
  if (className) cell.className = className;
  if (content instanceof Node) cell.append(content);
  else cell.textContent = content;
  row.append(cell);
  return cell;
}

function renderSubmissions(submissions) {
  const rows = document.querySelector("#submission-rows");
  const fragment = document.createDocumentFragment();
  for (const submission of submissions) {
    const row = document.createElement("tr");
    const candidate = document.createElement("div");
    candidate.className = "candidate-name";
    const avatar = document.createElement("span");
    avatar.className = "candidate-avatar";
    avatar.textContent = initials(submission.name);
    const name = document.createElement("span");
    name.textContent = submission.name;
    candidate.append(avatar, name);
    addCell(row, candidate);
    addCell(row, submission.college || "—");
    addCell(row, submission.department || "—");
    addCell(row, formatAssessmentDate(submission.date));
    addCell(row, formatDate(submission.submittedAt));
    const score = document.createElement("span");
    score.className = "score-pill";
    score.textContent = `${submission.score} / ${submission.total}`;
    addCell(row, score);
    const percentage = document.createElement("span");
    percentage.className = "percentage-pill";
    percentage.textContent = `${submission.percentage}%`;
    addCell(row, percentage);
    const details = document.createElement("button");
    details.type = "button";
    details.className = "detail-button";
    details.textContent = "View details";
    details.addEventListener("click", () => loadSubmission(submission.id));
    addCell(row, details);
    fragment.append(row);
  }
  rows.replaceChildren(fragment);
  document.querySelector("#empty-state").hidden = submissions.length !== 0;
  document.querySelector(".table-scroll").hidden = submissions.length === 0;
}

async function loadSubmissions() {
  dashboardError.textContent = "";
  const query = new URLSearchParams({
    page: String(page),
    limit: "10",
    search: document.querySelector("#submission-search").value.trim()
  });
  try {
    const { data } = await api(`/api/admin/submissions?${query}`);
    document.querySelector("#total-submissions").textContent = data.stats.total.toLocaleString();
    document.querySelector("#recent-submissions").textContent = data.stats.lastSevenDays.toLocaleString();
    document.querySelector("#average-score").textContent = `${data.stats.averagePercentage}%`;
    page = data.page;
    totalPages = data.totalPages;
    document.querySelector("#results-count").textContent = data.total === 0
      ? "Showing 0 submissions"
      : `Showing ${data.start}–${data.end} of ${data.total} submissions`;
    document.querySelector("#page-label").textContent = `Page ${page} of ${totalPages}`;
    document.querySelector("#previous-page").disabled = page <= 1;
    document.querySelector("#next-page").disabled = page >= totalPages;
    renderSubmissions(data.submissions);
  } catch (error) {
    dashboardError.textContent = error.message;
  }
}

function appendDetailSection(container, section) {
  const row = document.createElement("div");
  row.className = "detail-section";
  const title = document.createElement("span");
  title.textContent = section.title;
  const score = document.createElement("span");
  score.textContent = `${section.score} / ${section.total}`;
  row.append(title, score);
  container.append(row);
}

function appendAnswer(container, answer) {
  const row = document.createElement("article");
  row.className = "detail-answer";
  const question = document.createElement("p");
  question.textContent = `Q${String(answer.id).padStart(2, "0")} · ${answer.sectionTitle}`;
  const text = document.createElement("p");
  text.textContent = answer.text;
  const selected = document.createElement("p");
  selected.className = answer.selectedOption === null ? "answer-choice unanswered" : "answer-choice";
  selected.textContent = answer.selectedOption === null
    ? "No answer selected"
    : `${String.fromCharCode(65 + answer.selectedOption)} · ${answer.options[answer.selectedOption]}`;
  const correct = document.createElement("p");
  correct.className = "answer-choice";
  correct.textContent = `Correct answer: ${String.fromCharCode(65 + answer.correctOption)} · ${answer.options[answer.correctOption]}`;
  row.append(question, text, selected, correct);
  container.append(row);
}

async function loadSubmission(id) {
  dashboardError.textContent = "";
  try {
    const { data } = await api(`/api/admin/submissions/${encodeURIComponent(id)}`);
    document.querySelector("#detail-name").textContent = data.name;
    const summary = document.querySelector("#detail-summary");
    summary.replaceChildren();
    for (const text of [
      `College: ${data.college || "—"}`,
      `Department: ${data.department || "—"}`,
      `Test date: ${formatAssessmentDate(data.date)}`,
      formatDate(data.submittedAt),
      `Score: ${data.score} / ${data.total}`,
      `${data.percentage}% overall`
    ]) {
      const chip = document.createElement("span");
      chip.className = "detail-chip";
      chip.textContent = text;
      summary.append(chip);
    }
    const sections = document.querySelector("#detail-sections");
    sections.replaceChildren();
    data.sectionScores.forEach((section) => appendDetailSection(sections, section));
    const answers = document.querySelector("#detail-answers");
    answers.replaceChildren();
    data.answers.forEach((answer) => appendAnswer(answers, answer));
    submissionDialog.showModal();
  } catch (error) {
    dashboardError.textContent = error.message;
  }
}

async function checkSession() {
  try {
    const { data } = await api("/api/admin/session");
    if (data.authenticated) {
      showDashboard();
      await loadSubmissions();
    } else {
      showLogin();
    }
  } catch (error) {
    loginError.textContent = error.message;
    showLogin();
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  const button = document.querySelector("#login-button");
  button.disabled = true;
  const fields = new FormData(loginForm);
  try {
    await api("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: fields.get("username"),
        password: fields.get("password")
      })
    });
    loginForm.reset();
    showDashboard();
    page = 1;
    await loadSubmissions();
  } catch (error) {
    loginError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#logout-button").addEventListener("click", async () => {
  dashboardError.textContent = "";
  try {
    await api("/api/admin/logout", { method: "POST" });
    showLogin();
  } catch (error) {
    dashboardError.textContent = error.message;
  }
});

document.querySelector("#submission-search").addEventListener("input", () => {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    page = 1;
    loadSubmissions();
  }, 250);
});

document.querySelector("#previous-page").addEventListener("click", () => {
  if (page > 1) {
    page -= 1;
    loadSubmissions();
  }
});

document.querySelector("#next-page").addEventListener("click", () => {
  if (page < totalPages) {
    page += 1;
    loadSubmissions();
  }
});

document.querySelector("#export-button").addEventListener("click", async (event) => {
  dashboardError.textContent = "";
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const query = new URLSearchParams({ search: document.querySelector("#submission-search").value.trim() });
    const { response } = await api(`/api/admin/submissions.csv?${query}`);
    const file = await response.blob();
    const objectUrl = URL.createObjectURL(file);
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = "precon-submissions.csv";
    anchor.click();
    URL.revokeObjectURL(objectUrl);
  } catch (error) {
    dashboardError.textContent = error.message;
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#close-dialog").addEventListener("click", () => submissionDialog.close());
submissionDialog.addEventListener("click", (event) => {
  if (event.target === submissionDialog) submissionDialog.close();
});

checkSession();
