/**
 * Runs a non-interactive Selah restoration session via Claude Code CLI.
 * Spawns `claude -p` (uses stored login session, no API key).
 * Returns both the session filepath and Claude's conversational narrative.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
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

function extractTaggedNarrative(text: string): string | null {
  const m = text.match(/<SLACK_NARRATIVE>\s*([\s\S]*?)\s*<\/SLACK_NARRATIVE>/i);
  return m?.[1]?.trim() || null;
}

function normalizeNarrative(text: string): string {
  return text.trim();
}

function isLikelyOperationalReply(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return true;
  return [
    "session complete",
    "session completed",
    "full session notes attached",
    "structured session notes have been written",
    "ready to send to",
    "person file has been updated",
  ].some((needle) => t.includes(needle));
}

async function synthesizeNarrativeFromNotes(
  userMessage: string,
  sessionNotes: string
): Promise<string | null> {
  const prompt = [
    "Rewrite these restoration notes as a warm, direct conversational Slack response to the requester.",
    "Return ONLY the narrative text, with no preface, no labels, and no meta commentary about files/tools.",
    "",
    "Requester message:",
    userMessage,
    "",
    "Session notes:",
    sessionNotes,
  ].join("\n");

  const { stdout, code } = await runClaude(["-p", prompt], PROJECT_ROOT);
  if (code !== 0) return null;
  const narrative = normalizeNarrative(stdout);
  if (!narrative || isLikelyOperationalReply(narrative)) return null;
  return narrative;
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
    "First, output ONLY the full conversational narrative wrapped in these exact tags:",
    "<SLACK_NARRATIVE>",
    "(narrative for the requester goes here)",
    "</SLACK_NARRATIVE>",
    "The narrative should explain what you're sensing, what lit up, what the pathways mean, and walk through restoration in a warm, clear tone.",
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

  const taggedNarrative = extractTaggedNarrative(stdout);
  const cleanedStdout = normalizeNarrative(stdout);
  let narrative = taggedNarrative ?? cleanedStdout;

  if (isLikelyOperationalReply(narrative)) {
    const notes = readFileSync(filepath, "utf8");
    const synthesized = await synthesizeNarrativeFromNotes(userMessage, notes);
    if (synthesized) narrative = synthesized;
  }

  return { filepath, narrative };
}
