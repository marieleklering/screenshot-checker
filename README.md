# Screenshot Checker

Automatically checks whether your documentation screenshots are still accurate against the live product. Runs on a schedule, compares screenshots using Claude Vision, and opens a GitHub Issue when something needs updating.

---

## How it works

1. You keep reference screenshots in `screenshots/reference/` -- these are the screenshots currently in your docs
2. On a schedule, the tool loads each product URL and captures the same region
3. Claude Vision compares the live capture against your reference and identifies meaningful changes
4. A report is generated listing what changed and what you need to do
5. If anything needs updating, a GitHub Issue is created automatically (and updated on subsequent runs rather than creating duplicates)

---

## Before you start

You need two things:

**1. An Anthropic API key**

- Go to [console.anthropic.com](https://console.anthropic.com)
- Sign up or log in
- Click **API Keys** in the sidebar
- Click **Create Key**, give it a name, and copy the value

Keep this key private. You will add it to GitHub as a secret in the setup steps below.

**2. Node.js installed**

Download and install the LTS version from [nodejs.org](https://nodejs.org). This is free.

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

**Finding the right selector:** see [docs/selectors-guide.md](docs/selectors-guide.md)

**Product requires login:** see [docs/auth-guide.md](docs/auth-guide.md)

### Step 5: Add your reference screenshots

Copy your existing documentation screenshots into `screenshots/reference/`. File names should match the `reference` field in your config entries.

### Step 6: Enable GitHub Actions write permissions

The tool needs permission to create issues.

1. Go to **Settings > Actions > General**
2. Scroll to **Workflow permissions**
3. Select **Read and write permissions**
4. Click **Save**

### Step 7: Run it manually to verify

Go to the **Actions** tab in your repo, click **Screenshot Accuracy Check**, then click **Run workflow**. Check that it completes without errors and that the report artifact is downloadable from the run summary.

---

## Running locally

```bash
export ANTHROPIC_API_KEY=your-key-here
npm run check
```

The report is written to `report.md`. Live captures land in `screenshots/live/`.

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

The `sensitivity` setting in `config.yml` controls how much needs to change before the tool flags something:

```yaml
sensitivity: low      # Major changes only (recommended starting point)
sensitivity: medium   # Moderate changes including label and text differences
sensitivity: high     # Any visible difference
```

Start with `low` and adjust based on how many false positives you see in the first few runs.

---

## Masking dynamic content

If a captured region includes timestamps, user names, or other content that changes on every load, add those elements to the `mask` list for that entry:

```yaml
- id: dashboard-overview
  selector: "#main-content"
  mask:
    - ".last-updated"
    - ".user-avatar"
```

These elements are hidden before the screenshot is taken.

---

## Estimated cost

Each comparison sends two screenshots to Claude Vision. Rough estimates with Claude Sonnet 4.6:

| Screenshots | Weekly cost | Monthly cost |
|-------------|-------------|--------------|
| 10          | ~$0.10      | ~$0.40       |
| 30          | ~$0.30      | ~$1.20       |
| 100         | ~$1.00      | ~$4.00       |

---

## Troubleshooting

**Selector not found error**
The CSS selector in your config does not match any element on that page. Open the URL in a browser and verify the selector using DevTools. See [docs/selectors-guide.md](docs/selectors-guide.md).

**Authentication errors**
If your product requires login, see [docs/auth-guide.md](docs/auth-guide.md). If you are using session auth, your session may have expired and needs to be regenerated.

**API key error**
Make sure `ANTHROPIC_API_KEY` is set correctly as a GitHub secret, and that it is referenced in the workflow file under `env`.

**GitHub Issue not being created**
Check that workflow write permissions are enabled under **Settings > Actions > General**.

---

## Reference screenshots not added yet

If you want to start tracking a page but do not have a reference screenshot yet, run the tool once -- it will capture the live page and warn that no reference exists. Copy the live capture from `screenshots/live/` into `screenshots/reference/` to set your baseline.