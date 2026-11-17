/* Shared lesson engine: progress, to-do list, quiz, simple task types, copy and reset buttons. */
window.Lesson = function (cfg) {
  const $ = id => document.getElementById(id);
  const KEY = cfg.key, TASKS = cfg.tasks, LABELS = cfg.labels;
  let done = {};
  try { done = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { done = {}; }
  done.x = done.x || {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(done)); } catch (e) {} };
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const fmt = n => Math.round(n).toLocaleString("uk-UA");
  const setStatus = (el, ok, txt) => { el.textContent = txt; el.className = "status " + (ok === null ? "" : ok ? "ok" : "bad"); };
  let ready = false;

  function renderProg() {
    const n = TASKS.filter(t => done[t]).length;
    done._n = n; done._total = TASKS.length; save();
    if (!ready) return;
    $("progTxt").textContent = n + " / " + TASKS.length;
    $("progBar").style.width = (n / TASKS.length * 100) + "%";
    $("todo").innerHTML = '<span class="hd">' + (n === TASKS.length ? "Заняття пройдено! Залишився тільки челендж ★, якщо хочеш." : "Що ще залишилось:") + "</span>" +
      Object.entries(LABELS).map(([t, [sec, txt]]) => `<a href="#${sec}"><span class="${done[t] ? "ok" : "no"}">${done[t] ? "✓" : "○"}</span><span>${txt}</span></a>`).join("");
    const secDone = {};
    for (const [t, [s]] of Object.entries(LABELS)) secDone[s] = (secDone[s] ?? true) && !!done[t];
    document.querySelectorAll("#plan a").forEach(a => { const s = a.getAttribute("href").slice(1); a.classList.toggle("done", !!secDone[s]); });
  }
  function mark(t, v = true) { done[t] = v; renderProg(); }

  const api = { $, done, mark, save, esc, fmt, setStatus };

  /* text/number answer with a check(value) -> [ok, message] */
  api.inputTask = ({ input, btn, status, task, check }) => {
    $(btn).addEventListener("click", () => {
      const [ok, msg] = check($(input).value.trim());
      setStatus($(status), ok, msg);
      if (ok && task) mark(task);
    });
  };

  /* several questions answered with dropdowns */
  api.selectTask = ({ el, items, options, btn, status, task, ok, bad }) => {
    $(el).innerHTML = items.map(([q], i) => `<div class="field"><label for="${el}_${i}">${q}</label><select id="${el}_${i}"><option value="">обери…</option>${(items[i][2] || options).map(o => `<option>${esc(o)}</option>`).join("")}</select></div>`).join("");
    $(btn).addEventListener("click", () => {
      const wrong = items.filter(([, a], i) => $(`${el}_${i}`).value !== a).length;
      if (!wrong) { setStatus($(status), true, ok); if (task) mark(task); }
      else setStatus($(status), false, "Неправильних відповідей: " + wrong + ". " + (bad || "Спробуй ще."));
    });
  };

  /* put steps in order with up/down buttons */
  api.orderTask = ({ el, btn, status, task, steps, start, ok, hint }) => {
    const ord = start.slice(), list = $(el);
    const render = () => {
      list.innerHTML = ord.map((k, i) => `<li><span class="n">${i + 1}.</span><span class="t">${steps[k]}</span><button type="button" data-mv="-1" data-i="${i}" aria-label="Вгору" ${i === 0 ? "disabled" : ""}>↑</button><button type="button" data-mv="1" data-i="${i}" aria-label="Вниз" ${i === ord.length - 1 ? "disabled" : ""}>↓</button></li>`).join("");
    };
    list.addEventListener("click", e => {
      const b = e.target.closest("[data-mv]"); if (!b) return;
      const i = +b.dataset.i, j = i + +b.dataset.mv;
      [ord[i], ord[j]] = [ord[j], ord[i]]; render();
      const nb = list.querySelectorAll("li")[j]?.querySelector(`[data-mv="${b.dataset.mv}"]`); if (nb && !nb.disabled) nb.focus();
    });
    render();
    $(btn).addEventListener("click", () => {
      const right = ord.filter((k, i) => k === i).length;
      if (right === steps.length) { setStatus($(status), true, ok); if (task) mark(task); }
      else setStatus($(status), false, "На своєму місці: " + right + " з " + steps.length + ". " + (hint || ""));
    });
  };

  /* "try it and tick" list, e.g. Windows hotkeys */
  api.checklist = ({ el, items, task }) => {
    $(el).innerHTML = items.map(([id, k, t]) => `<label class="keyrow ${done.x[id] ? "got" : ""}" style="cursor:pointer"><span class="k">${k}</span><span>${t}</span><input type="checkbox" data-ck="${id}" ${done.x[id] ? "checked" : ""} style="width:18px;height:18px;accent-color:var(--ok)" aria-label="Спробував"></label>`).join("");
    $(el).addEventListener("change", e => {
      const cb = e.target.closest("[data-ck]"); if (!cb) return;
      done.x[cb.dataset.ck] = cb.checked; cb.closest(".keyrow").classList.toggle("got", cb.checked);
      mark(task, items.every(([id]) => done.x[id]));
    });
  };

  /* inputs whose values persist; onChange(values) runs after every edit and on load */
  api.fields = (ids, onChange) => {
    const vals = () => Object.fromEntries(ids.map(id => [id, done.x[id] ?? ""]));
    ids.forEach(id => {
      const el = $(id);
      if (done.x[id] != null) el.value = done.x[id];
      const h = () => { done.x[id] = el.value.trim(); save(); onChange && onChange(vals()); };
      el.addEventListener("input", h); el.addEventListener("change", h);
    });
    onChange && onChange(vals());
  };
  api.num = v => { const n = parseFloat(String(v ?? "").replace(",", ".")); return isFinite(n) ? n : null; };

  /* quiz in #quiz with #quizCheck and #quizStatus; needs 4 of 5 */
  api.quiz = Q => {
    const quizEl = $("quiz");
    quizEl.innerHTML = Q.map((x, i) => `<fieldset class="q" style="border:0;margin:0"><legend style="padding:0;font-weight:700">${i + 1}. ${x.q}</legend>${x.a.map((o, j) => `<label><input type="radio" name="q${i}" id="q${i}_${j}" value="${j}"> <span>${o}</span></label>`).join("")}<div class="expl" hidden></div></fieldset>`).join("");
    $("quizCheck").addEventListener("click", () => {
      let score = 0;
      Q.forEach((x, i) => {
        const sel = quizEl.querySelector(`input[name=q${i}]:checked`), ex = quizEl.querySelectorAll(".expl")[i];
        ex.hidden = false;
        if (!sel) { ex.className = "expl bad"; ex.textContent = "Ти не обрав відповідь."; return; }
        const ok = +sel.value === x.c; if (ok) score++;
        ex.className = "expl " + (ok ? "ok" : "bad"); ex.textContent = (ok ? "Правильно. " : "Ні. ") + x.e;
      });
      const need = Q.length - 1;
      setStatus($("quizStatus"), score >= need, score + " з " + Q.length + (score === Q.length ? ". Чудово!" : score >= need ? ". Добре!" : ". Перечитай пояснення і спробуй ще."));
      if (score >= need) mark("quiz");
    });
  };

  /* call after the lesson's own setup */
  api.ready = () => {
    ready = true;
    const pb = $("progBtn"), todo = $("todo");
    pb.addEventListener("click", () => { todo.hidden = !todo.hidden; pb.setAttribute("aria-expanded", String(!todo.hidden)); });
    todo.addEventListener("click", e => { if (e.target.closest("a")) { todo.hidden = true; pb.setAttribute("aria-expanded", "false"); } });
    document.querySelectorAll("input[data-task]").forEach(cb => { cb.checked = !!done[cb.dataset.task]; cb.addEventListener("change", () => mark(cb.dataset.task, cb.checked)); });
    document.querySelectorAll(".copy").forEach(btn => btn.addEventListener("click", () => {
      const pre = btn.parentElement.querySelector("pre");
      const ok = () => { btn.textContent = "Скопійовано"; setTimeout(() => btn.textContent = "Копіювати", 1500); };
      const fallback = () => { const r = document.createRange(); r.selectNodeContents(pre); const s = getSelection(); s.removeAllRanges(); s.addRange(r); btn.textContent = "Виділено: Ctrl+C"; };
      try { navigator.clipboard.writeText(pre.textContent).then(ok, fallback); } catch (e) { fallback(); }
    }));
    const rb = $("resetBtn");
    if (rb) rb.addEventListener("click", () => {
      if (rb.dataset.armed) { try { localStorage.removeItem(KEY); } catch (e) {} location.reload(); return; }
      rb.dataset.armed = "1"; rb.textContent = "Точно скинути? Натисни ще раз";
      setTimeout(() => { delete rb.dataset.armed; rb.textContent = "Скинути прогрес цього заняття"; }, 4000);
    });
    renderProg();
  };
  return api;
};
