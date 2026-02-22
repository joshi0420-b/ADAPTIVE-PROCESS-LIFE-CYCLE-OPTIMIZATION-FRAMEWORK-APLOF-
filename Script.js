// This file contain the overall logic of project :- 

(function () {
  // ---------- DOM Helpers ----------
  const $ = (id) => document.getElementById(id);
  const algorithmNameEl = $("algorithm-name");
  const resultsPanelEl = $("results-panel");
  const ganttChartEl = $("gantt-chart");
  const totalTimeEl = $("total-time");
  const metricsTableBodyEl = $("metrics-table-body");
  const avgTatEl = $("avg-tat");
  const avgWtEl = $("avg-wt");
  const messageBoxEl = $("message-box");

  const algoSelectEl = $("algorithm-select");
  const quantumGroupEl = $("quantum-input-group");
  const quantumInputEl = $("time-quantum");
  const csInputEl = $("context-switch-time");

  const comparisonTableBodyEl = $("comparison-table-body");
  const bestAlgoNameEl = $("best-algorithm-name");

  // ---------- Parsing ----------
  function parseInput() {
    const raw = $("process-data-input").value.trim();
    const lines = raw
      .replace(/\/\/.*$/gm, "") // remove comment lines inside textarea
      .split(/\n/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const processes = [];
    for (const line of lines) {
      // Expected: Name, AT, BT, Priority
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length < 3) continue;
      const name = parts[0];
      const at = Number(parts[1]);
      const bt = Number(parts[2]);
      const priority = parts.length >= 4 ? Number(parts[3]) : 9999; // default low priority if absent

      if (
        !name ||
        Number.isNaN(at) ||
        Number.isNaN(bt) ||
        bt < 0 ||
        at < 0 ||
        Number.isNaN(priority)
      ) {
        throw new Error(`Invalid line: "${line}". Use: Name, AT, BT, Priority`);
      }
      processes.push({
        name,
        at,
        bt,
        priority,
        remaining: bt,
        completion: 0,
        tat: 0,
        wt: 0,
      });
    }

    if (processes.length === 0) {
      throw new Error("No valid processes found. Enter at least one line.");
    }

    return processes;
  }

  // ---------- Utilities ----------
  function deepCopy(arr) {
    return arr.map((p) => ({ ...p }));
  }

  function allDone(ps) {
    return ps.every((p) => p.remaining === 0);
  }

  function computeMetrics(ps, segments) {
    // Completion time = last time the process executed (end of its final segment)
    const completionMap = new Map();
    for (const seg of segments) {
      if (seg.type === "exec" && seg.process) {
        completionMap.set(seg.process, seg.end);
      }
    }
    let totalTat = 0;
    let totalWt = 0;
    for (const p of ps) {
      p.completion = completionMap.get(p.name) ?? 0;
      p.tat = p.completion - p.at;
      p.wt = p.tat - p.bt;
      totalTat += p.tat;
      totalWt += p.wt;
    }
    const avgTat = ps.length ? totalTat / ps.length : 0;
    const avgWt = ps.length ? totalWt / ps.length : 0;
    return { avgTat, avgWt };
  }

  function pushSegment(segments, seg) {
    const last = segments[segments.length - 1];
    // Merge consecutive segments of same type+process
    if (
      last &&
      last.type === seg.type &&
      last.process === seg.process &&
      last.end === seg.start
    ) {
      last.end = seg.end;
      return;
    }
    segments.push(seg);
  }

  function addContextSwitchIfNeeded(segments, currentProcName, nextProcName, csTime, now) {
    if (csTime <= 0) return now;
    if (!currentProcName || currentProcName === nextProcName) return now;
    // Add CS segment
    pushSegment(segments, {
      label: "CS",
      type: "cs",
      process: null,
      start: now,
      end: now + csTime,
    });
    return now + csTime;
  }

  function addIdleIfNeeded(segments, start, end) {
    if (end > start) {
      pushSegment(segments, {
        label: "IDLE",
        type: "idle",
        process: null,
        start,
        end,
      });
    }
  }

  // ---------- Non-preemptive schedulers ----------
  function scheduleNonPreemptive(basePs, csTime, policy) {
    // policy: function(readyArray) -> chosen process by rule
    const ps = deepCopy(basePs).sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
    const segments = [];
    let time = 0;
    let current = null;

    const notArrived = [...ps];
    const ready = [];

    while (ready.length || notArrived.length) {
      // Move arrivals
      while (notArrived.length && notArrived[0].at <= time) {
        ready.push(notArrived.shift());
      }
      if (!ready.length) {
        // Jump to next arrival to avoid micro idle steps
        const nextArrival = notArrived[0].at;
        addIdleIfNeeded(segments, time, nextArrival);
        time = nextArrival;
        continue;
      }
      const next = policy(ready);
      // Remove from ready
      const idx = ready.indexOf(next);
      ready.splice(idx, 1);

      // Context switch if switching process
      time = addContextSwitchIfNeeded(segments, current?.name, next.name, csTime, time);
      current = next;

      // Run burst
      const start = time;
      const end = time + next.bt;
      pushSegment(segments, {
        label: next.name,
        type: "exec",
        process: next.name,
        start,
        end,
      });
      // Update remaining
      next.remaining = 0;
      time = end;
    }

    const { avgTat, avgWt } = computeMetrics(ps, segments);
    return { segments, processes: ps, avgTat, avgWt, totalTime: time };
  }

  function FCFS(basePs, csTime) {
    // Ready queue order: arrival time then input order (already sorted)
    return scheduleNonPreemptive(basePs, csTime, (ready) => {
      // Choose earliest arrival; if same AT, maintain order
      ready.sort((a, b) => a.at - b.at || a.name.localeCompare(b.name));
      return ready[0];
    });
  }

  function SJF(basePs, csTime) {
    return scheduleNonPreemptive(basePs, csTime, (ready) => {
      // Shortest BT; tie: earlier AT then name
      ready.sort((a, b) => a.bt - b.bt || a.at - b.at || a.name.localeCompare(b.name));
      return ready[0];
    });
  }

  function PriorityNP(basePs, csTime) {
    return scheduleNonPreemptive(basePs, csTime, (ready) => {
      // Highest priority (lowest number); tie: earlier AT then shorter BT then name
      ready.sort(
        (a, b) =>
          a.priority - b.priority ||
          a.at - b.at ||
          a.bt - b.bt ||
          a.name.localeCompare(b.name)
      );
      return ready[0];
    });
  }

  // ---------- Preemptive and RR schedulers (1ms tick simulation) ----------
  function tickSimulation(basePs, csTime, pickFn) {
    // pickFn(ready, current) => chosen process (SRJF / Priority-P)
    const ps = deepCopy(basePs);
    const segments = [];
    let time = 0;
    let current = null;

    const arrivals = deepCopy(basePs).sort((a, b) => a.at - b.at);
    const ready = [];
    let nextArrivalIdx = 0;

    while (!allDone(ps)) {
      // Bring all arrivals at this time
      while (nextArrivalIdx < arrivals.length && arrivals[nextArrivalIdx].at <= time) {
        const arrivingName = arrivals[nextArrivalIdx].name;
        const proc = ps.find((p) => p.name === arrivingName);
        ready.push(proc);
        nextArrivalIdx++;
      }

      // Choose next process
      const chosen = pickFn(ready, current, time);

      // Handle context switch if changing process
      if (chosen !== current) {
        const beforeName = current?.name || null;
        const afterName = chosen?.name || null;
        time = addContextSwitchIfNeeded(segments, beforeName, afterName, csTime, time);
        current = chosen;
      }

      if (!current) {
        // No process ready -> idle until next arrival
        const nextArrivalTime =
          nextArrivalIdx < arrivals.length ? arrivals[nextArrivalIdx].at : time + 1;
        const idleEnd = Math.max(nextArrivalTime, time + 1);
        addIdleIfNeeded(segments, time, idleEnd);
        time = idleEnd;
        continue;
      }

      // Execute 1 ms tick
      const start = time;
      const end = time + 1;
      pushSegment(segments, {
        label: current.name,
        type: "exec",
        process: current.name,
        start,
        end,
      });
      current.remaining -= 1;
      time = end;

      // If finished, remove from ready
      if (current.remaining === 0) {
        const idx = ready.indexOf(current);
        if (idx >= 0) ready.splice(idx, 1);
        current = null; // will pick new on next loop
      }
    }

    const totalTime = segments.length
      ? Math.max(...segments.map((s) => s.end))
      : 0;
    const { avgTat, avgWt } = computeMetrics(ps, segments);
    return { segments, processes: ps, avgTat, avgWt, totalTime };
  }

  function SRJF(basePs, csTime) {
    return tickSimulation(basePs, csTime, (ready, current) => {
      if (!ready.length) return null;
      // Shortest remaining; tie: earlier AT then name
      ready.sort(
        (a, b) =>
          a.remaining - b.remaining ||
          a.at - b.at ||
          a.name.localeCompare(b.name)
      );
      return ready[0];
    });
  }

  function PriorityP(basePs, csTime) {
    return tickSimulation(basePs, csTime, (ready) => {
      if (!ready.length) return null;
      // Highest priority (lowest number); tie: earlier AT then shorter remaining then name
      ready.sort(
        (a, b) =>
          a.priority - b.priority ||
          a.at - b.at ||
          a.remaining - b.remaining ||
          a.name.localeCompare(b.name)
      );
      return ready[0];
    });
  }

  function RoundRobin(basePs, csTime, quantum) {
    const ps = deepCopy(basePs);
    const segments = [];
    let time = 0;
    let current = null;

    const arrivals = deepCopy(basePs).sort((a, b) => a.at - b.at);
    let nextArrivalIdx = 0;
    const rq = []; // RR queue

    function enqueueIfNewArrivals() {
      while (nextArrivalIdx < arrivals.length && arrivals[nextArrivalIdx].at <= time) {
        const arrivingName = arrivals[nextArrivalIdx].name;
        const proc = ps.find((p) => p.name === arrivingName);
        rq.push(proc);
        nextArrivalIdx++;
      }
    }

    enqueueIfNewArrivals();

    while (!allDone(ps)) {
      if (!rq.length) {
        // Idle until next arrival
        const nextArrivalTime =
          nextArrivalIdx < arrivals.length ? arrivals[nextArrivalIdx].at : time + 1;
        addIdleIfNeeded(segments, time, nextArrivalTime);
        time = nextArrivalTime;
        enqueueIfNewArrivals();
        continue;
      }

      const next = rq.shift();

      // Context switch if needed
      time = addContextSwitchIfNeeded(segments, current?.name, next.name, csTime, time);
      current = next;

      // Run up to quantum or until finish, 1ms ticks to capture arrivals mid-slice
      let used = 0;
      while (used < quantum && current.remaining > 0) {
        // Tick
        const start = time;
        const end = time + 1;
        pushSegment(segments, {
          label: current.name,
          type: "exec",
          process: current.name,
          start,
          end,
        });
        current.remaining -= 1;
        used += 1;
        time = end;

        // Enqueue any arrivals that happened at this time
        enqueueIfNewArrivals();
      }

      // If finished, do not requeue
      if (current.remaining > 0) {
        // Not finished: requeue at end
        rq.push(current);
      }
      // Current slice ends; next loop picks new head (may be same process later, CS will be skipped if same)
    }

    const totalTime = segments.length
      ? Math.max(...segments.map((s) => s.end))
      : 0;
    const { avgTat, avgWt } = computeMetrics(ps, segments);
    return { segments, processes: ps, avgTat, avgWt, totalTime };
  }

  // ---------- Rendering ----------
  function clearNode(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function renderGantt(segments) {
    clearNode(ganttChartEl);
    if (!segments.length) return;

    const total = Math.max(...segments.map((s) => s.end));
    totalTimeEl.textContent = String(total);

    // Build bars with percentage widths
    for (const seg of segments) {
      const dur = seg.end - seg.start;
      const widthPct = (dur / total) * 100;

      const bar = document.createElement("div");
      bar.className =
        seg.type === "exec"
          ? "gantt-bar"
          : seg.type === "cs"
          ? "cs-bar"
          : "idle-bar";
      bar.style.width = `${widthPct}%`;
      bar.style.display = "inline-block";
      bar.style.position = "relative";
      bar.style.height = "24px";
      bar.style.marginRight = "2px";

      // Tooltip-like label
      const label = document.createElement("span");
      label.textContent =
        seg.type === "exec"
          ? `${seg.process} [${seg.start}-${seg.end}]`
          : seg.type === "cs"
          ? `CS [${seg.start}-${seg.end}]`
          : `IDLE [${seg.start}-${seg.end}]`;
      label.style.fontSize = "10px";
      label.style.position = "absolute";
      label.style.top = "50%";
      label.style.left = "4px";
      label.style.transform = "translateY(-50%)";
      label.style.color = "#e71d1dff";

      bar.appendChild(label);
      ganttChartEl.appendChild(bar);
    }
  }

  function renderMetrics(ps) {
    clearNode(metricsTableBodyEl);
    for (const p of ps
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const tr = document.createElement("tr");
      const cells = [
        p.name,
        p.at,
        p.bt,
        p.priority,
        p.completion,
        p.tat,
        p.wt,
      ];
      for (const val of cells) {
        const td = document.createElement("td");
        td.textContent = String(val);
        tr.appendChild(td);
      }
      metricsTableBodyEl.appendChild(tr);
    }
  }

  function renderAverages(avgTat, avgWt) {
    avgTatEl.textContent = avgTat.toFixed(2);
    avgWtEl.textContent = avgWt.toFixed(2);
  }

  function renderComparison(comparisons) {
    clearNode(comparisonTableBodyEl);
    for (const row of comparisons) {
      const tr = document.createElement("tr");
      const tdAlgo = document.createElement("td");
      const tdTat = document.createElement("td");
      const tdWt = document.createElement("td");
      tdAlgo.textContent = row.algoLabel;
      tdTat.textContent = row.avgTat.toFixed(2);
      tdWt.textContent = row.avgWt.toFixed(2);
      tr.appendChild(tdAlgo);
      tr.appendChild(tdTat);
      tr.appendChild(tdWt);
      comparisonTableBodyEl.appendChild(tr);
    }
  }

  // ---------- Controls ----------
  function getSelectedAlgo() {
    return algoSelectEl.value;
  }

  function algorithmLabel(key) {
    switch (key) {
      case "FCFS":
        return "First-Come, First-Served (FCFS)";
      case "SJF":
        return "Shortest Job First (Non-Preemptive)";
      case "RR":
        return "Round Robin (RR)";
      case "SRJF":
        return "Shortest Remaining Job First (Preemptive)";
      case "NP_PRIORITY":
        return "Priority (Non-Preemptive)";
      case "P_PRIORITY":
        return "Priority (Preemptive)";
      default:
        return key;
    }
  }

  function updateControlFields() {
    const algo = getSelectedAlgo();
    if (algo === "RR") {
      quantumGroupEl.classList.remove("hidden");
    } else {
      quantumGroupEl.classList.add("hidden");
    }
  }
  window.updateControlFields = updateControlFields;

  // ---------- Main runner ----------
  function runDetailed(basePs, algo, csTime, quantum) {
    switch (algo) {
      case "FCFS":
        return FCFS(basePs, csTime);
      case "SJF":
        return SJF(basePs, csTime);
      case "RR":
        return RoundRobin(basePs, csTime, Math.max(1, quantum));
      case "SRJF":
        return SRJF(basePs, csTime);
      case "NP_PRIORITY":
        return PriorityNP(basePs, csTime);
      case "P_PRIORITY":
        return PriorityP(basePs, csTime);
      default:
        throw new Error("Unsupported algorithm: " + algo);
    }
  }

  function runAllComparisons(basePs, csTime, quantum) {
    const entries = [
      { key: "FCFS" },
      { key: "SJF" },
      { key: "RR" },
      { key: "SRJF" },
      { key: "NP_PRIORITY" },
      { key: "P_PRIORITY" },
    ];

    const comparisons = [];
    for (const e of entries) {
      const res =
        e.key === "RR"
          ? RoundRobin(basePs, csTime, Math.max(1, quantum))
          : runDetailed(basePs, e.key, csTime, quantum);
      comparisons.push({
        algoKey: e.key,
        algoLabel: algorithmLabel(e.key),
        avgTat: res.avgTat,
        avgWt: res.avgWt,
      });
    }
    // Pick best: lowest avg TAT, then lowest avg WT
    comparisons.sort((a, b) => a.avgTat - b.avgTat || a.avgWt - b.avgWt);
    const best = comparisons[0];

    return { comparisons, best };
  }

  function runFullAnalysisAndDisplay() {
    try {
      messageBoxEl.classList.add("hidden");
      messageBoxEl.textContent = "";

      const basePs = parseInput();
      const algo = getSelectedAlgo();
      const quantum = Number(quantumInputEl.value || 4);
      const csTime = Number(csInputEl.value || 0);

      const detailed = runDetailed(basePs, algo, csTime, quantum);

      // Render detailed
      algorithmNameEl.textContent = algorithmLabel(algo);
      renderGantt(detailed.segments);
      renderMetrics(detailed.processes);
      renderAverages(detailed.avgTat, detailed.avgWt);
      resultsPanelEl.classList.remove("hidden");

      // Run comparisons and recommendation
      const { comparisons, best } = runAllComparisons(basePs, csTime, quantum);
      renderComparison(comparisons);
      bestAlgoNameEl.textContent = `${best.algoLabel} (Avg TAT: ${best.avgTat.toFixed(
        2
      )} ms, Avg WT: ${best.avgWt.toFixed(2)} ms)`;
    } catch (err) {
      messageBoxEl.textContent = err.message || String(err);
      messageBoxEl.classList.remove("hidden");
    }
  }
  window.runFullAnalysisAndDisplay = runFullAnalysisAndDisplay;

  // ---------- Init ----------
  updateControlFields();
})();

