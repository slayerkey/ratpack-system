import assert from "node:assert/strict";
import test from "node:test";
import { generateGsiConfig } from "../src/gsi/installer.js";
import { parseInstallDir, parseSteamLibraryPaths } from "../src/gsi/steam-locator.js";

test("GSI config binds to localhost and requests only approved normal-player components", () => {
  const config = generateGsiConfig(32123, "secret-token");
  assert.match(config, /127\.0\.0\.1:32123\/gsi/);
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
