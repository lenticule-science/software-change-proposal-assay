#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { operate } from "../src/service.mjs";
process.stdout.write(`${JSON.stringify(operate(JSON.parse(readFileSync(0, "utf8"))))}\n`);
