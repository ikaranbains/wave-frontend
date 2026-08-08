'use client';

import { useEffect, useState } from 'react';

export function useLoginCooldown() {
  const [cooldownEndsAt, setCooldownEndsAt] = useState(0);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  useEffect(() => {
    if (!cooldownEndsAt) return undefined;

    const updateRemaining = () => {
      const remaining = Math.max(0, Math.ceil((cooldownEndsAt - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining === 0) setCooldownEndsAt(0);
    };
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [cooldownEndsAt]);

  const startCooldown = (seconds = 2) => {
    const duration = Math.max(1, Number(seconds) || 2);
    setRemainingSeconds(duration);
    setCooldownEndsAt(Date.now() + duration * 1000);
  };

  return {
    remainingSeconds,
    isCoolingDown: remainingSeconds > 0,
    startCooldown,
  };
}
