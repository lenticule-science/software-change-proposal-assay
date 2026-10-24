import { createHash } from "node:crypto";
import { existsSync, lstatSync, readFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve, sep } from "node:path";
import {
  semanticJsonBytes, semanticJsonFromBytes, semanticJsonId, semanticJsonRecord,
} from "./semantic-json.mjs";

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

/**
 * Source-owned acceptance plan. This step may read the customer's protected
 * oracle but performs NO supplier-code execution, temp file write or purchase.
 *
 * The original narrow Work contract is retained; unsupported product families
 * and unaccounted oracle commands are explicit refusals, not partial passes.
 */
function prepare(request) {
  if (request?.type !== "SoftwareChangeProposalAssayRequest") throw new Error("exact-assay-request-required");
  const { lot, award, candidate } = request;
  const change = candidate?.changes?.[0];
  if (lot?.type !== "SoftwareDevelopmentWorkLot" ||
      award?.type !== "Accept" || award.object?.type !== "ImprovementProposalAward" ||
      candidate?.type !== "SoftwareChangeProposal")
    throw new Error("proposal-lot-award-binding");
  if (typeof lot.id !== "string" || !lot.id || typeof award.object.supplier !== "string" ||
      !award.object.supplier || award.object.lot !== lot.id ||
      award.id !== semanticJsonId(Object.fromEntries(Object.entries(award).filter(([key]) => key !== "id"))))
    throw new Error("unverified-award-source");
  if (candidate.lot !== lot.id || candidate.award !== award.id ||
      candidate.supplier !== award.object.supplier ||
      candidate.id !== semanticJsonId(Object.fromEntries(Object.entries(candidate).filter(([key]) => key !== "id"))))
    throw new Error("proposal-identity-or-award-binding");
  if (lot.productContract?.type !== "BoundedInferenceIntentCompiler" ||
      !Array.isArray(candidate.changes) || candidate.changes.length !== 1 ||
      change?.path !== "src/generated-resolvers/bounded-inference-intent-compiler.mjs")
    throw new Error("unsupported-product-or-target");
  if (!Array.isArray(lot.ownedTargetRoots) || !Array.isArray(lot.forbiddenRoots) ||
      !allowed(change.path, lot.ownedTargetRoots, lot.forbiddenRoots) ||
      candidate.upwardEscalationAuthorized !== false)
    throw new Error("authority-or-upward-escalation");

  const territoryClaim = lot.boardTerms?.territory;
  if (typeof territoryClaim !== "string" || !isAbsolute(territoryClaim) ||
      !existsSync(territoryClaim) || lstatSync(territoryClaim).isSymbolicLink())
    throw new Error("customer-territory");
  const territory = resolve(territoryClaim);
  const target = resolve(territory, change.path);
  if (!inside(territory, target) || hasSymlinkSegment(territory, target))
    throw new Error("target-boundary");
  const exists = existsSync(target);
  const before = exists ? readFileSync(target) : Buffer.alloc(0);
  if (change.beforeExisted !== exists || change.beforeDigest !== sha(before))
    throw new Error("source-drift");
  if (typeof change.afterBytesBase64 !== "string" || change.afterBytesBase64.length > 2 * 1024 * 1024 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/u.test(change.afterBytesBase64))
    throw new Error("candidate-bytes-not-canonical");
  const after = Buffer.from(change.afterBytesBase64, "base64");
  if (after.toString("base64") !== change.afterBytesBase64 || change.afterDigest !== sha(after))
    throw new Error("candidate-drift");

  // A lot with two declared customer acceptance programs was previously
  // declared accepted after executing only acceptanceArtifacts[0].
  if (!Array.isArray(lot.acceptanceArtifacts) || lot.acceptanceArtifacts.length !== 1 ||
      !Array.isArray(lot.acceptanceCommands) || lot.acceptanceCommands.length !== 1)
    throw new Error("incomplete-acceptance-coverage");
  const artifact = lot.acceptanceArtifacts[0], command = lot.acceptanceCommands[0];
  if (!artifact || !command || command.runner !== "node" ||
      !Array.isArray(command.argv) || command.argv.length !== 2 ||
      command.argv[0] !== "--test" || artifact.path !== command.argv[1] ||
      typeof artifact.path !== "string" ||
      lot.ownedTargetRoots.some(root => artifact.path === root || artifact.path.startsWith(`${root}/`)))
    throw new Error("protected-oracle-command");
  if (!Array.isArray(lot.acceptanceTests) || lot.acceptanceTests.length === 0 ||
      lot.acceptanceTests.length > 64 ||
      lot.acceptanceTests.some(name => typeof name !== "string" ||
        !name.trim() || name.length > 256 || /[\r\n]/u.test(name)) ||
      new Set(lot.acceptanceTests).size !== lot.acceptanceTests.length)
    throw new Error("unqualified-acceptance-tests");
  const oraclePath = resolve(territory, artifact.path);
  if (!inside(territory, oraclePath) || !existsSync(oraclePath) ||
      hasSymlinkSegment(territory, oraclePath))
    throw new Error("protected-oracle-path");
  const oracle = readFileSync(oraclePath);
  if (!Array.isArray(lot.sourceDigests) || sha(oracle) !== artifact.digest ||
      !lot.sourceDigests.includes(artifact.digest))
    throw new Error("protected-oracle-drift");
  const timeoutMs = lot.resourceCeilings?.runtimeMs;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30_000)
    throw new Error("assay-resource-budget");
  if (after.length > 1024 * 1024 || oracle.length > 1024 * 1024 ||
      before.length > 1024 * 1024)
    throw new Error("assay-input-unbounded");
  return Object.freeze({
    oracle: artifact.digest, candidate: change.afterDigest,
    expectedAssays: Object.freeze([...lot.acceptanceTests]),
    execution: Object.freeze({
      kind: "software-change-proposal.isolated-assay/v1",
      version: 1,
      files: Object.freeze([
        Object.freeze({ path: change.path, bytes: Buffer.from(after) }),
        Object.freeze({ path: artifact.path, bytes: Buffer.from(oracle) }),
      ]),
      testPaths: Object.freeze([artifact.path]),
      expectedAssays: Object.freeze([...lot.acceptanceTests]),
      timeoutMs, maxOutputBytes: 2 * 1024 * 1024,
      network: false, writableHostWorkspace: false,
    }),
  });
}

