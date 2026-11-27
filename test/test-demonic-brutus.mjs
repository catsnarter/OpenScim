// Demonic Brutus's rules as the wiki and the video of a kill (OBS) have them, asserted on the determinism harness's
// scenarios (tools/determinism/scenarios/brutus-demonic.mjs). Their digests say that nothing changed; this says what it is.
import assert from "node:assert/strict";
import { runScenario } from "../tools/determinism/harness.mjs";
import { scenarios } from "../tools/determinism/scenarios/brutus-demonic.mjs";

// Each tick: his hitpoints and phase, the special running, the ghosts there, and the hits on the player.
async function ticksOf(name) {
  const ticks = [];
  await runScenario(scenarios.find((scenario) => scenario.name === "brutus_demonic/" + name), {
    onTick(tick, engine) {
      const events = engine.getLastTickEvents();
      const boss = engine.worldState.getNpc("brutus");
      const state = engine.getEncounterSnapshot().state;
      const now = engine.currentTick;
      ticks[tick] = {
        hp: boss?.vitals.hp,
        phase: state.phase,
        special: state.special,
        ghosts: [...engine.worldState.actors.values()].filter((actor) => actor.npcTypeId === 15629).length,
        texts: events.filter((event) => event.type === "overhead_text").map((event) => event.overheadText),
        heals: events.filter((event) => event.type === "hitsplat_spawned" && event.hitsplatType === "heal").map((event) => event.amount),
        butts: events.filter((event) => event.type === "hit_applied" && event.targetId === "player" && event.attackKind === "melee_crush").map((event) => event.damage),
        bulls: engine.damageHistory.filter((hit) => hit.tick === now && /slam|charge/.test(hit.source)).map((hit) => hit.effectiveDamage),
        orbs: engine.damageHistory.filter((hit) => hit.tick === now && /orb/.test(hit.source)).map((hit) => ({ type: hit.attackType, damage: hit.effectiveDamage, prayed: hit.prayedCorrectly })),
        outcome: engine.getEncounterOutcome().phase,
      };
    },
  });
  return ticks;
}
const when = (ticks, test) => ticks.flatMap((tick, n) => (tick && test(tick) ? [n] : []));
const gaps = (list) => list.slice(1).map((value, n) => value - list[n]);
// Each special once: its snapshot a tick after he fades (as he reappears, with his ghosts and any orbs), and his
// hitpoints as he fades.
const specials = (ticks) =>
  when(ticks, (tick) => tick.special)
    .filter((n) => !ticks[n - 1]?.special || ticks[n - 1].special.fadedAt !== ticks[n].special.fadedAt)
    .map((n) => ({ ...(ticks[n + 1]?.special ?? ticks[n].special), hp: ticks[n].hp, phase: ticks[n].phase }));

{
  // The encounter's own helpers, loaded once the harness has run a scenario and installed its module hooks.
  await ticksOf("slams-only");
  const { chargeStart, chargeLane, slamCorner, specialStarts } = await import("../client/encounters/brutus/demonic.js");
  // A charge from the west: his 3 x 3 on the player's row, two tiles off him; its lane is the player's row and the
  // rows beside it, across him.
  const west = chargeStart("W", [20, 20]);
  assert.deepEqual(west, { corner: [15, 19], direction: "E" });
  const lane = chargeLane(west.corner, west.direction).lane;
  for (const tile of ["20,20", "20,19", "20,21", "15,20", "24,20"]) assert.ok(lane.has(tile), tile);
  for (const tile of ["20,22", "22,22", "18,18"]) assert.ok(!lane.has(tile), tile);
  // A slam from the south-west: his north-east tile diagonal to the player's.
  assert.deepEqual(slamCorner("SW", [20, 20]), [17, 17]);
  assert.deepEqual(slamCorner("NE", [20, 20]), [21, 21]);
  // Round the player: clockwise, or counterclockwise from 250 (WIKI; OBS SW NW NE SE at 547, SW SE NE NW at 216).
  assert.deepEqual(specialStarts("slam", "SW", true), ["SW", "NW", "NE", "SE"]);
  assert.deepEqual(specialStarts("slam", "SW", false), ["SW", "SE", "NE", "NW"]);
  assert.deepEqual(specialStarts("charge", "E", true), ["E", "S", "W", "N"]);
}

