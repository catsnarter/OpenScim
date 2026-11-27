// What draws Brutus: the default scene, with his sequences and the spot animations of his stomp, and his audio layer
// (audio.js). The ids are the game cache's (ids.js); the clip names are the ones encounter.js plays.
import { buildScene } from "../shared/buildScene.js";
import { brutusKind, brutusMapSquare, brutusMapSquareOffsets, bossActorId } from "./encounter.js";
import { npcTypeIds, seqIds, spotAnims, bossStart, bossSize } from "./ids.js";
import { brutusAudio } from "./audio.js";

const renderConfig = {
  terrainMapSquare: brutusMapSquare,
  mapSquareOffsets: brutusMapSquareOffsets,
  primaryNpc: { actorId: bossActorId, npcTypeId: npcTypeIds.brutus, basePosition: bossStart, size: bossSize, deathSeqId: seqIds.death },
  spotAnimIds: [...new Set(Object.values(spotAnims))],
  preloadNpcTypes: [
    {
      npcTypeId: npcTypeIds.brutus,
      idleSeqId: seqIds.idle,
      attackClips: {
        spawn: seqIds.spawn,
        attack: seqIds.attack,
        stomp: seqIds.stomp,
        charge: seqIds.charge,
      },
      deathSeqId: seqIds.death,
      bossDeathAnimationEnabled: true,
    },
  ],
};

export const presentation = (BaseScene) => ({
  kind: brutusKind,
  renderConfig,
  sceneBuilder: (context) => buildScene(BaseScene, renderConfig, context),
  audio: brutusAudio,
  // The player comes in west of him: the camera looks east, toward him. inferred: to adjust in the browser.
  defaultCamera: { yaw: 512, pitch: -40, zoom: 420 },
  presentation: {
    title: "Brutus",
    tagline: "Lumbridge cow field",
    blurb: "His butts, three stomps to step back from, and a charge to step aside from.",
    wikiUrl: "https://oldschool.runescape.wiki/w/Brutus",
    portrait: { npcTypeId: npcTypeIds.brutus, framing: { yaw: -30, pitch: -12, focusHeight: 0.5, span: 0.8 } },
  },
});
