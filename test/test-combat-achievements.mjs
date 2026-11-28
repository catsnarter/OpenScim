// Combat achievements (client/combatAchievements/): the tracker reads a fight
// tick by tick and judges a kill against its boss's tasks; the store keeps the
// progress. Run on the Alchemical Hydra's scenarios
// (tools/determinism/scenarios/alchemical-hydra.mjs), its tasks being the first
// written (client/encounters/alchemical-hydra/combatAchievements.js).
import assert from "node:assert/strict";
import { runScenario, loadEnvironment } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/alchemical-hydra.mjs";

await loadEnvironment(); // its module hooks resolve the client's web-root imports
const { createCombatAchievementsTracker, getCombatAchievements, judgeKill, ticksUnder, formatTicks, tierPoints, killTicks, runSummary } = await import(
  "../client/combatAchievements/tracker.js"
);
const { createCombatAchievementsStore } = await import("../client/combatAchievements/store.js");
const { mergeChatMessages, tellCompleted, tellFailed, getChatMessages, clearChat } = await import("../client/combatAchievements/chat.js");

const memoryStorage = () => {
  const items = new Map();
  return { getItem: (key) => items.get(key) ?? null, setItem: (key, value) => items.set(key, String(value)) };
};
const scenario = (name) => scenarios.find((s) => s.name === "alchemical-hydra/" + name);

// Runs a scenario with a tracker reading each tick; its last run, and the tasks it completed.
async function track(name, storage = memoryStorage()) {
  const store = createCombatAchievementsStore(storage);
  const completed = [];
  const failed = [];
  const aids = [];
  const tracker = createCombatAchievementsTracker({
    store,
    onComplete: (kind, tasks) => completed.push(...tasks.map((task) => task.id)),
    onFail: (kind, failures, tick) => failed.push(...failures.map(({ task, reason, repeat }) => [task.id, tick, reason, repeat])),
    onAssisted: (reasons, tick) => aids.push([reasons, tick]),
  });
  await runScenario(scenario(name), {
    onTick(tick, engine) {
      tracker.observe(engine, engine.getLastTickEvents());
    },
  });
  return { run: tracker.currentRun(), store, completed, failed, aids };
}

{
  // WIKI: Combat Achievements, its points; a speed task's "less than" as the most ticks under it.
  assert.deepEqual(tierPoints, { easy: 1, medium: 2, hard: 3, elite: 4, master: 5, grandmaster: 6 });
  assert.equal(ticksUnder(105), 174); // 174 ticks are 104.4 s, 175 are 105 s
  assert.equal(ticksUnder(80), 133); // 133 ticks are 79.8 s, 134 are 80.4 s
  assert.equal(formatTicks(174), "1:44.4");
}

{
  // The Hydra's twelve tasks, 61 points (WIKI: Combat Achievements/Tasks by boss).
  const { tasks } = getCombatAchievements("alchemical_hydra");
  assert.equal(tasks.length, 12);
  assert.equal(tasks.reduce((sum, task) => sum + tierPoints[task.tier], 0), 61);
  assert.equal(new Set(tasks.map((task) => task.id)).size, 12);
  assert.equal(getCombatAchievements("inferno"), null);
}

