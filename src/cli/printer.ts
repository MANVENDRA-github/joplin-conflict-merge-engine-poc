import type { ConflictSection, MergeResult } from "../merge/types.js";
import {
  buildMergePreviewPlan,
  formatMergePreviewReadable,
} from "../merge/mergeEngine.js";

const rule = (ch: string) => ch.repeat(40);

export const mergeResultToJson = (result: MergeResult): string =>
  JSON.stringify(result, null, 2);

const humanLine = (s: ConflictSection): string =>
  `[#${s.index}] ${s.type.toUpperCase()} (${s.reason}) ${s.lineRangeBasis} L${s.startLine}-${s.endLine}`;

export const printCase = (title: string, result: MergeResult): void => {
  console.log(`\n${rule("-")}`);
  console.log(title);
  console.log(rule("-"));
  console.log("\nJSON OUTPUT:");
  console.log(mergeResultToJson(result));
  console.log("\nHUMAN VIEW:");
  for (const s of result.sections) {
    console.log(humanLine(s));
  }
  const plan = buildMergePreviewPlan(result.sections);
  console.log("\nPREVIEW PLAN (JSON):");
  console.log(JSON.stringify(plan, null, 2));
  console.log("\nPREVIEW READABLE:");
  console.log(formatMergePreviewReadable(plan));
};
