# Giving Claude access to Supabase

`.mcp.json` in the repo root configures the official Supabase MCP server, so a
Claude Code session can read the schema, run migrations, check RLS behaviour and
query data directly — instead of handing you SQL to paste into the dashboard.

**It does nothing until you set two environment variables.** No secret lives in
this repo; `.mcp.json` only references variable names.

---

## Setup (once)

**1. Create a Supabase personal access token**

<https://supabase.com/dashboard/account/tokens> → *Generate new token*. Name it
something you will recognise later, e.g. `claude-code`. Copy it — Supabase shows
it only once.

**2. Find your project ref**

The subdomain of your Supabase URL: `https://<project-ref>.supabase.co`. Also in
the dashboard under *Project Settings → General → Reference ID*. This is not a
secret — it is in every request the app makes.

**3. Set both variables in your Claude Code environment**

In Claude Code on the web: environment settings → environment variables.

| Variable | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | the token from step 1 |
| `SUPABASE_PROJECT_REF` | the ref from step 2 |

**4. Start a new session.** MCP config and environment variables are read at
session start, so an already-running session will not pick this up.

To check it worked, ask Claude to list the `v2_` tables. If a variable is
missing, the server loads with the literal `${VAR}` text and reports a
missing-variable warning rather than failing silently.

---

## What this grants, honestly

**The token is account-wide.** Supabase personal access tokens are not
per-project. `--project-ref` in `.mcp.json` limits what *this server* will touch
to the basement-os project, but the token itself would reach any project in your
account if it were used elsewhere. If you later add Supabase projects that matter
more than a D&D campaign, that is worth remembering.

**Write access is real.** The config deliberately does not pass `--read-only`,
because the point is to let Claude run migrations. That means it can also drop
things. Adding `--read-only` to the `args` in `.mcp.json` turns it into a
read/inspect-only connection whenever you want that.

**Feature groups are scoped down.** The server supports
`docs, account, database, debugging, development, functions, branching, storage`.
This config enables only:

- `database` — schema, migrations, queries
- `debugging` — logs, and the security/performance advisors that catch things
  like a table left without RLS
- `docs` — Supabase's own documentation search

Deliberately excluded: **`account`** (can create and delete whole projects),
plus `branching`, `functions` and `storage`, none of which this project uses.

**Cloud sessions load it without prompting.** Claude Code prompts before using a
project `.mcp.json` in an interactive terminal, but in cloud sessions
(claude.ai/code) it cannot show that prompt and loads project-scoped servers
automatically. So once this is set up, any future web session on this repo has
database access without asking again.

**Prompt injection is the real risk, not typos.** A session with database write
access that also reads outside content — web pages, GitHub comments, issue text
— has a path from "untrusted text" to "wrote to your database". For a solo hobby
project the exposure is small, but it is the reason to prefer `--read-only` for
sessions that are mostly research.

**To revoke:** delete the token at
<https://supabase.com/dashboard/account/tokens>. It takes effect immediately and
nothing in this repo needs changing.

---

## If you would rather not

Nothing here is required. Without it, the workflow stays what it has been:
migrations land in `sql/` and you paste them into the Supabase SQL editor. The
cost is that Claude cannot verify RLS policies actually behave correctly against
your real database — it can only reason about the SQL.
