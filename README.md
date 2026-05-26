<p align="center">
  <img src="docs/brand/scrubbed-banner-animated.svg" alt="scrubbed — self-hosted privacy" width="480"/>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg" alt="License: MIT"/></a>
  <img src="https://img.shields.io/badge/Node.js-20-green.svg" alt="Node.js"/>
  <img src="https://img.shields.io/badge/TypeScript-5-blue.svg" alt="TypeScript"/>
  <img src="https://img.shields.io/badge/Docker-Compose-blue.svg" alt="Docker"/>
</p>

---

## What is Scrubbed?

Your name, address, phone number, and date of birth are being sold on hundreds of people-search websites. Removing yourself requires visiting each site individually, finding your profile, submitting an opt-out form, and confirming via email. For most people this takes days and needs to be repeated every few months as the data reappears.

Scrubbed automates the entire process. You enter your information once and the engine searches each data broker for your profile, submits opt-out requests on your behalf, handles email confirmations automatically, and reschedules future sweeps so your data stays removed. Everything runs on your own infrastructure and your data never touches a third-party server.

---

## Goals

- **Full automation** - zero manual steps for the most common opt-out flows
- **Self-hosted** - runs entirely on your own machine or server via Docker
- **Transparent** - live dashboard showing exactly what the system is doing and what it found
- **Extensible** - brokers are defined in plain YAML, making it easy to add new ones without touching code
- **Durable** - scheduled re-runs ensure data that reappears gets removed again automatically

---

## Architecture

Scrubbed is a monorepo with three Docker services and an optional CLI:

```
┌─────────────────────────────────────────────────────────┐
│  Dashboard (React + Nginx)          :3000                │
│  Visual status, live logs, profile management           │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP (proxied)
┌────────────────────▼────────────────────────────────────┐
│  API (Express + SQLite)             :3001                │
│  Profile, brokers, runs, results, real-time logs        │
└────────────────────┬────────────────────────────────────┘
                     │ HTTP
┌────────────────────▼────────────────────────────────────┐
│  Runner (Playwright + xvfb)                             │
│  Browser automation, email listener, cron scheduler     │
└─────────────────────────────────────────────────────────┘

  CLI (Node.js)  -  talks to API at localhost:3001
  Terminal UI with live logs, broker status, scan control
```

| Package | Stack |
|---|---|
| `packages/api` | Node.js 20, TypeScript, Express, SQLite (WAL), Zod |
| `packages/runner` | Playwright 1.49, Playwright-Extra Stealth, imapflow, node-cron, xvfb |
| `packages/dashboard` | React 18, Vite, Tailwind CSS, React Router v6 |
| `packages/cli` | Node.js, TypeScript, Commander.js, Blessed |
| `packages/broker-definitions` | YAML broker configs |

---

## How It Works

1. **Profile setup** - enter your name, email, addresses, phone, date of birth, and any aliases
2. **Start a scan** - triggers a queued run that the runner picks up within 10 seconds
3. **Scout phase** - for each broker, Playwright searches the site to find your profile URL
4. **Scrub phase** - navigates to the opt-out flow and executes broker-specific steps (form fills, button clicks, navigation)
5. **Email confirmation** - IMAP listener polls your inbox, finds verification emails, and auto-clicks confirmation links
6. **Live feedback** - logs stream in real time, status updates every 3 seconds
7. **Reschedule** - cron job re-runs the full sweep automatically on your configured schedule

---

## Interfaces

### Web Dashboard

Start the dashboard and API:

```bash
docker compose up api dashboard
```

