# Registration approval rollout

`sql/v2_007_registration_approval.sql` is reviewed/applied separately from the
application deployment. It never runs on startup. Existing profiles are approved
only on first application. All future profiles default pending, and a before-insert
trigger forces pending/player even if signup metadata attempts to override them.
The established player/GM roles retain their meaning.

The migration adds restrictive policies to all 22 reviewed campaign tables, a
separate own-row-or-approved profile policy, and restrictive Storage/Realtime
policies. Existing permissive policies still determine each approved user's access.
Profile table privileges are SELECT and UPDATE(username, avatar_url) only. The
GM-only approval RPC is the sole application approval write path. Pending users
cannot list requests or approve themselves. The request list shows account email
only to approved GMs.

The original battlefield RPC is moved into a private schema with client EXECUTE
revoked, behind an approval-checked public wrapper. Its original implementation is
preserved. The viewer-parameter helper and signup trigger also lose client EXECUTE.
The private predicates avoid recursive profile RLS; their search paths and all
public SECURITY DEFINER entry points are locked. Missing profiles fail closed.

The migration stops if the reviewed public relation inventory changes, a new
client-callable definer RPC appears, a public storage bucket exists, clients can
create public objects, or the expected publication is absent. Future public tables
must receive the approval policy before exposure. Future storage buckets must
remain private. Service/admin credentials continue to bypass RLS as intended.

## Realtime coordination

Postgres Changes DELETE does not enforce RLS. The migration therefore publishes
only INSERT/UPDATE, preserving those realtime updates. The companion UI uses
authorized periodic refetch for deletion refresh. No Supabase internal function is
changed. Battlefield pings move from public Broadcast to private channels governed
by `realtime.messages` policies. No Presence flow exists in this app.

After the companion UI is deployed, disable **Allow public access** in the project's
Realtime settings. All app channels must use private mode before that setting is
changed. Old open tabs should reload; old client bundles can still attempt public
ping broadcasts until public access is disabled. Do not claim the full registration
gate is active until migration, new UI and the Realtime setting are verified.

## Verification and rollback

`node scripts/test-registration.mjs` runs the exact migration against real isolated
PostgreSQL/PGlite. It tests anon, missing profile, pending player, approved player,
GM, metadata spoofing, protected column changes, upserts, campaign and storage
reads, both battlefield entry paths, private function isolation, approval persistence,
publication flags, restrictive coverage, rerun safety, preflight failure and rollback.
These SQL checks cover the database boundary used by REST/GraphQL but do not run
the deployed GraphQL or WebSocket servers. Connector review must verify those
protocol paths and live role memberships. No production test identities are needed.

Emergency rollback is `sql/rollback_v2_007_registration_approval.sql`, accompanied
by the previous UI and restored Realtime setting. It restores captured function
definitions/privileges, table grants and publication flags, then removes the gate.
Rollback reopens pre-approval access for pending accounts and requires explicit
review. It does not restore deleted accounts. The private rollback table contains
only schema/privilege definitions, not account data or credentials.
