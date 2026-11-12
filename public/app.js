const startForm = document.querySelector("#start-form");
const intro = document.querySelector("#intro");
const testView = document.querySelector("#test-view");
const resultView = document.querySelector("#result-view");
const startError = document.querySelector("#start-error");
const testError = document.querySelector("#test-error");

let testData;
let candidateName = "";
let candidateDetails = {};
let currentQuestion = 0;
let answers = {};
let timerInterval;
let testEndsAt = 0;
let testExpired = false;
let submissionInProgress = false;
const TEST_DURATION_SECONDS = 60 * 60;

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchTestData() {
  const response = await fetch("/api/questions");
  if (!response.ok) throw new Error("The test questions could not be loaded.");
  return response.json();
}

document.querySelector("#candidate-date").value = formatLocalDate(new Date());

function showQuestion() {
  const question = testData.questions[currentQuestion];
  const sectionIndex = testData.sections.findIndex((section) => section.id === question.sectionId);
  const section = testData.sections[sectionIndex];
  const sectionQuestions = testData.questions.filter((item) => item.sectionId === section.id);
  const answeredCount = Object.keys(answers).length;
  const sectionAnsweredCount = sectionQuestions.filter((item) => answers[item.id] !== undefined).length;
  const progressPercent = Math.round(((currentQuestion + 1) / testData.questions.length) * 100);

  document.querySelector("#progress-label").textContent = `Question ${currentQuestion + 1} of ${testData.questions.length}`;
  document.querySelector("#progress-percent").textContent = `${progressPercent}% complete`;
  document.querySelector("#answered-label").textContent = `${answeredCount} answered`;
  document.querySelector("#section-title").textContent = section.title;
  document.querySelector("#section-answered").textContent = `${sectionAnsweredCount} / ${sectionQuestions.length}`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", currentQuestion + 1);
  document.querySelector("#progress-fill").style.width = `${((currentQuestion + 1) / testData.questions.length) * 100}%`;
  document.querySelector("#section-count").textContent = `SECTION ${String(sectionIndex + 1).padStart(2, "0")} / ${String(testData.sections.length).padStart(2, "0")}`;
  document.querySelector("#section-description").textContent = section.description;
  document.querySelector("#question-section").textContent = section.title;
  document.querySelector("#question-number").textContent = String(question.id).padStart(2, "0");
  const secondsPerQuestion = TEST_DURATION_SECONDS / testData.questions.length;
  document.querySelector(".question-timing").textContent = `Avg. ${String(Math.floor(secondsPerQuestion / 60)).padStart(2, "0")}:${String(secondsPerQuestion % 60).padStart(2, "0")} / question`;
  document.querySelector("#question-text").textContent = question.text;
  document.querySelector("#question-position").textContent = `${String(question.id).padStart(2, "0")} / ${testData.questions.length}`;

  document.querySelectorAll(".section-tab").forEach((tab, index) => {
    tab.classList.toggle("active", index === sectionIndex);
    tab.setAttribute("aria-current", index === sectionIndex ? "step" : "false");
  });

  const pips = document.querySelector("#question-pips");
  pips.replaceChildren(...sectionQuestions.map((item, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-pip";
    button.textContent = String(index + 1);
    button.setAttribute("aria-label", `Go to question ${item.id}${answers[item.id] !== undefined ? ", answered" : ""}`);
    if (answers[item.id] !== undefined) button.classList.add("answered");
    if (item.id === question.id) {
      button.classList.add("current");
      button.setAttribute("aria-current", "step");
    }
    button.addEventListener("click", () => {
      currentQuestion = testData.questions.findIndex((entry) => entry.id === item.id);
      showQuestion();
    });
    return button;
  }));

  const options = document.querySelector("#answer-options");
  options.replaceChildren(Object.assign(document.createElement("legend"), { className: "answer-prompt", textContent: "Select one answer" }));
  question.options.forEach((option, index) => {
    const label = document.createElement("label");
    label.className = "answer-option";
    if (answers[question.id] === index) label.classList.add("selected");

    const input = document.createElement("input");
    input.type = "radio";
    input.name = `question-${question.id}`;
    input.value = String(index);
    input.checked = answers[question.id] === index;
    input.addEventListener("change", () => {
      answers[question.id] = index;
      testError.textContent = "";
      showQuestion();
    });

    const letter = document.createElement("span");
    letter.className = "option-letter";
    letter.textContent = String.fromCharCode(65 + index);
    const text = document.createElement("span");
    text.textContent = option;
    label.append(input, letter, text);
    options.append(label);
  });

  const previous = document.querySelector("#previous-question");
  previous.disabled = currentQuestion === 0;
  document.querySelector("#next-question").hidden = testExpired || currentQuestion === testData.questions.length - 1;
  document.querySelector("#submit-test").hidden = !testExpired && currentQuestion !== testData.questions.length - 1;
}

function renderSections() {
  const tabs = document.querySelector("#section-tabs");
  tabs.replaceChildren(...testData.sections.map((section, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "section-tab";
    button.innerHTML = `<span class="tab-number">${String(index + 1).padStart(2, "0")}</span>${section.title}`;
    button.addEventListener("click", () => {
      currentQuestion = testData.questions.findIndex((question) => question.sectionId === section.id);
      showQuestion();
    });
    return button;
  }));
}

