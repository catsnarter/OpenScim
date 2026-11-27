// The Mad Angel's foundation (client/encounters/mad-angel/), asserted on the
// determinism harness's scenarios (tools/determinism/scenarios/mad-angel.mjs)
// against the recorded kill (OBS, 2026-11-26) and the wiki: her waking, her
// standard attack every 6 ticks, three of them between her specials in the
// order blast, sweep, smite, each special's timing, the blast letting her
// standard attacks go on, her enrage at 350 and her death. The recording's
// ticks are one later than the harness's: it began a tick before the fight.
import assert from "node:assert/strict";
import { runScenario, loadEnvironment } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/mad-angel.mjs";

await loadEnvironment();
const BOSS = "mad-angel";

// Each tick: her animations, the projectiles and graphics, what she says, the hits on the player, her hitpoints and
// the snapshot.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "mad-angel/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const visuals = events.filter((event) => event.type === "inferno_visual");
      ticks[tick] = {
        clips: visuals.flatMap((event) => (event.animations ?? []).filter((a) => a.actorId === BOSS).map((a) => a.clipId)),
        projectiles: visuals.flatMap((event) => (event.projectiles ?? []).map((p) => p.spotAnimId)),
        graphics: visuals.flatMap((event) => (event.graphics ?? []).map((g) => g.spotAnimId)),
        said: events.filter((event) => event.type === "overhead_text").map((event) => event.overheadText),
        hits: events.filter((event) => event.type === "hit_applied" && event.targetId === "player").map((event) => event.damage),
        hp: engine.worldState.getNpc(BOSS)?.vitals.hp,
        state: engine.getEncounterSnapshot().state,
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  return ticks;
}
const ticksWith = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick) ? [n] : []));
const clipTicks = (ticks, clip) => ticksWith(ticks, (tick) => tick.clips.includes(clip));

{
  const ticks = await ticksOf("obligator-kill");
  // OBS: she wakes (spawn graphic 4010) and swings 4 ticks later, then every 6.
  assert.deepEqual(clipTicks(ticks, "wake"), [1]);
  assert.ok(ticks[1].graphics.includes(4010));
  const swings = clipTicks(ticks, "melee");
  assert.deepEqual(swings.slice(0, 3), [5, 11, 17]);
  // OBS: three standard attacks, then the blast; its ball leaves a tick after the throw and lands 5 ticks on, three times.
  assert.deepEqual(clipTicks(ticks, "blast")[0], 23);
  assert.deepEqual(ticksWith(ticks, (tick) => tick.projectiles.includes(4015)).slice(0, 3), [24, 30, 36]);
  assert.ok(ticks[24].graphics.includes(1448), "the shadow on the ball's tile");
  // OBS: her standard attacks go on through the blast and are not counted: three more after it, then the sweep.
  assert.deepEqual(swings.slice(3, 9), [29, 35, 41, 47, 53, 59]);
  assert.deepEqual(clipTicks(ticks, "sweep_left_draw").concat(clipTicks(ticks, "sweep_right_draw")), [65]);
  // OBS, WIKI: four cleaves 6 ticks apart, the last her reset; no standard attack while she sweeps.
  assert.equal(ticksWith(ticks, (tick) => tick.clips.some((clip) => /^sweep_(left|right)_(cleave|reset)$/.test(clip))).join(), "71,77,83,89");
  assert.ok(!swings.some((tick) => tick > 65 && tick <= 89));
  // Protect from Melee: what is left of a hit is up to 5 (WIKI: "from 31 to 5").
  assert.ok(ticks.every((tick) => !tick || tick.hits.every((damage) => damage <= 5)));
  // WIKI: at 350 she enrages at her next turn, "...!"; OBS: the blast 4 ticks after it, and the specials one after another.
  const enragedAt = ticksWith(ticks, (tick) => tick.said.includes("...!"));
  assert.equal(enragedAt.length, 1);
  assert.ok(ticks[enragedAt[0]].hp <= 350);
  assert.equal(clipTicks(ticks, "blast")[1], enragedAt[0] + 4);
  // OBS: enraged, the ball lands 4 ticks after it leaves, and the sweep's cleaves are 4 ticks apart.
  const enragedBalls = ticksWith(ticks, (tick) => tick.projectiles.includes(4015)).filter((tick) => tick > enragedAt[0]);
  assert.deepEqual(enragedBalls.slice(1).map((tick, n) => tick - enragedBalls[n]), [5, 5]);
  const enragedSweep = ticksWith(ticks, (tick) => tick.clips.some((clip) => /Enraged_cleave$/.test(clip)));
  assert.ok(enragedSweep.length >= 2 && enragedSweep.slice(1).every((tick, n) => tick - enragedSweep[n] === 4));
  // She dies, and the fight is won.
  assert.equal(ticks.at(-1).outcome, "victory");
}

{
  const ticks = await ticksOf("granite-hammer");
  // Unprayed, her standard attacks hit up to 31 (WIKI).
  const hits = ticks.flatMap((tick) => tick?.hits ?? []);
  assert.ok(hits.some((damage) => damage > 5) && hits.every((damage) => damage <= 31));
  // OBS: the smite after the sweep, its impact on the player 5 ticks in (smite graphic 4011, impact 4013).
  const smite = clipTicks(ticks, "smite")[0];
  assert.equal(smite, 113);
  assert.ok(ticks[smite].graphics.includes(4011));
  assert.ok(ticks[smite + 5].graphics.includes(4013));
}

{
  // Untouchable while she wakes; the snapshot says so.
  const ticks = await ticksOf("start");
  assert.equal(ticks[1].state.phase, "waking");
  assert.equal(ticks[4].state.phase, "fighting");
  assert.equal(ticks[4].state.nextSpecial, "blast");
}

console.log("The Mad Angel wakes, swings every 6 ticks, and runs her blast, sweep and smite in turn as recorded; she enrages at 350.");
