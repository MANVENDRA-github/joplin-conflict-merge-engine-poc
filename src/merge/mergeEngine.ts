import { diffLines } from "diff";
import { diff3MergeRegions, diffIndices } from "node-diff3";
import type { IDiffIndicesResult, IRegion } from "node-diff3";
import { deriveReason, groupSections } from "./sectionGrouper.js";
import type {
  ConflictSection,
  MergeNotesParams,
  MergePreviewPart,
  MergeResult,
  MergeSectionType,
  SectionDraft,
} from "./types.js";

const splitLines = (text: string): string[] => {
  if (text.length === 0) return [];
  return text.split(/\r?\n/);
};

const joinLines = (lines: string[]): string => lines.join("\n");

const lineCountFromDiffValue = (value: string): number => {
  if (value.length === 0) return 0;
  return value.split(/\r?\n/).length;
};

type StableRegion = Extract<IRegion<string>, { stable: true }>;
type DiffChunk = IDiffIndicesResult<string>;

const classifyThreeWay = (
  local: string,
  base: string,
  remote: string,
): MergeSectionType => {
  if (local === remote) return "safe";
  if (local === base) return "safe";
  if (remote === base) return "safe";
  return "conflict";
};

const findChunk = (
  region: StableRegion,
  chunks: DiffChunk[],
): DiffChunk | undefined =>
  chunks.find(
    (c) =>
      c.buffer2[0] === region.bufferStart &&
      c.buffer2[1] === region.bufferLength,
  );

const draftFromSharedLines = (
  lines: string[],
  startLine: number,
  endLine: number,
  basis: SectionDraft["lineRangeBasis"],
): SectionDraft => {
  const t = joinLines(lines);
  return {
    startLine,
    endLine,
    lineRangeBasis: basis,
    base: t,
    local: t,
    remote: t,
    type: "safe",
  };
};

const draftFromSideChunk = (
  chunk: DiffChunk,
  linesLocal: string[],
  linesRemote: string[],
  editedSide: "local" | "remote",
): SectionDraft => {
  const bas = joinLines(chunk.buffer1Content);
  const o0 = chunk.buffer1[0];
  const oLen = chunk.buffer1[1];
  const startLine = o0 + 1;
  const endLine = o0 + oLen;
  if (editedSide === "local") {
    return {
      startLine,
      endLine,
      lineRangeBasis: "base",
      base: bas,
      local: joinLines(chunk.buffer2Content),
      remote: joinLines(linesRemote.slice(o0, o0 + oLen)),
      type: "safe",
    };
  }
  return {
    startLine,
    endLine,
    lineRangeBasis: "base",
    base: bas,
    local: joinLines(linesLocal.slice(o0, o0 + oLen)),
    remote: joinLines(chunk.buffer2Content),
    type: "safe",
  };
};

const stableRegionToDraft = (
  region: StableRegion,
  linesLocal: string[],
  linesRemote: string[],
  oa: DiffChunk[],
  ob: DiffChunk[],
): SectionDraft => {
  if (region.buffer === "o") {
    const s0 = region.bufferStart;
    const e0 = region.bufferStart + region.bufferLength;
    return draftFromSharedLines(
      region.bufferContent,
      s0 + 1,
      e0,
      "base",
    );
  }
  if (region.buffer === "a") {
    const chunk = findChunk(region, oa);
    if (chunk) {
      return draftFromSideChunk(chunk, linesLocal, linesRemote, "local");
    }
    const s = region.bufferStart + 1;
    const e = region.bufferStart + region.bufferLength;
    const t = joinLines(region.bufferContent);
    return {
      startLine: s,
      endLine: e,
      lineRangeBasis: "local",
      base: t,
      local: t,
      remote: t,
      type: "safe",
    };
  }
  const chunk = findChunk(region, ob);
  if (chunk) {
    return draftFromSideChunk(chunk, linesLocal, linesRemote, "remote");
  }
  const s = region.bufferStart + 1;
  const e = region.bufferStart + region.bufferLength;
  const t = joinLines(region.bufferContent);
  return {
    startLine: s,
    endLine: e,
    lineRangeBasis: "local",
    base: t,
    local: t,
    remote: t,
    type: "safe",
  };
};

const subdivideUnstable = (
  region: Extract<IRegion<string>, { stable: false }>,
): SectionDraft[] => {
  const a = region.aContent;
  const o = region.oContent;
  const b = region.bContent;
  const oStart = region.oStart;
  if (a.length !== o.length || o.length !== b.length) {
    const loc = joinLines(a);
    const bas = joinLines(o);
    const rem = joinLines(b);
    const oLen = region.oLength;
    const startLine = oStart + 1;
    const endLine = oLen === 0 ? startLine : oStart + oLen;
    return [
      {
        startLine,
        endLine,
        lineRangeBasis: "base",
        base: bas,
        local: loc,
        remote: rem,
        type: classifyThreeWay(loc, bas, rem),
      },
    ];
  }
  return a.map((_, i) => ({
    startLine: oStart + i + 1,
    endLine: oStart + i + 1,
    lineRangeBasis: "base" as const,
    base: o[i],
    local: a[i],
    remote: b[i],
    type: classifyThreeWay(a[i], o[i], b[i]),
  }));
};

const regionToDrafts = (
  region: IRegion<string>,
  linesLocal: string[],
  linesRemote: string[],
  oa: DiffChunk[],
  ob: DiffChunk[],
): SectionDraft[] => {
  if (region.stable) {
    return [stableRegionToDraft(region, linesLocal, linesRemote, oa, ob)];
  }
  return subdivideUnstable(region);
};

