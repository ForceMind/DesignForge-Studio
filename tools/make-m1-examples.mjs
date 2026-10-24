/** Original editable examples. Regenerate without changing the M0 fixture/hash. */
import fs from "node:fs";
import { newProject, clone, validateProject } from "../src/core.mjs";
let seq = 0;
const id = () => `m${++seq}`;
const text = (name, content, size = 16, h = 28) => ({
  id: id(),
  type: "text",
  name,
  x: 0,
  y: 0,
  w: 260,
  h,
  text: content,
  style: { fontSize: size, fontWeight: size > 20 ? 700 : 500, color: "$ink" },
  sizing: { w: "fill", h: "hug" },
});
const frame = (name, children, layout = {}, w = 320, h = 200) => ({
  id: id(),
  type: "frame",
  name,
  x: 0,
  y: 0,
  w,
  h,
  text: "",
  style: { fill: "$surface", radius: "$radius" },
  children,
  layout: {
    mode: "flex",
    direction: "column",
    gap: "$spacing",
    padding: 20,
    ...layout,
  },
  sizing: { w: "fill", h: "hug" },
});
const button = (label) => ({
  id: id(),
  type: "button",
  name: label,
  x: 0,
  y: 0,
  w: 140,
  h: 44,
  text: label,
  style: {
    fill: "$primary",
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: 650,
    radius: 10,
  },
  sizing: { w: "fill" },
});
const metric = (name, value) => ({
  ...frame(
    name,
    [
      text(name, name, 14, 24),
      text("Value", value, 30, 42),
      text("Context", "Demo data · this month", 12, 20),
    ],
    {},
    260,
    148,
  ),
  style: {
    fill: "$surfaceAlt",
    stroke: "$border",
    strokeWidth: 1,
    radius: "$radius",
  },
});
const list = (title, items) =>
  frame(
    title,
    [
      text("Section heading", title, 20, 32),
      ...items.map((label, i) =>
        frame(
          label,
          [
            text("Label", label, 15, 24),
            text(
              "Detail",
              ["Ready for review", "In progress", "Updated just now"][i % 3],
              12,
              20,
            ),
          ],
          { gap: 4, padding: 12 },
          260,
          72,
        ),
      ),
    ],
    {},
    320,
    360,
  );
const base = (title) => {
  const p = newProject(title);
  p.id = title
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .slice(0, 50);
  p.updatedAt = "2026-10-23T00:00:00.000Z";
  Object.assign(p.tokens, {
    accent: "#2563EB",
    primary: "$accent",
    spacing: 12,
    spaceLarge: 24,
    muted: "#667085",
  });
  p.themes = {
    dark: {
      surface: "#202938",
      surfaceAlt: "#151D2B",
      ink: "#F2F4F8",
      muted: "#BCC7DA",
      border: "#3A4659",
      primarySoft: "#263D62",
      accent: "#3B82F6",
    },
  };
  p.components = [];
  return p;
};
const board = (name, children, w = 1200, h = 1000) => {
  const root = frame(
    "Page frame",
    children,
    { padding: "$spaceLarge", gap: 20 },
    w - 64,
    h - 64,
  );
  root.x = 32;
  root.y = 32;
  root.sizing = { h: "hug" };
  root.constraints = { horizontal: "stretch", referenceW: w };
  return {
    id: id(),
    name,
    x: 0,
    y: 80,
    w,
    h,
    autoHeight: true,
    bg: "#EEF1F6",
    nodes: [root],
  };
};
const header = (title) =>
  frame(
    "Header",
    [text("Product name", title, 22, 36), button("New project")],
    { direction: "row", align: "center", justify: "space-between", padding: 0 },
    1000,
    48,
  );
