// Demonic Brutus (https://oldschool.runescape.wiki/w/Demonic_Brutus), the hard
// version of Brutus, in the same field: the Brutus picker's "Version".
//
// He butts the player every 5 ticks: crush, up to 4, through Protect from
// Melee. After three butts (two if the player has dealt 100 at the fight's
// start) he fades and uses a special, then three butts more, and so on:
// - charge: he reappears on a side of the player and dashes across him; three
//   ghosts do the same from the other sides, a tick apart, clockwise.
// - slam: he reappears at a corner of the player and stomps the corner tile,
//   the two beside it and his own; three ghosts the same at the other corners.
// The two alternate, from sides and corners that go round the player: E, SW,
// W, NE (or S, NW, N, SE), from a random one of the four. Each bull hits for 45
// to 56, through prayer. A step two tiles diagonal from where the player
// stood dodges a charge's four; two tiles straight, a slam's.
// - from 500 hitpoints his first bull is 3 ticks after he fades, not 5;
// - from 250 the ghosts go counterclockwise;
// - at 0 he says "moo moo!" and heals 487: phase 2, the same with four orbs
//   over the player's head, which land with the bulls, each a projectile of
//   the style its colour shows (magic, melee, ranged, then one at random) for
//   18 to 20, which that protection prayer stops.
//
// Not here: the player pushed into open space when a special starts by an
// obstacle (WIKI); the orbs' projectiles in flight (only their splash); the
// bulls' paths around the field's fences (they pass through).
//
// Sources: WIKI Demonic Brutus and Demonic Brutus/Strategies; TABLE his stats
// (client/data/monsters.js, 15628); CACHE his ids (ids.js); OBS one kill read
// from a video (tools/video-timeline, 2:37.20, 7 specials in phase 1 and 4 in
// phase 2), which gives every timing below. Numbers no source gives are marked
// inferred.
import { getMonsterFormulaStats, getMonsterHitpoints } from "../../engine/monsterStats.js";
import { reviveNpc } from "../../engine/npcState.js";
import { createSeededRandom } from "../../engine/random.js";
import { defineNpc, NpcDefinitionRegistry } from "../shared/npcDefinitions.js";
import { rollNpcAttack } from "../shared/npcAttack.js";
import { buildActorVisualTarget } from "../shared/npcHelpers.js";
import { getNpcPursuitMoves } from "../shared/npcMovement.js";
import { emitInfernoNpcAttack, emitInfernoVisual } from "../inferno/events.js";
import { npcTypeIds, demonicSeqIds, orbSpotAnims, spotAnims, bossSize, bossStart, playerStart, edgeDistance } from "./ids.js";
import { demonicSlamTiles } from "./stomp.js";

export const demonicBrutusKind = "brutus_demonic";
export const bossActorId = "brutus";

const attackSpeed = 5; // WIKI, OBS
const meleeMaxHit = 4; // WIKI: "max hit of 4", "can hit through Protect from Melee"; OBS up to 3, praying melee
const standardsBeforeSpecial = 3; // WIKI: "After three basic attacks"; OBS: three, 5 ticks apart, then the special 5 on
const earlyDamage = 100; // WIKI: "more than ~100 damage at the start of the fight": then after two
const bullDamage = [45, 56]; // WIKI: "45-56 damage"; OBS none (every bull dodged)
const orbDamage = [18, 20]; // WIKI: "18-20"; OBS 19 and 20
const healAtPhaseTwo = 487; // WIKI, OBS: 0/750, then 487/750
const fastBelowHp = 500; // WIKI; OBS: the first bull 5 ticks after the fade above, 3 from 500 down
const counterclockwiseBelowHp = 250; // WIKI; OBS: clockwise at 547 and 386, counterclockwise at 216 and 142
const leadTicks = { slow: 5, fast: 3 }; // OBS
const nextButtAfterLastBull = 4; // OBS: the last bull t137, his next butt t141
const phaseTwoFirstButt = 5; // OBS: "moo moo!" t169, his next butt t174
const deathTicks = 4; // as Brutus's (inferred)
const charge = { tiles: 7, tilesPerTick: 4, gap: 2 }; // as Brutus's charge (inferred); gap: tiles between him and the player
const ghostStayTicks = 2; // inferred: a ghost goes once its bull is done

