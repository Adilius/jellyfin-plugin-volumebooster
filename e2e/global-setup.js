// Waits for the server, completes the first-run wizard if needed (user dev/dev)
// and checks that the plugin is loaded.
const base = process.env.JF_URL || "http://localhost:8096";
const user = process.env.JF_USER || "dev";
const pass = process.env.JF_PASS || "dev";
const auth = 'MediaBrowser Client="e2e", Device="e2e", DeviceId="volumebooster-e2e", Version="1.0"';
const json = { "Content-Type": "application/json" };

async function waitForServer() {
  for (let i = 0; i < 120; i++) {
    try {
      const r = await fetch(`${base}/System/Info/Public`);
      // Jellyfin answers 503 "Server is loading" while starting.
      if (r.ok) {
        const probe = await fetch(`${base}/web/index.html`);
        if (probe.ok && !(await probe.text()).includes("is loading")) {
          const info = await r.json();
          return { StartupWizardCompleted: info.StartupWizardCompleted ?? info.startupWizardCompleted };
        }
      }
    } catch {}
    await new Promise((res) => setTimeout(res, 1000));
  }
  throw new Error(`Jellyfin not reachable at ${base}`);
}

async function post(path, body, headers = {}) {
  const r = await fetch(`${base}${path}`, { method: "POST", headers: { ...json, ...headers }, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(`${path}: ${r.status}`);
  return r;
}

export default async function globalSetup() {
  const info = await waitForServer();
  if (!info.StartupWizardCompleted) {
    await post("/Startup/Configuration", { UICulture: "en-US", MetadataCountryCode: "US", PreferredMetadataLanguage: "en" });
    await fetch(`${base}/Startup/User`);
    await post("/Startup/User", { Name: user, Password: pass });
    await post("/Startup/Complete", {});
  }
  const login = await (await post("/Users/AuthenticateByName", { Username: user, Pw: pass }, { Authorization: auth })).json();
  const plugins = await (await fetch(`${base}/Plugins`, { headers: { Authorization: `${auth}, Token="${login.AccessToken}"` } })).json();
  for (const name of ["Volume Booster"]) {
    const p = plugins.find((x) => x.Name === name);
    if (!p || p.Status !== "Active") throw new Error(`plugin ${name} is not active: ${JSON.stringify(p)}`);
  }
}
