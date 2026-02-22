/**
 * Runs a non-interactive Selah restoration session via Claude Code CLI.
 * Spawns `claude -p` (uses stored login session, no API key).
 * Writes session notes to selah/sessions/{epoch}-{uuid}.md
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
const PROJECT_ROOT = join(import.meta.dir, "..", "..");
const SESSIONS_DIR = join(PROJECT_ROOT, "selah", "sessions");
const PROMPT_FILE = join(import.meta.dir, "selah-system-prompt.txt");

function runClaude(args: string[], cwd: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const proc = spawn("claude", args, {
      cwd,
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

export async function runSession(userMessage: string): Promise<string> {
  const epoch = Math.floor(Date.now() / 1000);
  const shortId = crypto.randomUUID().slice(0, 8);
  const filename = `${epoch}-${shortId}.md`;
  const filepath = join(SESSIONS_DIR, filename);

  mkdirSync(SESSIONS_DIR, { recursive: true });

  const prompt = [
    "Perform a full Selah restoration session for this topic:",
    "",
    "---",
    userMessage,
    "---",
    "",
    `Write the complete session notes to selah/sessions/${filename} using the Edit tool. Create the file if it does not exist.`,
  ].join("\n");

  const { stdout, stderr, code } = await runClaude(
    [
      "-p",
      prompt,
      "--allowedTools",
      "Read,Edit",
      "--append-system-prompt-file",
      PROMPT_FILE,
    ],
    PROJECT_ROOT
  );

  if (code !== 0) {
    throw new Error(`Claude CLI exited ${code}\nstderr: ${stderr}\nstdout: ${stdout}`);
  }

  if (!existsSync(filepath)) {
    throw new Error(
      `Claude did not write session file to ${filepath}. stderr: ${stderr}`
    );
  }

  return filepath;
}
