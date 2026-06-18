const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

const CONFIG_FILE = "config.yml";

if (!fs.existsSync(CONFIG_FILE)) {
  console.error("config.yml not found. Run bash setup.sh first.");
  process.exit(1);
}

const config = yaml.load(fs.readFileSync(CONFIG_FILE, "utf8"));
const id = process.argv[2];

// If no ID provided, list all available IDs
if (!id) {
  console.log("\nUsage: npm run approve -- <screenshot-id>");
  console.log("\nAvailable IDs:");
  config.screenshots.forEach((s) => {
    const liveExists = fs.existsSync(path.join("screenshots/live", `${s.id}.png`));
    console.log(`  ${s.id} -- ${s.label}${liveExists ? "" : " (no live capture yet)"}`);
  });
  console.log("\nRun npm run check first to generate live captures.");
  process.exit(0);
}

// Special case: approve all flagged screenshots at once
if (id === "all") {
  const liveFiles = fs.readdirSync("screenshots/live").filter((f) => f.endsWith(".png"));

  if (liveFiles.length === 0) {
    console.error("No live screenshots found. Run npm run check first.");
    process.exit(1);
  }

  let approved = 0;
  for (const file of liveFiles) {
    const livePath = path.join("screenshots/live", file);
    const refPath = path.join("screenshots/reference", file);
    fs.copyFileSync(livePath, refPath);
    console.log(`Approved: ${file}`);
    approved++;
  }

  console.log(`\n${approved} screenshot(s) approved as new baseline.`);
  console.log("Commit the updated reference screenshots to save your baseline.");
  process.exit(0);
}

// Find the entry matching the provided ID
const entry = config.screenshots.find((s) => s.id === id);

if (!entry) {
  console.error(`No screenshot found with id "${id}".`);
  console.log("\nAvailable IDs:");
  config.screenshots.forEach((s) => console.log(`  ${s.id}`));
  process.exit(1);
}

const livePath = path.join("screenshots/live", `${entry.id}.png`);
const refPath = entry.reference;

if (!fs.existsSync(livePath)) {
  console.error(`No live capture found for "${id}". Run npm run check first.`);
  process.exit(1);
}

// Ensure reference directory exists
const refDir = path.dirname(refPath);
if (!fs.existsSync(refDir)) {
  fs.mkdirSync(refDir, { recursive: true });
}

fs.copyFileSync(livePath, refPath);

console.log(`\nApproved: ${entry.label}`);
console.log(`Reference updated: ${refPath}`);
console.log("\nCommit this file to save your new baseline:");
console.log(`  git add ${refPath}`);
console.log(`  git commit -m "Update reference screenshot: ${entry.label}"`);