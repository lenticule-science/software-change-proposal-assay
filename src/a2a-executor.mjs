import { Message, Role } from "@a2a-js/sdk";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { ACTOR, assaySoftwareChangeProposalInHost } from "./assay.mjs";
import { semanticJsonBytes, semanticJsonFromBytes, semanticJsonId, semanticJsonRecord as record } from "./semantic-json.mjs";

const id = semanticJsonId;
export const operationBytes = semanticJsonBytes;
export const operationFromBytes = semanticJsonFromBytes;
function exact(value) { const body = value && typeof value === "object" ? Object.fromEntries(Object.entries(value).filter(([key]) => key !== "id")) : null; return body && value.id === id(body); }
export async function executeOperation(request, options = {}) {
  if (!exact(request) || request.provider !== ACTOR || request.type !== "SoftwareChangeProposalAssayOperation" || request.assayRequest?.type !== "SoftwareChangeProposalAssayRequest") throw new Error("exact provider-addressed canonical RMN assay operation is required");
  // The only path to supplier-code execution is an original HOST-composed
  // capability. Remote A2A data cannot supply executable callbacks or grant
  // an isolation claim. With no capability the request receives a typed refusal.
  const review = await (options.assaySoftwareChangeProposal ??
    (work => assaySoftwareChangeProposalInHost(work, {
      isolatedAssayExecutor: options.isolatedAssayExecutor,
    })))(request.assayRequest);
  return record({ type: "SoftwareChangeProposalAssayResult", provider: ACTOR, request: request.id, candidate: request.assayRequest.candidate?.id ?? null, review });
}
export async function executeA2aMessage(source, options = {}) { const message = Message.fromJSON(source); if (message.role !== Role.ROLE_USER) throw new Error("assay executor requires an A2A user Message"); const input = extractRmnPart(message.parts), response = await executeOperation(operationFromBytes(input.bytes), options); return Message.toJSON({ messageId: "", contextId: message.contextId ?? "", taskId: message.taskId ?? "", role: Role.ROLE_AGENT, parts: [rmnPart(operationBytes(response))], metadata: { inputNi: input.ni, outputNi: response.id, provider: ACTOR }, extensions: [], referenceTaskIds: [] }); }
