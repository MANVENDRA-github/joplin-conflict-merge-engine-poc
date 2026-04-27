# Joplin Conflict Merge Engine. (PoC)

This repository contains a prototype implementation of a **conflict resolution merge engine** designed for the Joplin GSoC 2026 Idea: *Automatic Conflict Resolution*.

The goal of this PoC is to validate the **core merge logic** and demonstrate how note conflicts can be classified into structured sections that can later power a conflict resolution UI.

---

## Overview

Joplin currently handles conflicts by duplicating notes, leaving resolution entirely manual.

This prototype explores a system where:

- Notes are compared using **3-way merge (base, local, remote)**
- A **2-way fallback** is used when base is unavailable
- Changes are grouped into **sections (not individual lines)**
- Each section is classified as:
  - `safe` → can be merged without conflict
  - `conflict` → requires user intervention

---

## Key Features

- 3-way merge support
- 2-way fallback (no base case)
- Section-based grouping of changes
- Deterministic conflict classification:
  - `identical`
  - `local_only`
  - `remote_only`
  - `both_modified`
  - `no_base_conflict`
- Structured JSON output (UI-ready)
- Non-persistent merge preview

---

## Example Output

```json
{
  "isClean": false,
  "sections": [
    {
      "index": 1,
      "type": "conflict",
      "reason": "both_modified",
      "startLine": 6,
      "endLine": 8
    }
  ]
}
```
---

## Project Structure

src/<br>
  merge/<br>
    mergeEngine.ts<br>
    sectionGrouper.ts<br>
    types.ts<br>
  cli/<br>
    printer.ts<br>
  index.ts

- mergeEngine.ts → core merge logic
- sectionGrouper.ts → section creation
- printer.ts → CLI output formatting

---

## How It Works

1. Input:
- Base version (optional)
- Local version
- Remote version
2. Merge Engine:
- Performs 3-way or 2-way comparison
- Identifies differences
- Groups them into sections
3. Output:
- Structured sections
- Safe vs conflict classification
- Preview plan for rendering