function updateTimer() {
  const remaining = Math.max(0, Math.ceil((testEndsAt - Date.now()) / 1000));
  const minutes = Math.floor(remaining / 60);
  const seconds = remaining % 60;
  const timer = document.querySelector(".timer-display");
  document.querySelector("#time-remaining").textContent = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  timer.classList.toggle("is-low", remaining <= 5 * 60);
  timer.setAttribute("aria-label", `${minutes} minutes and ${seconds} seconds remaining`);

  if (remaining === 0 && !testExpired) {
    testExpired = true;
    window.clearInterval(timerInterval);
    showQuestion();
    testError.textContent = "Time is up. Submitting your answers.";
    submitTest();
  }
}

function startTimer() {
  window.clearInterval(timerInterval);
  testExpired = false;
  testEndsAt = Date.now() + TEST_DURATION_SECONDS * 1000;
  updateTimer();
  timerInterval = window.setInterval(updateTimer, 1000);
}

async function submitTest() {
  if (submissionInProgress) return;
  submissionInProgress = true;
  const button = document.querySelector("#submit-test");
  button.disabled = true;
  button.textContent = "Submitting…";
  testError.textContent = "";
  try {
    const response = await fetch("/api/submit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...candidateDetails, answers })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || "Your test could not be submitted.");
    showResults(result);
  } catch (error) {
    testError.textContent = testExpired
      ? "Time is up, but your answers could not be submitted. Please retry."
      : error.message || "Your test could not be submitted. Please try again.";
  } finally {
    submissionInProgress = false;
    button.disabled = false;
    button.innerHTML = testExpired
      ? '<span>Retry submission</span><span class="button-arrow" aria-hidden="true">→</span>'
      : '<span>Submit assessment</span><span class="button-arrow" aria-hidden="true">→</span>';
  }
}

function showResults(result) {
  document.querySelector("#result-name").textContent = result.name;
  document.querySelector("#submission-message").textContent = result.message;
  window.clearInterval(timerInterval);
  testView.hidden = true;
  resultView.hidden = false;
  window.scrollTo({ top: 0, behavior: "smooth" });
}

startForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  startError.textContent = "";
  const nameInput = document.querySelector("#candidate-name");
  const formFields = new FormData(startForm);
  candidateDetails = {
    name: String(formFields.get("name") || "").trim(),
    college: String(formFields.get("college") || "").trim(),
    department: String(formFields.get("department") || "").trim(),
    date: String(formFields.get("date") || "")
  };
  candidateName = candidateDetails.name;
  startError.textContent = "";
  for (const [field, value] of Object.entries(candidateDetails)) {
    const input = startForm.elements.namedItem(field);
    if (!value) {
      startError.textContent = `Please enter your ${field}.`;
      input.focus();
      return;
    }
  }
  if (!startForm.reportValidity()) {
    nameInput.focus();
    return;
  }
  try {
    testData = await fetchTestData();
    if (testData.questions.length !== 50 || testData.sections.length !== 5) {
      throw new Error("The assessment is not available right now. Please contact the recruitment team.");
    }
    renderSections();
    document.querySelector("#candidate-greeting").textContent = candidateName;
    intro.hidden = true;
    testView.hidden = false;
    startTimer();
    showQuestion();
    window.scrollTo({ top: 0, behavior: "smooth" });
  } catch (error) {
    startError.textContent = error.message || "The test could not be started. Please try again.";
  }
});

document.querySelector("#previous-question").addEventListener("click", () => {
  if (currentQuestion > 0) {
    currentQuestion -= 1;
    showQuestion();
  }
});

document.querySelector("#next-question").addEventListener("click", () => {
  if (currentQuestion < testData.questions.length - 1) {
    currentQuestion += 1;
    showQuestion();
  }
});

document.querySelector("#submit-test").addEventListener("click", () => {
  if (testExpired) {
    submitTest();
    return;
  }
  const unanswered = testData.questions.filter((question) => answers[question.id] === undefined);
  if (unanswered.length > 0) {
    testError.textContent = `You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}. Please review all questions before submitting.`;
    const firstUnanswered = unanswered[0];
    currentQuestion = testData.questions.findIndex((question) => question.id === firstUnanswered.id);
    showQuestion();
    testError.textContent = `You have ${unanswered.length} unanswered question${unanswered.length === 1 ? "" : "s"}. Please review all questions before submitting.`;
    return;
  }
  const confirmed = window.confirm("Submit your completed assessment? You will not be able to change your answers afterwards.");
  if (confirmed) submitTest();
});

document.querySelector("#exit-test").addEventListener("click", () => {
  if (window.confirm("Exit the assessment? Your current answers will be discarded.")) {
    window.clearInterval(timerInterval);
    candidateName = "";
    candidateDetails = {};
    answers = {};
    currentQuestion = 0;
    testExpired = false;
    submissionInProgress = false;
    document.querySelector(".timer-display").classList.remove("is-low");
    document.querySelector("#time-remaining").textContent = "60:00";
    testView.hidden = true;
    intro.hidden = false;
    document.querySelector("#candidate-name").value = "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
});