// The specials' starts, in turn (OBS: E, SW, W, NE, E, SW, W, NE, E, SW, W: a charge from a side, a slam from a
// corner). WIKI: "If West, specials start W or E ... If South, they swap N and S": the other axis, inferred.
const rotations = [
  [["charge", "E"], ["slam", "SW"], ["charge", "W"], ["slam", "NE"]],
  [["charge", "S"], ["slam", "NW"], ["charge", "N"], ["slam", "SE"]],
];
const sides = ["N", "E", "S", "W"]; // clockwise
const corners = ["NE", "SE", "SW", "NW"]; // clockwise
const step = { N: [0, 1], E: [1, 0], S: [0, -1], W: [-1, 0] };
const orbStyles = ["magic", "melee", "ranged"]; // OBS: cyan, red, yellow, in every special; the fourth at random
const orbAttackTypes = { magic: "magic", melee: "melee", ranged: "range" }; // the engine's names (engine/damage.js)

const specialKeys = { charge: "demonicBrutusCharge", slam: "demonicBrutusSlam" };
const defaultMechanics = Object.fromEntries(Object.values(specialKeys).map((key) => [key, true]));
const specialToggles = [
  { key: specialKeys.charge, label: "Charge", info: "From a side of you, then three ghosts round you: step two tiles diagonally." },
  { key: specialKeys.slam, label: "Slam", info: "From a corner of you, then three ghosts round you: step two tiles straight." },
].map((toggle) => ({ ...toggle, section: "Specials", setup: true }));

const key = ([x, y]) => x + "," + y;
const onTile = (spotAnimId, position) => ({ spotAnimId, target: { kind: "tile", position: [...position] }, height: 0, delayCycles: 0, onGround: true });
const onActor = (spotAnimId, actor, height = 0) => ({ spotAnimId, target: buildActorVisualTarget(actor), height, delayCycles: 0 });
const footprint = (corner) => {
  const tiles = [];
  for (let x = 0; x < bossSize; x++) for (let y = 0; y < bossSize; y++) tiles.push([corner[0] + x, corner[1] + y]);
  return tiles;
};

// Where a bull stands for a charge from `side` of the player at `p`, and the way it dashes: across his row or column,
// `charge.gap` tiles off him (inferred: OBS him a few tiles off, then past the player).
export function chargeStart(side, [px, py]) {
  const far = charge.gap + 1;
  if (side === "W") return { corner: [px - far - bossSize + 1, py - 1], direction: "E" };
  if (side === "E") return { corner: [px + far, py - 1], direction: "W" };
  if (side === "S") return { corner: [px - 1, py - far - bossSize + 1], direction: "N" };
  return { corner: [px - 1, py + far], direction: "S" };
}

// A charge's lane: every tile his 3x3 covers from where he stands to where he stops.
export function chargeLane(corner, direction) {
  const [dx, dy] = step[direction];
  const path = Array.from({ length: charge.tiles }, (_, n) => [corner[0] + dx * (n + 1), corner[1] + dy * (n + 1)]);
  const lane = new Set();
  for (const at of [corner, ...path]) for (const tile of footprint(at)) lane.add(key(tile));
  return { path, lane };
}

// Where a bull stands for a slam from `cornerName` of the player at `p`: his corner tile diagonal to the player's
// (inferred: OBS him at the player's corner, the dust on the tiles round the player).
export function slamCorner(cornerName, [px, py]) {
  const west = cornerName.endsWith("W");
  const south = cornerName.startsWith("S");
  return [west ? px - bossSize : px + 1, south ? py - bossSize : py + 1];
}

// The four starts of a special from `first`, clockwise or not.
export function specialStarts(kind, first, clockwise) {
  const ring = kind === "charge" ? sides : corners;
  const at = ring.indexOf(first);
  return Array.from({ length: 4 }, (_, n) => ring[(at + (clockwise ? n : -n) + 8) % 4]);
}

