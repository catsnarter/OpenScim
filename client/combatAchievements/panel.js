// The side panel's Combat Achievements tab (mounted by assets/Grid.js): the
// tasks of the fight on screen, done or not, their tiers and points, the kills
// that counted, and whether the fight now running can count. Plain DOM, kept
// in step with the store and the tracker's run. Its chat settings are in
// Settings, Interface, Game chat (assets/application.js).
import { combatAchievementsStore, subscribeToRun, getCombatAchievementsEngine, currentRun, currentStreak, ensureStyle, tierLabel } from "./index.js";
import { getCombatAchievements, taskKey, tierPoints, tierOrder } from "./tracker.js";

const css = `
.ca-panel { height: 100%; box-sizing: border-box; padding: 4px 6px 6px; overflow-y: auto; overscroll-behavior: contain;
  font: 16px/1.1 "RuneScape Plain 12", sans-serif; color: #ff981f; text-shadow: 1px 1px #000; user-select: none; }
.ca-panel__title { text-align: center; font-family: "RuneScape Bold 12", "RuneScape Plain 12", sans-serif; }
.ca-panel__line { display: flex; justify-content: space-between; gap: 6px; margin-top: 2px; }
.ca-panel__run { margin: 4px 0 2px; font-size: 13px; }
.ca-panel__run--counts { color: #0dc10d; }
.ca-panel__run--not { color: #ff3030; }
.ca-panel__run--idle { color: #9f9f9f; }
.ca-panel__empty { margin-top: 10px; color: #9f9f9f; text-align: center; }
.ca-panel__tier { margin-top: 6px; padding-bottom: 1px; border-bottom: 1px solid rgba(0, 0, 0, 0.45); color: #ffff00; }
.ca-task { margin-top: 3px; cursor: default; }
.ca-task__name { color: #ff3030; }
.ca-task--done .ca-task__name { color: #0dc10d; }
.ca-task__detail { color: #cec0a3; font-size: 12px; line-height: 1.15; margin-top: 1px; }
.ca-panel__reset { margin-top: 8px; width: 100%; font: inherit; color: #cec0a3; background: rgba(0, 0, 0, 0.25);
  border: 1px solid rgba(0, 0, 0, 0.55); cursor: pointer; text-shadow: 1px 1px #000; }
`;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function runLine(run, kind) {
  if (!run || run.kind !== kind || run.lastTick <= run.startTick) return ["idle", "Start the fight: a clean kill counts."];
  if (run.assisted.size > 0) return ["not", "This kill won't count: " + [...run.assisted].join(", ") + "."];
  if (run.ended === "death") return ["not", "You died: this run won't count."];
  if (run.ended === "kill") return ["counts", "Kill counted."];
  return ["counts", "This kill can count."];
}

/** Mounts the tab's content in `root`; returns its unmount. */
export function mountCombatAchievementsPanel(root) {
  ensureStyle("ca-panel-style", css);
  const panel = el("div", "ca-panel");
  root.append(panel);
  let shownKind;
  let runText = "";
  const runNode = el("div", "ca-panel__run");

  function render() {
    const kind = getCombatAchievementsEngine()?.getEncounterKind?.() ?? null;
    shownKind = kind;
    const achievements = getCombatAchievements(kind);
    const { completed, kills } = combatAchievementsStore.getState();
    panel.replaceChildren();
    panel.append(el("div", "ca-panel__title", "Combat Achievements"));
    if (!achievements) {
      panel.append(el("div", "ca-panel__empty", "This fight has no combat achievements here yet."));
      return;
    }
    const tasks = achievements.tasks;
    const done = tasks.filter((task) => completed[taskKey(kind, task)]);
    const points = (list) => list.reduce((sum, task) => sum + tierPoints[task.tier], 0);
    const summary = el("div", "ca-panel__line");
    summary.append(el("span", "", `Tasks: ${done.length}/${tasks.length}`), el("span", "", `Points: ${points(done)}/${points(tasks)}`));
    const killLine = el("div", "ca-panel__line");
    killLine.append(el("span", "", `Kills: ${kills[kind] ?? 0}`), el("span", "", `In a row: ${currentStreak()}`));
    panel.append(summary, killLine, runNode);
    runText = "";
    updateRun();
    const progress = { kills: kills[kind] ?? 0, streak: currentStreak() };
    for (const tier of tierOrder) {
      const ofTier = tasks.filter((task) => task.tier === tier);
      if (!ofTier.length) continue;
      panel.append(el("div", "ca-panel__tier", `${tierLabel(tier)} (${tierPoints[tier]} pt${tierPoints[tier] === 1 ? "" : "s"} each)`));
      for (const task of ofTier) {
        const isDone = Boolean(completed[taskKey(kind, task)]);
        const row = el("div", "ca-task" + (isDone ? " ca-task--done" : ""));
        row.title = `${task.type} task${isDone ? ", completed " + new Date(completed[taskKey(kind, task)]).toLocaleDateString() : ""}`;
        row.append(el("div", "ca-task__name", task.name));
        const target = !isDone && task.target ? task.target(progress) : null;
        row.append(el("div", "ca-task__detail", task.description + (target ? ` (${target.current}/${target.of})` : "")));
        panel.append(row);
      }
    }
    const reset = el("button", "ca-panel__reset", "Reset this boss's progress");
    reset.type = "button";
    reset.addEventListener("click", () => {
      if (window.confirm("Forget this boss's completed tasks and kill count, in this browser?")) combatAchievementsStore.reset(kind);
    });
    panel.append(reset);
  }

  function updateRun() {
    const [state, text] = runLine(currentRun(), shownKind);
    if (text === runText) return;
    runText = text;
    runNode.className = "ca-panel__run ca-panel__run--" + state;
    runNode.textContent = text;
  }

  render();
  const offStore = combatAchievementsStore.subscribe(render);
  const offRun = subscribeToRun(() => {
    const kind = getCombatAchievementsEngine()?.getEncounterKind?.() ?? null;
    if (kind !== shownKind) render();
    else updateRun();
  });
  return () => {
    offStore();
    offRun();
    panel.remove();
  };
}
