# software-change-proposal-assay

<!-- 561-group-standards:badges:start -->
[![Lenticule Science](https://img.shields.io/badge/561%20Group-Lenticule%20Science-5b4b8a)](https://github.com/lenticule-science)
[![License: MIT](https://img.shields.io/badge/license-MIT-5b4b8a)](LICENSE)
[![Indigenous data: CARE](https://img.shields.io/badge/Indigenous%20data-CARE-4b6f44)](https://github.com/lenticule-science/.github/blob/main/GOVERNANCE.md)
[![Tips welcome](https://img.shields.io/badge/tips-welcome-d4a017)](https://github.com/561-group/.github/blob/main/TIPS.md)
<!-- 561-group-standards:badges:end -->


## Contracted source change review, not ambient candidate execution

This service is one narrowly supported original Code Engineering proof/assay
recipient for a `BoundedInferenceIntentCompiler` `SoftwareDevelopmentWorkLot`.
The authoritative customer requirement, original Work and legal permission must
exist **before** its provider-local check. The old source used an ordinary
`spawnSync` inside a temporary directory and described that as hermetic.
Neither a temp directory nor a stripped environment isolates untrusted JS.
The default `assaySoftwareChangeProposal(request)` and A2A native endpoint
now **refuse** with `isolated-assay-unavailable`; they never execute supplier
source or claim a customer-reviewed change.

The explicitly qualified asynchronous host integration is:

```js
const review = await assaySoftwareChangeProposalInHost(request, {
  // HOST-composed original Work/Office/tenant authority, not serialized input:
  authorizeWork: async ({customer, lot, award, candidate, territory}) =>
    originalWorkPermissionService.receiveExactWorkRead({
      customer, lot, award, candidate, territory,
    }),
  // HOST-composed Guix/LAGOON process isolation. Not a local Node runner:
  isolatedAssayExecutor: async admittedSourceAndTestLot =>
    qualifiedIsolatedExecutionService.run(admittedSourceAndTestLot),
});
```

Those two illustrative service identifiers are **interfaces the actual
host must bind**, not current installed packages or promises of capacity.
`authorizeWork` must return an authorized receipt with **exactly matching**
`customer`, `lot`, `award`, `candidate`, and `territory` and
`authorized:true`. A claimant-provided territory is not a grant to read that
filesystem. The assayer snapshots the full request via the existing semantic
JSON codec before awaiting Work authorization, then checks that receipt before
reading source or protected customer tests. The host must truly enforce
permission and prevent cross-tenant read; this module cannot attest to its
own authority.

A qualified `isolatedAssayExecutor` must impose: disposable writable scratch,
read-only explicit inputs, no network/host credentials/operator mounts,
finite CPU, RAM, PIDs, elapsed/output limits and descendant cleanup, and must
return a trustworthy bounded process outcome. Its `isolated:true` Boolean
is a *claim of the qualified host provider*, not proof of kernel isolation.
The original [Code Engineering host-isolation requirement](https://github.com/red-cup-engineering/computer-code-engineering-services-section/issues/74)
owns installation/negative controls; no second sandbox has been created here.
The `test/fixtures/controlled-local-assay.mjs` harness runs repository-owned
literal fixtures with ordinary Node and **must never serve arbitrary Work**.

The currently admitted original Work profile requires canonical source and
award identities, pinned before/after source digests, one exact protected
customer test program, a `node --test` command and nonempty unique
`acceptanceTests` names. Unknown/extra test programs and commands, modified
source, symlinked paths, changed original Work identity, resource overruns,
missing authority or missing isolation refuse. Successful receipt demands the
selected host's `executedAssays` and `passedAssays` match every declared
case exactly, `failedAssays=[]`, exit zero, and complete real Node TAP
runner totals (all expected tests, all passed, no skipped/todo/cancelled/failed).
Import-time `process.exit(0)` is not passing behavioral evidence.
`ImprovementCandidateReview.accepted:true` means **only the qualified
provider-local assay**, never installed code, accepted outside buyer Work,
mathematical proof, a formal security certificate or settled cash.

## Current receiving and commercial status

The original source tests retain exact path/oracle constraints and adversarial
security tests. [Review PR #1](https://github.com/red-cup-engineering/software-change-proposal-assay/pull/1)
does **not** establish real Guix/LAGOON host isolation or a native completed
A2A consumer. Its public Node 24 source CI recovered three unavailable
exact pinned A2A provider versions in the 561 Group registry and, separately,
a transitive published `workspace:*` dependency in
`@red-cup-engineering/semantic-content-identify-service@0.2.2`.
The original [npm publication and exact dependency owner](https://github.com/red-cup-engineering/npm-workspace-publication-service/issues/41)
must supply verified cleanly installable immutable closure, not a fake local
`node_modules` or a post-hoc downgraded dependency. Until then full original
package tests and native downstream serving remain unreceived.

Its commercial purpose is to support independently verifiable code QA and the
existing narrow [561 Group Work-continuity audit](https://561.group/work/#agent-operations),
subject to a legitimate payer, consent, original requirement and competent
service offer. A published price, draft PR, CI result or self-hosted
test receipt is not an accepted contract or revenue. Asana/Jira/GitHub
professional parity needs same-job, same-authority capability, capacity,
efficiency and actual applicable standards comparisons against current
versions, and buyer/receiver outcomes—not this one proof-gate slice.
