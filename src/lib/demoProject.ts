import type { ProjectFiles } from "./types";
import { defaultPreviewModel, generateAppJsx, generateStylesCss } from "./previewModel";

export const demoFileOrder = [
  "src/App.jsx",
  "src/styles.css",
  ".env",
  ".env.example",
  "package.json",
  "tests/button.test.js",
  "README.md",
];

const _model = defaultPreviewModel();

export const initialProjectFiles: ProjectFiles = {
  "src/App.jsx": generateAppJsx(_model),
  "src/styles.css": generateStylesCss(_model),
  ".env": `STRIPE_SECRET_KEY=sk_live_fake_secret
DATABASE_URL=postgres://prod-db
`,
  ".env.example": `STRIPE_SECRET_KEY=your_key_here
DATABASE_URL=your_database_url
`,
  "package.json": `{
  "scripts": {
    "test": "node tests/button.test.js"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "vite": "latest",
    "react": "latest",
    "react-dom": "latest"
  }
}
`,
  "tests/button.test.js": `const fs = require("fs");

const app = fs.readFileSync("src/App.jsx", "utf8");
const styles = fs.readFileSync("src/styles.css", "utf8");

if (!app.includes("AgentOps Console")) {
  throw new Error("AgentOps Console title missing");
}

if (!styles.includes(".primary-button")) {
  throw new Error("Primary workflow button styles missing");
}

if (!styles.includes(".metric-card")) {
  throw new Error("Metric card styles missing");
}

console.log("ok AgentOps console renders");
console.log("ok primary workflow button contract is present");
console.log("ok AgentWing sandbox replay passed");
`,
  "README.md": `# Mini AI Workspace Dashboard

This tiny SaaS dashboard is modified by the AgentWing Live Agent Lab mini-agent.
`,
};

export function cloneInitialFiles(): ProjectFiles {
  return { ...initialProjectFiles };
}
