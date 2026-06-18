# Screenshot Checker

Every two weeks a release ships. UI changes, buttons move, labels get renamed. And somewhere in the docs, a screenshot is now lying to your users.

I built screenshot-checker to fix that. It automatically compares your documentation screenshots against the live product and tells you exactly what changed, so you can update before anyone notices.

The idea came from an interview question that stumped me: how do you keep screenshots accurate when releases happen every two weeks? I didn't have a good answer then. This is my answer now.

---

## Why screenshots matter

If you are a reader like me, you rely on screenshots to find your way. A visual aid tells you you are in the right place before you read a single word. For visual learners, screenshots are their way of navigating documentation.

When they are wrong, there is a break on trust. The reader looks at the screen, looks at the doc, and they do not match. That moment of confusion is small but it adds up.

---

## How it works

1. You keep reference screenshots in `screenshots/reference/`, these are the screenshots currently in your docs
2. On a schedule, the tool loads each product URL and captures the same region
3. Claude Vision compares the live capture against your reference and identifies meaningful changes
4. A report is generated listing what changed and what you need to do
5. If anything needs updating, a GitHub Issue is created automatically and updated on subsequent runs

---

## Before you start

You need two things.

**An Anthropic API key**

- Go to [console.anthropic.com](https://console.anthropic.com)
- Sign up or log in
- Click **API Keys** in the sidebar
- Click **Create Key**, give it a name, and copy the value

Keep this key private. You will add it to GitHub as a secret in the setup steps below.

**Node.js installed**

Download and install the LTS version from [nodejs.org](https://nodejs.org). It is free.

---

## Setup

### Step 1: Create your repo from this template

Click **Use this template** at the top of this page, then **Create a new repository**. Give it a name and create it in your account.

Clone the repo to your machine:

```bash
git clone https://github.com/your-username/your-repo-name
cd your-repo-name
```

### Step 2: Run the setup script

```bash
bash setup.sh
```

This installs dependencies, sets up folders, and copies the example config to `config.yml`.

### Step 3: Add your Anthropic API key as a GitHub secret

1. Go to your GitHub repo
2. Click **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Name: `ANTHROPIC_API_KEY`
5. Value: paste your API key
6. Click **Add secret**

### Step 4: Configure your screenshots

Open `config.yml` and replace the example entries with your own:

```yaml
screenshots:
  - id: dashboard-overview
    label: "Dashboard overview"
    url: "https://yourproduct.com/dashboard"
    selector: "#main-content"
    reference: "screenshots/reference/dashboard-overview.png"
    doc: "docs/getting-started.md"
```

Not sure how to find the right selector? See [docs/selectors-guide.md](docs/selectors-guide.md).

Product requires login? See [docs/auth-guide.md](docs/auth-guide.md).

### Step 5: Add your reference screenshots

Copy your existing documentation screenshots into `screenshots/reference/`. File names should match the `reference` field in your config entries.

### Step 6: Enable GitHub Actions write permissions

The tool needs permission to create issues.

1. Go to **Settings > Actions > General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**

### Step 7: Run it manually to verify

Go to the **Actions** tab, click **Screenshot Accuracy Check**, then click **Run workflow**. Check that it completes without errors and that the report artifact is downloadable from the run summary.

---

## Running locally

```bash
export ANTHROPIC_API_KEY=your-key-here
npm run check
```

The report is written to `report.md`. Live captures land in `screenshots/live/`.

---

## Setting a baseline for the first time

No reference screenshots yet? Run the tool once. It will capture the live page and warn that no reference exists. Copy the live capture across to set your baseline:

```bash
cp screenshots/live/your-screenshot.png screenshots/reference/your-screenshot.png
```

Then run again. That is your starting point.

---

## Approving updated screenshots

When the tool flags a screenshot as needing an update, fix the doc screenshot first. Then approve the new version as your baseline:

```bash
npm run approve -- dashboard-overview
```

To approve all live screenshots at once:

```bash
npm run approve -- all
```

To see all available IDs:

```bash
npm run approve
```

After approving, commit the updated reference file. This is part of the definition of done -- not optional:

```bash
git add screenshots/reference/dashboard-overview.png
git commit -m "Update reference screenshot: Dashboard overview"
```

---

## Adjusting the schedule

Edit the `schedule` field in `config.yml`:

```yaml
schedule: "0 9 * * 1"      # Every Monday at 9am UTC
schedule: "0 9 * * 1,4"    # Monday and Thursday
schedule: "0 9 1 * *"      # First of every month
```

Use [crontab.guru](https://crontab.guru) to build your own schedule. After changing this, also update the `cron` value in `.github/workflows/screenshot-check.yml` to match.

---

## Adjusting sensitivity

```yaml
sensitivity: low      # Major changes only -- recommended starting point
sensitivity: medium   # Moderate changes including label and text differences
sensitivity: high     # Any visible difference
```

Start with `low`. Adjust based on how many false positives you see in the first few runs.

---

## Masking dynamic content

Some regions include timestamps, user names, or other content that changes on every load. Hide them before the screenshot is taken:

```yaml
- id: dashboard-overview
  selector: "#main-content"
  mask:
    - ".last-updated"
    - ".user-avatar"
```

---

## Estimated cost

Each comparison sends two screenshots to Claude Vision. Rough estimates with Claude Sonnet 4.6:

| Screenshots | Weekly cost | Monthly cost |
|-------------|-------------|--------------|
| 10          | ~$0.10      | ~$0.40       |
| 30          | ~$0.30      | ~$1.20       |
| 100         | ~$1.00      | ~$4.00       |

---

## Limitations

This tool works well for docs sets up to around 50 screenshots. Every screenshot needs a manual config entry with a CSS selector. That is a one-time setup cost per screenshot, not ongoing work, but it is worth knowing upfront.

At larger scale, selector maintenance becomes the main overhead. If a product UI restructure changes class names or IDs, some selectors will break and need updating.

---

## Troubleshooting

**Selector not found**
The CSS selector in your config does not match any element on that page. Open the URL in a browser and verify the selector using DevTools. See [docs/selectors-guide.md](docs/selectors-guide.md).

**Authentication errors**
If your product requires login, see [docs/auth-guide.md](docs/auth-guide.md). If you are using session auth, your session may have expired and needs to be regenerated.

**API key error**
Make sure `ANTHROPIC_API_KEY` is set correctly as a GitHub secret and referenced in the workflow file under `env`.

**GitHub Issue not being created**
Check that workflow write permissions are enabled under **Settings > Actions > General**.