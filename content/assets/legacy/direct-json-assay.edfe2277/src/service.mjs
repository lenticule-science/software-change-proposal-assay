#!/usr/bin/env node
import { readFileSync } from "node:fs";
import { compileRmlLaw } from "@emsenn/rmn-semantic-conformance/law";
import { assaySoftwareChangeProposal } from "./assay.mjs";
export const CONTRACT = compileRmlLaw(readFileSync(new URL("../content/contracts/assay-software-change-proposal.rml", import.meta.url), "utf8")).id;
export function operate(input) { return assaySoftwareChangeProposal(input); }
if (process.argv[1] === new URL(import.meta.url).pathname) process.stdout.write(`${JSON.stringify(operate(JSON.parse(readFileSync(0, "utf8"))))}\n`);
