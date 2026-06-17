# Authentication Guide

If your product requires login, you need to tell the tool how to authenticate before it can take screenshots. There are two supported approaches.

---

## Option A: Email and password form

Use this if your product has a standard login page with an email and password field.

### 1. Find your login form selectors

Open the login page, right-click the email field, click Inspect, and copy the selector. Do the same for the password field and the submit button.

### 2. Add GitHub secrets for your credentials

Never put real credentials in your config file. Instead:

1. Go to your GitHub repo
2. Click **Settings > Secrets and variables > Actions**
3. Click **New repository secret**
4. Add two secrets:
   - Name: `PRODUCT_USERNAME` / Value: your login email
   - Name: `PRODUCT_PASSWORD` / Value: your password

Use a dedicated test account if possible, not your personal credentials.

### 3. Update config.yml

```yaml
auth:
  type: "password"
  login_url: "https://yourproduct.com/login"
  username_selector: "#email"
  password_selector: "#password"
  submit_selector: "button[type=submit]"
  username_secret: "PRODUCT_USERNAME"
  password_secret: "PRODUCT_PASSWORD"
```

### 4. Update the GitHub Actions workflow

In `.github/workflows/screenshot-check.yml`, uncomment these lines under `env`:

```yaml
env:
  ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
  PRODUCT_USERNAME: ${{ secrets.PRODUCT_USERNAME }}
  PRODUCT_PASSWORD: ${{ secrets.PRODUCT_PASSWORD }}
```

---

## Option B: SSO or OAuth (Google, Microsoft, Okta)

SSO providers block automated browsers as a security measure, so Playwright cannot complete the login flow directly. Instead, you log in manually once and export the session.

### 1. Generate a session file

Run this command from your project folder:

```bash
npx playwright codegen --save-storage=auth/session.json https://yourproduct.com
```

A browser window will open. Log in normally. When you are fully logged in and can see the product, close the browser window. The session is saved to `auth/session.json`.

### 2. Add the session file as a GitHub secret

The session file contains sensitive tokens. Do not commit it to your repo.

1. Copy the contents of `auth/session.json`
2. Go to **Settings > Secrets and variables > Actions**
3. Add a new secret named `PRODUCT_SESSION` and paste the contents

Then add a step to your workflow that writes the secret back to a file before the comparison runs:

```yaml
- name: Restore session
  run: |
    mkdir -p auth
    echo '${{ secrets.PRODUCT_SESSION }}' > auth/session.json
```

### 3. Update config.yml

```yaml
auth:
  type: "session"
  session_file: "auth/session.json"
```

### Session expiry

Sessions expire. If the tool suddenly starts failing with authentication errors, your session has expired and you need to regenerate it using the `playwright codegen` command above.

How long sessions last depends on the product -- typically anywhere from two weeks to three months.

---

## No authentication needed

If your product is publicly accessible, remove the auth section from config.yml entirely or set:

```yaml
auth:
  type: "none"
```