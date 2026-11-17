// Publishes every package in packages/ whose version isn't on npm yet.
// Packages you didn't bump are skipped, so you can run this after any change.
// If npm holds a version for your approval (staged publishing), approve it on
// npmjs.com (the package's Staged Packages tab) or with `npm stage approve <id>`.
//
//   npm run packages:publish              # publish
//   npm run packages:publish -- --dry-run # show what would be published
import { execFileSync, spawn } from "node:child_process"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"

const dryRun = process.argv.includes("--dry-run")
const npm = process.platform === "win32" ? "npm.cmd" : "npm"

const packages = readdirSync("packages")
  .map(dir => join("packages", dir))
  .filter(dir => existsSync(join(dir, "package.json")))
  .map(dir => ({ dir, ...JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) }))
  .filter(pkg => !pkg.private)

// Publish a package after the local packages it depends on.
const local = new Set(packages.map(pkg => pkg.name))
const localDeps = pkg => Object.keys(pkg.dependencies ?? {}).filter(name => local.has(name))
packages.sort((a, b) => localDeps(a).length - localDeps(b).length)

function isPublished(name, version) {
  try {
    return execFileSync(npm, ["view", `${name}@${version}`, "version"], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim() === version
  }
  catch {
    return false // The package isn't on npm at all yet.
  }
}

const todo = packages.filter(pkg => !isPublished(pkg.name, pkg.version))
for (const pkg of packages) {
  console.log(`${todo.includes(pkg) ? "→ publish" : "  skip   "}  ${pkg.name}@${pkg.version}`)
}
if (!todo.length) {
  console.log("\nNothing new to publish. Raise a package's version first (see README).")
  process.exit(0)
}

// Runs npm with its messages shown live (so login prompts still appear), keeping
// a copy of its errors to check afterwards.
function run(args) {
  return new Promise((resolve) => {
    const child = spawn(npm, args, { stdio: ["inherit", "inherit", "pipe"] })
    let stderr = ""
    child.stderr.on("data", (chunk) => {
      stderr += chunk
      process.stderr.write(chunk)
    })
    child.on("close", status => resolve({ status, stderr }))
  })
}

const waiting = []
for (const pkg of todo) {
  console.log(`\nPublishing ${pkg.name}@${pkg.version}${dryRun ? " (dry run)" : ""}`)
  const result = await run(["publish", `--workspace=${pkg.dir}`, ...(dryRun ? ["--dry-run"] : [])])
  if (result.status === 0) {
    continue
  }
  if (/previously staged/i.test(result.stderr)) {
    // Already uploaded earlier; npm is holding it until you approve it.
    waiting.push(`${pkg.name}@${pkg.version}`)
    continue
  }
  console.error(`\nStopped: ${pkg.name} failed to publish.`)
  process.exit(result.status ?? 1)
}
if (waiting.length) {
  console.log(`\nWaiting for your approval on npm: ${waiting.join(", ")}`)
  console.log("Approve them on npmjs.com (each package's Staged Packages tab), or run `npm stage list` then `npm stage approve <id>`.")
}
console.log(dryRun ? "\nDry run finished. Nothing was uploaded." : "\nDone.")
