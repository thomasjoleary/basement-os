# Ship design review

Approved users open `/v2/designs` from the Ships page to create private designs.
Only the author edits a draft; approved GMs can inspect and review it. Crew status
does not grant draft access. Existing playable ships keep their previous access.

Save before submitting. Submission freezes the exact plan and disables editing.
GMs can leave feedback, request changes, or accept the exact submitted revision.
The author can withdraw before editing, resubmit changes, and start a new revision
after acceptance. The previous accepted ship stays playable during this process.

Acceptance explicitly confirms owner and crew from approved profiles. Later
acceptances default to the current playable assignments for confirmation. The
review UI shows changes between the latest two submissions, actor-labelled events,
and read-only inspection of earlier frozen submissions. Private GM notes are never
loaded by design pages or copied into drafts/submissions/history.

Apply `sql/20261002175518_ship_design_review.sql` only after the separate access
approval and database review. New tables grant SELECT only; the guarded
`v2_design_action` RPC checks current approval, author/GM identity, state and exact
revision on every call. Creation is serialized per author (100 designs maximum).
Submitted snapshots are immutable through client APIs. Acceptance also locks and
checks the existing playable revision. An accepted ship cannot bypass review via
the legacy ship editor. Existing GM-note storage stays separate.

Limits: 500 submissions and 2,000 events per design, existing 2 MB plan limit,
10,000-character feedback. No workflow tables are added to Realtime publication.
Use Refresh review after another person's action; unsaved changes disable it.

`node scripts/test-ship-designs.mjs` runs isolated PostgreSQL permission,
concurrency/replay, old-client preservation and rollback checks. Browser tests
mock all writes. CI live smoke only reads the existing account's design list.

Rollback must preserve author work and review history. The automated rollback
test drops new objects only inside a transaction that is rolled back. Do not run
those destructive statements against live data. To pause authoring, a separately
reviewed revocation of the action RPC can retain all data and read access; full
removal requires a backup and an explicit decision about accepted-ship protection.
