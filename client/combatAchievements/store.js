// The player's combat achievements, kept in this browser (localStorage): the
// tasks completed, when, the clean kills of each boss, and the settings. There are no
// accounts, so another browser starts from nothing. Storage that is missing
// or refuses (a private window, blocked site data) leaves the progress in
// memory for the visit.
const storageKey = "openscim.combatAchievements.v1";

// The settings, the game's two of failures (WIKI: Settings, Chat, Game Chat): `failureMessages`,
// "Combat Achievements Tasks - Failure", a line in the chat as a task fails; `repeatFailureMessages`,
// "Combat Achievements Tasks - Repeat failure", the same for a task completed before. inferred: the
// wiki gives no defaults; the first is on, as it was asked for, the second off.
export const defaultSettings = { failureMessages: true, repeatFailureMessages: false };

const empty = () => ({ completed: {}, kills: {}, settings: { ...defaultSettings } });

function read(storage) {
  try {
    const parsed = JSON.parse(storage?.getItem(storageKey) ?? "null");
    if (parsed && typeof parsed === "object") return { completed: { ...parsed.completed }, kills: { ...parsed.kills }, settings: { ...defaultSettings, ...parsed.settings } };
  } catch {
    // unreadable: start again
  }
  return empty();
}

/** A store over `storage` (window.localStorage in the client). */
export function createCombatAchievementsStore(storage = globalThis.localStorage) {
  let state = read(storage);
  const listeners = new Set();
  const save = () => {
    try {
      storage?.setItem(storageKey, JSON.stringify(state));
    } catch {
      // kept in memory only
    }
    for (const listener of [...listeners]) listener(state);
  };
  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    completedKeys: () => new Set(Object.keys(state.completed)),
    /** Counts a clean kill of `kind`; the kills it has now. */
    recordKill(kind) {
      state = { ...state, kills: { ...state.kills, [kind]: (state.kills[kind] ?? 0) + 1 } };
      save();
      return state.kills[kind];
    },
    complete(keys) {
      const at = new Date().toISOString();
      state = { ...state, completed: { ...state.completed, ...Object.fromEntries(keys.map((key) => [key, at])) } };
      save();
    },
    setSetting(key, value) {
      state = { ...state, settings: { ...state.settings, [key]: value } };
      save();
    },
    /** Forgets everything but the settings, or one boss's tasks and kills. */
    reset(kind) {
      state = kind
        ? {
            completed: Object.fromEntries(Object.entries(state.completed).filter(([key]) => !key.startsWith(kind + ":"))),
            kills: Object.fromEntries(Object.entries(state.kills).filter(([key]) => key !== kind)),
            settings: state.settings,
          }
        : { ...empty(), settings: state.settings };
      save();
    },
  };
}