const p = base("Studio — Responsive workspace");
const primary = frame(
  "Action",
  [text("Action label", "Create project", 14, 24)],
  { padding: 12, align: "center", justify: "center" },
  152,
  48,
);
primary.sizing = {};
primary.style = { fill: "$primary", radius: 10 };
primary.children[0].style.color = "#FFFFFF";
const secondary = clone(primary);
secondary.style.fill = "$primarySoft";
secondary.children[0].style.color = "$primary";
secondary.children[0].text = "View project";
p.components = [
  {
    id: "action",
    name: "Project action",
    variants: [
      { id: "primary", name: "Primary", root: primary },
      { id: "secondary", name: "Secondary", root: secondary },
    ],
  },
];
const instance = {
  id: id(),
  type: "instance",
  name: "Create project instance",
  x: 0,
  y: 0,
  w: 152,
  h: 48,
  text: "",
  style: {},
  componentId: "action",
  variantId: "primary",
  overrides: {},
};
const stats = frame(
  "Metrics grid",
  [
    metric("Projects", "12"),
    metric("Tasks completed", "84"),
    metric("Review queue", "07"),
  ],
  { mode: "grid", columns: 3, padding: 0 },
  1000,
  148,
);
stats.sizing.h = "hug";
stats.responsive = [
  { maxWidth: 600, changes: { layout: { ...stats.layout, columns: 1 } } },
];
const content = frame(
  "Content grid",
  [
    list("Recent projects", [
      "Mobile onboarding",
      "Game lobby",
      "Creator dashboard",
    ]),
    list("Design checklist", [
      "Token consistency",
      "Touch targets",
      "Responsive layout",
    ]),
  ],
  { mode: "grid", columns: 2, padding: 0 },
  1000,
  360,
);
content.sizing.h = "hug";
content.responsive = [
  { maxWidth: 600, changes: { layout: { ...content.layout, columns: 1 } } },
];
p.boards = [
  board(
    "Workspace / Desktop",
    [
      frame(
        "Header",
        [text("Brand", "FORGE / Workspace", 20, 32), instance],
        { direction: "row", align: "center", padding: 0 },
        1000,
        48,
      ),
      text("Page title", "Make room for your next idea.", 32, 52),
      stats,
      content,
      text("Footer", "Local design · Shared components · Demo content", 12, 26),
    ],
    1200,
    1000,
  ),
];
const mobile = clone(p.boards[0]);
p.boards[0].guides = [
  { id: "contentInset", axis: "x", position: 32, locked: true },
  { id: "headerBaseline", axis: "y", position: 96, hidden: true },
];
mobile.id = id();
mobile.name = "Workspace / Mobile";
mobile.x = 1290;
mobile.w = 390;
mobile.h = 1720;
for (const entry of (await import("../src/tree.mjs")).flattenNodes(
  mobile.nodes,
))
  entry.node.id = id();
