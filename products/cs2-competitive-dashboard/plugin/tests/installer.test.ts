import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import { generateGsiConfig } from "../src/gsi/installer.js";
import { normalizeManualCs2Path, parseInstallDir, parseSteamLibraries, parseSteamLibraryPaths } from "../src/gsi/steam-locator.js";

test("GSI config binds to localhost root and requests only approved normal-player components", () => {
  const config = generateGsiConfig(32123, "secret-token");
  assert.match(config, /"uri" "http:\/\/127\.0\.0\.1:32123\/"/);
  assert.doesNotMatch(config, /32123\/gsi/);
  assert.match(config, /"token" "secret-token"/);
  assert.match(config, /"player_state" "1"/);
  assert.match(config, /"player_match_stats" "1"/);
  assert.doesNotMatch(config, /"phase_countdowns"/);
  assert.doesNotMatch(config, /"allplayers_/);
  assert.doesNotMatch(config, /"allgrenades"/);
});

test("parses custom Steam library paths and CS2 install folder", () => {
  const vdf = `"libraryfolders"\n{\n  "1"\n  {\n    "path" "D:\\\\SteamLibrary"\n  }\n  "2"\n  {\n    "path" "E:\\\\Games\\\\Steam"\n  }\n}`;
  assert.deepEqual(parseSteamLibraryPaths(vdf), ["D:\\SteamLibrary", "E:\\Games\\Steam"]);
  assert.equal(parseInstallDir(`"AppState" { "appid" "730" "installdir" "Counter-Strike Global Offensive" }`), "Counter-Strike Global Offensive");
});

test("marks the Steam library that explicitly owns app 730", () => {
  const vdf = `"libraryfolders"\n{\n  "0"\n  {\n    "path" "C:\\\\Program Files (x86)\\\\Steam"\n    "apps"\n    {\n      "570" "1"\n    }\n  }\n  "1"\n  {\n    "path" "D:\\\\SteamLibrary"\n    "apps"\n    {\n      "730" "1"\n      "252490" "1"\n    }\n  }\n}`;
  assert.deepEqual(parseSteamLibraries(vdf), [
    { path: "C:\\Program Files (x86)\\Steam", hasCs2: false },
    { path: "D:\\SteamLibrary", hasCs2: true }
  ]);
});

test("manual override accepts both the CS2 install root and game csgo cfg folder", () => {
  const install = path.resolve("C:\\SteamLibrary\\steamapps\\common\\Counter-Strike Global Offensive");
  const fromRoot = normalizeManualCs2Path(install);
  assert.equal(fromRoot.installDir, install);
  assert.equal(fromRoot.cfgDir, path.join(install, "game", "csgo", "cfg"));

  const cfg = path.join(install, "game", "csgo", "cfg");
  const fromCfg = normalizeManualCs2Path(cfg);
  assert.equal(fromCfg.installDir, install);
  assert.equal(fromCfg.cfgDir, cfg);
});
