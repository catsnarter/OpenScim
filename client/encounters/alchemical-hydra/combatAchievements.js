// The Alchemical Hydra's combat achievements (its descriptor's
// `combatAchievements`, client/combatAchievements/tracker.js): its 12 tasks,
// their names, tiers and requirements as WIKI: Combat Achievements/Tasks by
// boss lists them (read 2026-11-27). How each is judged here:
// - "hit by" a mechanic is a hit on the player its encounter names: the
//   lightning's currents "Lightning" (lightning.js), the flame wall's and the
//   tracking fire's "Fire" (fire.js, the burn after them "Burn"), the acid's
//   pools "Poison pool" (poison.js);
// - empowered is the snapshot's `empowered`, set as a wrong vent erupts under
//   it (encounter.js); a flame wall spawned is its flame special reaching its
//   breath, the stage that lights the walls, as it stops in the middle (WIKI:
//   The Flame Skipper: it fails once the Hydra "reach[es] the middle and
//   stop[s] moving");
// - a kill's time runs from the fight's first tick to the tick it dies. Where
//   the game's timer starts is not on the wiki's pages (inferred);
// - "without leaving the room" is clean kills in a row of the Hydra without
//   choosing another fight or dying;
// - the kill counts are the kills in this browser that counted;
// - a task fails (`failed`, told in the chat when the player wants it) the
//   tick it can no longer be met: the hit, the empowering, the flame wall,
//   the time run past, a weapon other than the greataxe or more than 10
//   hitpoints. The kill counts and Working Overtime do not fail in a fight.
//   `failed` gives the reason the chat line tells after the task's name
//   ("You have failed <task>: <reason>", chat.js). inferred: the Hydra's own
//   reasons are not recorded; these are written as the recorded ones of solo
//   tasks are (OBS (rsprox, ToA): "You lost a prayer point.").
import { ticksUnder, hitsFrom, killTicks, elapsedTicks } from "../../combatAchievements/runs.js";

// Dharok's greataxe and its degraded forms (client/data/equipment.js).
const dharoksGreataxes = new Set([4718, 4886, 4887, 4888, 4889, 4890]);

const kills = (n) => ({ check: (run, progress) => progress.kills >= n, target: (progress) => ({ current: Math.min(progress.kills, n), of: n }) });
// A speed task: met by a kill under the time, failed as the fight runs past it. Under 1:20 is 133 ticks
// (WIKI: Alchemical Speed-Runner), as ticksUnder gives.
const under = (seconds) => ({
  check: (run) => killTicks(run) <= ticksUnder(seconds),
  failed: (run) => elapsedTicks(run) > ticksUnder(seconds) && "You did not kill the Alchemical Hydra in time.",
});
// A task that holds unless something happens: met while it has not, failed once it has.
const unless = (happened, reason) => ({ check: (run) => !happened(run), failed: (run) => happened(run) && reason });
const onlyGreataxe = (run) => [...run.weapons].every((id) => dharoksGreataxes.has(id));
const isNoPressure = (run) => onlyGreataxe(run) && run.highestHp <= 10;

export const alchemicalHydraCombatAchievements = {
  observe(state, facts) {
    if (state.empowered) facts.empowered = true;
    if (state.fireSpecial?.stage === "breath") facts.flameWall = true;
  },
  tasks: [
    { id: "alchemical_veteran", name: "Alchemical Veteran", tier: "elite", type: "Kill Count", description: "Kill the Alchemical Hydra 75 times.", ...kills(75) },
    { id: "alcleanical_hydra", name: "Alcleanical Hydra", tier: "master", type: "Perfection", description: "Kill the Alchemical Hydra without taking any damage.", ...unless((run) => run.damageTaken > 0, "You took damage.") },
    { id: "lightning_lure", name: "Lightning Lure", tier: "master", type: "Mechanical", description: "Kill the Alchemical Hydra without being hit by the lightning attack.", ...unless((run) => hitsFrom(run, "Lightning") > 0, "You were hit by the lightning attack.") },
    { id: "dont_flame_me", name: "Don't Flame Me", tier: "master", type: "Mechanical", description: "Kill the Alchemical Hydra without being hit by the flame wall attack.", ...unless((run) => hitsFrom(run, "Fire") > 0, "You were hit by the flame wall attack.") },
    { id: "unrequired_antipoisons", name: "Unrequired Antipoisons", tier: "master", type: "Mechanical", description: "Kill the Alchemical Hydra without being hit by the acid pool attack.", ...unless((run) => hitsFrom(run, "Poison pool") > 0, "You were hit by the acid pool attack.") },
    { id: "mixing_correctly", name: "Mixing Correctly", tier: "master", type: "Mechanical", description: "Kill the Alchemical Hydra without empowering it.", ...unless((run) => Boolean(run.facts.empowered), "The Alchemical Hydra was empowered.") },
    {
      id: "working_overtime", name: "Working Overtime", tier: "master", type: "Stamina", description: "Kill the Alchemical Hydra 15 times without leaving the room.",
      check: (run, progress) => progress.streak >= 15, target: (progress) => ({ current: Math.min(progress.streak, 15), of: 15 }),
    },
    { id: "alchemical_master", name: "Alchemical Master", tier: "master", type: "Kill Count", description: "Kill the Alchemical Hydra 150 times.", ...kills(150) },
    { id: "the_flame_skipper", name: "The Flame Skipper", tier: "master", type: "Mechanical", description: "Kill the Alchemical Hydra without letting it spawn a flame wall attack.", ...unless((run) => Boolean(run.facts.flameWall), "The Alchemical Hydra spawned a flame wall attack.") },
    { id: "alchemical_speed_chaser", name: "Alchemical Speed-Chaser", tier: "master", type: "Speed", description: "Kill the Alchemical Hydra in less than 1 minute 45 seconds.", ...under(105) },
    { id: "alchemical_speed_runner", name: "Alchemical Speed-Runner", tier: "grandmaster", type: "Speed", description: "Kill the Alchemical Hydra in less than 1 minute 20 seconds.", ...under(80) },
    {
      id: "no_pressure", name: "No Pressure", tier: "grandmaster", type: "Restriction",
      description: "Kill the Alchemical Hydra using only Dharok's Greataxe as a weapon whilst having no more than 10 Hitpoints throughout the entire fight.",
      check: (run) => run.weapons.size > 0 && isNoPressure(run),
      failed: (run) => (!onlyGreataxe(run) ? "You used a weapon other than Dharok's greataxe." : run.highestHp > 10 && "You had more than 10 Hitpoints."),
    },
  ],
};