p.boards.push(mobile);
p.comments = [
  {
    id: "review1",
    boardId: p.boards[0].id,
    nodeId: stats.id,
    text: "Metrics switch to one column at 600px.",
    resolved: false,
  },
];
const examples = [["Studio", p]];
const cases = [
  [
    "Settings",
    "Mobile settings",
    [
      header("Preferences"),
      list("Account", [
        "Profile and avatar",
        "Privacy and security",
        "Language and region",
      ]),
      list("Experience", ["Appearance", "Haptic feedback", "Notifications"]),
    ],
    390,
    1100,
  ],
  [
    "Kanban",
    "Project board",
    [
      header("Sprint workspace"),
      frame(
        "Board columns",
        [
          list("Planned", ["Search flow", "Empty states", "Design tokens"]),
          list("Building", ["Settings view", "Project import", "Review panel"]),
          list("Review", ["Editor toolbar", "Export assets"]),
        ],
        { mode: "grid", columns: 3, padding: 0 },
        1000,
        390,
      ),
    ],
    1200,
    800,
  ],
  [
    "GameHUD",
    "Portrait game HUD",
    [
      frame(
        "HUD",
        [text("Coins", "● 2,450", 18), text("Level", "LEVEL 12", 18)],
        { direction: "row", padding: 12 },
        320,
        56,
      ),
      frame(
        "Playfield",
        [
          text("Mission", "Sort every color", 26, 50),
          text("Board hint", "Playable content area", 16, 40),
        ],
        { justify: "center", align: "center" },
        320,
        390,
      ),
      frame(
        "Power ups",
        [button("Undo"), button("Hint")],
        { direction: "row", padding: 0 },
        320,
        48,
      ),
    ],
    390,
    850,
  ],
  [
    "LandscapeHUD",
    "Landscape game HUD",
    [
      header("PARTY / ROUND 03"),
      frame(
        "Arena",
        [
          text("Round status", "Find the hidden signal", 32, 50),
          text("Countdown", "00:24", 44, 64),
        ],
        { align: "center", justify: "center" },
        1000,
        360,
      ),
      frame(
        "Controls",
        [button("Inspect"), button("Use skill"), button("Ready")],
        { direction: "row", justify: "space-between" },
        1000,
        84,
      ),
    ],
    1200,
    720,
  ],
  [
    "Pricing",
    "Web pricing",
    [
      header("Choose your workspace"),
      text("Headline", "Designed for the way you work.", 32, 60),
      frame(
        "Plans",
        [
          metric("Personal", "$0"),
          metric("Studio", "$19"),
          metric("Team", "$49"),
        ],
        { mode: "grid", columns: 3, padding: 0 },
        1000,
        180,
      ),
      button("Compare features"),
    ],
    1200,
    720,
  ],
  [
    "Messages",
    "Messaging workspace",
    [
      header("Team inbox"),
      frame(
        "Split view",
        [
          list("Conversations", [
            "Design review",
            "Launch planning",
            "Product updates",
          ]),
          list("Design review", [
            "Can we use the shared button?",
            "Yes, the primary variant is ready.",
            "I will review the mobile layout.",
          ]),
        ],
        { mode: "grid", columns: 2, padding: 0 },
        1000,
        400,
      ),
      button("New message"),
    ],
    1200,
    800,
  ],
  [
    "SignIn",
    "Mobile sign in",
    [
      text("Brand", "FORGE", 24, 44),
      text("Welcome", "Welcome back.", 32, 56),
      text("Description", "Continue to your local workspace.", 16, 56),
      frame(
        "Credentials",
        [
          text("Email", "Email address", 14, 24),
          text("Email value", "designer@example.com", 16, 40),
          text("Password", "Password", 14, 24),
          text("Password value", "••••••••••••", 16, 40),
        ],
        {},
        300,
        240,
      ),
      button("Continue"),
      text("Privacy", "Your project files stay on this device.", 12, 44),
    ],
    390,
    900,
  ],
  [
    "Storefront",
    "Mobile storefront",
    [
      header("Objects / Studio"),
      text("Collection", "Everyday essentials", 28, 72),
      frame(
        "Products",
        [
          metric("Field notebook", "$12"),
          metric("Desk organizer", "$28"),
          metric("Travel pouch", "$24"),
        ],
        { gap: 16, padding: 0 },
        320,
        500,
      ),
      button("View basket"),
    ],
    390,
    1000,
  ],
  [
    "Files",
    "Desktop file browser",
    [
      header("Project library"),
      frame(
        "Library split",
        [
          list("Collections", ["All projects", "Favorites", "Recently opened"]),
          frame(
            "File grid",
            [
              metric("Orbit", "3 boards"),
              metric("Studio", "2 boards"),
              metric("Game HUD", "1 board"),
              metric("Storefront", "1 board"),
            ],
            { mode: "grid", columns: 2, padding: 0 },
            700,
            320,
          ),
        ],
        { mode: "grid", columns: 2, padding: 0 },
        1000,
        420,
      ),
    ],
    1200,
    800,
  ],
];
for (const [name, title, nodes, w, h] of cases) {
  const x = base(title);
  x.boards = [board(title, nodes, w, h)];
  examples.push([name, x]);
}
for (const [name, project] of examples) {
  const issues = validateProject(project);
  if (issues.length) throw Error(name + ": " + JSON.stringify(issues));
  fs.writeFileSync(
    new URL(`../examples/${name}.project.json`, import.meta.url),
    JSON.stringify(project, null, 2) + "\n",
  );
}
console.log(`Wrote ${examples.length} M1 examples`);
