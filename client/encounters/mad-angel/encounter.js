// The Mad Angel (https://oldschool.runescape.wiki/w/Mad_Angel), the
// post-quest golem in the nave of Ardeaglais, on Wyrmscraig.
//
// She wakes as the fight starts and walks after the player. Her standard
// attack is melee, every 6 ticks, up to 31; Protect from Melee leaves up to 5
// of it. After three standard attacks she does a special, in turn:
// - blast: a ball of light thrown to a tile; standing on the tile bounces it
//   back to her, three times; one that lands explodes over the whole nave.
//   Her standard attacks go on meanwhile.
// - sweep: she draws her sword to a side and cleaves, four times (six
//   enraged), the side the player is on and the side she drew from.
// - smite: lightning, once (three strikes enraged), for Protect from Magic.
// At 350 hitpoints she enrages ("...!"): her specials come quicker, and from
// then on one after another, the three of them first.
//
// This is the foundation: her waking, her walk, her standard attack, the
// order and the timing of her specials with every animation and graphic, the
// enrage and her death. What a special does to the player and to her (the
// ball's bounce and explosion, the cleaves' tiles, the smite's damage and its
// perfect prayer, the accurate and maximum hits they earn) is not yet here:
// the specials play and take their time, and hit nothing.
//
// Sources: WIKI Mad Angel and Mad Angel/Strategies; TABLE her stats
// (client/data/monsters.js, 16305); CACHE her ids (ids.js); OBS one kill
// recorded with the Encounter Recorder (2026-11-26, 248 ticks), which gives
// the ticks. Numbers no source gives are marked inferred.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, seqIds, spotAnims, mapSquare, bossSize, bossStart, playerStart } from "./ids.js";
import { madAngelLoadouts } from "./loadouts.js";

export const madAngelKind = "mad_angel";
export const madAngelMapSquare = mapSquare;
export const bossActorId = "mad-angel";

const wakeTick = 1; // inferred: she wakes on the fight's first tick (OBS: the wake 2 ticks into the recording, which began before it)
const awakeAfterTicks = 3; // OBS: 16307 on the wake's tick, 16305 three ticks later; inferred: untouchable till then
const firstAttackAfterTicks = 4; // OBS: the wake t2, her first swing t6
const attackSpeed = 6; // TABLE, WIKI, OBS: swings 6 ticks apart
const standardsBetweenSpecials = 3; // WIKI, OBS: three standard attacks after a special, then the next
const specialOrder = ["blast", "sweep", "smite"]; // OBS: blast t24, sweep t66, smite t114, and again (one kill)
const meleeMaxHit = 31; // WIKI: "will reduce the max hit of its standard attacks from 31 to 5"
const meleePrayedShare = 5 / 31; // WIKI; OBS: prayed hits of 0 to 5
const meleeImpactTicks = 2; // OBS: each hitsplat 2 ticks after her swing
const enrageHitpoints = 350; // WIKI: "Upon reaching 350 Hitpoints (~45%)"
const enrageToSpecialTicks = 4; // OBS: "...!" t144, her first enraged special t148
const deathTicks = 5; // inferred: her death animation t249, the recording stopped by hand at t256

// The specials' timing (OBS), in ticks from the special's start.
const blast = {
  releaseTicks: 1, // OBS: the ball leaves the tick after her throw (the animation t24, the projectile t25)
  flightTicks: 5, // OBS: it lands 150 cycles after it leaves
  flightTicksEnraged: 4, // OBS: 120 cycles
  throws: 3, // WIKI, OBS: bounced back three times
  rethrowTicks: 1, // OBS: thrown again, as a projectile alone, the tick after it lands (landed t30, thrown t31, landed t36)
  flight: { startHeight: 220, endHeight: 30, slope: 40 }, // OBS: the projectile's heights and slope
  back: { cycles: 30, startHeight: 30, endHeight: 220, slope: 17 }, // OBS: back to her in 30 cycles
};
const sweep = { cleaves: 4, cleavesEnraged: 6, everyTicks: 6, everyTicksEnraged: 4 }; // WIKI (4, 6), OBS: 6 and 4 ticks apart
const smite = { strikeTicks: 5, strikesEnraged: [5, 9, 11] }; // OBS: the impact on the player 5 ticks in; enraged 4 then 2 ticks apart
const nextTurnAfterSpecialTicks = { blast: 3, sweep: attackSpeed, smite: attackSpeed }; // OBS: sweep t90 -> t96, smite t120 -> t126; inferred blast (t158 -> t160, t223 -> t226)

