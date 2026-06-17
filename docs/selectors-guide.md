# Finding the Right CSS Selector

A CSS selector tells the tool which part of the page to capture. Here is how to find the right one for any element.

## The quick method

1. Open the product page in Chrome or Firefox
2. Right-click the element you want to capture
3. Click **Inspect**
4. In the panel that opens, the relevant HTML is highlighted
5. Right-click the highlighted line
6. Choose **Copy > Copy selector**
7. Paste it into your `config.yml`

That copied selector works in most cases. If it looks very long and complex (e.g. `#root > div > div:nth-child(3) > section`), it may be fragile -- see the tips below.

## What makes a good selector

Good selectors target something stable and meaningful, not a position in the page structure.

| Good | Why |
|------|-----|
| `#main-content` | ID selectors are stable and unique |
| `.dashboard-panel` | Class names tied to a component |
| `[data-testid="export-button"]` | Test IDs are set intentionally and rarely change |
| `nav.top-bar` | Tag + class combination |

| Fragile | Why |
|---------|-----|
| `div:nth-child(4)` | Breaks if anything is reordered |
| `div > div > div` | Too generic, matches many things |
| `.css-1a2b3c` | Auto-generated class names change on every build |

## Capturing a full page section

If you want to capture a whole section rather than a specific element, target the section's container:

```yaml
selector: "section#getting-started"
```

## Capturing the full page

Leave the selector blank to capture the entire page:

```yaml
selector:
```

## Testing your selector

Before adding it to config.yml, test it in the browser console:

```javascript
document.querySelector("your-selector-here")
```

If it returns `null`, the selector does not match anything. If it returns an element, you will see it highlighted in the DevTools panel.

## Masking dynamic content

If the region you are capturing includes timestamps, user names, or other content that changes on every load, add those elements to the `mask` list in your config entry:

```yaml
mask:
  - ".last-updated-timestamp"
  - ".current-user-name"
```

These elements are hidden before the screenshot is taken so they do not trigger false positives.