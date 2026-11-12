require("dotenv").config();

const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const os = require("node:os");
const { MongoClient, ObjectId } = require("mongodb");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const MAX_BODY_BYTES = 16 * 1024;
const ADMIN_SESSION_IDLE_MS = 30 * 60 * 1000;
const ADMIN_SESSION_MAX_MS = 8 * 60 * 60 * 1000;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;
const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB = process.env.MONGODB_DB || "precon_recruitment";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "";
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || "";
const ADMIN_COOKIE_SECURE = process.env.ADMIN_COOKIE_SECURE === "true";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";

const sections = [
  {
    id: "quantitative",
    title: "Quantitative Aptitude",
    description: "Test your basic mathematical and calculation skills.",
    questions: [
      ["What is 20% of 500?", ["50", "100", "150", "200"], 1],
      ["Find the next number: 3, 6, 12, 24, ___.", ["36", "42", "48", "52"], 2],
      ["What is 15 × 12?", ["160", "170", "180", "190"], 2],
      ["A worker completes a job in 10 days. What percentage of work is completed per day?", ["5%", "10%", "15%", "20%"], 1],
      ["What is the square root of 144?", ["10", "11", "12", "14"], 2],
      ["A product costs ₹1,000. After a 10% discount, what is the price?", ["₹800", "₹850", "₹900", "₹950"], 2],
      ["Convert 2.5 metres into millimetres.", ["250 mm", "2,500 mm", "25,000 mm", "250,000 mm"], 1],
      ["What is the average of 10, 20, 30, 40 and 50?", ["20", "25", "30", "35"], 2],
      ["If 5 workers complete a job in 10 days, how many days will 10 workers take (at the same rate)?", ["2 days", "5 days", "10 days", "20 days"], 1],
      ["What is 3/4 expressed as a percentage?", ["25%", "50%", "75%", "80%"], 2]
    ]
  },
  {
    id: "reasoning",
    title: "Logical Reasoning",
    description: "Test your logical thinking and problem-solving ability.",
    questions: [
      ["Find the odd one out.", ["Square", "Rectangle", "Triangle", "Apple"], 3],
      ["If CAT = DBU, then DOG = ?", ["EPH", "FPH", "EOG", "DPH"], 0],
      ["Find the next number: 5, 10, 15, 20, ___.", ["22", "25", "30", "35"], 1],
      ["Ravi is taller than Kumar. Kumar is taller than Arun. Who is the shortest?", ["Ravi", "Kumar", "Arun", "Cannot determine"], 2],
      ["If today is Monday, what day will it be after 10 days?", ["Wednesday", "Thursday", "Friday", "Saturday"], 1],
      ["Complete the series: 1, 4, 9, 16, ___.", ["20", "25", "30", "36"], 1],
      ["Which number is different?", ["16", "25", "36", "45"], 3],
      ["If A = 1, B = 2, C = 3, what is the value of CAB?", ["5", "6", "7", "8"], 1],
      ["Complete the series: 2, 5, 10, 17, 26, ___.", ["35", "36", "37", "38"], 2],
      ["A clock shows 3:00. What is the angle between the hour and minute hands?", ["45°", "90°", "120°", "180°"], 1]
    ]
  },
  {
    id: "english",
    title: "English & Communication",
    description: "Test your basic English grammar, vocabulary and communication skills.",
    questions: [
      ["Choose the correct spelling.", ["Engeneering", "Engineering", "Enginering", "Engeneeringg"], 1],
      ["Choose the correct sentence.", ["He go to office.", "He going to office.", "He goes to office.", "He gone to office."], 2],
      ["What is the opposite of “Increase”?", ["Improve", "Decrease", "Develop", "Expand"], 1],
      ["What is the synonym of “Quick”?", ["Slow", "Fast", "Weak", "Late"], 1],
      ["Fill in the blank: I ___ working in an engineering company.", ["Is", "Are", "Am", "Be"], 2],
      ["Choose the plural form of “Analysis”.", ["Analysises", "Analysis", "Analyses", "Analys"], 2],
      ["Choose the correct past tense of “Build”.", ["Builded", "Built", "Building", "Builds"], 1],
      ["Fill in the blank: She is good ___ mathematics.", ["In", "On", "At", "By"], 2],
      ["What does “Deadline” mean?", ["Starting time", "Final time limit", "Break time", "Meeting time"], 1],
      ["Choose the correct sentence.", ["I have completed the drawing.", "I has completed the drawing.", "I completing the drawing.", "I completes the drawing."], 0]
    ]
  },
  {
    id: "engineering",
    title: "General Engineering Knowledge",
    description: "Test your basic engineering concepts, measurements and technical awareness.",
    questions: [
      ["What is the SI unit of force?", ["Joule", "Newton", "Watt", "Pascal"], 1],
      ["What is the full form of CAD?", ["Computer Aided Design", "Computer Automatic Drawing", "Central Aided Design", "Computer Analysis Data"], 0],
      ["Which software is commonly used for structural steel detailing?", ["Photoshop", "Tekla Structures", "MS Paint", "PowerPoint"], 1],
      ["What is the SI unit of pressure?", ["Newton", "Pascal", "Joule", "Metre"], 1],
      ["How many millimetres are there in one metre?", ["10", "100", "1,000", "10,000"], 2],
      ["What is the standard angle of a straight line?", ["45°", "60°", "90°", "180°"], 3],
      ["Which instrument is used to measure external and internal dimensions accurately?", ["Hammer", "Vernier Caliper", "Screwdriver", "Spanner"], 1],
      ["What is the main purpose of a structural beam?", ["To support loads", "To decorate buildings", "To paint structures", "To reduce building height"], 0],
      ["What is the SI unit of stress?", ["Pascal", "Newton", "Watt", "Metre"], 0],
      ["Which material is commonly used for structural steel construction?", ["Wood", "Glass", "Steel", "Plastic"], 2]
    ]
  },
  {
    id: "strength",
    title: "Strength of Materials (Mechanical)",
    description: "Choose the correct answer for each basic Strength of Materials question.",
    questions: [
      ["What is stress?", ["Force per unit area", "Force × Area", "Length per unit area", "Mass × Volume"], 0],
      ["What is strain?", ["Change in length / Original length", "Load / Area", "Force / Length", "Area / Load"], 0],
      ["Which type of stress occurs when a material is pulled?", ["Compressive stress", "Tensile stress", "Shear stress", "Bending stress"], 1],
      ["Which type of stress occurs when a material is compressed?", ["Tensile stress", "Shear stress", "Compressive stress", "Torsional stress"], 2],
      ["Which beam is fixed at one end and free at the other end?", ["Simply Supported Beam", "Cantilever Beam", "Fixed Beam", "Continuous Beam"], 1],
      ["What is the SI unit of bending moment?", ["Newton", "Newton-metre", "Pascal", "Kilogram"], 1],
      ["Which property allows a material to return to its original shape after removing the load?", ["Hardness", "Elasticity", "Plasticity", "Brittleness"], 1],
      ["Which instrument is used to measure the diameter of a shaft accurately?", ["Steel Rule", "Micrometer", "Hammer", "Spanner"], 1],
      ["What is the neutral axis in a beam?", ["Axis of maximum stress", "Axis where bending stress is zero", "Axis of maximum load", "Axis of maximum deflection"], 1],
      ["What is the main purpose of a factor of safety?", ["Reduce material strength", "Ensure safety in design", "Increase material weight", "Increase deformation"], 1]
    ]
  }
];

