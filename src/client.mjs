import { randomUUID } from "node:crypto";
import { Message, Role } from "@a2a-js/sdk";
import { a2aResultParts, sendRmnTask } from "@red-cup-engineering/a2a-rmn-task-client-service";
import { extractRmnPart, rmnPart } from "@red-cup-engineering/a2a-rmn-part-service";
import { semanticId } from "@red-cup-engineering/relation-model-notation-runtime";
import { relationalWitnessJournalDocument } from "@red-cup-engineering/witness-journal-rdf-projection-service/client";
import { ACTOR } from "./assay.mjs";
import { operationBytes, operationFromBytes } from "./a2a-executor.mjs";
const id = (value) => semanticId(relationalWitnessJournalDocument(value)); const record = (body) => Object.freeze({ id: id(body), ...body });
export async function requestSoftwareChangeProposalAssay(assayRequest, { agentCardUrl = process.env.SOFTWARE_CHANGE_PROPOSAL_ASSAY_AGENT_CARD_URL, send = sendRmnTask, signal } = {}) {
  if (typeof agentCardUrl !== "string" || !agentCardUrl) throw new Error("SOFTWARE_CHANGE_PROPOSAL_ASSAY_AGENT_CARD_URL is required");
  const request = record({ type: "SoftwareChangeProposalAssayOperation", provider: ACTOR, assayRequest });
  const message = Message.toJSON({ messageId: randomUUID(), contextId: "", taskId: "", role: Role.ROLE_USER, parts: [rmnPart(operationBytes(request))], metadata: {}, extensions: [], referenceTaskIds: [] });
  const exchange = await send({ agentUrl: agentCardUrl, message, requireSignature: true, signal }), parts = a2aResultParts(exchange.result), response = operationFromBytes(extractRmnPart(parts).bytes);
  if (response?.type !== "SoftwareChangeProposalAssayResult" || response.provider !== ACTOR || response.request !== request.id || response.candidate !== assayRequest.candidate?.id) throw new Error("assay provider returned a foreign result");
  return Object.freeze({ review: response.review, provider: ACTOR, exchange: { inputNi: exchange.inputNi, outputNi: exchange.outputNi, agentCard: exchange.agentCard } });
}
