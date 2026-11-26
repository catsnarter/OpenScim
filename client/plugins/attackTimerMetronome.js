// The plugin Attack Timer Metronome: the ticks until the player's next attack,
// as a number over the player's head and as a bar. Rebuilt from the RuneLite
// plugin of that name (github.com/ngraves95/attacktimer, v1.3.8, BSD 2-Clause),
// from its options, their defaults and what it shows; no code of it is here.
// Left out: its overlay layer choice ("Draw": the page has one layer for bars),
// "Disable Font Size Scaling" (the number is never scaled here), its debug
// logging and its deprecated switch.
//
// What is the application's own: the timer is the engine's. The plugin in the
// game has to work an attack out from the player's animation and a table of
// weapons, eats and bosses (its VariableSpeed); here the fight itself keeps the
// tick of the next attack (`playerNextAttackTick`) and the cycle of the one
// scheduled (`playerAttackSpeed`), so what is shown is what the engine does,
// for every weapon and every encounter. The Plugins panel lists it by its store
// (application.js, PluginStoreEntry), and rendering.js draws what this module
// returns (DL for the number, LL for the bar).
//
// In the plugin's terms, with T the ticks until the next attack (the next
// attack's tick minus this one): the number is T while T > 0 (T - 1 when
// zero-based), in the last tick colour when T is 1. Once T reaches 0 the attack
// is late: -1, -2, ... in the lost tick colour, up to the maximum, then nothing
// until the next attack. The bar shows from the attack until T is 0, at
// (T - 1) / (cycle - 1) of its width by default.
import { createPluginStore, toHexColor } from "./pluginStore.js";

const choices = (...pairs) => pairs.map(([value, label]) => ({ value, label }));
const tickSection = "Attack Cooldown Tick Settings";
const barSection = "Attack Bar";

/** The options, in the order and with the defaults of the plugin's panel. */
export const attackTimerMetronomeOptions = [
  { key: "showTick", label: "Show Attack Cooldown Ticks", section: tickSection, type: "boolean", default: true, info: "Shows number of ticks until next attack" },
  { key: "fontSize", label: "Font Size (Overhead Tick Only)", section: tickSection, type: "number", min: 8, max: 50, default: 15, info: "Change the font size of the overhead attack cooldown ticks" },
  // PLUGIN: java.awt.Color.CYAN for both.
  { key: "numberColor", label: "Tick Number Color", section: tickSection, type: "color", default: "FF00FFFF", info: "Configures the color of tick number" },
  { key: "lastColor", label: "Last Tick Color", section: tickSection, type: "color", default: "FF00FFFF", info: "Configures the color of tick number when it says 1" },
  {
    key: "fontType",
    label: "Font Type",
    section: tickSection,
    type: "select",
    choices: choices(["REGULAR", "RS Regular"], ["ARIAL", "Arial"], ["BOLD", "Bold"], ["CAMBRIA", "Cambria"], ["ROCKWELL", "Rockwell"], ["SEGOE_UI", "Segoe Ui"], ["TIMES_NEW_ROMAN", "Times New Roman"], ["VERDANA", "Verdana"]),
    default: "REGULAR",
    info: "Change the font of the tick number",
  },
  {
    key: "ticksPosition",
    label: "Ticks Position",
    section: tickSection,
    type: "select",
    choices: choices(["DEFAULT", "Default"], ["TOP", "Top"], ["CENTERED", "Centered"], ["BOTTOM", "Bottom"]),
    default: "DEFAULT",
    info: "Position of the tick number respective to the player",
  },
  { key: "tickHeightOffset", label: "Height Offset", section: tickSection, type: "number", min: -50, max: 50, default: 0, info: "Height offset for minor adjustments of the tick number" },
  { key: "useZeroBasedTickCount", label: "Zero-based Tick Count", section: tickSection, type: "boolean", default: false, info: "Count ticks to 0 instead of 1" },
  { key: "showLostTicks", label: "Show Lost Attack Ticks", section: tickSection, type: "boolean", default: true, info: "Show -1, -2, etc. when an attack is late." },
  { key: "maximumLostTicks", label: "Maximum Lost Ticks", section: tickSection, type: "number", min: 1, max: 20, default: 2, info: "Largest negative value that will be shown after missing an attack." },
  // PLUGIN: java.awt.Color.RED.
  { key: "lostTickColor", label: "Lost Tick Color", section: tickSection, type: "color", default: "FFFF0000", info: "Color of the lost ticks." },
  { key: "showBar", label: "Show Attack Bar", section: barSection, type: "boolean", default: false, info: "Show the attack bar" },
  // PLUGIN: "Height Offset", as the number's; named apart here, where settings are searched by their names.
  { key: "barHeightOffset", label: "Bar Height Offset", section: barSection, type: "number", min: -100, max: 100, default: 0, info: "Height offset for the bar from top of player model" },
  { key: "barEmpties", label: "Empties Before Attack", section: barSection, type: "boolean", default: true, info: "Controls whether the attack bar will fully empty before a new attack can occur" },
  { key: "barFills", label: "Fills Before Attack", section: barSection, type: "boolean", default: true, info: "Controls whether the attack bar will fill completely after an attack" },
  { key: "barDrains", label: "Attack Bar Fills or Drains", section: barSection, type: "boolean", default: true, info: "Controls whether the attack bar will fill or drain as a cooldown" },
  {
    key: "barStyle",
    label: "Attack Bar Style",
    section: barSection,
    type: "select",
    choices: choices(["AUTO", "Auto"], ["STANDARD", "Standard"], ["HIGH_DETAIL", "High Detail"]),
    default: "AUTO",
    info: "Auto matches HD/SD from Interface Styles plugin. Standard forces the basic bar. High Detail forces the HD bar.",
  },
];
export const attackTimerMetronomeStore = createPluginStore("attackTimerMetronome", attackTimerMetronomeOptions);