const questions = sections.flatMap((section, sectionIndex) =>
  section.questions.map(([text, options, answer], questionIndex) => ({
    id: sectionIndex * 10 + questionIndex + 1,
    sectionId: section.id,
    sectionTitle: section.title,
    text,
    options,
    answer
  }))
);

let mongoClient;
let submissionsCollection;
let testSections = sections;
let testQuestions = questions;
const adminSessions = new Map();
const loginAttempts = new Map();

function getPasswordHashParts() {
  const match = /^scrypt\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(ADMIN_PASSWORD_HASH);
  if (!match) {
    throw new Error("Admin login is not configured. Run npm.cmd run admin:setup to set a username and password.");
  }
  if (!ADMIN_USERNAME || ADMIN_USERNAME.length > 64) {
    throw new Error("Admin login is not configured. Run npm.cmd run admin:setup to set a username and password.");
  }
  return { salt: Buffer.from(match[1], "hex"), hash: Buffer.from(match[2], "hex") };
}

function safeEqualStrings(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function verifyPassword(password, salt, expectedHash) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, expectedHash.length, { N: 16384, r: 8, p: 1 }, (error, derivedKey) => {
      if (error) return reject(error);
      return resolve(crypto.timingSafeEqual(derivedKey, expectedHash));
    });
  });
}

