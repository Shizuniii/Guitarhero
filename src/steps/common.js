import { useEffect } from '../../vendor/htm-preact.js';
import { settings } from '../lib/state.js';
import { resetTimer, setTimerDuration, toggleTimer } from '../lib/timer.js';
import { setHotkeys } from '../lib/ui-state.js';

export function useStepTimer(seconds, extraKeys) {
  const duration = seconds || settings.get().timerSeconds;
  useEffect(() => {
    resetTimer();
    setTimerDuration(duration);
    return () => resetTimer();
  }, [duration]);
  useEffect(() => {
    setHotkeys({ ' ': toggleTimer, ...(extraKeys || {}) });
    return () => setHotkeys({});
  });
}