const isDiscardableEmpty = (d: SectionDraft): boolean =>
  d.type === "safe" &&
  d.local === "" &&
  d.remote === "" &&
  (d.base === undefined || d.base === "");

const mergeThreeWay = (
  base: string,
  local: string,
  remote: string,
): SectionDraft[] => {
  const o = splitLines(base);
  const a = splitLines(local);
  const b = splitLines(remote);
  const oa = diffIndices(o, a);
  const ob = diffIndices(o, b);
  const regions = diff3MergeRegions(a, o, b);
  const raw: SectionDraft[] = [];
  for (const region of regions) {
    raw.push(...regionToDrafts(region, a, b, oa, ob));
  }
  return groupSections(raw).filter((d) => !isDiscardableEmpty(d));
};

const mergeTwoWay = (local: string, remote: string): SectionDraft[] => {
  const parts = diffLines(local, remote);
  const out: SectionDraft[] = [];
  let localLine = 1;
  let i = 0;
  while (i < parts.length) {
    const p = parts[i];
    if (!p.added && !p.removed) {
      const n = lineCountFromDiffValue(p.value);
      const endLine = n === 0 ? localLine : localLine + n - 1;
      out.push({
        startLine: localLine,
        endLine,
        lineRangeBasis: "local",
        local: p.value,
        remote: p.value,
        type: "safe",
      });
      localLine += n;
      i += 1;
      continue;
    }
    let loc = "";
    let rem = "";
    while (i < parts.length && (parts[i].added || parts[i].removed)) {
      const q = parts[i];
      if (q.removed) loc += q.value;
      if (q.added) rem += q.value;
      i += 1;
    }
    const nLoc = lineCountFromDiffValue(loc);
    const endLine = nLoc === 0 ? localLine : localLine + nLoc - 1;
    out.push({
      startLine: localLine,
      endLine,
      lineRangeBasis: "local",
      local: loc,
      remote: rem,
      type: "conflict",
    });
    localLine += nLoc === 0 ? 0 : nLoc;
  }
  return out;
};

const finalizeDrafts = (drafts: SectionDraft[]): ConflictSection[] =>
  drafts.map((d, index) => ({
    index,
    startLine: d.startLine,
    endLine: d.endLine,
    lineRangeBasis: d.lineRangeBasis,
    type: d.type,
    reason: deriveReason(d),
    base: d.base,
    local: d.local,
    remote: d.remote,
  }));

const resolvePreviewText = (s: ConflictSection): string => {
  if (s.local === s.remote) return s.local;
  if (s.base !== undefined && s.local === s.base) return s.remote;
  if (s.base !== undefined && s.remote === s.base) return s.local;
  return s.local;
};

export const validateMergeResult = (result: MergeResult): void => {
  const { sections, isClean } = result;
  const expectedClean = !sections.some((s) => s.type === "conflict");
  if (isClean !== expectedClean) {
    throw new Error(
      `validateMergeResult: isClean (${isClean}) does not match sections`,
    );
  }
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i];
    if (s.index !== i) {
      throw new Error(`validateMergeResult: index ${s.index}, expected ${i}`);
    }
    if (s.startLine < 1 || s.endLine < s.startLine) {
      throw new Error(
        `validateMergeResult: invalid line range ${s.startLine}-${s.endLine} at ${i}`,
      );
    }
    const empty =
      s.local === "" &&
      s.remote === "" &&
      (s.base === undefined || s.base === "");
    if (empty) {
      throw new Error(`validateMergeResult: empty section at ${i}`);
    }
    if (s.type === "safe" && s.reason === "both_modified") {
      throw new Error(`validateMergeResult: safe/both_modified at ${i}`);
    }
    if (s.type === "conflict" && s.reason === "identical") {
      throw new Error(`validateMergeResult: conflict/identical at ${i}`);
    }
    if (s.type === "safe" && s.reason === "no_base_conflict") {
      throw new Error(`validateMergeResult: safe/no_base_conflict at ${i}`);
    }
    if (
      s.type === "conflict" &&
      s.reason !== "both_modified" &&
      s.reason !== "no_base_conflict"
    ) {
      throw new Error(`validateMergeResult: conflict/bad reason at ${i}`);
    }
    const recomputed = deriveReason({
      startLine: s.startLine,
      endLine: s.endLine,
      lineRangeBasis: s.lineRangeBasis,
      base: s.base,
      local: s.local,
      remote: s.remote,
      type: s.type,
    });
    if (recomputed !== s.reason) {
      throw new Error(
        `validateMergeResult: reason mismatch at ${i}: ${s.reason} vs ${recomputed}`,
      );
    }
  }
};

export const mergeNotes = (params: MergeNotesParams): MergeResult => {
  const { base, local, remote } = params;
  const drafts =
    base !== undefined
      ? mergeThreeWay(base, local, remote)
      : groupSections(mergeTwoWay(local, remote));
  const sections = finalizeDrafts(drafts);
  const result = {
    sections,
    isClean: !sections.some((s) => s.type === "conflict"),
  };
  validateMergeResult(result);
  return result;
};

export const buildMergePreviewPlan = (
  sections: ConflictSection[],
): MergePreviewPart[] => {
  const out: MergePreviewPart[] = [];
  for (const s of sections) {
    if (s.type === "conflict") {
      out.push({ kind: "conflict_marker", sectionIndex: s.index });
    } else {
      const text = resolvePreviewText(s);
      if (text.length > 0) {
        out.push({ kind: "text", value: text });
      }
    }
  }
  return out;
};

export const formatMergePreviewReadable = (
  parts: MergePreviewPart[],
): string =>
  parts
    .map((p) =>
      p.kind === "text"
        ? p.value
        : `CONFLICT_MARKER sectionIndex=${p.sectionIndex}`,
    )
    .join("\n");
