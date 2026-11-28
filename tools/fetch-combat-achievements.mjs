// Writes client/combatAchievements/tasks.js: every combat achievement task, as the OSRS Wiki keeps them (its
// `combat_achievement` bucket, the data behind WIKI: Combat Achievements/All tasks): the game's id, name, monster,
// description, tier and type. Run it again when the wiki changes; the diff shows the tasks added, renamed or reworded.
//
//   node tools/fetch-combat-achievements.mjs
import { writeFile } from "node:fs/promises";

const out = new URL("../client/combatAchievements/tasks.js", import.meta.url);
const query = 'bucket("combat_achievement").select("id","name","monster","task","tier","type").limit(5000).run()';
const url = "https://oldschool.runescape.wiki/api.php?action=bucket&format=json&query=" + encodeURIComponent(query);

const response = await fetch(url, { headers: { "User-Agent": "openscim-combat-achievements-fetch" } });
if (!response.ok) throw new Error(`the wiki answered ${response.status}`);
const rows = (await response.json()).bucket;
if (!Array.isArray(rows) || rows.length < 100) throw new Error("the wiki gave no task list");

// The wiki's markup in a description (a "sic" note, a link) is left out: only its text is kept.
const plain = (text) =>
  String(text)
    .replace(/<sup[\s\S]*?<\/sup>/g, "")
    .replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&#91;|&#93;/g, "")
    .replace(/\s+/g, " ")
    .trim();

const tasks = rows
  .map((row) => ({
    gameId: Number(row.id),
    name: plain(row.name),
    monster: plain(row.monster),
    description: plain(row.task),
    tier: String(row.tier).toLowerCase(),
    type: plain(row.type),
  }))
  .sort((a, b) => a.gameId - b.gameId);

const lines = tasks.map((task) => "  " + JSON.stringify(task) + ",");
await writeFile(
  out,
  `// Every combat achievement task (WIKI: Combat Achievements/All tasks, its \`combat_achievement\` bucket), written by
// tools/fetch-combat-achievements.mjs: do not edit by hand. ${tasks.length} tasks.
export const combatAchievementTasks = [
${lines.join("\n")}
];
`,
);
console.log(`${tasks.length} tasks written to client/combatAchievements/tasks.js`);
