#!/usr/bin/env node
// Golden stub: github-webhook-to-slack — n8n-to-claw snapshot test
import { readFileSync } from "node:fs";

const payload = readFileSync(0, "utf-8");
console.log(JSON.stringify({ workflow: "github-webhook-to-slack", bytes: payload.length }));
