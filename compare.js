const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const yaml = require("js-yaml");

// ─── Config ──────────────────────────────────────────────────────────────────

const CONFIG_FILE = "config.yml";

if (!fs.existsSync(CONFIG_FILE)) {
    console.error(
        "config.yml not found. Copy config.example.yml to config.yml and fill in your values."
    );
    process.exit(1);
}

const config = yaml.load(fs.readFileSync(CONFIG_FILE, "utf8"));

const LIVE_DIR = "screenshots/live";
const REPORT_FILE = "report.md";
const API_KEY = process.env.ANTHROPIC_API_KEY;

if (!API_KEY) {
    console.error(
        "ANTHROPIC_API_KEY environment variable is not set.\n" +
        "Locally: export ANTHROPIC_API_KEY=your-key-here\n" +
        "GitHub Actions: add it as a repository secret named ANTHROPIC_API_KEY"
    );
    process.exit(1);
}

const SENSITIVITY_PROMPTS = {
    low: "Focus only on significant changes: missing or renamed UI elements, changed button labels, removed sections, or major layout shifts. Ignore minor styling differences.",
    medium: "Flag moderate changes including button label changes, small text differences, reordered elements, and layout shifts. Ignore minor colour or font rendering differences.",
    high: "Flag any visible difference between the two screenshots, including minor text changes, colour shifts, spacing differences, or element repositioning.",
};

const sensitivity = config.sensitivity || "low";

// ─── Authentication ───────────────────────────────────────────────────────────

async function authenticate(page) {
    const auth = config.auth;
    if (!auth || auth.type === "none") return;

    if (auth.type === "password") {
        const username = process.env[auth.username_secret];
        const password = process.env[auth.password_secret];

        if (!username || !password) {
            throw new Error(
                `Auth credentials not found. Make sure ${auth.username_secret} and ${auth.password_secret} are set as environment variables or GitHub secrets.`
            );
        }

        console.log("  Authenticating...");
        await page.goto(auth.login_url, { waitUntil: "networkidle" });
        await page.fill(auth.username_selector, username);
        await page.fill(auth.password_selector, password);
        await page.click(auth.submit_selector);
        await page.waitForNavigation({ waitUntil: "networkidle" });
        console.log("  Authenticated.");
        return;
    }

    if (auth.type === "session") {
        if (!fs.existsSync(auth.session_file)) {
            throw new Error(
                `Session file not found at ${auth.session_file}. See docs/auth-guide.md for how to generate it.`
            );
        }
        const session = JSON.parse(fs.readFileSync(auth.session_file, "utf8"));
        await page.context().addCookies(session.cookies || []);
        console.log("  Session restored.");
        return;
    }

    throw new Error(`Unknown auth type "${auth.type}". Valid options: password, session, none.`);
}

// ─── Screenshot capture ───────────────────────────────────────────────────────