function getCookie(request, name) {
  const cookies = request.headers.cookie || "";
  const entry = cookies.split(";").map((cookie) => cookie.trim()).find((cookie) => cookie.startsWith(`${name}=`));
  return entry ? entry.slice(name.length + 1) : "";
}

function setSessionCookie(response, token) {
  const secure = ADMIN_COOKIE_SECURE ? "; Secure" : "";
  response.setHeader("Set-Cookie", `precon_admin=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${ADMIN_SESSION_MAX_MS / 1000}${secure}`);
}

function clearSessionCookie(response) {
  const secure = ADMIN_COOKIE_SECURE ? "; Secure" : "";
  response.setHeader("Set-Cookie", `precon_admin=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`);
}

function getAdminSession(request) {
  const token = getCookie(request, "precon_admin");
  if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const session = adminSessions.get(tokenHash);
  if (!session) return null;
  const now = Date.now();
  if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) {
    adminSessions.delete(tokenHash);
    return null;
  }
  session.idleExpiresAt = Math.min(now + ADMIN_SESSION_IDLE_MS, session.absoluteExpiresAt);
  return { tokenHash, session };
}

function hasSameOrigin(request) {
  const origin = request.headers.origin;
  if (!origin || !request.headers.host) return false;
  try {
    const url = new URL(origin);
    const forwardedProtocol = TRUST_PROXY && typeof request.headers["x-forwarded-proto"] === "string"
      ? request.headers["x-forwarded-proto"].split(",")[0].trim()
      : "";
    if (TRUST_PROXY && ADMIN_COOKIE_SECURE && forwardedProtocol !== "https") return false;
    const protocol = forwardedProtocol === "https" || forwardedProtocol === "http"
      ? `${forwardedProtocol}:`
      : request.socket.encrypted ? "https:" : "http:";
    return url.host === request.headers.host && url.protocol === protocol;
  } catch {
    return false;
  }
}

function getLoginAttempt(ip) {
  const now = Date.now();
  for (const [address, attempts] of loginAttempts) {
    if (now >= attempts.resetAt) loginAttempts.delete(address);
  }
  let attempts = loginAttempts.get(ip);
  if (!attempts || now >= attempts.resetAt) {
    attempts = { count: 0, resetAt: now + LOGIN_WINDOW_MS };
    loginAttempts.set(ip, attempts);
  }
  return attempts;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function shuffleQuestionsBySection() {
  return testSections.flatMap((section) => {
    const sectionQuestions = testQuestions.filter((question) => question.sectionId === section.id);
    for (let index = sectionQuestions.length - 1; index > 0; index -= 1) {
      const swapIndex = crypto.randomInt(index + 1);
      [sectionQuestions[index], sectionQuestions[swapIndex]] = [sectionQuestions[swapIndex], sectionQuestions[index]];
    }
    return sectionQuestions;
  });
}

async function connectToDatabase() {
  getPasswordHashParts();
  if (!MONGODB_URI) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env and add your MongoDB Atlas connection string.");
  }

  mongoClient = new MongoClient(MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
  await mongoClient.connect();
  const database = mongoClient.db(MONGODB_DB);
  const sectionsCollection = database.collection("test_sections");
  const questionsCollection = database.collection("test_questions");
  submissionsCollection = database.collection("test_submissions");

  if (await sectionsCollection.countDocuments() === 0) {
    await sectionsCollection.insertMany(sections.map((section, index) => ({
      id: section.id,
      title: section.title,
      description: section.description,
      startQuestion: index * 10 + 1,
      questionCount: section.questions.length
    })));
  }
  if (await questionsCollection.countDocuments() === 0) {
    await questionsCollection.insertMany(questions);
  }

  testSections = await sectionsCollection.find({}, { projection: { _id: 0 } }).sort({ startQuestion: 1 }).toArray();
  testQuestions = await questionsCollection.find({}, { projection: { _id: 0 } }).sort({ id: 1 }).toArray();

  const sectionIds = new Set(testSections.map((section) => section.id));
  if (testSections.length !== 5 || testQuestions.length !== 50 ||
      testSections.some((section) => !section.id || !section.title || !section.description) ||
      testQuestions.some((question) =>
        !Number.isInteger(question.id) ||
        !sectionIds.has(question.sectionId) ||
        typeof question.text !== "string" ||
        !Array.isArray(question.options) ||
        question.options.length !== 4 ||
        !Number.isInteger(question.answer) ||
        question.answer < 0 ||
        question.answer >= question.options.length
      )) {
    throw new Error("MongoDB question data must contain 5 valid sections and 50 valid questions.");
  }

  await submissionsCollection.createIndex({ submittedAt: -1 });
  await submissionsCollection.createIndex({ name: 1, college: 1, department: 1 });
}

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer"
  });
  response.end(JSON.stringify(data));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (Buffer.byteLength(body) > MAX_BODY_BYTES) {
        reject(new Error("Request body is too large."));
        request.destroy();
      }
    });
    request.on("end", () => resolve(body));
    request.on("error", reject);
  });
}