/**
 * A successful test-file wrapper and a vendor/host summary array are not
 * sufficient evidence that customer-defined tests executed. Demand the
 * trusted Node TAP runner's complete accounting alongside the independent
 * host-owned exact case names. This only validates a selected runner's output
 * structure; it does not establish the runner's OS isolation or authenticity.
 */
export function completeCustomerAssayTap(stdout, numberOfCustomerTests) {
  if (typeof stdout !== "string" || !stdout.startsWith("TAP version 13\n") ||
      !Number.isInteger(numberOfCustomerTests) || numberOfCustomerTests < 1)
    return false;
  const counters = {};
  for (const key of ["tests", "pass", "fail", "cancelled", "skipped", "todo"]) {
    const hits = [...stdout.matchAll(new RegExp("^# " + key + " ([0-9]+)$", "gm"))];
    if (hits.length !== 1) return false;
    const amount = Number(hits[0][1]);
    if (!Number.isSafeInteger(amount)) return false;
    counters[key] = amount;
  }
  return counters.tests === numberOfCustomerTests &&
    counters.pass === numberOfCustomerTests &&
    counters.fail === 0 && counters.cancelled === 0 &&
    counters.skipped === 0 && counters.todo === 0;
}

function result(request, reason, evidence = {}) {
  return record({
    type: "ImprovementCandidateReview", actor: ACTOR,
    candidate: request?.candidate?.id ?? null,
    accepted: reason === null,
    reason: reason ?? "exact proposal passed a host-reported isolated customer-protected assay; customer acceptance is separate",
    evidence: {
      assay: "software-change-proposal-assay/v2",
      inferenceCalls: 0, customerFilesystemWrites: 0,
      independentCustomerAcceptance: false, ...evidence,
    },
    customerMutation: false,
  });
}

