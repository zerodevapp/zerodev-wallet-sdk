// Tabs of one origin share the key vault and session storage but not the
// in-process key-transition queue in createZeroDevWalletCore. A Web Lock spans
// tabs. It covers a whole refresh, so every tab's timer firing at the same
// instant sends one stamp login (Turnkey fails concurrent ones for a sub-org,
// DPL-798), and every write of the shared vault and session, including the
// stamper's first key on an empty vault, so one tab cannot overwrite another's
// key or consume its transition journal. It never spans a passkey prompt or
// OAuth popup: an abandoned prompt would block every other tab. It is not
// re-entrant, so code running under it must not take it again. Without Web
// Locks (React Native, very old browsers) there is one instance per app or the
// in-process queue is all we have.
export const KEY_TRANSITION_LOCK = '@zerodev/key_transition'

export const withCrossTabLock = async <T>(
  task: () => Promise<T>,
): Promise<T> => {
  const locks = typeof navigator === 'undefined' ? undefined : navigator.locks
  return locks ? await locks.request(KEY_TRANSITION_LOCK, task) : task()
}