async function handleAdminLogin(request, response) {
  if (!hasSameOrigin(request)) return sendJson(response, 403, { error: "This sign-in request could not be verified." });
  const ip = request.socket.remoteAddress || "unknown";
  const attempts = getLoginAttempt(ip);
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    response.setHeader("Retry-After", String(Math.ceil((attempts.resetAt - Date.now()) / 1000)));
    return sendJson(response, 429, { error: "Too many sign-in attempts. Please try again in 15 minutes." });
  }
  attempts.count += 1;

  const body = await readRequestBody(request);
  let credentials;
  try {
    credentials = JSON.parse(body);
  } catch {
    return sendJson(response, 400, { error: "Please enter your username and password." });
  }
  if (!credentials || typeof credentials !== "object" || Array.isArray(credentials)) {
    return sendJson(response, 400, { error: "Please enter your username and password." });
  }
  const username = typeof credentials.username === "string" ? credentials.username : "";
  const password = typeof credentials.password === "string" ? credentials.password : "";
  if (username.length > 64 || password.length > 256) {
    return sendJson(response, 401, { error: "Incorrect username or password." });
  }

  const { salt, hash } = getPasswordHashParts();
  const passwordMatches = await verifyPassword(password, salt, hash);
  if (!safeEqualStrings(username, ADMIN_USERNAME) || !passwordMatches) {
    return sendJson(response, 401, { error: "Incorrect username or password." });
  }

  attempts.count = 0;
  const now = Date.now();
  for (const [token, session] of adminSessions) {
    if (now >= session.idleExpiresAt || now >= session.absoluteExpiresAt) adminSessions.delete(token);
  }
  if (adminSessions.size >= 1000) {
    return sendJson(response, 503, { error: "Administrator sessions are temporarily full. Please try again shortly." });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  adminSessions.set(tokenHash, {
    idleExpiresAt: now + ADMIN_SESSION_IDLE_MS,
    absoluteExpiresAt: now + ADMIN_SESSION_MAX_MS
  });
  setSessionCookie(response, token);
  return sendJson(response, 200, { authenticated: true });
}

function parseSubmissionFilter(search) {
  const query = search.trim().slice(0, 100);
  return query ? {
    $or: ["name", "college", "department"].map((field) => ({
      [field]: { $regex: escapeRegex(query), $options: "i" }
    }))
  } : {};
}

function csvCell(value) {
  const text = value === null || value === undefined ? "" : String(value);
  const safeText = /^[\s]*[=+\-@]/.test(text) ? `'${text}` : text;
  return `"${safeText.replace(/"/g, '""')}"`;
}

function waitForCsvDrain(response) {
  return new Promise((resolve) => {
    const onDrain = () => {
      cleanup();
      resolve(true);
    };
    const onClose = () => {
      cleanup();
      resolve(false);
    };
    const cleanup = () => {
      response.removeListener("drain", onDrain);
      response.removeListener("close", onClose);
    };
    response.once("drain", onDrain);
    response.once("close", onClose);
  });
}

