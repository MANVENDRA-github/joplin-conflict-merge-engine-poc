import { mergeNotes } from "./merge/mergeEngine.js";
import { printCase } from "./cli/printer.js";

printCase(
  "CASE 1 — 3-way (non-overlapping)",
  mergeNotes({
    base: ["Title", "Body A", "Body B", "Footer"].join("\n"),
    local: ["Title", "Body A (local)", "Body B", "Footer"].join("\n"),
    remote: ["Title", "Body A", "Body B (remote)", "Footer"].join("\n"),
  }),
);

printCase(
  "CASE 2 — 3-way (overlapping)",
  mergeNotes({
    base: "Shopping list:\n- milk\n- eggs\n",
    local: "Shopping list:\n- milk\n- eggs\n- bread\n",
    remote: "Shopping list:\n- milk\n- eggs\n- juice\n",
  }),
);

printCase(
  "CASE 3 — 2-way (no base)",
  mergeNotes({
    local: "Version A\nshared tail\n",
    remote: "Version B\nshared tail\n",
  }),
);

printCase(
  "CASE 4 — 3-way (identical all sides)",
  mergeNotes({
    base: "alpha\nbeta\ngamma\n",
    local: "alpha\nbeta\ngamma\n",
    remote: "alpha\nbeta\ngamma\n",
  }),
);

printCase(
  "CASE 5 — 3-way (large multi-line block)",
  mergeNotes({
    base: ["# Doc", "", "Intro paragraph.", "", "## Section", "Old line 1", "Old line 2", "Old line 3", "", "Outro."].join(
      "\n",
    ),
    local: ["# Doc", "", "Intro paragraph.", "", "## Section", "New local A", "New local B", "New local C", "", "Outro."].join(
      "\n",
    ),
    remote: ["# Doc", "", "Intro paragraph.", "", "## Section", "New remote A", "New remote B", "New remote C", "", "Outro."].join(
      "\n",
    ),
  }),
);
