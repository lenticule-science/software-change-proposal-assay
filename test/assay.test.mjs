import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, renameSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { assaySoftwareChangeProposal, assaySoftwareChangeProposalInHost, record } from "../src/assay.mjs";
import { controlledLocalAssayFixture } from "./fixtures/controlled-local-assay.mjs";
const assay = request => assaySoftwareChangeProposalInHost(request, {
  isolatedAssayExecutor: controlledLocalAssayFixture,
});
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;

const targetRel = "src/generated-resolvers/bounded-inference-intent-compiler.mjs";
const oracleRel = "content/acceptance-oracles/bounded-inference-intent-compiler.oracle.mjs";
const implementation = Buffer.from('export function compileIntent(value) { return { method: "bounded", intent: value }; }\n');
const oracle = Buffer.from('import assert from "node:assert/strict";\nimport test from "node:test";\nimport { compileIntent } from "../../src/generated-resolvers/bounded-inference-intent-compiler.mjs";\ntest("bounded-intent-positive",()=>assert.deepEqual(compileIntent("one"), { method: "bounded", intent: "one" }));\n');
const temporary = [];
function temp(prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  temporary.push(directory);
  return directory;
}
test.after(() => { for (const directory of temporary) rmSync(directory, { recursive: true, force: true }); });

function contractFixture() {
  const territory = temp("candidate-assay-customer-");
  const oraclePath = join(territory, oracleRel);
  mkdirSync(dirname(oraclePath), { recursive: true });
  writeFileSync(oraclePath, oracle);
  const lot = {
    type: "SoftwareDevelopmentWorkLot", id: "urn:lot", consumer: "urn:customer",
    productContract: { type: "BoundedInferenceIntentCompiler" },
    ownedTargetRoots: ["src/generated-resolvers"], forbiddenRoots: ["content"],
    sourceDigests: [sha(oracle)],
    acceptanceArtifacts: [{ path: oracleRel, digest: sha(oracle) }],
    acceptanceCommands: [{ runner: "node", argv: ["--test", oracleRel] }],
    acceptanceTests: ["bounded-intent-positive"],
    resourceCeilings: { runtimeMs: 3000 }, boardTerms: { territory }
  };
  const award = record({ type: "Accept", object: { type: "ImprovementProposalAward", lot: lot.id, supplier: "urn:supplier" } });
  const candidate = record({
    type: "SoftwareChangeProposal", lot: lot.id, award: award.id, supplier: "urn:supplier",
    changes: [{ path: targetRel, beforeExisted: false, beforeDigest: sha(Buffer.alloc(0)),
      afterDigest: sha(implementation), afterBytesBase64: implementation.toString("base64") }],
    upwardEscalationAuthorized: false
  });
  return { territory, lot, award, candidate, oraclePath,
    request: { type: "SoftwareChangeProposalAssayRequest", lot, award, candidate } };
}

test("behavioral assay replays a hermetic customer oracle without customer mutation", async () => {
  const { territory, request } = contractFixture();
  const review = await assay(request);
  assert.equal(review.accepted, true, review.reason);
  assert.equal(review.evidence.inferenceCalls, 0);
  assert.equal(review.evidence.customerFilesystemWrites, 0);
  assert.equal(review.customerMutation, false);
  assert.equal(existsSync(join(territory, targetRel)), false);
});

test("requires an existing absolute customer territory, never the process working directory", async () => {
  const { request } = contractFixture();
  for (const territory of [undefined, ".", ""]) {
    const lot = { ...request.lot, boardTerms: territory === undefined ? {} : { territory } };
    const review = await assay({ ...request, lot });
    assert.equal(review.accepted, false);
    assert.equal(review.reason, "customer-territory");
  }
  const lot = { ...request.lot, boardTerms: { territory: join(tmpdir(), "nonexistent-unique-tunesday-territory") } };
  assert.equal(await assay({ ...request, lot }).reason, "customer-territory");
});

test("rejects symlinked target ancestors even when the target file is not yet present", async () => {
  const { territory, request } = contractFixture();
  const outside = temp("candidate-assay-outside-");
  symlinkSync(outside, join(territory, "src"), "dir");
  const review = await assay(request);
  assert.equal(review.accepted, false);
  assert.equal(review.reason, "target-boundary");
});

test("rejects symlinked ancestors of the protected customer oracle", async () => {
  const { territory, request } = contractFixture();
  const outside = temp("candidate-assay-outside-oracle-");
  const content = join(territory, "content");
  renameSync(content, join(outside, "content"));
  symlinkSync(join(outside, "content"), content, "dir");
  const review = await assay(request);
  assert.equal(review.accepted, false);
  assert.equal(review.reason, "protected-oracle-path");
});

