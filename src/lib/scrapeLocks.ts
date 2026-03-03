type LockEntry = {
  expiresAt: number;
};

const creatorLocks = new Map<string, LockEntry>();

function cleanupExpiredLocks(now: number) {
  for (const [key, lock] of creatorLocks.entries()) {
    if (now >= lock.expiresAt) {
      creatorLocks.delete(key);
    }
  }
}

export function acquireCreatorScrapeLock(lockKey: string, ttlMs = 5 * 60_000): boolean {
  const now = Date.now();
  cleanupExpiredLocks(now);
  const active = creatorLocks.get(lockKey);
  if (active && now < active.expiresAt) return false;
  creatorLocks.set(lockKey, { expiresAt: now + ttlMs });
  return true;
}

export function releaseCreatorScrapeLock(lockKey: string) {
  creatorLocks.delete(lockKey);
}
