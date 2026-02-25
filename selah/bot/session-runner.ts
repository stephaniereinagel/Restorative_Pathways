/**
 * Runs a non-interactive Selah restoration session via Claude Code CLI.
 * Spawns `claude -p` (uses stored login session, no API key).
 * Returns both the session filepath and Claude's conversational narrative.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const SESSIONS_DIR = join(PROJECT_ROOT, "selah", "sessions");
const PROMPT_FILE = join(import.meta.dir, "selah-system-prompt.txt");

export interface SessionResult {
  filepath: string;
  narrative: string;
}

function formatDate(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

function runClaude(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const env = { ...process.env, HOME: process.env.HOME || "/root" };
    const proc = spawn("claude", args, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    proc.stdout?.on("data", (d) => { stdout += d.toString(); });
    proc.stderr?.on("data", (d) => { stderr += d.toString(); });
    proc.on("close", (code) => resolve({ stdout, stderr, code }));
    proc.on("error", reject);
  });
}

export async function runSession(userMessage: string): Promise<SessionResult> {
  const date = formatDate();
  const slug = slugify(userMessage);
  const shortId = crypto.randomUUID().slice(0, 8);
  const filename = slug ? `${date}-${slug}.md` : `${date}-${shortId}.md`;
  const filepath = join(SESSIONS_DIR, filename);

  mkdirSync(SESSIONS_DIR, { recursive: true });
  // Ensure the target file exists so Claude can Edit it
  if (!existsSync(filepath)) {
    writeFileSync(filepath, "", "utf8");
  }

  const prompt = [
    "Perform a full Selah restoration session for this request:",
    "",
    "---",
    userMessage,
    "---",
    "",
    "First, share your full conversational narrative — explain what you're sensing, what lit up, what the pathways mean, and walk through the restoration. This narrative will be sent directly to the person on Slack, so be warm and thorough.",
    "",
    `Then write the structured session notes to selah/sessions/${filename} using the Edit tool. Create the file if it does not exist.`,
  ].join("\n");

  const { stdout, stderr, code } = await runClaude(
    [
      "-p",
      prompt,
      "--allowedTools",
      "Read,Edit,Write",
      "--append-system-prompt-file",
      PROMPT_FILE,
    ],
    PROJECT_ROOT
  );

  if (code !== 0) {
    throw new Error(`Claude CLI exited ${code}\nstderr: ${stderr}\nstdout: ${stdout}`);
  }

  if (!existsSync(filepath)) {
    // Fallback: persist whatever Claude returned so the bot can complete.
    writeFileSync(filepath, stdout || "", "utf8");
  }

  return { filepath, narrative: stdout };
}
