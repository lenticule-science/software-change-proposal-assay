import {
  EMPTY_WITNESS_ROOT,
  admitJsonSemanticContent,
  identifyJsonSemanticContent,
} from "@red-cup-engineering/semantic-content-identify-service";

const OBJECT_KIND = "lenticule.software-change-proposal-assay.json";
const identify = (value) => identifyJsonSemanticContent({
  objectKind: OBJECT_KIND,
  value,
  witnessRoot: EMPTY_WITNESS_ROOT,
});

export const semanticJsonId = (value) => identify(value).token;
export const semanticJsonBytes = (value) => identify(value).bytes;
export const semanticJsonFromBytes = (bytes) => admitJsonSemanticContent({
  bytes,
  objectKind: OBJECT_KIND,
}).value;
export const semanticJsonRecord = (body) => Object.freeze({ id: semanticJsonId(body), ...body });