const bossDefinition = defineNpc({
  id: "mad-angel",
  // OBS: she walks after the player, but stands while she sweeps and smites.
  move: ({ actor, context, config }) => (config.standsStill() ? [] : getNpcPursuitMoves(actor, context)),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});

const onTile = (spotAnimId, position, delayCycles = 0, height = 0) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height, delayCycles, onGround: true });
const onActor = (spotAnimId, actor, delayCycles = 0, height = 0) => ({ spotAnimId, target: buildActorVisualTarget(actor), height, delayCycles });
const centreOf = (position) => [position[0] + (bossSize >> 1), position[1] + (bossSize >> 1)];

class MadAngelEncounter {
  kind = madAngelKind;
  constructor() {
    this.definitions = new NpcDefinitionRegistry([bossDefinition].map((definition) => definition.register(this)));
    this.reset();
  }
  reset(seeds) {
    this.seed = seeds?.encounterSeed ?? Math.floor(Math.random() * 2 ** 32);
    this.random = createSeededRandom(this.seed);
    this.outcome = { phase: "active" };
    this.startRun();
  }
  startRun() {
    this.now = 0;
    this.tasks = [];
    this.phase = "waking"; // "waking" | "fighting" | "dead"
    this.nextAt = wakeTick + firstAttackAfterTicks;
    this.standards = 0; // standard attacks since the last special ended
    this.nextSpecial = 0; // its index in specialOrder
    this.special = null; // { name, startedAt, endsAt, ... }
    this.enraged = false;
    this.enrageAnnounced = false;
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  takeDueTask() {
    const index = this.tasks.findIndex((entry) => entry.tick <= this.now);
    return index < 0 ? null : this.tasks.splice(index, 1)[0];
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }
  animate(context, clipId, graphics = [], projectiles = []) {
    emitInfernoVisual(context.tickEvents, { animations: clipId ? [{ actorId: bossActorId, clipId, delayCycles: 0 }] : [], projectiles, graphics });
  }
  // She stands while she sweeps and smites (OBS), and while she wakes.
  standsStill() {
    return this.phase !== "fighting" || (this.special !== null && this.special.name !== "blast");
  }

  // --- what the engine always calls --------------------------------------------
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return {};
  }
  getDefaultPlayerStart() {
    return [...playerStart];
  }
  getIntroConfig() {
    return null;
  }
  getArenaConfig() {
    return { bounds: null, collisionMap: null, walkableTiles: null };
  }
  configureRunStart(mechanics, context) {
    this.random = createSeededRandom(this.seed);
    this.startRun();
    const boss = context?.world.actors.get(bossActorId);
    if (!boss) return;
    boss.position = [...bossStart];
    boss.previousPosition = [...bossStart];
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.madAngel); // TABLE: 755
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.madAngel, archetypeId: "mad_angel", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 0, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.madAngel)),
          combat: {
            attackSpeed, attackRange: 1, attackStyle: "melee", nextActionTick: Infinity, targetId: "player", lastAttackTick: null,
            animations: { idle: null, walk: null, run: null, attack: null, death: null },
          },
        },
        {},
      ),
    ];
  }

  // --- every tick ----------------------------------------------------------------
  resolveHazards(context) {
    this.now = context.tick;
    this.context = context;
    for (let due = this.takeDueTask(); due; due = this.takeDueTask()) due.task(context);
    return [];
  }
  processPostTick(context) {
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    return [];
  }

  // --- her turn ---------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (this.phase === "waking") {
      if (context.tick === wakeTick) this.animate(context, "wake", [onActor(spotAnims.wake, boss)]);
      if (context.tick >= wakeTick + awakeAfterTicks) this.phase = "fighting";
      if (this.phase === "waking") return none;
    }
    if (this.special && context.tick >= this.special.endsAt) this.endSpecial(context);
    if (context.tick < this.nextAt || !player.alive) return none;
    // The blast lets her standard attacks go on; the others hold them till they end.
    if (this.special && this.special.name !== "blast") return none;
    if (!this.special && !this.enraged && boss.vitals.hp <= enrageHitpoints) return this.enrage(boss, context);
    if (!this.special && (this.enraged || this.standards >= standardsBetweenSpecials)) {
      this.startSpecial(boss, player, context);
      return none;
    }
    this.nextAt = context.tick + attackSpeed;
    if (!this.special) this.standards++;
    return { environmentalDamages: [], npcAttacks: [this.melee(boss, player, context)] };
  }
  // WIKI: at 350 she enrages "at the next available opportunity", with "...!" over her head.
  enrage(boss, context) {
    this.enraged = true;
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: "...!", overheadCycle: 90 });
    this.nextAt = context.tick + enrageToSpecialTicks;
    this.nextSpecial = 0; // WIKI: all three of her specials, one after another, the blast first (OBS)
    return { environmentalDamages: [] };
  }
  melee(boss, player, context) {
    // inferred: slash, her sword; prayer counted as it lands (OBS: the hitsplat 2 ticks after the swing).
    const attack = rollNpcAttack({
      attacker: boss, target: player,
      plan: { formulaStyle: "melee_slash", damageType: "melee", attackKind: "melee_slash", maxHit: meleeMaxHit, impactDelayTicks: meleeImpactTicks, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for the Mad Angel");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "melee", kind: "mad_angel_melee", impactDelayTicks: meleeImpactTicks });
    return { ...attack, prayerReduction: { type: "reduce", value: meleePrayedShare } };
  }

  // --- her specials -------------------------------------------------------------------
  startSpecial(boss, player, context) {
    const name = specialOrder[this.nextSpecial];
    this.nextSpecial = (this.nextSpecial + 1) % specialOrder.length;
    this.standards = 0;
    if (name === "blast") this.startBlast(boss, player, context);
    else if (name === "sweep") this.startSweep(boss, player, context);
    else this.startSmite(boss, player, context);
    this.nextAt = name === "blast" ? context.tick + attackSpeed : this.special.endsAt;
  }
  // A special over: sweep and smite give her next turn 6 ticks on; the blast left her standard attacks going. Enraged,
  // her next turn is her next special.
  endSpecial(context) {
    const name = this.special.name;
    this.special = null;
    if (name !== "blast" || this.enraged) this.nextAt = Math.max(this.nextAt, context.tick + nextTurnAfterSpecialTicks[name]);
  }
  // A ball of light thrown to a tile, three times. inferred: the tile is the player's or one beside it (OBS: within 2 of him;
  // WIKI: since 19 August 2026 it can be his own). Not yet: the bounce, the explosion: all three throws go.
  startBlast(boss, player, context) {
    const flight = this.enraged ? blast.flightTicksEnraged : blast.flightTicks;
    // The landings: the first a release and a flight after her throw, each next a rethrow and a flight after the last.
    const landings = Array.from({ length: blast.throws }, (_, n) => blast.releaseTicks + flight + n * (blast.rethrowTicks + flight));
    this.special = { name: "blast", startedAt: context.tick, endsAt: context.tick + landings[landings.length - 1] + 1, throws: [] };
    this.animate(context, "blast", [onActor(spotAnims.blastThrow, boss)]);
    landings.forEach((landsAfter, n) => this.later(landsAfter - flight, (ctx) => this.releaseBall(ctx, flight, n)));
  }
  releaseBall(context, flight) {
    const boss = this.boss(context.world);
    const player = context.world.getPlayer();
    if (!boss?.alive || this.special?.name !== "blast") return;
    const tile = [player.position[0] + Math.floor(this.random() * 3) - 1, player.position[1] + Math.floor(this.random() * 3) - 1];
    const from = centreOf(boss.position);
    this.special.throws.push({ tile, landsAt: context.tick + flight });
    this.animate(
      context,
      null,
      [onTile(spotAnims.shadow, tile)],
      [{ spotAnimId: spotAnims.ball, sourcePosition: [from[0] + 0.5, from[1] + 0.5], target: { kind: "tile", position: [...tile] }, startDelayCycles: 0, endDelayCycles: flight * 30, slope: blast.flight.slope, startOffset: 0, startHeight: blast.flight.startHeight, endHeight: blast.flight.endHeight }],
    );
  }
  // She draws her sword to a side and cleaves. Not yet: which side the player is on, the tiles a cleave sweeps, its damage.
  startSweep(boss, player, context) {
    const cleaves = this.enraged ? sweep.cleavesEnraged : sweep.cleaves;
    const every = this.enraged ? sweep.everyTicksEnraged : sweep.everyTicks;
    const side = this.random() < 0.5 ? "left" : "right"; // inferred: the side she draws to
    const clips = this.enraged ? `${side}Enraged` : side;
    this.special = { name: "sweep", startedAt: context.tick, endsAt: context.tick + cleaves * every, side };
    this.animate(context, `sweep_${clips}_draw`);
    for (let n = 1; n <= cleaves; n++) {
      this.later(n * every, (ctx) => this.animate(ctx, n === cleaves ? `sweep_${side}_reset` : `sweep_${clips}_cleave`));
    }
  }
  // Lightning: once, or three strikes enraged. Not yet: its damage, Protect from Magic, the perfect prayer.
  startSmite(boss, player, context) {
    const strikes = this.enraged ? smite.strikesEnraged : [smite.strikeTicks];
    this.special = { name: "smite", startedAt: context.tick, endsAt: context.tick + strikes[strikes.length - 1] + 1 };
    this.animate(context, this.enraged ? "smite_enraged" : "smite", [onActor(this.enraged ? spotAnims.smiteEnraged : spotAnims.smite, boss)]);
    for (const at of strikes) {
      this.later(at, (ctx) => {
        const you = ctx.world.getPlayer();
        if (you.alive && this.boss(ctx.world)?.alive) this.animate(ctx, null, [onActor(spotAnims.smiteImpact, you)]);
      });
    }
  }

  // --- the rules, the end, the snapshot -------------------------------------------------
  getEngineRules() {
    return {
      // inferred: untouchable till she has woken.
      playerDamageOnNpc: (damage, { target }) => (target.id === bossActorId && this.phase === "waking" ? 0 : damage),
    };
  }
  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    this.phase = "dead";
    this.tasks = [];
    this.special = null;
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  getSnapshot() {
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        enraged: this.enraged,
        standardsSinceSpecial: this.standards,
        nextSpecial: specialOrder[this.nextSpecial],
        nextAttackAt: this.nextAt,
        special: this.special && { name: this.special.name, startedAt: this.special.startedAt, endsAt: this.special.endsAt, side: this.special.side ?? null },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "Mad Angel";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const madAngelDefinition = {
  kind: madAngelKind,
  factory: () => new MadAngelEncounter(),
  descriptor: {
    kind: madAngelKind,
    displayName: "Mad Angel",
    description: "Ardeaglais. Her sword sweeps, the ball of light to bounce back, the smite to pray against on the tick, and her enrage.",
    mapSquare: madAngelMapSquare,
    playerStart,
    loadsMapLocs: true,
    collision: { mode: "auto", seed: playerStart },
    victory: { title: "VICTORY", narrative: "THE MAD ANGEL DEFEATED", accent: "gold" },
    isWorkInProgress: true,
    loadouts: madAngelLoadouts,
  },
  controls: { defaultMechanicsConfig: {}, mechanicsToggles: [], debugActions: [] },
};
export { madAngelDefinition as definition };
export const order = 86;
