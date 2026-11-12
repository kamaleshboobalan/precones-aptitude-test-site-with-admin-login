const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const readline = require("node:readline");

const envPath = path.join(__dirname, "..", ".env");
const salt = crypto.randomBytes(16);

function promptSecret(label) {
  const input = process.stdin;
  if (!input.isTTY || typeof input.setRawMode !== "function") {
    return Promise.reject(new Error("Run npm.cmd run admin:setup in an interactive terminal."));
  }

  readline.emitKeypressEvents(input);
  input.setRawMode(true);
  input.resume();
  process.stdout.write(label);

  return new Promise((resolve, reject) => {
    let value = "";
    const cleanup = () => {
      input.removeListener("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
      process.stdout.write("\n");
    };
    const onKeypress = (character, key) => {
      if (key && key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Administrator setup cancelled."));
      } else if (key && key.name === "return") {
        cleanup();
        resolve(value);
      } else if (key && key.name === "backspace") {
        value = Array.from(value).slice(0, -1).join("");
      } else if (character && key && !key.ctrl && !key.meta) {
        value += character;
      }
    };
    input.on("keypress", onKeypress);
  });
}

function setEnvValue(lines, key, value) {
  const prefix = `${key}=`;
  const lineIndex = lines.findIndex((line) => line.startsWith(prefix));
  if (lineIndex === -1) lines.push(`${prefix}${value}`);
  else lines[lineIndex] = `${prefix}${value}`;
}

async function main() {
  if (!fs.existsSync(envPath)) {
    throw new Error("Missing .env file. Copy .env.example to .env before setting up the admin login.");
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  let username;
  try {
    username = (await new Promise((resolve) => rl.question("Admin username: ", resolve))).trim();
  } finally {
    rl.close();
  }
  if (!/^[a-zA-Z0-9._@-]{3,64}$/.test(username)) {
    throw new Error("Username must be 3–64 characters and use letters, numbers, ., _, @, or -.");
  }

  const password = await promptSecret("Admin password (minimum 12 characters): ");
  const confirmation = await promptSecret("Confirm password: ");
  if (password.length < 12) throw new Error("Choose an admin password with at least 12 characters.");
  if (password !== confirmation) throw new Error("Passwords do not match.");

  const passwordHash = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 }).toString("hex");
  const contents = fs.readFileSync(envPath, "utf8");
  const lines = contents.split(/\r?\n/);
  if (lines[lines.length - 1] === "") lines.pop();
  setEnvValue(lines, "ADMIN_USERNAME", username);
  setEnvValue(lines, "ADMIN_PASSWORD_HASH", `scrypt$${salt.toString("hex")}$${passwordHash}`);
  setEnvValue(lines, "HOST", "0.0.0.0");
  fs.writeFileSync(envPath, `${lines.join("\n")}\n`, { mode: 0o600 });
  process.stdout.write("Administrator login saved to .env. The password itself was not stored.\n");
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