async function exportSubmissionsCsv(request, response, search) {
  const filter = parseSubmissionFilter(search);
  const columns = ["Candidate name", "College", "Department", "Assessment date", "Submitted at", "Score", "Total", "Percentage",
    ...testSections.map((section) => section.title)];
  response.writeHead(200, {
    "Content-Type": "text/csv; charset=utf-8",
    "Content-Disposition": 'attachment; filename="precon-submissions.csv"',
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  });
  response.write(`${columns.map(csvCell).join(",")}\r\n`);
  const cursor = submissionsCollection.find(filter, {
    projection: { name: 1, college: 1, department: 1, date: 1, submittedAt: 1, score: 1, total: 1, percentage: 1, sectionScores: 1 }
  }).sort({ submittedAt: -1 });
  try {
    for await (const submission of cursor) {
      const sectionScoreById = new Map((submission.sectionScores || []).map((section) => [section.id, `${section.score}/${section.total}`]));
      const values = [
        submission.name,
        submission.college,
        submission.department,
        submission.date,
        submission.submittedAt instanceof Date ? submission.submittedAt.toISOString() : submission.submittedAt,
        submission.score,
        submission.total,
        submission.percentage,
        ...testSections.map((section) => sectionScoreById.get(section.id) || "")
      ];
      if (!response.write(`${values.map(csvCell).join(",")}\r\n`)) {
        const writable = await waitForCsvDrain(response);
        if (!writable) {
          await cursor.close();
          return;
        }
      }
    }
    response.end();
  } catch (error) {
    await cursor.close();
    throw error;
  }
}

