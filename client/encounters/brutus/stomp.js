// The tiles a stomp lands on, Brutus's and Demonic Brutus's slam's (demonic.js).
import { bossSize } from "./ids.js";

// The tiles a stomp lands on (WIKI: "a 3x1 area if adjacent, or an L shape if diagonal", "Both slam attacks also deal
// damage on adjacent tiles beneath Brutus"; OBS: the graphic on the three tiles beside him toward the player). The side
// is the player's as the snort sounds: beside him, the three tiles there and his own row next to them; at a corner, the
// corner tile and the two beside it, and his own corner tile (inferred: the L's tiles).
export function stompTiles(corner, player) {
  const [bx, by] = corner;
  const far = bx + bossSize - 1;
  const top = by + bossSize - 1;
  const sx = player[0] < bx ? -1 : player[0] > far ? 1 : 0;
  const sy = player[1] < by ? -1 : player[1] > top ? 1 : 0;
  const outside = [];
  const beneath = [];
  if (sx !== 0 && sy !== 0) {
    const cx = sx < 0 ? bx - 1 : far + 1;
    const cy = sy < 0 ? by - 1 : top + 1;
    const ex = sx < 0 ? bx : far;
    const ey = sy < 0 ? by : top;
    outside.push([cx, cy], [cx, ey], [ex, cy]);
    beneath.push([ex, ey]);
  } else if (sx !== 0) {
    const x = sx < 0 ? bx - 1 : far + 1;
    const row = sx < 0 ? bx : far;
    for (let y = by; y <= top; y++) outside.push([x, y]), beneath.push([row, y]);
  } else {
    // Toward the player north or south of him; under him (sy 0 too), the row he faces first: south (inferred).
    const y = sy > 0 ? top + 1 : by - 1;
    const row = sy > 0 ? top : by;
    for (let x = bx; x <= far; x++) outside.push([x, y]), beneath.push([x, row]);
  }
  return { outside, all: [...outside, ...beneath] };
}