async function captureScreenshot(page, entry) {
    await page.goto(entry.url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(1000);

    // Hide dynamic elements that would cause false positives
    if (entry.mask && entry.mask.length > 0) {
        for (const selector of entry.mask) {
            await page.evaluate((sel) => {
                document.querySelectorAll(sel).forEach((el) => {
                    el.style.visibility = "hidden";
                });
            }, selector);
        }
    }

    const livePath = path.join(LIVE_DIR, `${entry.id}.png`);

    if (entry.selector) {
        const element = await page.$(entry.selector);
        if (!element) {
            throw new Error(
                `Selector "${entry.selector}" not found on ${entry.url}. Check your config or see docs/selectors-guide.md.`
            );
        }
        await element.screenshot({ path: livePath });
    } else {
        await page.screenshot({ path: livePath, fullPage: true });
    }

    return livePath;
}

// ─── Claude Vision comparison ─────────────────────────────────────────────────

async function compareWithVision(referencePath, livePath, entry) {
    const referenceBase64 = fs.readFileSync(referencePath).toString("base64");
    const liveBase64 = fs.readFileSync(livePath).toString("base64");

    const prompt = `You are a documentation accuracy reviewer.

Image 1 is a reference screenshot from existing documentation.
Image 2 is the current live product page.

${SENSITIVITY_PROMPTS[sensitivity]}

Respond only with a JSON object in this exact format, no other text:
{
  "needs_update": true or false,
  "confidence": "high", "medium", or "low",
  "changes": ["list each specific change you observed, or empty array if none"],
  "recommendation": "one sentence telling the technical writer what to do"
}`;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-api-key": API_KEY,
            "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
            model: "claude-sonnet-4-6",
            max_tokens: 1000,
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "image",
                            source: { type: "base64", media_type: "image/png", data: referenceBase64 },
                        },
                        {
                            type: "image",
                            source: { type: "base64", media_type: "image/png", data: liveBase64 },
                        },
                        { type: "text", text: prompt },
                    ],
                },
            ],
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Anthropic API error ${response.status}: ${error}`);
    }

    const data = await response.json();
    const text = data.content.find((b) => b.type === "text")?.text || "";

    try {
        return JSON.parse(text.replace(/```json|```/g, "").trim());
    } catch {
        throw new Error(`Could not parse Vision response: ${text}`);
    }
}

// ─── Report generation ────────────────────────────────────────────────────────

function generateReport(results) {
    const now = new Date().toUTCString();
    const flagged = results.filter((r) => r.status === "needs_update" || r.status === "error");
    const clean = results.filter((r) => r.status === "ok");

    // Group by doc file
    const byDoc = {};
    for (const r of results) {
        const doc = r.doc || "Uncategorised";
        if (!byDoc[doc]) byDoc[doc] = [];
        byDoc[doc].push(r);
    }

    const lines = [
        "# Screenshot Accuracy Report",
        "",
        `**Generated:** ${now}`,
        `**Sensitivity:** ${sensitivity}`,
        `**Total checked:** ${results.length}`,
        `**Up to date:** ${clean.length}`,
        `**Needs attention:** ${flagged.length}`,
        "",
        "---",
        "",
    ];

    for (const [doc, entries] of Object.entries(byDoc)) {
        lines.push(`## ${doc}`, "");

        const docFlagged = entries.filter((e) => e.status !== "ok");
        const docClean = entries.filter((e) => e.status === "ok");

        if (docFlagged.length > 0) {
            lines.push("### Needs Updating", "");
            for (const r of docFlagged) {
                lines.push(`#### ${r.label}`);
                if (r.status === "error") {
                    lines.push(`- **Error:** ${r.error}`);
                } else {
                    lines.push(`- **Confidence:** ${r.vision.confidence}`);
                    lines.push(`- **What changed:**`);
                    for (const change of r.vision.changes) {
                        lines.push(`  - ${change}`);
                    }
                    lines.push(`- **Action:** ${r.vision.recommendation}`);
                    lines.push(`- **Reference:** \`${r.reference}\``);
                    lines.push(`- **Live capture:** \`screenshots/live/${r.id}.png\``);
                }
                lines.push("");
            }
        }

        if (docClean.length > 0) {
            lines.push("### Up to Date", "");
            for (const r of docClean) {
                lines.push(`- **${r.label}** -- no meaningful changes detected`);
            }
            lines.push("");
        }
    }

    fs.writeFileSync(REPORT_FILE, lines.join("\n"));
    console.log(`\nReport written to ${REPORT_FILE}`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function run() {
    if (!fs.existsSync(LIVE_DIR)) fs.mkdirSync(LIVE_DIR, { recursive: true });

    const browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();

    // Authenticate once before any screenshots
    try {
        await authenticate(page);
    } catch (err) {
        console.error(`Authentication failed: ${err.message}`);
        await browser.close();
        process.exit(1);
    }

    const results = [];

    // Group entries by URL so each page loads once
    const byUrl = {};
    for (const entry of config.screenshots) {
        if (!byUrl[entry.url]) byUrl[entry.url] = [];
        byUrl[entry.url].push(entry);
    }

    for (const [url, entries] of Object.entries(byUrl)) {
        console.log(`\nLoading: ${url}`);

        for (const entry of entries) {
            console.log(`  Checking: ${entry.label}`);

            if (!fs.existsSync(entry.reference)) {
                console.warn(`  Reference not found: ${entry.reference}`);
                results.push({ ...entry, status: "error", error: `Reference screenshot not found at ${entry.reference}. Add your reference screenshot to start tracking this entry.` });
                continue;
            }

            let livePath;
            try {
                livePath = await captureScreenshot(page, entry);
            } catch (err) {
                console.warn(`  Capture failed: ${err.message}`);
                results.push({ ...entry, status: "error", error: err.message });
                continue;
            }

            let vision;
            try {
                vision = await compareWithVision(entry.reference, livePath, entry);
            } catch (err) {
                console.warn(`  Vision comparison failed: ${err.message}`);
                results.push({ ...entry, status: "error", error: err.message });
                continue;
            }

            const status = vision.needs_update ? "needs_update" : "ok";
            console.log(`  ${status === "ok" ? "OK" : "NEEDS UPDATE"} (confidence: ${vision.confidence})`);
            if (vision.changes.length > 0) {
                vision.changes.forEach((c) => console.log(`    - ${c}`));
            }

            results.push({ ...entry, status, vision });
        }
    }

    await browser.close();
    generateReport(results);

    const hasIssues = results.some((r) => r.status !== "ok");
    process.exit(hasIssues ? 1 : 0);
}

run().catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
});