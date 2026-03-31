import type { MergeReason, SectionDraft } from "./types.js";

export const deriveReason = (draft: SectionDraft): MergeReason => {
  if (draft.type === "conflict") {
    return draft.base === undefined ? "no_base_conflict" : "both_modified";
  }
  if (draft.local === draft.remote) return "identical";
  if (draft.base !== undefined && draft.local === draft.base) {
    return "remote_only";
  }
  if (draft.base !== undefined && draft.remote === draft.base) {
    return "local_only";
  }
  return "identical";
};

const mergePair = (a: SectionDraft, b: SectionDraft): SectionDraft => {
  const sep = "\n";
  let base: string | undefined;
  if (a.base !== undefined || b.base !== undefined) {
    base = [(a.base ?? ""), (b.base ?? "")].join(sep);
  }
  return {
    startLine: a.startLine,
    endLine: b.endLine,
    lineRangeBasis: a.lineRangeBasis,
    base,
    local: [a.local, b.local].join(sep),
    remote: [a.remote, b.remote].join(sep),
    type: a.type,
  };
};

const mergeablePair = (cur: SectionDraft, next: SectionDraft): boolean => {
  if (next.type !== cur.type) return false;
  if (cur.lineRangeBasis !== next.lineRangeBasis) return false;
  if (cur.endLine + 1 !== next.startLine) return false;
  if (cur.type === "safe" && deriveReason(cur) !== deriveReason(next)) {
    return false;
  }
  return true;
};

export const groupSections = (sections: SectionDraft[]): SectionDraft[] => {
  if (sections.length === 0) return [];
  const merged: SectionDraft[] = [];
  let cur = { ...sections[0] };
  for (let i = 1; i < sections.length; i++) {
    const next = sections[i];
    if (mergeablePair(cur, next)) {
      cur = mergePair(cur, next);
    } else {
      merged.push(cur);
      cur = { ...next };
    }
  }
  merged.push(cur);
  return merged;
};
