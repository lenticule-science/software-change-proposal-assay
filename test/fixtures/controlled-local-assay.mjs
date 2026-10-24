// CONTROLLED TEST FIXTURE ONLY: NOT a production sandbox. This runs only
// literals authored in this test repo, in an ordinary child process, and
// simulates a trusted host result. Never install this module in src/ or
// compose it with arbitrary model/customer candidate code.
import { spawnSync } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export async function controlledLocalAssayFixture(request) {
  if (request?.kind !== "software-change-proposal.isolated-assay/v1" ||
      request.network !== false || request.writableHostWorkspace !== false ||
      !Array.isArray(request.files) || request.files.length !== 2 ||
      !Array.isArray(request.testPaths) || request.testPaths.length !== 1)
    throw new TypeError("controlled fixture received a malformed native work order");
  const workspace = mkdtempSync(join(tmpdir(), "controlled-software-proposal-"));
  try {
    for (const { path, bytes } of request.files) {
      if (typeof path !== "string" || !/^(src|content)\/[a-z0-9/.-]+$/u.test(path) ||
          path.includes("..") || !Buffer.isBuffer(bytes))
        throw new TypeError("controlled fixture requires simple source paths and Node buffers");
      const target = join(workspace, path);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, bytes, { flag: "wx" });
    }
    const observed = spawnSync(process.execPath,
      ["--test", "--test-reporter=tap", ...request.testPaths],
      { cwd: workspace, encoding: "utf8", timeout: request.timeoutMs,
        maxBuffer: request.maxOutputBytes, env: { TZ: "UTC" } });
    // Simulated host observations: a separate production provider MUST enforce
    // isolation, network controls, read-only inputs, budgets and child cleanup.
    const lines = (observed.stdout ?? "").split("\n");
    const results = lines.map(line => /^\s*(ok|not ok) \d+ - (.*)$/u.exec(line))
      .filter(Boolean);
    const executedAssays = results.map(m => m[2]);
    const passedAssays = results.filter(m => m[1] === "ok").map(m => m[2]);
    return {
      isolated: true, status: observed.status,
      stdout: observed.stdout ?? "", stderr: observed.stderr ?? "",
      timedOut: observed.error?.code === "ETIMEDOUT",
      truncated: observed.error?.code === "ENOBUFS",
      signal: observed.signal ?? null,
      executedAssays, passedAssays, failedAssays: results.filter(m => m[1] !== "ok").map(m => m[2]),
    };
  } finally {
    rmSync(workspace, { recursive: true, force: true });
  }
}
