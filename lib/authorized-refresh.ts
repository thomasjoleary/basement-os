// DELETE/TRUNCATE publication is disabled to prevent RLS-bypassing metadata.
// These callbacks use the normal authenticated API and its current permissions.
export function startAuthorizedRefresh(refresh: () => void | Promise<void>, intervalMs = 15000) {
  let stopped = false, running = false
  async function tick() {
    if (stopped || running || document.visibilityState !== 'visible') return
    running = true
    try { await refresh() } catch {
      // A failed background read leaves the current view intact; the next tick retries.
    } finally { running = false }
  }
  const timer = window.setInterval(() => { void tick() }, intervalMs)
  window.addEventListener('focus', tick)
  return () => { stopped = true; window.clearInterval(timer); window.removeEventListener('focus', tick) }
}