Open [http://localhost:3000](http://localhost:3000) to manage your profile, view broker status, and monitor scans.

### CLI

The CLI connects to the running API and provides a terminal UI as well as individual commands for scripting.

**Install:**

```bash
cd packages/cli
npm install
npm run build
sudo npm link
```

**Open the terminal UI:**

```bash
scrubbed
```

The TUI shows live logs, broker status, run progress, and discovered profile URLs. Navigate brokers with arrow keys and press Enter to open a discovered URL in your browser.

**Key bindings:**

| Key | Action |
|---|---|
| `s` | Start a new scan |
| `r` | Refresh all data |
| `tab` | Focus log panel |
| `esc` | Unfocus / back to brokers |
| `enter` | Open selected broker URL in browser |
| `q` | Quit |

**Individual commands:**

```bash
scrubbed status                     # overview of profile and latest run
scrubbed profile show               # display current profile
scrubbed profile setup              # interactive profile setup
scrubbed scan start                 # queue a new scan
scrubbed scan watch                 # start scan and stream logs until done
scrubbed scan status                # show latest run progress
scrubbed scan status --id <runId>   # specific run
scrubbed scan results <runId>       # per-broker results table
scrubbed brokers                    # list all brokers with status
scrubbed logs                       # show recent logs
scrubbed logs --follow              # tail logs live
scrubbed discovered                 # list discovered profile URLs
```

Point the CLI at a remote API with `SCRUBBED_API_URL=http://your-server:3001 scrubbed`.

---

## Current Status

### Completed

- [x] Full profile management (name, aliases, address history, DOB, phone)
- [x] Broker definition system (YAML-based, schema-validated)
- [x] Automated profile discovery (search-result parsing per broker)
- [x] Opt-out form automation (click, fill, navigate, verify)
- [x] Email confirmation auto-handling via IMAP
- [x] Stealth browser (xvfb + Playwright-Extra, randomized user agents, human-like delays)
- [x] Screenshot capture on failures for debugging
- [x] Per-broker error recording for failed runs
- [x] Real-time log streaming to dashboard and CLI
- [x] Scheduled re-runs via cron
- [x] SQLite WAL database with full run and result history
- [x] Web dashboard (run progress, broker status, exposure tracker, logs)
- [x] Terminal UI with live logs, broker navigation, and in-browser URL opening
- [x] Docker Compose deployment (API + Runner + Dashboard)
- [x] 12 broker definitions: Whitepages, Spokeo, BeenVerified, CheckPeople, ClustrMaps, Intelius, MyLife, Nuwber, PublicDataUSA, Radaris, SmartBackgroundChecks, ThatsThem

### In Progress / Challenges

| Area | Status | Notes |
|---|---|---|
| CAPTCHA solving | In progress | Detection works; 2captcha/capsolver integration pending |
| Database encryption | Planned | `MASTER_PASSWORD` env var defined; encryption not yet wired |
| Manual queue UI | Planned | DB table exists; API routes and dashboard view not built |
| Broker coverage | Ongoing | 12 brokers live; more added via YAML |
| ID verification flows | Planned | Some brokers require government ID upload; will route to manual queue |
| Re-verification workflow | Planned | Schema fields in place; full recheck loop in progress |

---

## Getting Started

### Prerequisites

- [Docker](https://docs.docker.com/get-docker/) and [Docker Compose](https://docs.docker.com/compose/)
- Node.js 20+ (CLI only)

### Setup

```bash
git clone https://github.com/your-org/scrubbed.git
cd scrubbed
cp .env.example .env
# Edit .env with your MASTER_PASSWORD and optional SCHEDULE_CRON
docker compose up --build
```

Open [http://localhost:3000](http://localhost:3000) and fill in your profile to get started.

### Environment Variables

| Variable | Default | Description |
|---|---|---|
| `MASTER_PASSWORD` | (none) | Required. At least 32 characters. Used for credential encryption. |
| `SCHEDULE_CRON` | `0 2 1 * *` | Cron expression for automatic re-runs (default: 2am on the 1st). |
| `DB_PATH` | `/app/data/scrubbed.db` | Path to the SQLite database inside the API container. |
| `NODE_ENV` | `development` | Set to `production` for production deployments. |

---

## Adding a Broker

Brokers are defined in `packages/broker-definitions/` as YAML files. No code changes required. See an existing broker file for the full schema, which covers search URL patterns, opt-out steps, result-list selectors, email confirmation requirements, and success indicators.

---

## Roadmap

- [ ] CAPTCHA solving (2captcha / capsolver integration)
- [ ] At-rest encryption for stored credentials
- [ ] Manual queue dashboard view
- [ ] Expanded broker coverage (targeting 50+ brokers)
- [ ] Multi-profile support
- [ ] Public hosted version (SaaS)

---

## Team

| Role | Name |
|---|---|
| Founder | Muzamil |
| Co-Founder | Aden Brady |

---

## License

MIT
