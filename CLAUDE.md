# ApplyDesk project conventions

## Commands

- Start web app: `npm run dev`
- Start worker: `npm run worker`
- Unit tests: `npm test`
- Browser tests: `npm run test:e2e`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Local services: `docker compose up -d`
- Generate Prisma client: `npm run db:generate`
- Create/apply a local migration: `npm run db:migrate`
- Apply production migrations: `npm run db:deploy`
- Open Prisma Studio: `npm run db:studio`
- Production build: `npm run build`

## Engineering conventions

- Use TypeScript. Validate request data, environment config, and model output with Zod.
- Keep route handlers thin and put business rules in tested server modules.
- Keep secrets in environment variables or a managed secret store. Commit placeholders only.
- Use Prisma migrations and keep generated files out of source control.
- Scope all reads, writes, and file access to the authenticated user ID.
- Keep queue tasks idempotent, bounded, rate-limited, and observable.
- Isolate ATS adapters and cover them with recorded fixtures.
- Record redacted audit events; do not store unrelated personal data in prompts or logs.
- Keep the UI accessible, responsive, and clear about unsupported career sites.
- Use focused commits after each milestone.

## Hard rules

1. Never automate LinkedIn, Naukri, Indeed, or any site whose terms prohibit bots. Only supported company career pages and public ATS platforms are in scope. Show a clear unsupported-site warning.
2. Every submitted answer must come from the user's stored profile, answer bank, or selected resume. If the needed fact is missing or uncertain, stop and ask the user. Never invent experience.
3. Default to approval before final submission. Show a screenshot and every proposed field/answer in an editable review. Auto-submit is opt-in, threshold-limited, and supported-ATS-only if implemented.
4. Stop on login requirements, CAPTCHA, payment, bot protection, unknown required facts, or low-confidence field mapping. Mark “Needs user action”; never bypass protections.
5. Protect resumes and personal data: encrypt stored files at rest, scope queries by user ID, capture signup consent, redact logs, and implement export and deletion flows.
6. Enforce subscription limits server-side. Free plan: at most 3 saved companies and 10 applications per month. Never rely on client-side checks.
7. Validate inputs, rate-limit API routes, keep secrets out of source control, and honor site rate limits and terms.
8. Maintain tests for matching logic, fresher filtering, ATS adapters with recorded fixtures, and the approval flow. Add Playwright e2e coverage for critical user journeys.
