---
description: standard browser automation workflow using managed headless chromium
---

### Global Browser Standard

All browser automation in this and future projects MUST follow these rules:
1. **Managed Browsers Only**: Use Playwright's own browser binaries.
2. **Headless by Default**: Browser launch must include `{ headless: true }`.
3. **No Local Chrome**: Never use `channel: 'chrome'` or depend on the Chrome Desktop App.
4. **Scripted Execution**: Run browser tasks via scripts or terminal commands within the workspace.

### Standard Launch Code

```javascript
import { chromium } from "playwright";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  // Your automation logic here
  
  await browser.close();
})();
```

### Setup Instructions
// turbo
1. Ensure Playwright is installed: `npm install -D @playwright/test`
2. Install managed Chromium: `npx playwright install chromium`
