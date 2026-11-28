// Combat achievements: what a fight did, tick by tick, and which of its boss's
// tasks (WIKI: Combat Achievements) a kill completes.
//
// A boss lists its tasks in its descriptor (encounters/registry.js):
//
//   combatAchievements: {
//     observe(state, facts)   optional: called each tick with the encounter's
//                             snapshot state (getEncounterSnapshot().state);
//                             writes what its tasks need into `facts`
//     tasks: [{ id, name, tier, type, description, check(run, progress) }],
//   }
//
// `check` answers on a kill that counts: `run` is what this module kept of the
// fight (below), `progress` the player's kills of the boss, this one included
// ({ kills, streak }). A task whose `target(progress)` is given also shows how
// far along it is ({ current, of }).
//
// Only a clean kill counts, as one with a plugin or a cheat would not in the
// game: none with infinite health or infinite special attack, none where an
// encounter command was run or the boss's hitpoints were set, none taken over
// part-way. Each reason is kept in `run.assisted`. The other mechanics toggles
// are the account's unlocks (upgraded prayers, the prepot) and are allowed.
//
// The tracker reads the engine after each tick: its tick events, its
// `damageHistory` (each hit on the player, with the `source` its encounter
// gave it: "Lightning", "Fire", ...), the player and the outcome. It changes
// nothing in the engine but the three methods it wraps to see an aid used,
// so a fight runs and digests the same with it as without.
import { encounterRegistry } from "../encounters/registry.js";
import { newRun, observeTick, judgeKill, taskKey, newlyFailed, newlyAssisted, noteAid as noteRunAid } from "./runs.js";

export * from "./runs.js";

/** The combat achievements of a kind: { observe?, tasks }, or null. */
export function getCombatAchievements(kind) {
  if (!kind) return null;
  const descriptor = encounterRegistry.getDescriptorOfKindOrVariant(kind);
  return descriptor?.combatAchievements ?? null;
}

/**
 * A tracker for the application: `observe(engine, events)` after each tick
 * starts a run when a fight starts (its tick goes back, or the kind or the
 * engine changes) and, on a clean kill, counts it and hands the tasks it
 * completed to `onComplete(kind, tasks, tick)`. As the fight runs it hands
 * the tasks that can no longer be met to `onFail(kind, failures, tick)`
 * (runs.js, newlyFailed: { task, reason, repeat }) and the
 * aids that stop the kill counting to `onAssisted(reasons, tick)`, each
 * once a fight; `onRunStart(run)` as a fight starts. `store` keeps the
 * progress (store.js). `noteAid(reason)` marks the current run as assisted.
 */
export function createCombatAchievementsTracker({
  store,
  onComplete = () => {},
  onFail = () => {},
  onAssisted = () => {},
  onRunStart = () => {},
  onRunChange = () => {},
}) {
  let run = null;
  let engineSeen = null;
  let streak = { kind: null, count: 0 }; // clean kills in a row of one boss, without leaving it
  const wrapped = new WeakSet();

  function tellAids() {
    const reasons = newlyAssisted(run);
    if (reasons.length) onAssisted(reasons, run.lastTick);
  }

  const noteAid = (reason) => {
    if (run && !run.ended) {
      noteRunAid(run, reason);
      if (getCombatAchievements(run.kind)) tellAids();
      onRunChange(run);
    }
  };

  // The engine's own aids: a command, the boss's hitpoints set.
  function watch(engine) {
    if (wrapped.has(engine)) return;
    wrapped.add(engine);
    for (const [method, reason] of [["executeEncounterCommand", "an encounter command"], ["setBossHp", "boss hitpoints set"], ["applyBossHpPreset", "boss hitpoints set"]]) {
      const original = engine[method];
      if (typeof original !== "function") continue;
      engine[method] = function (...args) {
        noteAid(reason);
        return original.apply(this, args);
      };
    }
  }

  function observe(engine, events = []) {
    if (!engine) return;
    const kind = engine.getEncounterKind?.();
    const achievements = getCombatAchievements(kind);
    const tick = engine.getState().currentTick;
    watch(engine);
    if (!run || engine !== engineSeen || kind !== run.kind || tick <= run.lastTick) {
      if (kind !== streak.kind) streak = { kind, count: 0 };
      engineSeen = engine;
      run = newRun(kind, Math.max(0, tick - 1)); // the tick before the first seen: the fight's start
      // A fight taken over part-way (a replay's Take over) does not count.
      if (tick > 1) noteRunAid(run, "started part-way");
      onRunStart(run);
    }
    const before = run.ended;
    observeTick(run, engine, events, achievements);
    // Every fight that ends, of any boss, counted or not: a kill or a death, once a fight.
    if (!before && run.ended) store.recordFight(kind, run.ended);
    if (!achievements) return;
    if (before) {
      onRunChange(run);
      return;
    }
    tellAids();
    const failures = newlyFailed(run, achievements, store.completedKeys());
    if (failures.length) onFail(kind, failures, tick);
    if (!run.ended || run.ended === "death" || run.assisted.size > 0) {
      if (run.ended === "death") streak.count = 0;
      onRunChange(run);
      return;
    }
    streak.count++;
    const kills = store.recordKill(kind);
    run.progress = { kills, streak: streak.count };
    const done = judgeKill(run, achievements, run.progress, store.completedKeys());
    if (done.length) {
      store.complete(done.map((task) => taskKey(kind, task)));
      onComplete(kind, done, tick);
    }
    onRunChange(run);
  }

  return { observe, noteAid, currentRun: () => run, streak: () => streak.count };
}