const bossDefinition = defineNpc({
  id: "brutus",
  move: ({ actor, context, config }) => config.bullMove(actor, context),
  tick: ({ actor, context, config }) => config.bossTurn(actor, context),
});
const ghostDefinition = defineNpc({
  id: "brutus-ghost",
  move: ({ actor, context, config }) => config.bullMove(actor, context),
  tick: () => ({ environmentalDamages: [] }),
});

class DemonicBrutusEncounter {
  kind = demonicBrutusKind;
  constructor() {
    this.definitions = new NpcDefinitionRegistry([bossDefinition, ghostDefinition].map((definition) => definition.register(this)));
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
    this.epoch = 0;
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.phase = 1; // 1 | 2 | "dead"
    this.nextAt = 1;
    this.standards = 0;
    this.specialsDone = 0;
    this.rotation = null; // { list, next }, chosen as the first special is due
    this.special = null;
    this.dashes = new Map(); // bull id -> { path, travelled, from }
    this.ghosts = 0;
  }
  later(ticks, task) {
    this.tasks.push({ tick: this.now + ticks, task });
  }
  laterAfterMove(ticks, task) {
    this.postTasks.push({ tick: this.now + ticks, task });
  }
  // A task of this special only: dropped when the phase changes under it.
  scheduled(ticks, task, afterMove = false) {
    const epoch = this.epoch;
    (afterMove ? this.laterAfterMove : this.later).call(this, ticks, (ctx) => {
      if (this.epoch === epoch && this.phase !== "dead") task(ctx);
    });
  }
  boss(world) {
    return world.getNpc(bossActorId);
  }
  animate(context, actorId, clipId, graphics = []) {
    emitInfernoVisual(context.tickEvents, {
      animations: clipId ? [{ actorId, clipId, delayCycles: 0 }] : [],
      projectiles: [],
      graphics,
    });
  }
  // His overhead text, for 5 ticks: the game client's 150 cycles (3 seconds) (overheadCycle is in ticks).
  say(context, text) {
    context.tickEvents.emit({ type: "overhead_text", anchor: { kind: "actor", actorId: bossActorId }, overheadText: text, overheadCycle: 5 });
  }

