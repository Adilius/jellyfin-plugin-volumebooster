// Live check against a running Jellyfin Media Player / Jellyfin Desktop.
//
// 1. Quit the client, then start it with the DevTools port:
//      "C:\Program Files\Jellyfin\Jellyfin Media Player\JellyfinMediaPlayer.exe" --remote-debugging-port=9222
// 2. Start playing something (for loudness checks, dev/media tone files).
// 3. node scripts/jmp-smoke.mjs             -> report only
//    node scripts/jmp-smoke.mjs --set 150   -> also set the level through the patched player
//
// Requires Node 22+ (global WebSocket). Changes nothing unless --set is given.

const args = process.argv.slice(2);
const port = Number(args[args.indexOf("--port") + 1]) || 9222;
const setIndex = args.indexOf("--set");
const setLevel = setIndex >= 0 ? Number(args[setIndex + 1]) : null;

async function connect() {
  let targets;
  try {
    targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
  } catch {
    throw new Error(`Nothing on port ${port}. Start the client with --remote-debugging-port=${port} (quit it first; it is single-instance).`);
  }
  const page = targets.find((t) => t.type === "page" && /\/web\//.test(t.url)) || targets.find((t) => t.type === "page");
  if (!page) throw new Error("No page target found");
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    const p = pending.get(msg.id);
    if (p) {
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  };
  const evaluate = (expression) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject });
      ws.send(JSON.stringify({ id: n, method: "Runtime.evaluate", params: { expression, returnByValue: true, awaitPromise: true } }));
    }).then((r) => {
      if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || "evaluation failed");
      return r.result.value;
    });
  return { page, evaluate, close: () => ws.close() };
}

const probe = `(() => {
  const vb = window.__volumeBooster;
  const proto = (n) => window[n] && window[n].prototype;
  return {
    url: location.href,
    nativeShell: !!(window.api || window.apiPromise || window.jmpInfo),
    apiPlayerMethods: window.api && window.api.player ? Object.keys(window.api.player).filter((k) => typeof window.api.player[k] === "function").length : 0,
    scriptLoaded: !!vb,
    active: vb ? vb.active : false,
    reason: vb ? vb.reason || null : null,
    config: vb ? vb.config : null,
    videoPlayerPatched: !!(proto("_mpvVideoPlayer") && proto("_mpvVideoPlayer").__volumeBoosterPatched),
    audioPlayerPatched: !!(proto("_mpvAudioPlayer") && proto("_mpvAudioPlayer").__volumeBoosterPatched),
    level: vb && vb.getLevel ? vb.getLevel() : null,
    savedVolume: (() => { try { return localStorage.getItem("volume"); } catch { return "unavailable"; } })(),
  };
})()`;

const cdp = await connect();
try {
  console.log(`target: ${cdp.page.url}`);
  const before = await cdp.evaluate(probe);
  console.log(JSON.stringify(before, null, 2));

  if (setLevel !== null) {
    if (!before.active) throw new Error("Volume Booster is not active in this page; cannot set level");
    const ok = await cdp.evaluate(`window.__volumeBooster.setLevel(${JSON.stringify(setLevel)})`);
    const after = await cdp.evaluate(probe);
    console.log(`setLevel(${setLevel}) -> ${ok}; level now ${after.level}, saved ${after.savedVolume}`);
  }

  const problems = [];
  if (!before.nativeShell) problems.push("page has no JMP bridge (window.api) - is this the desktop client?");
  if (!before.scriptLoaded) problems.push("Volume Booster script not loaded - is the plugin active? Does /web/index.html contain <!-- Volume Booster -->?");
  if (before.scriptLoaded && !before.active) problems.push(`script inactive: ${before.reason}`);
  if (before.active && !before.videoPlayerPatched) problems.push("mpvVideoPlayer not patched yet (play a video once, then re-run)");
  console.log(problems.length ? `\nProblems:\n- ${problems.join("\n- ")}` : "\nOK");
  process.exitCode = problems.length ? 1 : 0;
} finally {
  cdp.close();
}
