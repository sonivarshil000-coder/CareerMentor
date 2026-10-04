# ApplyDesk

ApplyDesk helps candidates organize role-specific resumes, discover entry-level opportunities on company career sites, and prepare application forms for review. The default workflow never submits until the user approves the completed application.

## Local setup

Requirements: Node.js 24, npm, and Docker Desktop with Compose.

1. Copy `.env.example` to `.env`. Generate `AUTH_SECRET` and `FILE_ENCRYPTION_KEY` with `openssl rand -base64 32`; configure OAuth/email credentials before using authenticated features.
2. Start PostgreSQL, Redis, and MinIO:

   ```sh
   docker compose up -d
   ```

3. Install dependencies and create the database schema:

   ```sh
   npm ci
   npm run db:generate
   npm run db:migrate
   ```

4. Start the web app in one terminal and the worker in another:

   ```sh
   npm run dev
   npm run worker
   ```

The web app runs at `http://localhost:3000`; MinIO's local console runs at `http://localhost:9001`. The credentials in Compose are for local development only.

## Checks

```sh
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run build
```

See `PLAN.md` for architecture, milestones, risks, and release decisions. See `DEPLOY.md` for production deployment once the deployment milestone is complete. See `CLAUDE.md` and the Next.js generated `AGENTS.md` for repository conventions.

## Security and scope

Only supported public ATS APIs and permitted company career pages may be used. The app does not automate LinkedIn, Naukri, Indeed, CAPTCHA challenges, login walls, or sites that prohibit bots. Missing facts and uncertain field mappings pause the application for user input. Resume files and application data are private user data; configure encryption keys and access controls before using real records.
