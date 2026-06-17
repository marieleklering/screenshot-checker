#!/bin/bash

set -e

echo ""
echo "Setting up Screenshot Checker..."
echo ""

# Check Node is installed
if ! command -v node &> /dev/null; then
  echo "Node.js is not installed. Please install it from https://nodejs.org (LTS version) and run this script again."
  exit 1
fi

# Check npm is available
if ! command -v npm &> /dev/null; then
  echo "npm is not installed. It usually comes with Node.js -- please reinstall from https://nodejs.org"
  exit 1
fi

# Install dependencies
echo "Installing dependencies..."
npm install

# Install Playwright browser
echo "Installing browser for Playwright..."
npx playwright install chromium --with-deps

# Create folders
mkdir -p screenshots/reference screenshots/live

# Copy example config if config.yml doesn't exist yet
if [ ! -f config.yml ]; then
  cp config.example.yml config.yml
  echo ""
  echo "Created config.yml from the example. Open it and fill in your URLs and selectors."
else
  echo ""
  echo "config.yml already exists -- skipping."
fi

echo ""
echo "Setup complete."
echo ""
echo "Next steps:"
echo "  1. Open config.yml and add your product URLs and selectors"
echo "  2. Drop your reference screenshots into screenshots/reference/"
echo "  3. Set your Anthropic API key: export ANTHROPIC_API_KEY=your-key-here"
echo "  4. Run: npm run check"
echo ""
echo "See README.md for full instructions."
echo ""