{
  // The whole fight: a kill, but with infinite health, so it does not count and completes nothing.
  const { run, store, completed, failed, aids } = await track("kill");
  assert.equal(run.ended, "kill");
  assert.deepEqual([...run.assisted], ["infinite health"]);
  assert.deepEqual(completed, []);
  assert.deepEqual(store.getState().kills, {});
  // What it kept of the fight: its time, the damage the player took, the hits its encounter named and the weapon.
  assert.ok(killTicks(run) > 0 && killTicks(run) === run.killTick - run.startTick);
  // Its script prays every attack and steps off every mechanic: 54 hits on the player, all blocked.
  assert.equal(run.damageTaken, 0);
  assert.equal(run.hits["Alchemical Hydra"].count, 54);
  assert.equal(run.hits["Alchemical Hydra"].damage, 0);
  assert.ok(run.weapons.has(20997)); // the twisted bow of its setup
  assert.ok(run.facts.flameWall, "the whole fight sees its flame special");
  // Judged as a clean kill, the same fight completes what it did without: each task's answer from what it kept.
  const clean = { ...run, assisted: new Set() };
  const done = judgeKill(clean, getCombatAchievements("alchemical_hydra"), { kills: 1, streak: 1 }, new Set()).map((task) => task.id);
  const expect = (id, answer) => assert.equal(done.includes(id), answer, id);
  expect("alcleanical_hydra", true);
  expect("the_flame_skipper", false);
  expect("lightning_lure", (run.hits.Lightning?.count ?? 0) === 0);
  expect("dont_flame_me", (run.hits.Fire?.count ?? 0) === 0);
  expect("unrequired_antipoisons", (run.hits["Poison pool"]?.count ?? 0) === 0);
  expect("mixing_correctly", !run.facts.empowered);
  expect("alchemical_speed_chaser", killTicks(run) <= 174);
  expect("no_pressure", false);
  expect("alchemical_veteran", false);
  expect("working_overtime", false);
  // As it ran: told once that it would not count, on its first tick (the harness shows tick 0); each task told failed once, the tick it could no
  // longer be met. The flame special on the tick its breath starts; the speed tasks on the first tick past their time.
  assert.deepEqual(aids, [[["infinite health"], 0]]);
  const failedAt = Object.fromEntries(failed.map(([id, tick]) => [id, tick]));
  const reasonOf = Object.fromEntries(failed.map(([id, , reason]) => [id, reason]));
  assert.ok(failed.every(([, , , repeat]) => repeat === false), "none completed before");
  assert.equal(reasonOf.the_flame_skipper, "The Alchemical Hydra spawned a flame wall attack.");
  assert.equal(reasonOf.no_pressure, "You used a weapon other than Dharok's greataxe.");
  assert.equal(reasonOf.alchemical_speed_runner, "You did not kill the Alchemical Hydra in time.");
  assert.equal(failed.length, Object.keys(failedAt).length);
  assert.equal(failedAt.alchemical_speed_runner, 134);
  assert.equal(failedAt.alchemical_speed_chaser, 175);
  assert.ok(failedAt.the_flame_skipper > 0);
  assert.equal(failedAt.no_pressure, 0, "the twisted bow and 99 hitpoints from the first tick");
  for (const id of ["alcleanical_hydra", "lightning_lure", "dont_flame_me", "unrequired_antipoisons", "alchemical_veteran", "alchemical_master", "working_overtime"]) {
    assert.equal(failedAt[id], undefined, id);
  }
  assert.equal(failedAt.mixing_correctly === undefined, !run.facts.empowered);
  // The victory screen's summary (runSummary). The kill did not count: said once, from the tick the aid was first
  // seen. The tasks chosen to go for, in the boss's order: one failed in the fight, with its reason and tick; the
  // others failed as the kill did not count.
  const hydra = getCombatAchievements("alchemical_hydra");
  const rowsOf = (summary) => summary.rows.map(({ task, status, reason, tick }) => [task.id, status, reason, tick]);
  const chosen = ["the_flame_skipper", "alcleanical_hydra", "alchemical_veteran"];
  const assisted = runSummary(run, hydra, chosen);
  assert.deepEqual(assisted.notCounted, { reasons: ["infinite health"], tick: 0 });
  assert.equal(assisted.chosen, true);
  assert.deepEqual(rowsOf(assisted), [
    ["alchemical_veteran", "failed", "The kill did not count.", 0],
    ["alcleanical_hydra", "failed", "The kill did not count.", 0],
    ["the_flame_skipper", "failed", "The Alchemical Hydra spawned a flame wall attack.", failedAt.the_flame_skipper],
  ]);
  // None chosen: every task the fight failed on its own, and none it did not.
  const all = runSummary(run, hydra, []);
  assert.equal(all.chosen, false);
  assert.deepEqual(all.rows.map((row) => row.status), failed.map(() => "failed"));
  assert.deepEqual(all.rows.map((row) => row.task.id).sort(), failed.map(([id]) => id).sort());
  // The same fight as a clean kill: completed on the kill's tick, or a kill count still short; with none chosen,
  // what it completed and what failed.
  const cleanRun = { ...run, assisted: new Set(), aids: {} };
  const cleanSummary = runSummary(cleanRun, hydra, chosen, { kills: 1, streak: 1 });
  assert.equal(cleanSummary.notCounted, null);
  assert.deepEqual(rowsOf(cleanSummary), [
    ["alchemical_veteran", "not completed", "1/75 so far.", undefined],
    ["alcleanical_hydra", "completed", undefined, run.killTick],
    ["the_flame_skipper", "failed", "The Alchemical Hydra spawned a flame wall attack.", failedAt.the_flame_skipper],
  ]);
  const cleanAll = runSummary(cleanRun, hydra, [], { kills: 1, streak: 1 });
  assert.ok(cleanAll.rows.some((row) => row.task.id === "alcleanical_hydra" && row.status === "completed"));
  assert.ok(!cleanAll.rows.some((row) => row.task.id === "alchemical_veteran"), "a kill count not reached is neither");
}

{
  // The vents scenario draws it over the green vent first: empowered, so Mixing Correctly would fail.
  const { run } = await track("vents");
  assert.equal(run.facts.empowered, true);
  assert.equal(run.ended, null);
}

