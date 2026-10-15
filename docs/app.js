"use strict";
const data = window.GALLERY_DATA || { scenes: [] };
const $ = id => document.getElementById(id);
function el(tag, text, className) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = String(text);
  if (className) node.className = className;
  return node;
}
function imageSource(value) {
  if (typeof value !== "string" || !/^images\/[a-zA-Z0-9_-]+\.png$/.test(value)) throw new Error("Некорректный путь изображения");
  return value;
}
function reply(entry) {
  const row = el("div", undefined, "reply");
  row.append(el("strong", entry.agent), el("p", entry.reply));
  return row;
}
function score(name, value) {
  const row = el("div", undefined, "score");
  row.append(el("span", name), el("strong", String(value).replace(".", ",") + " / 10"));
  return row;
}
function renderChecks(crit, state) {
  const nodes = [];
  const names = Object.fromEntries([...(state.scene.requirements || []), ...(crit.previous_tasks || [])].map(item => [item.id, item.text || item.instruction]));
  const labels = { done: "Выполнено", partial: "Частично", missing: "Не выполнено" };
  for (const [name, items] of [["Требования сцены", crit.checks || []], ["Предыдущие правки", crit.revision_checks || []]]) {
    if (!items.length) continue;
    nodes.push(el("h4", name));
    for (const item of items) {
      const row = el("div", undefined, "check"), heading = el("div", undefined, "check-title");
      heading.append(el("strong", names[item.id] || item.id), el("span", labels[item.status]));
      row.append(heading, el("p", item.evidence));
      nodes.push(row);
    }
  }
  if (crit.balance_reason) nodes.push(el("p", "Баланс стилей: " + crit.balance_reason, "muted"));
  for (const limit of crit.score_limits || []) {
    nodes.push(el("p", (limit.genre === "western" ? "Вестерн" : "Фантастика") + ": балл ограничен " + limit.ceiling + "/10. Не завершено: " + limit.incomplete.map(id => names[id] || id).join("; "), "muted"));
  }
  $("checks").replaceChildren(...nodes);
}
function selectTake(state, index) {
  const draft = state.drafts[index], crit = draft.critique;
  renderChecks(crit, state);
  $("frame-title").textContent = state.scene.title;
  $("take-label").textContent = "Дубль " + (index + 1) + " из " + state.drafts.length;
  $("frame-image").src = imageSource(draft.gallery_image);
  $("frame-image").alt = state.scene.title + ", дубль " + (index + 1);
  $("frame-caption").textContent = draft.generation.dimensions.join(" × ") + (state.final.take === index ? " · выбранный дубль" : " · промежуточный дубль");
  $("scores").replaceChildren(score("Вестерн", crit.western_score), score("Фантастика", crit.scifi_score), score("Цельность", crit.coherence_score), score("Действие", crit.scene_score));
  $("feedback").textContent = crit.feedback;
  $("evidence").replaceChildren(el("p", "Вестерн: " + crit.western_evidence.join("; ")), el("p", "Фантастика: " + crit.scifi_evidence.join("; ")));
  $("changes").replaceChildren(...crit.changes.map(item => el("li", item)));
  if (!crit.changes.length) $("changes").append(el("li", "Дополнительных изменений не предложено."));
  $("decision").textContent = state.final.take === index ? (state.final.accepted ? "Выбранный дубль прошёл условия критика." : "Выбранный дубль сохранил замечания критика.") : "Промежуточный дубль. Выбран дубль " + (state.final.take + 1) + ".";
  $("prompt").textContent = draft.prompt;
  $("parameters").textContent = JSON.stringify(draft.generation, null, 2);
  $("takes").querySelectorAll("button").forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
}
function selectScene(state) {
  $("frame-view").hidden = false;
  $("empty").hidden = true;
  $("scenes").querySelectorAll("button").forEach(button => button.setAttribute("aria-pressed", String(button.dataset.scene === state.scene.id)));
  $("takes").replaceChildren(...state.drafts.map((draft, i) => {
    const button = el("button", String(i + 1) + (state.final.take === i ? " · выбор" : ""));
    button.type = "button";
    button.setAttribute("aria-label", "Дубль " + (i + 1) + (state.final.take === i ? ", выбранный" : ""));
    button.addEventListener("click", () => selectTake(state, i));
    return button;
  }));
  const log = [el("h4", "До генерации", "stage-label"), ...state.dialogue.map(reply)];
  for (const draft of state.drafts) {
    log.push(el("h4", "Дубль " + (draft.index + 1), "stage-label"));
    const verdict = el("div", undefined, "reply critic");
    verdict.append(el("strong", "Критик"), el("p", draft.critique.feedback));
    log.push(verdict, ...draft.replies.map(reply));
  }
  $("dialogue").replaceChildren(...log);
  selectTake(state, state.final.take);
}
const scenes = data.scenes.filter(state => state.status === "completed");
$("count").textContent = scenes.length ? scenes.length + " сцен" : "";
$("scenes").replaceChildren(...scenes.map((state, i) => {
  const button = el("button", undefined, "scene-button");
  button.type = "button";
  button.dataset.scene = state.scene.id;
  button.setAttribute("aria-label", "Сцена " + (i + 1) + ": " + state.scene.title);
  const preview = el("img");
  preview.src = imageSource(state.final.gallery_image);
  preview.alt = "";
  const caption = el("span", undefined, "scene-name");
  caption.append(el("span", String(i + 1).padStart(2, "0"), "scene-number"), el("span", state.scene.title));
  button.append(preview, caption);
  button.addEventListener("click", () => selectScene(state));
  return button;
}));
if (scenes.length) {
  const cover = scenes.find(state => state.final.accepted) || scenes[0];
  document.querySelector(".intro").style.setProperty("--hero-image", 'url("' + imageSource(cover.final.gallery_image) + '")');
  selectScene(scenes[0]);
}
if (data.comparison) {
  const comparison = data.comparison, state = scenes.find(item => item.scene.id === comparison.scene_id);
  if (state) {
    $("comparison").hidden = false;
    $("comparison-intro").textContent = state.scene.title + ". Обе модели получили один короткий английский промпт.";
    $("comparison-yandex").src = imageSource(comparison.yandex_comparison?.gallery_image || state.final.gallery_image);
    $("comparison-hf").src = imageSource(comparison.gallery_image);
    $("comparison-feedback").textContent = "SDXL Turbo: " + comparison.critique.feedback;
    $("comparison-yandex-feedback").textContent = comparison.yandex_comparison ? "Yandex ART: " + comparison.yandex_comparison.critique.feedback : "";
    $("comparison-prompt").textContent = comparison.prompt;
    $("comparison-parameters").textContent = JSON.stringify({ SDXL: comparison.generation, Yandex: comparison.yandex_comparison?.generation }, null, 2);
    $("comparison-warning").textContent = comparison.generation.prompt_truncated ? "Промпт SDXL был усечён текстовым энкодером." : "Промпт передан без усечения. Разрешение и процессы генерации моделей различаются.";
  }
}
if (data.summary?.length) {
  const table = el("table");
  table.setAttribute("aria-label", "Оценки выбранных дублей");
  const head = el("thead"), header = el("tr");
  for (const label of ["Сцена", "Дубли", "Вестерн", "Фантастика", "Цельность", "Принят"]) {
    const cell = el("th", label); cell.scope = "col"; header.append(cell);
  }
  head.append(header); table.append(head);
  const body = el("tbody");
  for (const row of data.summary) {
    const tr = el("tr");
    for (const value of [row.scene, row.takes, row.western, row.scifi, row.coherence, row.accepted ? "Да" : "Нет"]) tr.append(el("td", value));
    body.append(tr);
  }
  table.append(body); $("results-table").replaceChildren(table);
}
