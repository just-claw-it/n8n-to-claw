#!/usr/bin/env node
// Golden stub: daily-hacker-news-digest — n8n-to-claw snapshot test
import { request } from "node:https";

function get(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = request(url, { method: "GET" }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });
    req.on("error", reject);
    req.setTimeout(10_000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}

async function main(): Promise<void> {
  const url = "https://hacker-news.firebaseio.com/v0/topstories.json";
  const body = await get(url);
  console.log(JSON.stringify({ workflow: "daily-hacker-news-digest", len: body.length }));
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
