const sequence = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];

export function isTextEntry(target: EventTarget | null) {
  return target instanceof Element && !!target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="combobox"]');
}

export function createKonami() {
  let keys: string[] = [], last = -Infinity;
  return {
    reset() { keys = []; last = -Infinity; },
    feed(key: string, now: number, eligible: boolean) {
      if (!eligible || now - last > 2400) keys = [];
      if (!eligible) { last = -Infinity; return false; }
      last = now;
      keys.push(key.toLowerCase());
      // Keep the longest valid prefix: ↑ ↑ ↑ ↓ ↓ … still has a valid last pair.
      while (keys.length && !keys.every((value, index) => value === sequence[index])) keys.shift();
      if (keys.length !== sequence.length) return false;
      keys = [];
      return true;
    },
  };
}