async function handleAdminApi(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/admin/session") {
    return sendJson(response, 200, { authenticated: Boolean(getAdminSession(request)) });
  }
  if (request.method === "POST" && url.pathname === "/api/admin/login") {
    return handleAdminLogin(request, response);
  }
  if (request.method === "POST" && url.pathname === "/api/admin/logout") {
    if (!hasSameOrigin(request)) return sendJson(response, 403, { error: "This sign-out request could not be verified." });
    const session = getAdminSession(request);
    if (session) adminSessions.delete(session.tokenHash);
    clearSessionCookie(response);
    return sendJson(response, 200, { authenticated: false });
  }
  if (!url.pathname.startsWith("/api/admin/submissions")) return false;

  const session = getAdminSession(request);
  if (!session) return sendJson(response, 401, { error: "Please sign in again to continue." });
  if (request.method === "GET" && url.pathname === "/api/admin/submissions.csv") {
    return exportSubmissionsCsv(request, response, url.searchParams.get("search") || "");
  }
  if (request.method === "GET" && url.pathname === "/api/admin/submissions") {
    const pageValue = Number.parseInt(url.searchParams.get("page") || "1", 10);
    const limitValue = Number.parseInt(url.searchParams.get("limit") || "10", 10);
    const requestedPage = Number.isInteger(pageValue) ? Math.max(1, pageValue) : 1;
    const limit = Number.isInteger(limitValue) ? Math.max(1, Math.min(limitValue, 50)) : 10;
    const filter = parseSubmissionFilter(url.searchParams.get("search") || "");
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const [total, lastSevenDays, averageResult] = await Promise.all([
      submissionsCollection.countDocuments(filter),
      submissionsCollection.countDocuments({ ...filter, submittedAt: { $gte: since } }),
      submissionsCollection.aggregate([
        { $match: filter },
        { $group: { _id: null, percentage: { $avg: "$percentage" } } }
      ]).next()
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * limit;
    const submissions = await submissionsCollection.find(filter, {
      projection: { name: 1, college: 1, department: 1, date: 1, score: 1, total: 1, percentage: 1, submittedAt: 1 }
      }).sort({ submittedAt: -1 }).skip(offset).limit(limit).toArray();
    return sendJson(response, 200, {
      submissions: submissions.map((submission) => ({
        id: submission._id.toString(),
        name: submission.name,
        college: submission.college || "",
        department: submission.department || "",
        date: submission.date || "",
        score: submission.score,
        total: submission.total,
        percentage: submission.percentage,
        submittedAt: submission.submittedAt
      })),
      stats: {
        total,
        lastSevenDays,
        averagePercentage: averageResult ? Math.round(averageResult.percentage) : 0
      },
      page,
      limit,
      total,
      totalPages,
      start: total ? offset + 1 : 0,
      end: Math.min(offset + submissions.length, total)
    });
  }

  const submissionMatch = /^\/api\/admin\/submissions\/([a-f0-9]{24})$/i.exec(url.pathname);
  if (request.method === "GET" && submissionMatch) {
    const submission = await submissionsCollection.findOne(
      { _id: new ObjectId(submissionMatch[1]) }
    );
    if (!submission) return sendJson(response, 404, { error: "This submission could not be found." });

    const selectedAnswers = submission.answers || {};
    const answers = testQuestions.map((question) => {
      const selectedOption = Object.prototype.hasOwnProperty.call(selectedAnswers, String(question.id))
        ? selectedAnswers[String(question.id)]
        : null;
      return {
        id: question.id,
        sectionTitle: question.sectionTitle,
        text: question.text,
        options: question.options,
        selectedOption,
        correctOption: question.answer
      };
    });
    return sendJson(response, 200, {
      name: submission.name,
      college: submission.college || "",
      department: submission.department || "",
      date: submission.date || "",
      score: submission.score,
      total: submission.total,
      percentage: submission.percentage,
      submittedAt: submission.submittedAt,
      sectionScores: submission.sectionScores,
      answers
    });
  }
  return sendJson(response, 404, { error: "Admin endpoint not found." });
}

async function handleSubmit(request, response) {
  try {
    const body = await readRequestBody(request);
    let submission;
    try {
      submission = JSON.parse(body);
    } catch {
      return sendJson(response, 400, { error: "Please submit valid test data." });
    }

    const name = typeof submission.name === "string" ? submission.name.trim() : "";
    if (!name || name.length > 100) {
      return sendJson(response, 400, { error: "Enter a name of 1 to 100 characters." });
    }
    const college = typeof submission.college === "string" ? submission.college.trim() : "";
    if (!college || college.length > 150) {
      return sendJson(response, 400, { error: "Enter a college name of 1 to 150 characters." });
    }
    const department = typeof submission.department === "string" ? submission.department.trim() : "";
    if (!department || department.length > 100) {
      return sendJson(response, 400, { error: "Enter a department of 1 to 100 characters." });
    }
    const date = typeof submission.date === "string" ? submission.date : "";
    const parsedDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
    if (!parsedDate || Number.isNaN(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      return sendJson(response, 400, { error: "Enter a valid assessment date." });
    }
    if (!submission.answers || typeof submission.answers !== "object" || Array.isArray(submission.answers)) {
      return sendJson(response, 400, { error: "Please submit your answers." });
    }

    const questionById = new Map(testQuestions.map((question) => [String(question.id), question]));
    for (const [questionId, answer] of Object.entries(submission.answers)) {
      const question = questionById.get(questionId);
      if (!question || !Number.isInteger(answer) || answer < 0 || answer >= question.options.length) {
        return sendJson(response, 400, { error: "One or more submitted answers are invalid." });
      }
    }

    let score = 0;
    const sectionScores = testSections.map((section) => {
      const sectionQuestions = testQuestions.filter((question) => question.sectionId === section.id);
      const correct = sectionQuestions.reduce((total, question) =>
        total + (submission.answers[String(question.id)] === question.answer ? 1 : 0), 0);
      score += correct;
      return { id: section.id, title: section.title, score: correct, total: sectionQuestions.length };
    });

    const result = {
      name,
      score,
      total: testQuestions.length,
      percentage: Math.round((score / testQuestions.length) * 100),
      sectionScores
    };
    await submissionsCollection.insertOne({
      ...result,
      college,
      department,
      date,
      answers: submission.answers,
      submittedAt: new Date()
    });

    return sendJson(response, 200, {
      name,
      message: "Thank you for taking the time to complete the PRECON recruitment assessment. Our recruitment team will review your submission and contact you about the next steps."
    });
  } catch (error) {
    if (!response.destroyed && !response.headersSent) {
      console.error("Unable to process test submission:", error);
      sendJson(response, 500, { error: "We could not process your submission. Please try again." });
    }
  }
}

function serveStatic(request, response) {
  const pathname = new URL(request.url, `http://${request.headers.host || "localhost"}`).pathname;
  const files = {
    "/": [path.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8"],
    "/index.html": [path.join(PUBLIC_DIR, "index.html"), "text/html; charset=utf-8"],
    "/styles.css": [path.join(PUBLIC_DIR, "styles.css"), "text/css; charset=utf-8"],
    "/app.js": [path.join(PUBLIC_DIR, "app.js"), "text/javascript; charset=utf-8"],
    "/admin": [path.join(PUBLIC_DIR, "admin.html"), "text/html; charset=utf-8"],
    "/admin/": [path.join(PUBLIC_DIR, "admin.html"), "text/html; charset=utf-8"],
    "/admin/index.html": [path.join(PUBLIC_DIR, "admin.html"), "text/html; charset=utf-8"],
    "/admin.css": [path.join(PUBLIC_DIR, "admin.css"), "text/css; charset=utf-8"],
    "/admin.js": [path.join(PUBLIC_DIR, "admin.js"), "text/javascript; charset=utf-8"],
    "/logo.png": [path.join(__dirname, "LOGO", "Logo.png"), "image/png"]
  };
  const file = files[pathname];
  if (!file) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return response.end("Not found");
  }

  fs.readFile(file[0], (error, content) => {
    if (error) {
      console.error(`Unable to read ${file[0]}:`, error);
      response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      return response.end("Unable to load the page.");
    }
    response.writeHead(200, {
      "Content-Type": file[1],
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "no-referrer",
      "X-Frame-Options": "DENY",
      "Content-Security-Policy": "default-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self'; script-src 'self'; connect-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
    });
    response.end(content);
  });
}

const server = http.createServer((request, response) => {
  const handleRequest = async () => {
    const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/admin/")) {
      const handled = await handleAdminApi(request, response, url);
      if (handled !== false) return;
    }

    if (request.method === "GET" && url.pathname === "/api/questions") {
      try {
        return sendJson(response, 200, {
          sections: testSections,
          questions: shuffleQuestionsBySection().map(({ id, sectionId, sectionTitle, text, options }) => ({
            id, sectionId, sectionTitle, text, options
          }))
        });
      } catch (error) {
        console.error("Unable to load test questions:", error);
        return sendJson(response, 500, { error: "The test questions could not be loaded." });
      }
    }
    if (request.method === "POST" && url.pathname === "/api/submit") {
      return handleSubmit(request, response).catch((error) => {
        console.error("Unable to process test submission:", error);
        if (!response.headersSent && !response.destroyed) {
          sendJson(response, 500, { error: "We could not process your submission. Please try again." });
        }
      });
    }
    if (request.method === "GET") {
      return serveStatic(request, response);
    }
    response.writeHead(405, { Allow: "GET, POST", "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
  };

  handleRequest().catch((error) => {
    console.error("Unable to process request:", error);
    if (!response.headersSent && !response.destroyed) {
      sendJson(response, 500, { error: "The request could not be completed." });
    } else if (!response.destroyed) {
      response.destroy(error);
    }
  });
});

connectToDatabase().then(() => {
  server.listen(PORT, HOST, () => {
    const localHost = HOST === "0.0.0.0" || HOST === "::" ? "localhost" : HOST;
    console.log(`PRECON Recruitment Aptitude Test is running at http://${localHost}:${PORT}`);
    if (HOST === "0.0.0.0" || HOST === "::") {
      for (const addresses of Object.values(os.networkInterfaces())) {
        for (const address of addresses || []) {
          if (address.family === "IPv4" && !address.internal) {
            console.log(`Network access: http://${address.address}:${PORT}`);
          }
        }
      }
    }
    console.log(`MongoDB connected: ${MONGODB_DB}`);
  });
}).catch(async (error) => {
  console.error(`MongoDB startup failed: ${error.message}`);
  if (mongoClient) await mongoClient.close();
  process.exitCode = 1;
});

server.on("close", () => {
  if (mongoClient) mongoClient.close().catch((error) => {
    console.error("Unable to close MongoDB connection:", error);
  });
});
