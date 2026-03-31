export type MergeSectionType = "safe" | "conflict";

export type MergeReason =
  | "identical"
  | "local_only"
  | "remote_only"
  | "both_modified"
  | "no_base_conflict";

export type LineRangeBasis = "base" | "local";

export type ConflictSection = {
  index: number;
  startLine: number;
  endLine: number;
  lineRangeBasis: LineRangeBasis;
  type: MergeSectionType;
  reason: MergeReason;
  base?: string;
  local: string;
  remote: string;
};

export type MergeResult = {
  isClean: boolean;
  sections: ConflictSection[];
};

export type MergeNotesParams = {
  base?: string;
  local: string;
  remote: string;
};

export type SectionDraft = {
  startLine: number;
  endLine: number;
  lineRangeBasis: LineRangeBasis;
  base?: string;
  local: string;
  remote: string;
  type: MergeSectionType;
};

export type MergePreviewPart =
  | { kind: "text"; value: string }
  | { kind: "conflict_marker"; sectionIndex: number };