/**
 * Legacy synchronous entrypoint remains callable, but never executes untrusted
 * source or accepts a customer job merely because a temp Node process exited 0.
 * The actual host-composed asynchronous receiver is below.
 */
export function assaySoftwareChangeProposal(request) {
  return result(request, "isolated-assay-unavailable");
}

/**
 * Accept a host capability composed by the SERVICE operator, not from a
 * deserialized A2A/user request. The host must genuinely enforce ephemeral
 * process isolation, no network, no credentials/host mounts, read-only input,
 * resource limits and descendant termination. The returned isolation flag
 * alone is NOT a cryptographic or kernel proof of such enforcement.
 */
export async function assaySoftwareChangeProposalInHost(request, { isolatedAssayExecutor, authorizeWork } = {}) {
  if (typeof isolatedAssayExecutor !== "function")
    return result(request, "isolated-assay-unavailable");
  // A source-supplied boardTerms.territory is NOT an authorization to read the
  // customer's Work tree or protected acceptance oracle. A genuine original
  // host Work/tenant provider must authorize that exact customer, Work, award,
  // candidate and territory BEFORE prepare() performs any filesystem read.
  // Neither this module nor serialized A2A request can self-grant the right.
  if (typeof authorizeWork !== "function")
    return result(request, "work-authority-unavailable");
  try {
    // Use the existing native semiotic JSON codec to detach the caller's
    // mutable record before the first async host-authority check. A caller
    // must not swap customer, candidate, source digest or territory during
    // an await and trick an already-authorized read into crossing tenants.
    // It also preserves original canonical JSON admission; there is no
    // home-grown shadow content digest or second contract parser.
    const source = semanticJsonFromBytes(semanticJsonBytes(request));
    const scope = Object.freeze({
      customer: source?.lot?.consumer,
      lot: source?.lot?.id,
      award: source?.award?.id,
      candidate: source?.candidate?.id,
      territory: source?.lot?.boardTerms?.territory,
    });
    const authority = await authorizeWork(scope);
    if (!authority || authority.authorized !== true ||
        authority.customer !== scope.customer ||
        authority.lot !== scope.lot || authority.award !== scope.award ||
        authority.candidate !== scope.candidate ||
        authority.territory !== scope.territory)
      return result(source, "work-authority-unverified");
    const plan = prepare(source);
    const run = await isolatedAssayExecutor(plan.execution);
    if (!run || run.isolated !== true ||
        !Number.isInteger(run.status) || typeof run.stdout !== "string" ||
        typeof run.stderr !== "string" ||
        run.stdout.length > plan.execution.maxOutputBytes ||
        run.stderr.length > plan.execution.maxOutputBytes ||
        run.truncated === true || run.timedOut === true || run.signal)
      return result(source, "isolated-assay-unverified");
    if (run.status !== 0)
      return result(source, `protected-oracle-replay:${run.status}:${sha(Buffer.from(run.stderr))}`);

    // Host-owned test execution accounting MUST report all and only the
    // customer-protected cases. Exit 0 and a successful file wrapper are not
    // sufficient: candidate imports can call process.exit(0) before tests run.
    const sameNames = values => Array.isArray(values) &&
      values.length === plan.expectedAssays.length &&
      new Set(values).size === plan.expectedAssays.length &&
      values.every(name => plan.expectedAssays.includes(name));
    if (!sameNames(run.executedAssays) || !sameNames(run.passedAssays) ||
        !Array.isArray(run.failedAssays) || run.failedAssays.length !== 0 ||
        !completeCustomerAssayTap(run.stdout, plan.expectedAssays.length))
      return result(source, "assay-incomplete");
    return result(source, null, {
      oracle: plan.oracle, candidate: plan.candidate,
      replayStatus: run.status, hostReportedIsolation: true,
      completedCustomerAssays: [...plan.expectedAssays],
    });
  } catch (error) {
    return result(request, error instanceof Error ? error.message : String(error));
  }
}
