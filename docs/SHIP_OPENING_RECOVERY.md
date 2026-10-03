# Deck-opening migration review and recovery

This is preparation, not authorization to apply SQL or publish the dependent UI.
The reviewed artifact is `sql/20261002200613_ship_deck_openings.sql`.
No live migration, recovery, export, backup setting, account or grant change was
performed during this hardening task. The independent connector must review the
exact committed bytes and obtain informed approval before applying them.

## Authorized rollout record — 2026-10-03

Following explicit approval, the exact reviewed SQL from commit
`9488cba984c1ffba0027f206debd4293560e2929` was applied to BasementOS as migration
`20261003165826_ship_deck_openings`. SHA-256:
`65f4c7ed8171db9e2c372caf438b8370562b3c7dd3bc4b541b2c15fcfaf1c73c`.
The preparation-only statements above describe the earlier hardening phase.

Live post-apply checks matched all five function body hashes to source, preserved
function permissions/security modes and confirmed all four existing plans still
validate. Before/after fingerprints matched for all four ships, four private-note
rows and empty draft/submission/review-history tables. Bounded transaction-scoped
checks verified existing-profile ship/private-note read boundaries, missing-profile
workflow denial, anonymous helper denial, legacy numeric validation, old-client
aperture preservation and invalid aperture rejection; no campaign records were
written. Backup/PITR and production load/restore uncertainty remain unchanged.

## Scope and compatibility

The two SECURITY INVOKER opening helpers now bound their own input, including
when authenticated pending users invoke them directly. They read only their
arguments; bounded calls remain allowed without granting campaign access.
Anonymous EXECUTE remains explicitly revoked, including inherited default grants.
The merge helper validates proposed/result geometry and bounds both argument
structures. Prior geometry is not revalidated: explicit repairs remain possible,
while invalid copied aperture metadata still fails result validation. Only the trigger's exact
`{"decks":[]}` empty-prior sentinel bypasses prior-plan validation.

Limits: 2,000,000 bytes per JSONB text document, 1–20 decks, 2,000 parts,
200 connections, 500 rooms and 2,000 marks per deck. Graph IDs must be nonempty,
at most 100 characters and unique within each traversed collection; referenced
decks must exist. Deck dimensions, room geometry and endpoint coordinates are
bounded before traversal. Legacy integer formats use the same integer parser as the predecessor, including
leading zeros, signs and whitespace; there is no new numeric-text length ceiling.
Document bytes bound parser input. Regression tests save predecessor-created ships
and drafts unchanged, then repair their dimensions after migration.

Floor coverage is built once per used deck, deduplicating identical room rectangles.
Before expansion, a global budget permits at most **100,000 distinct room-column
intervals across all decks used by physical apertures**. Above-budget plans fail
with an explicit error; prior-only over-budget geometry cannot block a repaired
proposed plan. Legacy plans without apertures use no coverage budget. At most
40,000 opening-column containment checks then use cached floor unions, and deck
indexes/geometry are cached rather than repeatedly scanning full room documents.
This supports normal 20-deck ships and 200 openings without multiplying room scans
by opening count. Dense custom layouts may need fewer distinct room rectangles;
this is a deliberate resource limit, not a new simulation rule.

The committed tests exercise the formerly slow overlapping-room fixture, the
exact 100,000-interval boundary, 100,001 rejection, a dense 20-deck fixture and a
normal 20-deck plan. Local timings are regression evidence, not production latency
promises. This is not a rate limiter or a guarantee against concurrent saturation.

No table, RLS policy or stored row is changed. The three existing save/validation
functions retain their published opening integration; this revision changes only
the two new helpers. Their original ownership, security mode, search path and
ACLs are asserted locally. Applying the migration again does not change ship,
GM-note, draft, submission or review-event rows.

## Recovery after openings have been saved

1. Stop publishing the new opening UI; retain the database's aperture-compatible
   validators and merge helpers. The known earlier UI source is commit
   `478cf6b81261507865cdedf703e6858bac9544e0`; selecting a deployment is a separate
   operational action, not part of this preparation.
2. Do not drop these helpers or restore the pre-opening validator once any draft,
   submission or playable ship has an aperture. That validator rejects aperture
   plans. Do not strip aperture JSON, delete ladder parts or rewrite frozen
   submissions to make a downgrade pass.
3. Earlier clients that omit aperture metadata preserve it by connection ID.
   Tested: old-format draft saves preserve exact opening data; accepted playable
   rows and frozen submission records stay unchanged. Old-format GM saves also
   preserve opening metadata. Earlier clients cannot render/edit the new physical
   opening controls. Structural edits that invalidate preserved openings are
   rejected atomically; users should leave those designs unchanged until a fix.
   Explicit connection deletion remains an intentional edit, not a rollback tool.
4. If the SQL itself needs repair, prepare a reviewed forward correction retaining
   the aperture format and merge semantics. Test it against saved apertures and
   immutable accepted snapshots before applying. No universal untested forward
   patch is offered here. If validation blocks edits, preserve the records while
   preparing the correction; do not bypass RLS or the versioned acceptance guard.
5. If initial migration execution fails, its transaction must be rolled back.
   An injected-failure test confirms original function bodies, security settings
   and ACLs are restored and new helper creation is undone. After a successful
   commit, UI rollback is the primary tested recovery, not a data downgrade.

## Verification

Run `node scripts/test-ship-openings-hardening.mjs`. It uses in-memory PostgreSQL
and dummy identities only. Coverage includes direct approved/pending helper calls,
invalid roots/collections/IDs/geometry, input and merged-output byte ceilings,
collection ceilings, combined coverage budgets, legacy numeric repair, room-floor unions/gaps, anonymous denial despite explicit
anon default grants, pending save denial, stale/immutable workflow records,
failed-migration rollback, repeat application and old-client recovery.

These are SQL-level local tests, not live PostgREST transport/load tests or a
production restore rehearsal. The dependent opening UI stays unpublished.

## Backup and deployment prerequisites

Read-only project metadata on 2026-10-02 reports BasementOS
`uonpiqyugwdtarwidhqf` ACTIVE_HEALTHY, PostgreSQL 17.6.1.063. The migration ledger
ends with `ship_surface_design`; no deck-opening migration is recorded.
A later read-only aggregate check found four stored plans/six decks, none with
deck-dimension text above the removed 12-character limit; the opening helper was
still absent. This is a narrow compatibility observation, not a full production
plan/resource audit. The exposed project metadata contains no backup/PITR history, and the available
connector tools have no backup-list operation. No authorized Management API token
or dashboard backup session was available in this execution environment.
Therefore backup age, retention, latest usable restore point and restore success
are **unverified**, not assumed from project health. No backup/export was created.

Before informed approval, an authorized operator should inspect Database > Backups
and any PITR recovery window in the existing Supabase dashboard, report the actual
restore points and establish an acceptable recovery plan. Do not create tokens,
change backup settings or restore production merely to complete this checklist.
[Supabase backup documentation](https://supabase.com/docs/guides/platform/backups)
explains availability and restore downtime. A full restore may discard campaign
changes after its restore point; it is not the preferred opening-feature rollback.

Live review must compare the committed migration hash, confirm the expected
predecessor function definitions/ACLs and current plan compatibility, and assess
operational resource limits. Local passes cannot establish that a live migration
is “absolutely safe.” Keep UI activation blocked until the migration is approved,
applied and independently verified.
