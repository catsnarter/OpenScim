// Scurrius' sounds that are in no animation. The game's server sends them, so
// here they are rules, keyed by the type of a tick event
// (docs/ADDING-AN-ENCOUNTER.md, section 5, `audio`): the falling bricks, and
// his bolts and fur balls as they land on the player. The layers of all
// encounters hear every event, so these answer his own alone: his stomp, and
// a landing he marks (`scurriusLanding`, encounter.js). The sounds of the
// frames of his animations and his rats' are in the cache with them, and the
// scene plays those.
//
// OBS (Encounter Recorder): four solo kills, rev 243 (ids.js); each count is of
// the times what the sound goes with came.
import { spotAnims, centreTile } from "./ids.js";
import { bossActorId, splashSpotAnim } from "./encounter.js";

// Played to the player alone.
const toPlayer = (id) => ({ id, channel: "sfx" });
const landingSounds = {
  [spotAnims.magicImpact]: toPlayer(7670), // 7 of 8 bolts that hit
  [splashSpotAnim]: toPlayer(227), // 11 of 11 that splash
  [spotAnims.rangedImpact]: toPlayer(7696), // 15 of 15 fur balls
};

// Heard from a tile. Each stomp: two sounds from the middle of the room,
// whatever tile he stomps on (24 of 24 stomps, at 34,11, range 9). Each tile
// of rubble: a sound sent with its graphic and played 240 cycles later, as the
// bricks land (267 of 290 tiles, range 5).
const stompSounds = [7699, 7667].map((id) => ({ id, range: 9, position: [...centreTile], channel: "area" }));
const brickSound = { id: 4175, range: 5, delayCycles: 240, channel: "area" };

const play = (sounds) => (sounds.length > 0 ? { kind: "play", sound: sounds } : { kind: "pass" });

export const scurriusAudio = {
  layerName: "scurrius",
  rules: {
    inferno_visual: {
      preloadIds: [...Object.values(landingSounds), ...stompSounds, brickSound].map(({ id }) => id),
      resolve({ animations = [], graphics = [], scurriusLanding = false }) {
        const stomps = animations.some(({ actorId, clipId }) => actorId === bossActorId && (clipId === "stomp" || clipId === "feedingStomp"));
        return play([
          ...(stomps ? stompSounds : []),
          ...(stomps ? graphics.filter(({ spotAnimId }) => spotAnimId === spotAnims.debris).map(({ target }) => ({ ...brickSound, position: [...target.position] })) : []),
          ...(scurriusLanding ? graphics.filter(({ spotAnimId }) => Object.hasOwn(landingSounds, spotAnimId)).map(({ spotAnimId }) => landingSounds[spotAnimId]) : []),
        ]);
      },
    },
  },
};
