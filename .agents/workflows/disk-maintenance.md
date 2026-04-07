---
description: how to free up disk space by clearing build artifacts and caches
---

# disk-maintenance

Run this workflow whenever you notice your disk space is running low or if building the application becomes slow.

## Steps

1. **Check current disk space**
   // turbo
   `df -h /System/Volumes/Data`

2. **Run the Automated Cleanup**
   This script clears heavy `.next` folders and temporary app caches.
   // turbo
   `bash /Users/socket/distill/maintenance/cleanup.sh`

3. **Optional: Clear node_modules**
   If you still need more space, you can delete `node_modules` from projects you aren't currently using.
   - For `lstnr`: `rm -rf /Users/socket/lstnr/node_modules`
   - For `isang`: `rm -rf /Users/socket/isang/node_modules`
   
   *Note: You can always restore these by running `npm install` inside those folders later.*

4. **Verify Savings**
   // turbo
   `df -h /System/Volumes/Data`
