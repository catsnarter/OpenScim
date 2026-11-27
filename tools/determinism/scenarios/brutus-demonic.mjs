// Demonic Brutus (client/encounters/brutus/demonic.js), Brutus's hard version, in his field. The snapshot tells the
// special running: its kind, the tile it is round (`at`, a tick after he fades), when its first bull lands, and in
// phase 2 the styles of its orbs. Each script decides from it and the tick alone.
import { attack, protect, toggleRun } from "./common.mjs";

const KIND = "brutus_demonic";
const BOSS = "brutus";

const state = (api) => api.engine.getEncounterSnapshot().state;
const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
const prayers = { magic: "ProtectMagic", melee: "ProtectMelee", ranged: "ProtectRange" };

// Out of a special's way as soon as it is round the player: two tiles diagonally from a charge's four lanes, two
// tiles straight from a slam's four corners; of the four such tiles, the one nearest the middle of the open field
// (58, 14): a fence runs along its west side, and the push the game gives a player too near one isn't in the
// encounter. Returns true while a special is on.
const middle = [58, 14];
function dodge(api) {
  const special = state(api).special;
  if (!special) return false;
  if (!special.at) return true; // faded, not yet back
  const [x, y] = special.at;
  const offsets = special.name === "charge" ? [[2, 2], [2, -2], [-2, 2], [-2, -2]] : [[2, 0], [-2, 0], [0, 2], [0, -2]];
  const distance = ([dx, dy]) => Math.abs(x + dx - middle[0]) + Math.abs(y + dy - middle[1]);
  const [dx, dy] = offsets.reduce((best, offset) => (distance(offset) < distance(best) ? offset : best));
  const tile = [x + dx, y + dy];
  if (!sameTile(tile, api.player().position)) {
    if (api.player().attackTarget !== null) attack(api, null);
    api.moveTo(...tile);
  }
  return true;
}
// In phase 2, the prayer for the orb that lands this tick (a prayer turned on in a tick counts against its hits);
// Protect from Melee otherwise.
function pray(api, tick) {
  const special = state(api).special;
  const n = special ? tick - special.firstBullAt : -1;
  const wanted = special?.orbs?.length && n >= 0 && n < 4 ? prayers[special.orbs[n]] : "ProtectMelee";
  if (api.player().activePrayer !== wanted) protect(api, wanted);
}
const run = (api, tick) => tick === 1 && !api.player().isRunEnabled && toggleRun(api);

// The guide's high-level melee setup (loadouts.js, "max"), worn.
const max = {
  equipment: { head: 26382, cape: 21295, amulet: 29801, weapon: 22325, body: 26384, legs: 26386, hands: 22981, boots: 31097, ring: 28307 },
};
const bare = { equipment: {} };

export const scenarios = [
  {
    // A player who stands still and doesn't fight back: three butts, a special, three butts, the next special, each
    // special's four bulls landing on him. Infinite health: to the end.
    name: "brutus_demonic/standing",
    kind: KIND,
    seed: 3,
    start: [58, 14],
    ticks: 140,
    mechanics: { infiniteHealth: true },
    ...bare,
    script() {},
  },
  {
    // The same, each special stepped out of: no bull lands.
    name: "brutus_demonic/dodged",
    kind: KIND,
    seed: 3,
    start: [58, 14],
    ticks: 140,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...bare,
    script(tick, api) {
      run(api, tick);
      dodge(api);
    },
  },
  {
    // Slams only (the setup's switch for the charge off).
    name: "brutus_demonic/slams-only",
    kind: KIND,
    seed: 7,
    start: [58, 14],
    ticks: 100,
    mechanics: { infiniteHealth: true, demonicBrutusCharge: false },
    ...bare,
    script() {},
  },
  {
    // The guide's melee setup, attacking him from the start, dodging every special and praying against each orb:
    // faster specials from 500, counterclockwise ghosts from 250, "moo moo!" and his heal to 487 at 0, phase 2's orbs,
    // his death and the victory.
    name: "brutus_demonic/kill",
    kind: KIND,
    seed: 11,
    start: [58, 14],
    ticks: 620,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...max,
    script(tick, api) {
      run(api, tick);
      pray(api, tick);
      if (dodge(api)) return;
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
];
