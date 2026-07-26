import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { assaySoftwareChangeProposal, record } from "../src/assay.mjs";
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
test("behavioral assay replays customer oracle against candidate bytes without customer mutation", () => {
  const territory = mkdtempSync(join(tmpdir(), "candidate-assay-customer-")), oracle = readFileSync("/home/emsenn/info/lib/emsenn/services/board-of-directors/services/executive-office/services/working-services-section/services/sovereign-improvement-board-service/content/acceptance-oracles/bounded-inference-intent-compiler.oracle.mjs"), after = readFileSync("/home/emsenn/info/lib/emsenn/services/561-group/services/red-cup-engineering/services/software-development-services-section/services/deterministic-intent-compiler-supplier/content/templates/bounded-inference-intent-compiler.mjs"), oracleRel = "content/acceptance-oracles/bounded-inference-intent-compiler.oracle.mjs";
  mkdirSync(dirname(join(territory, oracleRel)), { recursive: true }); writeFileSync(join(territory, oracleRel), oracle);
  const lot = { type: "SoftwareDevelopmentWorkLot", id: "urn:lot", consumer: "urn:customer", productContract: { type: "BoundedInferenceIntentCompiler" }, ownedTargetRoots: ["src/generated-resolvers"], forbiddenRoots: ["content"], sourceDigests: [sha(oracle)], acceptanceArtifacts: [{ path: oracleRel, digest: sha(oracle) }], acceptanceCommands: [{ runner: "node", argv: [oracleRel] }], resourceCeilings: { runtimeMs: 3000 }, boardTerms: { territory } };
  const award = record({ type: "Accept", object: { type: "ImprovementProposalAward", lot: lot.id, supplier: "urn:supplier" } });
  const candidate = record({ type: "SoftwareChangeProposal", lot: lot.id, award: award.id, supplier: "urn:supplier", changes: [{ path: "src/generated-resolvers/bounded-inference-intent-compiler.mjs", beforeExisted: false, beforeDigest: sha(Buffer.alloc(0)), afterDigest: sha(after), afterBytesBase64: after.toString("base64") }], upwardEscalationAuthorized: false });
  const review = assaySoftwareChangeProposal({ type: "SoftwareChangeProposalAssayRequest", lot, award, candidate });
  assert.equal(review.accepted, true, review.reason); assert.equal(review.evidence.inferenceCalls, 0); assert.equal(review.evidence.customerFilesystemWrites, 0);
});
