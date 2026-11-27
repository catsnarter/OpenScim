// Brutus's ids and his field's tiles. The ids are the game cache's, named as RuneLite's gameval lists name them
// (AnimationID COW_BOSS_*, SpotanimID VFX_COWBOSS_*), each checked against the cache and against six recorded kills
// (OBS: Outside recordings of 2026-11-27, one player, kill counts 212 to 217). Tiles are local to map square 50,51
// (region 12851), the north-east corner of the Lumbridge cow field; a local tile is the world one minus (3200, 3264).
// The field's east part is in map square 51,51 (local x from 64).
export const npcTypeIds = {
  // CACHE, TABLE: Brutus (58 hitpoints, 3x3). OBS: 15626 is the one fought, in every recording.
  brutus: 15626,
};

export const seqIds = {
  idle: 13781, // CACHE: COW_BOSS_IDLE, the stand of 15626
  walk: 13782, // CACHE: COW_BOSS_WALK
  spawn: 13790, // CACHE: COW_BOSS_SPAWN; OBS: as he appears
  attack: 13783, // CACHE: COW_BOSS_ATTACK; OBS: his standard attack, every 5 ticks
  stomp: 13785, // CACHE: COW_BOSS_STOMP; OBS: with "*snorts*", each of his three stomps
  charge: 13778, // CACHE: COW_BOSS_CHARGE; OBS: with "*growls*"
  death: 13784, // CACHE: COW_BOSS_DEATH; OBS: with "m-moo..."
};

export const spotAnims = {
  stompTile: 3588, // CACHE: VFX_COWBOSS_STOMP_IMPACT01; OBS: on each stomped tile, as it lands
  stompBoss: 3589, // CACHE: VFX_COWBOSS_STOMP_IMPACT02; OBS: on him, as it lands
};

// OBS: the two sounds of the fight that are in no animation, each played to the player on the tick of its overhead
// text: the snort before a stomp, and the growl before a charge. His others (the attack, the stomp's thud, the charge's
// run and impact, the death) are in his animations' frames (CACHE), and the scene plays those.
export const soundIds = {
  snort: 11213,
  growl: 11210,
  range: 15, // OBS: his area sounds are heard to 15 tiles
};

export const mapSquare = { x: 50, y: 51 }; // CACHE; WIKI: "the north-east corner of the cow field"; OBS: world 3261, 3287
export const mapSquareOffsets = [{ dx: 0, dy: 0 }, { dx: 1, dy: 0 }]; // the field's east fence is in 51,51
export const bossSize = 3; // CACHE, TABLE
// OBS: his south-west tile as he appears (world 3261, 3287), in all six recordings. inferred: the player a few tiles
// west of him, where the recorded player walked in from.
export const bossStart = [61, 23];
export const playerStart = [57, 24];

export const sameTile = (a, b) => a[0] === b[0] && a[1] === b[1];
// Edge to edge, Chebyshev: 0 under him, 1 beside him (diagonally too).
export const edgeDistance = (position, size, [x, y]) =>
  Math.max(Math.max(position[0] - x, 0, x - (position[0] + size - 1)), Math.max(position[1] - y, 0, y - (position[1] + size - 1)));