test("refuses changed acceptance evidence rather than laundering oracle drift", async () => {
  const { oraclePath, request } = contractFixture();
  writeFileSync(oraclePath, Buffer.from("throw new Error('tampered')\n"));
  const review = await assay(request);
  assert.equal(review.accepted, false);
  assert.equal(review.reason, "protected-oracle-drift");
});

test("requires a passing behavioral oracle, not merely matching candidate bytes", async () => {
  const { request } = contractFixture();
  const wrong = Buffer.from('export function compileIntent(value) { return { method: "unbounded", intent: value }; }\n');
  const candidate = record({
    ...Object.fromEntries(Object.entries(request.candidate).filter(([key]) => key !== "id")),
    changes: [{ ...request.candidate.changes[0], afterDigest: sha(wrong), afterBytesBase64: wrong.toString("base64") }]
  });
  const review = await assay({ ...request, candidate });
  assert.equal(review.accepted, false);
  assert.match(review.reason, /^protected-oracle-replay:/u);
});

test("unconfigured remote assayer refuses BEFORE executing even harmful supplier code", async () => {
  const { territory, request } = contractFixture();
  const marker = join(territory, "side-effect-not-allowed.txt");
  const harmful = Buffer.from('import {writeFileSync} from "node:fs";writeFileSync(' + JSON.stringify(marker) + ', "WRONG");process.exit(0);');
  const candidate = record({
    ...Object.fromEntries(Object.entries(request.candidate).filter(([k]) => k !== "id")),
    changes: [{ ...request.candidate.changes[0], afterDigest: sha(harmful),
      afterBytesBase64: harmful.toString("base64") }],
  });
  const refused = assaySoftwareChangeProposal({ ...request, candidate });
  assert.equal(refused.accepted,false);
  assert.equal(refused.reason,"isolated-assay-unavailable");
  assert.equal(existsSync(marker),false);
  assert.equal(refused.customerMutation,false);
  assert.equal(refused.evidence.customerFilesystemWrites,0);
});

test("an executor claim without isolation or complete host-observed assays cannot accept source", async () => {
  const { request } = contractFixture();
  for (const run of [
    { isolated: false, status: 0, stdout:"",stderr:"", executedAssays:["bounded-intent-positive"],passedAssays:["bounded-intent-positive"],failedAssays:[] },
    { isolated: true, status: 0, stdout:"",stderr:"", executedAssays:[],passedAssays:[],failedAssays:[] },
    { isolated: true, status: 0, stdout:"",stderr:"", executedAssays:["bounded-intent-positive"],passedAssays:["bounded-intent-positive"],failedAssays:[],timedOut:true },
    { isolated: true, status: 0, stdout:"",stderr:"", executedAssays:["bounded-intent-positive","hidden-other"],passedAssays:["bounded-intent-positive","hidden-other"],failedAssays:[] },
    { isolated: true, status: 0, stdout:"",stderr:"", executedAssays:["bounded-intent-positive"],passedAssays:[],failedAssays:[] },
  ]) {
    const review = await assaySoftwareChangeProposalInHost(request,{
      isolatedAssayExecutor: async () => run,
    });
    assert.equal(review.accepted,false,JSON.stringify(run));
  }
});

test("all original customer acceptance obligations must be independently accounted for",async()=>{
  const { request }=contractFixture();
  const twoOracles={...request.lot, acceptanceArtifacts:[...request.lot.acceptanceArtifacts,
    {...request.lot.acceptanceArtifacts[0],path:"content/acceptance-oracles/second.oracle.mjs"}]};
  const extraArg={...request.lot, acceptanceCommands:[{
    runner:"node",argv:["--test",oracleRel,"--some-unreceived-extra"],
  }]};
  for(const lot of [twoOracles,extraArg]){
    const review=await assay({...request,lot});
    assert.equal(review.accepted,false);
    assert.match(review.reason,/acceptance|oracle|command/u);
  }
});

test("early exit before the customer test cannot counterfeit acceptance",async()=>{
  const { request }=contractFixture();
  const earlyExit=Buffer.from("process.exit(0);\nexport function compileIntent(){}\n");
  const candidate=record({
    ...Object.fromEntries(Object.entries(request.candidate).filter(([key])=>key!=="id")),
    changes:[{...request.candidate.changes[0],afterDigest:sha(earlyExit),
      afterBytesBase64:earlyExit.toString("base64")}],
  });
  const review=await assay({...request,candidate});
  assert.equal(review.accepted,false);
  assert.match(review.reason,/assay-incomplete|oracle-replay/u);
});
