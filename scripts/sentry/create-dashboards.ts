#!/usr/bin/env bun
/**
 * Create vkara Sentry custom dashboards from dashboards.json.
 * Each template is published twice: development + production (hard environment filter).
 *
 * Usage:
 *   SENTRY_AUTH_TOKEN=sntryu_... bun scripts/sentry/create-dashboards.ts
 *
 * Prefer a **Personal User Token** (not Organization Token):
 *   https://sentry.io/settings/account/api/auth-tokens/
 * Scopes: org:read, org:write, project:read
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type SentryEnv = 'development' | 'production';

type DashboardDef = {
    title: string;
    period?: string;
    projects?: number[];
    isFavorited?: boolean;
    description?: string;
    widgets: unknown[];
};

type Manifest = {
    org: string;
    regionApi: string;
    dashboards: DashboardDef[];
};

const ENVS: SentryEnv[] = ['development', 'production'];

const __dir = dirname(fileURLToPath(import.meta.url));
const token = process.env.SENTRY_AUTH_TOKEN?.trim();
if (!token) {
    console.error(`Missing SENTRY_AUTH_TOKEN.

Create a Personal User Token at:
  https://sentry.io/settings/account/api/auth-tokens/
Scopes: org:read, org:write, project:read

Then:
  SENTRY_AUTH_TOKEN=sntryu_... bun scripts/sentry/create-dashboards.ts
`);
    process.exit(1);
}

const manifest = JSON.parse(
    readFileSync(join(__dir, 'dashboards.json'), 'utf8'),
) as Manifest;

const base = `${manifest.regionApi}/organizations/${manifest.org}/dashboards/`;

function titled(baseTitle: string, env: SentryEnv): string {
    // Strip a previous · env suffix if re-running against old titles.
    const cleaned = baseTitle.replace(/\s·\s(development|production)$/i, '');
    return `${cleaned} · ${env}`;
}

async function listExisting(): Promise<Map<string, string>> {
    const res = await fetch(`${base}?per_page=100`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
        throw new Error(`List dashboards failed: ${res.status} ${await res.text()}`);
    }
    const rows = (await res.json()) as Array<{ id: string; title: string }>;
    return new Map(rows.map((r) => [r.title, r.id]));
}

async function createOrReplace(
    dashboard: DashboardDef & { environment: SentryEnv[] },
    existingId?: string,
) {
    const body = {
        title: dashboard.title,
        description: dashboard.description,
        widgets: dashboard.widgets,
        projects: dashboard.projects ?? [-1],
        period: dashboard.period ?? '24h',
        environment: dashboard.environment,
        isFavorited: dashboard.isFavorited ?? false,
    };

    const url = existingId ? `${base}${existingId}/` : base;
    const method = existingId ? 'PUT' : 'POST';

    const res = await fetch(url, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
    });

    const text = await res.text();
    if (!res.ok) {
        throw new Error(`${method} ${dashboard.title} failed: ${res.status}\n${text}`);
    }
    return JSON.parse(text) as { id: string; title: string };
}

const existing = await listExisting();
const results: Array<{ title: string; id: string; url: string; action: string }> = [];

for (const template of manifest.dashboards) {
    for (const env of ENVS) {
        const title = titled(template.title, env);
        const prior =
            existing.get(title) ??
            // Migrate older unscoped titles → production only once.
            (env === 'production' ? existing.get(template.title) : undefined);
        const action = prior ? 'updated' : 'created';
        console.log(`${action === 'updated' ? 'Updating' : 'Creating'}: ${title}`);
        const saved = await createOrReplace(
            {
                ...template,
                title,
                environment: [env],
                // Favorite production overview only — avoid cluttering the star list.
                isFavorited: Boolean(template.isFavorited) && env === 'production',
                description: [
                    template.description,
                    `Filtered to Sentry environment=${env}.`,
                ]
                    .filter(Boolean)
                    .join(' '),
            },
            prior,
        );
        results.push({
            title: saved.title,
            id: saved.id,
            url: `https://vkara.sentry.io/dashboard/${saved.id}/?environment=${env}`,
            action,
        });
    }
}

console.log('\nDone:\n');
for (const row of results) {
    console.log(`- [${row.action}] ${row.title}`);
    console.log(`  ${row.url}`);
}