  // --- what the engine always calls --------------------------------------------
  getSeeds() {
    return { encounterSeed: this.seed };
  }
  getDefaultMechanicsConfig() {
    return { ...defaultMechanics };
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
    if (mechanics) this.mechanics = mechanics;
    this.random = createSeededRandom(this.seed);
    this.startRun();
    const boss = context?.world.actors.get(bossActorId);
    if (!boss) return;
    boss.position = [...bossStart];
    boss.previousPosition = [...bossStart];
  }
  createNpcs() {
    const hp = getMonsterHitpoints(npcTypeIds.demonic); // TABLE: 750
    return [
      bossDefinition.createActor(
        {
          id: bossActorId, kind: "npc", role: "boss", npcTypeId: npcTypeIds.demonic, archetypeId: "brutus", size: bossSize, alive: true,
          position: [...bossStart], previousPosition: [...bossStart], facing: 512, history: new Map(),
          vitals: { hp, maxHp: hp },
          formulaStats: structuredClone(getMonsterFormulaStats(npcTypeIds.demonic)),
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
  resolveHazards(context, mechanics) {
    if (mechanics) this.mechanics = mechanics;
    this.now = context.tick;
    this.context = context;
    for (let index = this.tasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.tasks.findIndex((entry) => entry.tick <= this.now)) {
      this.tasks.splice(index, 1)[0].task(context);
    }
    return [];
  }
  processPostTick(context) {
    this.now = context.tick;
    this.context = context;
    for (let index = this.postTasks.findIndex((entry) => entry.tick <= this.now); index >= 0; index = this.postTasks.findIndex((entry) => entry.tick <= this.now)) {
      this.postTasks.splice(index, 1)[0].task(context);
    }
    if (this.outcome.phase === "resolving" && context.tick >= this.outcome.completionTick) this.outcome = { ...this.outcome, phase: "victory" };
    const damages = this.pending;
    this.pending = [];
    return damages;
  }
  hurt(source, baseDamage, attackType = "typeless") {
    const player = this.context.world.getPlayer();
    if (!player.alive) return;
    this.pending.push({ source, baseDamage, attackType, playerPosition: [...player.position] });
  }
  randomInt([low, high]) {
    return low + Math.floor(this.random() * (high - low + 1));
  }

  // --- movement: he walks after the player; a bull dashes in a charge ------------
  bullMove(actor, context) {
    const dash = this.dashes.get(actor.id);
    if (dash) {
      if (dash.travelled >= dash.path.length) return [];
      const path = dash.path.slice(dash.travelled, dash.travelled + charge.tilesPerTick);
      dash.travelled += path.length;
      return [{ npcId: actor.id, path }];
    }
    if (actor.id !== bossActorId || this.special || this.phase === "dead") return [];
    return getNpcPursuitMoves(actor, context);
  }

  // --- his turn -------------------------------------------------------------------
  bossTurn(boss, context) {
    this.now = context.tick;
    const none = { environmentalDamages: [] };
    const player = context.world.getPlayer();
    if (!boss.alive || this.phase === "dead") return none;
    if (context.tick === 1) {
      this.animate(context, bossActorId, "spawn");
      this.say(context, "Moo"); // OBS
    }
    if (this.special) {
      if (context.tick < this.special.endsAt) return none;
      this.special = null;
    }
    if (context.tick < this.nextAt || !player.alive) return none;
    const early = this.specialsDone === 0 && this.phase === 1 && boss.vitals.maxHp - boss.vitals.hp > earlyDamage;
    if (this.standards >= (early ? standardsBeforeSpecial - 1 : standardsBeforeSpecial) && this.startSpecial(boss, player, context)) return none;
    if (!this.inMeleeReach(boss, player)) return none;
    this.nextAt = context.tick + attackSpeed;
    this.standards++;
    return { environmentalDamages: [], npcAttacks: [this.butt(boss, player, context)] };
  }
  inMeleeReach(boss, player) {
    if (edgeDistance(boss.position, bossSize, player.position) !== 1) return false;
    const [x, y] = player.position;
    return (x >= boss.position[0] && x < boss.position[0] + bossSize) || (y >= boss.position[1] && y < boss.position[1] + bossSize);
  }
  butt(boss, player, context) {
    const attack = rollNpcAttack({
      attacker: boss, target: player,
      plan: { formulaStyle: "melee_crush", damageType: "melee", attackKind: "melee_crush", maxHit: meleeMaxHit, impactDelayTicks: 0, prayerCheckAt: "impact", sourceDeathPolicy: "cancel-before-impact" },
      random: this.random,
    });
    if (!attack) throw new TypeError("Missing formula stats for Demonic Brutus");
    emitInfernoNpcAttack(context, { actor: boss, target: player, clipId: "attack", kind: "brutus_attack", impactDelayTicks: 0 });
    return { ...attack, prayerReduction: { type: "reduce", value: 1 } }; // WIKI: through Protect from Melee
  }

  // --- his specials -----------------------------------------------------------------
  // The next start of the rotation whose special the setup has on, or null with both off.
  nextStart() {
    if (!this.rotation) {
      const list = rotations[Math.floor(this.random() * rotations.length)];
      this.rotation = { list, next: Math.floor(this.random() * list.length) };
    }
    for (let n = 0; n < 4; n++) {
      const [kind, from] = this.rotation.list[this.rotation.next];
      this.rotation.next = (this.rotation.next + 1) % 4;
      if (this.mechanics?.[specialKeys[kind]] !== false) return { kind, from };
    }
    return null;
  }
  startSpecial(boss, player, context) {
    const start = this.nextStart();
    if (!start) return false;
    this.standards = 0;
    this.specialsDone++;
    const lead = boss.vitals.hp > fastBelowHp ? leadTicks.slow : leadTicks.fast;
    const clockwise = boss.vitals.hp > counterclockwiseBelowHp;
    const fadedAt = context.tick;
    const lastBull = fadedAt + lead + 3;
    this.special = { name: start.kind, from: start.from, fadedAt, firstBullAt: fadedAt + lead, endsAt: lastBull + 1, clockwise, bulls: [], orbs: [] };
    this.nextAt = lastBull + nextButtAfterLastBull;
    boss.untargetable = true;
    this.animate(context, bossActorId, "fadeOut");
    this.scheduled(1, (ctx) => this.appear(ctx, start, clockwise));
    for (let n = 0; n < 4; n++) {
      this.scheduled(lead + n, (ctx) => this.bullSetsOff(ctx, n));
      this.scheduled(lead + n, (ctx) => this.bullLands(ctx, n));
    }
    this.scheduled(lead + 3 + 1, (ctx) => {
      const now = this.boss(ctx.world);
      if (now) now.untargetable = false;
    });
    return true;
  }
  // A tick after he fades: he and three ghosts round the player where he stands now; in phase 2, the orbs over him.
  appear(context, start, clockwise) {
    const player = context.world.getPlayer();
    const at = [...player.position];
    const special = this.special;
    special.at = at;
    const froms = specialStarts(start.kind, start.from, clockwise);
    const boss = this.boss(context.world);
    special.bulls = froms.map((from, n) => {
      const id = n === 0 ? bossActorId : `brutus_ghost_${++this.ghosts}`;
      if (start.kind === "charge") {
        const { corner, direction } = chargeStart(from, at);
        return { id, from, corner, direction, ...chargeLane(corner, direction) };
      }
      const corner = slamCorner(from, at);
      return { id, from, corner, tiles: demonicSlamTiles(corner, at) };
    });
    for (const bull of special.bulls) {
      if (bull.id === bossActorId) {
        boss.position = [...bull.corner];
        boss.previousPosition = [...bull.corner];
        this.animate(context, bossActorId, start.kind === "charge" ? "chargeFadeIn" : "stompFadeIn");
        continue;
      }
      context.spawnNpc(ghostDefinition.createActor({
        id: bull.id, kind: "npc", role: "npc", npcTypeId: npcTypeIds.demonicGhost, archetypeId: "brutus-ghost", size: bossSize, alive: true,
        position: [...bull.corner], previousPosition: [...bull.corner], facing: boss.facing, history: new Map(),
        untargetable: true, blocksNpcMovement: false, passThruNpcs: true,
        vitals: { hp: 1, maxHp: 1 },
        combat: { attackSpeed: 1, attackRange: 0, attackStyle: "typeless", nextActionTick: Infinity, targetId: null, lastAttackTick: null,
          animations: { idle: null, walk: null, run: null, attack: null, death: null } },
      }, {}));
      this.animate(context, bull.id, start.kind === "charge" ? "ghostChargeFadeIn" : "ghostStompFadeIn");
    }
    if (this.phase === 2) {
      // OBS: four orbs over the player; they land bottom first: magic, melee, ranged, then one at random.
      special.orbs = [...orbStyles, orbStyles[Math.floor(this.random() * orbStyles.length)]];
      this.animate(context, null, null, special.orbs.map((style, n) => onActor(orbSpotAnims.spawn[style], player, 220 + n * 60)));
    }
  }
  // The bull's move: a charge's dash starts on its tick (its lane hits as it sets off, as Brutus's charge does).
  bullSetsOff(context, n) {
    const bull = this.special?.bulls[n];
    if (!bull) return;
    const charging = this.special.name === "charge";
    const clip = charging ? (bull.id === bossActorId ? "charge" : "ghostCharge") : bull.id === bossActorId ? "slam" : "ghostSlam";
    this.animate(context, bull.id, clip);
    if (charging) this.dashes.set(bull.id, { path: bull.path, travelled: 0 });
  }
  // As the bull's tick starts, before the player moves (as Brutus's stomp and charge, OBS): what it finds him on, and
  // (phase 2) its orb.
  bullLands(context, n) {
    const special = this.special;
    const bull = special?.bulls[n];
    if (!bull) return;
    const player = context.world.getPlayer();
    const at = key(player.position);
    if (special.name === "slam") {
      const actor = context.world.getNpc(bull.id);
      this.animate(context, null, null, [...bull.tiles.outside.map((tile) => onTile(spotAnims.stompTile, tile)), ...(actor ? [onActor(spotAnims.stompBoss, actor)] : [])]);
      if (bull.tiles.all.some((tile) => key(tile) === at)) this.hurt("Demonic Brutus's slam", this.randomInt(bullDamage));
    } else if (bull.lane.has(at)) {
      this.hurt("Demonic Brutus's charge", this.randomInt(bullDamage));
    }
    const style = special.orbs[n];
    if (style) {
      this.animate(context, null, null, [onActor(orbSpotAnims.impact[style], player)]);
      this.hurt("Demonic Brutus's orb", this.randomInt(orbDamage), orbAttackTypes[style]);
    }
    if (bull.id !== bossActorId) {
      this.scheduled(ghostStayTicks, (ctx) => this.dropGhost(ctx, bull.id));
    } else if (special.name === "charge") {
      this.scheduled(2, () => this.dashes.delete(bossActorId));
    }
  }
  dropGhost(context, id) {
    this.dashes.delete(id);
    if (context.world.getNpc(id)) context.despawnNpc(id);
  }
  // A special cut short (his phase changes, or he dies): its ghosts go, its tasks are dropped.
  clearSpecial(context) {
    this.epoch++;
    for (const bull of this.special?.bulls ?? []) if (bull.id !== bossActorId && context.world.getNpc(bull.id)) context.despawnNpc(bull.id);
    this.dashes.clear();
    this.special = null;
    const boss = this.boss(context.world);
    if (boss) boss.untargetable = false;
  }

  onNpcDefeated(defeat, context, completionOwnership) {
    if (defeat.npcId !== bossActorId) return;
    const boss = this.boss(context.world);
    this.clearSpecial(context);
    if (this.phase === 1 && boss) {
      // WIKI, OBS: "moo moo!", and he heals 487: phase 2.
      reviveNpc(boss);
      boss.vitals = { ...boss.vitals, hp: healAtPhaseTwo };
      this.phase = 2;
      this.standards = 0;
      this.nextAt = defeat.tick + phaseTwoFirstButt;
      this.say(context, "moo moo!");
      context.tickEvents.emit({ type: "hitsplat_spawned", targetId: boss.id, amount: healAtPhaseTwo, hitsplatType: "heal" });
      return;
    }
    this.phase = "dead";
    this.tasks = [];
    this.postTasks = [];
    this.pending = [];
    this.say(context, "m-moo..."); // as Brutus (inferred)
    if (completionOwnership !== "encounter-owned") return;
    this.outcome = { phase: "resolving", decisiveTick: defeat.tick, completionTick: defeat.tick + deathTicks, primaryActorId: bossActorId, completionActorIds: [bossActorId] };
  }
  getOutcome() {
    return this.outcome;
  }
  getSnapshot() {
    const special = this.special;
    return {
      kind: this.kind,
      state: {
        phase: this.phase,
        standardsSinceSpecial: this.standards,
        specialsDone: this.specialsDone,
        nextAttackAt: this.nextAt,
        special: special && {
          name: special.name,
          from: special.from,
          fadedAt: special.fadedAt,
          firstBullAt: special.firstBullAt,
          clockwise: special.clockwise,
          at: special.at ? [...special.at] : null,
          bulls: special.bulls.map((bull) => ({ id: bull.id, from: bull.from, corner: [...bull.corner] })),
          orbs: [...special.orbs],
        },
      },
      visuals: {},
    };
  }
  getNpcDamageSourceLabel() {
    return "Demonic Brutus";
  }
  getNpcDefinitions() {
    return this.definitions;
  }
  processNpcTick(npc, context) {
    return this.definitions.tick(npc, { ...context, random: this.random });
  }
}

export const demonicBrutusFactory = () => new DemonicBrutusEncounter();
export const demonicBrutusControls = { defaultMechanicsConfig: { ...defaultMechanics }, mechanicsToggles: specialToggles, debugActions: [] };
