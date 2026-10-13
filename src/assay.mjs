import { createHash } from "node:crypto";
import { existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { spawnSync } from "node:child_process";
import { semanticJsonId, semanticJsonRecord } from "./semantic-json.mjs";

export const ACTOR = "urn:ame:software-change-proposal-assay";
export const record = semanticJsonRecord;
const sha = (bytes) => `sha256:${createHash("sha256").update(bytes).digest("hex")}`;
const inside = (root, path) => { const rel = relative(root, path); return rel === "" || (rel !== ".." && !rel.startsWith(`..${sep}`) && !isAbsolute(rel)); };
const allowed = (path, roots, forbidden) => roots.some((root) => path === root || path.startsWith(`${root}/`)) && !forbidden.some((root) => path === root || path.startsWith(`${root}/`));
// lstat each existing path segment: lexical containment alone does not prevent
// a customer pathname from traversing a symlink into another territory.
function hasSymlinkSegment(root, path) {
  let cursor = root;
  if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) return true;
  for (const segment of relative(root, path).split(sep).filter(Boolean)) {
    cursor = join(cursor, segment);
    if (lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) return true;
  }
  return false;
}

function replay(request) {
  const { lot, award, candidate } = request; const change = candidate?.changes?.[0];
  if (lot?.type !== "SoftwareDevelopmentWorkLot" || award?.type !== "Accept" || award.object?.type !== "ImprovementProposalAward" || candidate?.type !== "SoftwareChangeProposal") throw new Error("proposal-lot-award-binding");
  if (candidate.lot !== lot.id || candidate.award !== award.id || candidate.supplier !== award.object.supplier || candidate.id !== semanticJsonId(Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "id")))) throw new Error("proposal-identity-or-award-binding");
  if (lot.productContract?.type !== "BoundedInferenceIntentCompiler" || candidate.changes?.length !== 1 || change.path !== "src/generated-resolvers/bounded-inference-intent-compiler.mjs") throw new Error("unsupported-product-or-target");
  if (!allowed(change.path, lot.ownedTargetRoots ?? [], lot.forbiddenRoots ?? []) || candidate.upwardEscalationAuthorized !== false) throw new Error("authority-or-upward-escalation");
  const territoryClaim = lot.boardTerms?.territory;
  if (typeof territoryClaim !== "string" || !isAbsolute(territoryClaim) || !existsSync(territoryClaim) || lstatSync(territoryClaim).isSymbolicLink()) throw new Error("customer-territory");
  const territory = resolve(territoryClaim);
  const target = resolve(territory, change.path); if (!inside(territory, target) || hasSymlinkSegment(territory, target)) throw new Error("target-boundary");
  const before = existsSync(target) ? readFileSync(target) : Buffer.alloc(0);
  if (change.beforeExisted !== existsSync(target) || change.beforeDigest !== sha(before)) throw new Error("source-drift");
  const after = Buffer.from(change.afterBytesBase64 ?? "", "base64"); if (change.afterDigest !== sha(after)) throw new Error("candidate-drift");
  const artifact = lot.acceptanceArtifacts?.[0]; const command = lot.acceptanceCommands?.[0];
  if (!artifact || artifact.path !== command?.argv?.[0] || command.runner !== "node" || lot.ownedTargetRoots.some((root) => artifact.path === root || artifact.path.startsWith(`${root}/`))) throw new Error("protected-oracle-boundary");
  const oraclePath = resolve(territory, artifact.path); if (!inside(territory, oraclePath) || !existsSync(oraclePath) || hasSymlinkSegment(territory, oraclePath)) throw new Error("protected-oracle-path");
  const oracle = readFileSync(oraclePath); if (sha(oracle) !== artifact.digest || !lot.sourceDigests.includes(artifact.digest)) throw new Error("protected-oracle-drift");
  const sandbox = mkdtempSync(join(tmpdir(), "software-change-proposal-assay-"));
  try {
    const sandboxTarget = resolve(sandbox, change.path), sandboxOracle = resolve(sandbox, artifact.path);
    mkdirSync(dirname(sandboxTarget), { recursive: true }); mkdirSync(dirname(sandboxOracle), { recursive: true });
    writeFileSync(sandboxTarget, after); writeFileSync(sandboxOracle, oracle);
    const run = spawnSync(process.execPath, [artifact.path], { cwd: sandbox, encoding: "utf8", timeout: lot.resourceCeilings?.runtimeMs ?? 3000, maxBuffer: 2 * 1024 * 1024, env: { PATH: process.env.PATH, NO_COLOR: "1" } });
    if (run.status !== 0) throw new Error(`protected-oracle-replay:${run.status}:${sha(Buffer.from(run.stderr ?? ""))}`);
    return { oracle: artifact.digest, candidate: change.afterDigest, replayStatus: run.status };
  } finally { rmSync(sandbox, { recursive: true, force: true }); }
}

export function assaySoftwareChangeProposal(request) {
  let issue = null, evidence = null;
  try { if (request?.type !== "SoftwareChangeProposalAssayRequest") throw new Error("exact-assay-request-required"); evidence = replay(request); }
  catch (error) { issue = error instanceof Error ? error.message : String(error); }
  return record({ type: "ImprovementCandidateReview", actor: ACTOR, candidate: request?.candidate?.id ?? null, accepted: issue === null, reason: issue ?? "exact candidate passed provider-local replay of the customer-protected oracle", evidence: { assay: "software-change-proposal-assay/v1", inferenceCalls: 0, customerFilesystemWrites: 0, ...evidence }, customerMutation: false });
}
