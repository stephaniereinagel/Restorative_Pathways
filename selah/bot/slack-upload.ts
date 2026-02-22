/**
 * Upload a file to a Slack channel/DM using the v2 API.
 * Requires files:write scope.
 */

import type { WebClient } from "@slack/web-api";
import { readFileSync } from "node:fs";

export async function uploadFileToSlack(
  client: WebClient,
  channelId: string,
  filepath: string,
  initialComment: string
): Promise<void> {
  const content = readFileSync(filepath, "utf8");
  const filename = filepath.split("/").pop() || "session.md";

  await client.filesUploadV2({
    content,
    filename,
    channel_id: channelId,
    initial_comment: initialComment,
  });
}
