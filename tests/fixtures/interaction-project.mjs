import { newProject } from "../../src/core.mjs";
export function interactionProject() {
  const p = newProject("States workshop");
  p.boards = [
    {
      id: "work",
      name: "Work",
      x: 0,
      y: 60,
      w: 800,
      h: 600,
      bg: "#FFFFFF",
      nodes: [
        {
          id: "action",
          type: "button",
          name: "Action",
          x: 40,
          y: 40,
          w: 220,
          h: 48,
          text: "Save project",
          style: { fill: "$primary", color: "#FFFFFF", radius: 12 },
          states: {
            hover: { style: { fill: "#123456" } },
            active: { style: { fill: "#234567" } },
            focus: { style: { stroke: "#345678" } },
            disabled: { style: { opacity: 0.4 } },
            loading: { style: { fill: "#456789" } },
          },
        },
        {
          id: "field",
          type: "input",
          name: "Email",
          x: 40,
          y: 130,
          w: 320,
          h: 48,
          text: "Email address",
          style: {
            fill: "$surface",
            color: "$ink",
            stroke: "$border",
            strokeWidth: 1,
            radius: 8,
          },
          states: {
            error: { style: { stroke: "$danger" } },
            focus: { style: { stroke: "$primary" } },
          },
        },
      ],
    },
  ];
  return p;
}