{
  // Standing still: three butts 5 ticks apart, through prayer and up to 4; then a special; then three more; the
  // specials in turn, charge and slam.
  const ticks = await ticksOf("standing");
  const butts = when(ticks, (tick) => tick.butts.length);
  assert.ok(butts.flatMap((n) => ticks[n].butts).every((damage) => damage <= 4), "his butts up to 4 (WIKI)");
  const list = specials(ticks);
  assert.ok(list.length >= 4, `${list.length} specials`);
  for (let n = 1; n < list.length; n++) assert.notEqual(list[n].name, list[n - 1].name, "charge and slam in turn");
  // Three butts before each special, the special 5 ticks after the third (OBS).
  for (const special of list) {
    const before = butts.filter((tick) => tick < special.fadedAt).slice(-3);
    assert.equal(before.length, 3);
    assert.deepEqual(gaps([...before, special.fadedAt]), [5, 5, 5], `butts ${before} before the fade at ${special.fadedAt}`);
    // Above 500 hitpoints, his first bull 5 ticks after he fades (OBS), and the four a tick apart, each 45 to 56 through prayer.
    assert.equal(special.firstBullAt, special.fadedAt + 5);
    const bulls = when(ticks, (tick) => tick.bulls.length).filter((tick) => tick >= special.firstBullAt && tick < special.firstBullAt + 4);
    assert.deepEqual(bulls, [0, 1, 2, 3].map((n) => special.firstBullAt + n));
    for (const tick of bulls) for (const damage of ticks[tick].bulls) assert.ok(damage >= 45 && damage <= 56, `bull ${damage}`);
    // Three ghosts with him, gone once their bulls are done.
    assert.equal(ticks[special.fadedAt + 1].ghosts, 3);
    assert.equal(ticks[special.firstBullAt + 6]?.ghosts ?? 0, 0);
  }
}

{
  // Each special stepped out of, two tiles from where the player stood: no bull lands.
  const ticks = await ticksOf("dodged");
  assert.ok(specials(ticks).length >= 4);
  assert.deepEqual(when(ticks, (tick) => tick.bulls.length), []);
}

{
  // The charge's switch off: every special a slam.
  const ticks = await ticksOf("slams-only");
  assert.ok(specials(ticks).every((special) => special.name === "slam"));
}

{
  // A kill with the guide's melee setup, dodging and praying against each orb.
  const ticks = await ticksOf("kill");
  const list = specials(ticks);
  // From 500 his first bull 3 ticks after the fade; from 250 the ghosts counterclockwise (WIKI, OBS).
  for (const special of list) {
    assert.equal(special.firstBullAt - special.fadedAt, special.hp > 500 ? 5 : 3, `fade at ${special.fadedAt}, ${special.hp} hitpoints`);
    assert.equal(special.clockwise, special.hp > 250, `fade at ${special.fadedAt}, ${special.hp} hitpoints`);
  }
  // At 0 in phase 1: "moo moo!" and a heal of 487; then phase 2 (WIKI, OBS).
  const change = when(ticks, (tick) => tick.texts.includes("moo moo!"));
  assert.equal(change.length, 1);
  assert.deepEqual(ticks[change[0]].heals, [487]);
  assert.equal(ticks[change[0]].hp, 487);
  assert.equal(ticks[change[0]].phase, 2);
  // Phase 2's specials have four orbs: magic, melee and ranged first (OBS), each landing with a bull, each stopped by
  // its protection prayer.
  const phaseTwo = list.filter((special) => special.phase === 2);
  assert.ok(phaseTwo.length >= 2);
  for (const special of phaseTwo) assert.deepEqual(special.orbs.slice(0, 3), ["magic", "melee", "ranged"]);
  const orbs = ticks.flatMap((tick) => tick?.orbs ?? []);
  assert.equal(orbs.length, phaseTwo.length * 4);
  assert.ok(orbs.every((orb) => orb.prayed && orb.damage === 0), "every orb prayed against");
  assert.ok(list.filter((special) => special.phase === 1).every((special) => special.orbs.length === 0), "no orbs in phase 1");
  // No bull lands on a player who dodges; his death and the victory.
  assert.deepEqual(when(ticks, (tick) => tick.bulls.length), []);
  assert.ok(when(ticks, (tick) => tick.texts.includes("m-moo...")).length === 1);
  assert.equal(ticks.at(-1).outcome, "victory");
}
console.log("Demonic Brutus: three butts and a special, four bulls a tick apart; faster from 500, counterclockwise from 250; 487 back at 0, then orbs to pray against.");