{
  // The store: kills and tasks kept in storage, read back by a new store; a boss's own reset.
  const storage = memoryStorage();
  const store = createCombatAchievementsStore(storage);
  assert.equal(store.recordKill("alchemical_hydra"), 1);
  assert.equal(store.recordKill("alchemical_hydra"), 2);
  store.complete(["alchemical_hydra:lightning_lure"]);
  const again = createCombatAchievementsStore(storage);
  assert.equal(again.getState().kills.alchemical_hydra, 2);
  assert.ok(again.completedKeys().has("alchemical_hydra:lightning_lure"));
  // The tasks chosen to go for: kept, read back, and kept through a boss's reset.
  again.setSelected("alchemical_hydra", ["lightning_lure", "dont_flame_me", "lightning_lure"]);
  assert.deepEqual(createCombatAchievementsStore(storage).selectedFor("alchemical_hydra"), ["lightning_lure", "dont_flame_me"]);
  assert.deepEqual(again.selectedFor("vorkath"), []);
  again.reset("alchemical_hydra");
  assert.deepEqual(again.getState(), { completed: {}, kills: {}, selected: { alchemical_hydra: ["lightning_lure", "dont_flame_me"] }, settings: { failureMessages: true, repeatFailureMessages: false } });
  // Storage that refuses: the progress stays for the visit.
  const refusing = createCombatAchievementsStore({ getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } });
  assert.equal(refusing.recordKill("alchemical_hydra"), 1);
  // The setting: a failure in the chat, on unless turned off; kept, and kept through a reset.
  assert.equal(again.getState().settings.failureMessages, true);
  again.setSetting("failureMessages", false);
  again.reset();
  assert.equal(createCombatAchievementsStore(storage).getState().settings.failureMessages, false);
}

{
  // The chat: a line of the combat achievements after the fight's own lines of its tick.
  const line = (key, tick) => ({ key, tick });
  const merged = mergeChatMessages([line("a", 1), line("b", 5), line("c", 6)], [line("x", 5), line("y", 9)]);
  assert.deepEqual(merged.map((m) => m.key), ["a", "b", "x", "c", "y"]);
  const recorded = [line("a", 1)];
  assert.equal(mergeChatMessages(recorded, []), recorded);
  // The lines as the game words them (OBS, rsprox): the task's name in <col=0cc919>, the rest in the chat's colour;
  // tasks failed together for one reason named in one line.
  const text = (message) => message.segments.map(({ text, color }) => (color ? `<col=${color.slice(1)}>${text}</col>` : text)).join("");
  clearChat();
  const task = (name, tier) => ({ name, tier });
  tellCompleted(task("Lightning Lure", "master"), 7);
  tellCompleted(task("Alchemical Veteran", "elite"), 7);
  tellFailed([{ task: task("Lightning Lure"), reason: "You were hit by the lightning attack." }, { task: task("Alcleanical Hydra"), reason: "You took damage." }, { task: task("Speedy"), reason: "You took damage." }], 9);
  assert.deepEqual(getChatMessages().map(text), [
    "Congratulations, you've completed a master combat task: <col=0cc919>Lightning Lure</col> (5 points).",
    "Congratulations, you've completed an elite combat task: <col=0cc919>Alchemical Veteran</col> (4 points).",
    "You have failed <col=0cc919>Lightning Lure</col>: You were hit by the lightning attack.",
    "You have failed <col=0cc919>Alcleanical Hydra</col> / <col=0cc919>Speedy</col>: You took damage.",
  ]);
  clearChat();
}

{
  // A tracker on an engine: a clean kill counts and completes; a second kill of the same boss adds to the streak.
  // A fake engine, the least the tracker reads, its tick and outcome set by hand.
  let now = { tick: 1, phase: "active" };
  const engine = {
    getEncounterKind: () => "alchemical_hydra",
    getState: () => ({ currentTick: now.tick }),
    mechanicsConfig: {},
    damageHistory: [],
    player: () => ({ alive: true, equipment: { weapon: 4718 }, vitals: { hp: 10 } }),
    getEncounterSnapshot: () => ({ state: {} }),
    getEncounterOutcome: () => ({ phase: now.phase }),
    executeEncounterCommand: () => true,
  };
  const store = createCombatAchievementsStore(memoryStorage());
  const completed = [];
  const tracker = createCombatAchievementsTracker({ store, onComplete: (kind, tasks) => completed.push(...tasks.map((task) => task.id)) });
  tracker.observe(engine, []);
  now = { tick: 2, phase: "resolving" };
  tracker.observe(engine, []);
  assert.equal(store.getState().kills.alchemical_hydra, 1);
  // Two ticks, no damage, no mechanic, only Dharok's greataxe at 10 hitpoints: everything but the kill counts and the streak.
  assert.deepEqual(completed.sort(), [
    "alchemical_speed_chaser", "alchemical_speed_runner", "alcleanical_hydra", "dont_flame_me", "lightning_lure",
    "mixing_correctly", "no_pressure", "the_flame_skipper", "unrequired_antipoisons",
  ]);
  // A restart (the tick goes back) is a new run; an encounter command marks it, and its kill does not count.
  now = { tick: 1, phase: "active" };
  tracker.observe(engine, []);
  engine.executeEncounterCommand("anything");
  now = { tick: 2, phase: "resolving" };
  tracker.observe(engine, []);
  assert.deepEqual([...tracker.currentRun().assisted], ["an encounter command"]);
  assert.equal(store.getState().kills.alchemical_hydra, 1);
  assert.equal(tracker.streak(), 1);
}
