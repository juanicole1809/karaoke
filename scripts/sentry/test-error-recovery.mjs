import { createRequire } from 'node:module';

// Resolve via apps/api (workspace owner of playwright) — avoid Bun store version pins.
const require = createRequire(new URL('../../apps/api/package.json', import.meta.url));
const { chromium } = require('playwright');

const BASE = 'http://localhost:3000';
const results = [];

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

async function sleep(ms) {
    await page.waitForTimeout(ms);
}

async function waitFor(fn, timeoutMs, label) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
        try {
            if (await fn()) return Date.now() - start;
        } catch {
            /* navigating */
        }
        await sleep(150);
    }
    throw new Error(`Timeout waiting for ${label} after ${timeoutMs}ms`);
}

async function readPhase() {
    return page.evaluate(() => {
        const el = document.querySelector('[data-recovery-phase]');
        return {
            href: location.href,
            phase: el?.getAttribute('data-recovery-phase') ?? null,
            hasSpinner: Boolean(el?.querySelector('[aria-hidden], .animate-spin')),
            bucket: sessionStorage.getItem('vkara_error_recovery'),
        };
    });
}

// --- SOFT ---
await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => {
    sessionStorage.removeItem('vkara_error_recovery');
});

const softSamples = [];
const softNav = Date.now();
await page.goto(`${BASE}/e2e-recovery?mode=soft&run=${softNav}`, {
    waitUntil: 'commit',
});
const softStart = Date.now();
let sawSoftRetrying = false;
const softMs = await waitFor(async () => {
    const snap = await readPhase();
    softSamples.push({ t: Date.now() - softStart, ...snap });
    if (snap.phase === 'retrying') {
        sawSoftRetrying = true;
    }
    return (await page.locator('#e2e-soft-recovered').count()) > 0;
}, 15000, 'soft recovered');

results.push({
    test: 'soft',
    ok:
        softMs >= 1000 &&
        softMs <= 4000 &&
        sawSoftRetrying &&
        (await page.locator('#e2e-soft-recovered').count()) > 0 &&
        page.url().includes('mode=soft'),
    softMs,
    sawSoftRetrying,
    softUrl: page.url(),
    softSamples: softSamples.filter((s) => s.phase).slice(0, 10),
});

// --- HARD ---
await page.evaluate(() => {
    sessionStorage.removeItem('vkara_error_recovery');
});
const hardNav = Date.now();
await page.goto(`${BASE}/e2e-recovery?mode=hard&run=${hardNav}`, {
    waitUntil: 'commit',
});
const hardStart = Date.now();
const hardSamples = [];
let sawHardRetrying = false;
let sawHardRedirecting = false;

const hardMs = await waitFor(async () => {
    const snap = await readPhase().catch(() => ({ href: page.url(), phase: null, text: '', bucket: null }));
    hardSamples.push({ t: Date.now() - hardStart, ...snap });
    if (snap.phase === 'retrying') sawHardRetrying = true;
    if (snap.phase === 'redirecting') sawHardRedirecting = true;
    const url = page.url();
    return !url.includes('e2e-recovery') && new URL(url).pathname === '/';
}, 25000, 'hard redirect home');

results.push({
    test: 'hard',
    // Expect roughly: 2 soft (1.2s each) + hard delay (2.8s) ≈ 5.2s, allow 3–15s window
    ok:
        hardMs >= 3000 &&
        hardMs <= 15000 &&
        sawHardRetrying &&
        new URL(page.url()).pathname === '/',
    hardMs,
    sawHardRetrying,
    sawHardRedirecting,
    hardUrl: page.url(),
    hardSamples: hardSamples.filter((s, i) => s.phase || i === 0 || i === hardSamples.length - 1).slice(0, 12),
});

await browser.close();
console.log(JSON.stringify({ results }, null, 2));
if (results.some((r) => !r.ok)) process.exit(1);
