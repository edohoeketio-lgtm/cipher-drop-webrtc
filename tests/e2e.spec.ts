import { test, expect, chromium } from '@playwright/test';

test('E2E Ghost Terminal V3 QA Simulation', async () => {
    test.setTimeout(30000);
    const browser = await chromium.launch({ headless: true });

    // TAB 1: Host
    const hostContext = await browser.newContext();
    const hostPage = await hostContext.newPage();
    hostPage.on('console', msg => console.log(`[HOST LOG] ${msg.type()}: ${msg.text()}`));
    hostPage.on('pageerror', err => console.log(`[HOST ERR] ${err.message}`));
    hostPage.on('dialog', dialog => {
       console.log(`[HOST DIALOG] ${dialog.message()}`);
       dialog.accept();
    });

    await hostPage.goto('http://localhost:5173');
    await hostPage.waitForSelector('button');
    await hostPage.locator('button', { hasText: 'HOST_NETWORK' }).click();
    console.log('[QA] Clicked HOST button');
    
    await expect(hostPage.locator('.hud-panel')).toContainText('DERIVING...', { timeout: 15000 });
    
    // Now the signature box should be visible
    await expect(hostPage.locator('.hud-panel')).toContainText('LISTENING_ON_CHANNEL...', { timeout: 15000 });
    const signatureLocator = hostPage.locator('.hud-panel > div:nth-child(2)');
    const signature = (await signatureLocator.innerText()).trim();
    console.log(`[QA] Generated Host Signature: ${signature}`);

    // TAB 2: Peer Join
    const peerContext = await browser.newContext();
    const peerPage = await peerContext.newPage();
    await peerPage.goto('http://localhost:5173');
    
    await peerPage.click('text=JOIN_NETWORK');
    
    // Input signature
    await peerPage.fill('input[placeholder="ALPHA-BRAVO-CHARLIE-DELTA"]', signature);
    await peerPage.click('button[type="submit"]');

    // Verify Peer connects to chat
    await expect(peerPage.locator('text=SECURE_CHANNEL_ACTIVE')).toBeVisible({ timeout: 10000 });
    console.log(`[QA] Peer 1 connected successfully!`);

    // Verify Host drops into chat
    await expect(hostPage.locator('text=SECURE_CHANNEL_ACTIVE')).toBeVisible({ timeout: 10000 });
    console.log(`[QA] Host transitioned to active secure channel!`);

    // Host sends Ghost Message
    await hostPage.selectOption('select', '10'); // select 10s timer
    await hostPage.fill('input[placeholder="Insert payload..."]', 'System Check: Nuke Protocol Test');
    await hostPage.keyboard.press('Enter');

    // Peer receives message
    await expect(peerPage.locator('text=System Check: Nuke Protocol Test')).toBeVisible();
    await expect(peerPage.locator('div', { hasText: '10s' }).first()).toBeVisible();
    console.log(`[QA] Ghost active message received on Peer!`);

    // Host clicks Nuke
    await hostPage.click('text=[NUKE_TUNNEL]');
    console.log(`[QA] NUKE_TUNNEL initiated by Host!`);

    // Verify Peer is reset to Lobby via Dead-Man's Switch
    await expect(peerPage.locator('text=SYSTEM_READY')).toBeVisible();
    console.log(`[QA] Peer correctly wiped! Tests passed.`);

    await browser.close();
});
