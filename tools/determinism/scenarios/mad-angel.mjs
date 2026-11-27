// The Mad Angel (client/encounters/mad-angel/). She wakes with her south-west
// tile at 36,39 (3 x 3) in the middle of the nave; the player comes in at
// 41,39, east of her. The snapshot tells her phase ("waking", "fighting"),
// whether she is enraged, the special running and the next. Each script
// decides from it and the tick alone.
import { attack, protect } from "./common.mjs";

const KIND = "mad_angel";
const BOSS = "mad-angel";

// The wiki's two melee setups (loadouts.js), worn.
const obligator = {
  equipment: { head: 24419, cape: 21295, amulet: 29801, weapon: 34715, body: 24420, shield: 22322, legs: 24421, hands: 22981, boots: 31097, ring: 28307 },
  supplies: { equippedAmmo: { id: 22947 } },
};
const graniteHammer = {
  equipment: { head: 29028, cape: 6570, amulet: 6585, weapon: 21742, body: 29022, shield: 12954, legs: 29025, hands: 7462, boots: 11840, ring: 11773 },
  supplies: { equippedAmmo: { id: 22947 } },
};

export const scenarios = [
  {
    // The whole fight with the Obligator, Protect from Melee on from the start: her three specials in turn, her
    // enrage at 350 and her death. Infinite health: to the end.
    name: "mad-angel/obligator-kill",
    kind: KIND,
    seed: 3,
    ticks: 600,
    mechanics: { infiniteHealth: true, infinitePrayer: true },
    ...obligator,
    script(tick, api) {
      if (tick === 1) protect(api, "ProtectMelee");
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  {
    // The granite hammer, unprayed: her standard attacks in full, and her golembane weakness.
    name: "mad-angel/granite-hammer",
    kind: KIND,
    seed: 8,
    ticks: 200,
    mechanics: { infiniteHealth: true },
    ...graniteHammer,
    script(tick, api) {
      if (api.player().attackTarget !== BOSS) attack(api, BOSS);
    },
  },
  // The snapshot of a fresh fight: she wakes.
  {
    name: "mad-angel/start",
    kind: KIND,
    seed: 1,
    ticks: 10,
    script() {},
  },
];