// Before it kept its own settings, the metronome's were the application's
// (Grid.js, kept under "osrs-yama-settings"): on, "Show Attack Bar", "Show
// Attack Cooldown Ticks" and a font size, with an offset and "above prayer
// icon" that RuneLite's plugin has no match for. Once, before the application
// next saves its settings without them (this module is loaded first), they are
// carried into the store: all of them for a player who had it on, so that it
// looks as it did; for one who had it off, only what was changed from what
// they were by default then, so that it is RuneLite's when first switched on.
const legacyKey = "osrs-yama-settings";
const legacyDefaults = { attackTimerMetronomeShowBar: true, attackTimerMetronomeShowTicks: false, attackTimerMetronomeFontSize: 24 };
export function carryOverLegacySettings(store = attackTimerMetronomeStore, storage = globalThis.localStorage) {
  try {
    if (!storage || storage.getItem("openscim.plugin." + store.key) !== null) return false; // its own already, or nowhere to keep any
    const app = JSON.parse(storage.getItem(legacyKey) ?? "null");
    if (typeof app?.attackTimerMetronomeEnabled !== "boolean") return false;
    const on = app.attackTimerMetronomeEnabled;
    const chosen = (key, valid) => valid(app[key]) && (on || app[key] !== legacyDefaults[key]);
    const settings = { ...store.getState().settings };
    if (chosen("attackTimerMetronomeShowBar", (v) => typeof v === "boolean")) settings.showBar = app.attackTimerMetronomeShowBar;
    if (chosen("attackTimerMetronomeShowTicks", (v) => typeof v === "boolean")) settings.showTick = app.attackTimerMetronomeShowTicks;
    // Its old size could be 8 to 72; RuneLite's is 8 to 50.
    if (chosen("attackTimerMetronomeFontSize", Number.isFinite)) settings.fontSize = Math.max(8, Math.min(50, Math.round(app.attackTimerMetronomeFontSize)));
    const changed = Object.keys(settings).some((key) => settings[key] !== store.defaults[key]);
    if (!on && !changed) return false; // nothing of the player's to keep
    store.setSettings(settings);
    store.setEnabled(on);
    return true;
  } catch {
    return false; // not readable: the defaults
  }
}
carryOverLegacySettings();

