// Fails when build.yaml, Directory.Build.props and web/package.json disagree.
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const yaml = read("build.yaml").match(/^version:\s*"([^"]+)"/m)?.[1];
const props = read("Directory.Build.props");
const tags = ["Version", "AssemblyVersion", "FileVersion"].map((t) => props.match(new RegExp(`<${t}>([^<]+)</${t}>`))?.[1]);
const pkg = JSON.parse(read("web/package.json")).version;

const problems = [];
if (!yaml || !/^\d+\.\d+\.\d+\.0$/.test(yaml)) problems.push(`build.yaml version must look like X.Y.Z.0 (got ${yaml})`);
tags.forEach((v, i) => {
  if (v !== yaml) problems.push(`Directory.Build.props ${["Version", "AssemblyVersion", "FileVersion"][i]}=${v} != build.yaml ${yaml}`);
});
if (yaml && pkg !== yaml.split(".").slice(0, 3).join(".")) problems.push(`web/package.json version ${pkg} != ${yaml}`);

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log(`version ${yaml} consistent`);