// What the CSS of the page calls each of the plugin's fonts. "RS Regular" is
// the client's RuneScape font, and its bold the RuneScape bold.
const fontFamilies = {
  REGULAR: '"RuneScape Plain 12", sans-serif',
  ARIAL: "Arial, sans-serif",
  BOLD: '"RuneScape Bold 12", sans-serif',
  CAMBRIA: "Cambria, serif",
  ROCKWELL: "Rockwell, serif",
  SEGOE_UI: '"Segoe UI", sans-serif',
  TIMES_NEW_ROMAN: '"Times New Roman", serif',
  VERDANA: "Verdana, sans-serif",
};

// PLUGIN: the height of the number over the tile, in the game's units (128 a
// tile), for each position: the player's logical height and 20 more, 214, 100,
// and 10 (the text location at the feet); the height offset adds to each.
export const tickHeights = { DEFAULT: (logicalHeight) => logicalHeight + 20, TOP: () => 214, CENTERED: () => 100, BOTTOM: () => 10 };

// Whether Interface Styles draws high detail health bars: the bar's "Auto"
// follows it. Set by the application (application.js), which keeps that option.
let hdHealthBars = false;
export function setAttackTimerHdHealthBars(on) {
  hdHealthBars = on === true;
}

const ticksUntilNextAttack = ({ currentTick, nextAttackTick }) =>
  // -1: the engine has no attack scheduled yet (none was made).
  Number.isFinite(nextAttackTick) && nextAttackTick >= 0 ? nextAttackTick - currentTick : null;

/**
 * The number over the player's head: { text, textColor, fontSize, fontFamily,
 * position, heightOffset }, or null. `state`: { currentTick, nextAttackTick }.
 */
export function getAttackTimerNumber(state) {
  const { enabled, settings } = attackTimerMetronomeStore.getState();
  if (!enabled) return null;
  const ticks = ticksUntilNextAttack(state);
  if (ticks === null) return null;
  let text;
  let color;
  if (ticks > 0) {
    if (!settings.showTick) return null;
    text = String(settings.useZeroBasedTickCount ? ticks - 1 : ticks);
    color = ticks === 1 ? settings.lastColor : settings.numberColor;
  } else {
    if (!settings.showLostTicks) return null;
    const lost = 1 - ticks;
    if (lost > settings.maximumLostTicks) return null;
    text = "-" + lost;
    color = settings.lostTickColor;
  }
  return {
    text,
    textColor: toHexColor(color),
    fontSize: settings.fontSize,
    fontFamily: fontFamilies[settings.fontType] ?? fontFamilies.REGULAR,
    position: settings.ticksPosition,
    heightOffset: settings.tickHeightOffset,
  };
}

// PLUGIN: the standard bar is 30 x 5, (201, 161, 28) on black; the high detail
// one is drawn here as Interface Styles' health bar, 40 x 7 (rendering.js draws
// a timer bar of that width with those pictures when it is given none).
const solid = (color) => `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="30" height="5"><rect width="30" height="5" fill="${color}"/></svg>`)}`;
const standardBar = { width: 30, height: 5, frontImage: solid("#C9A11C"), backImage: solid("#000000") };
const highDetailBar = { width: 40, height: 7 };

/**
 * The bar: { ratio, width, height, frontImage?, backImage?, heightOffset }, or
 * null. `state`: { currentTick, nextAttackTick, attackSpeed }.
 */
export function getAttackTimerBar(state) {
  const { enabled, settings } = attackTimerMetronomeStore.getState();
  if (!enabled || !settings.showBar) return null;
  const ticks = ticksUntilNextAttack(state);
  // PLUGIN: shown from the attack until the tick the next one could be made (its
  // one tick of "debounce" after the cooldown), then gone.
  if (ticks === null || ticks < 0) return null;
  const period = Math.max(1, state.attackSpeed ?? 1);
  const numerator = ticks - (settings.barFills ? 1 : 0);
  const denominator = period - (settings.barEmpties ? 1 : 0);
  const fraction = denominator > 0 ? numerator / denominator : 0;
  const clamp = (value) => Math.max(0, Math.min(1, value));
  const hd = settings.barStyle === "HIGH_DETAIL" || (settings.barStyle === "AUTO" && hdHealthBars);
  return {
    ratio: settings.barDrains ? clamp(fraction) : clamp(1 - fraction),
    ...(hd ? highDetailBar : standardBar),
    heightOffset: settings.barHeightOffset,
  };
}
