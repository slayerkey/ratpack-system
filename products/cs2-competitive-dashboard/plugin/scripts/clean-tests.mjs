import { rm } from "node:fs/promises";
await rm(".test-build", { recursive: true, force: true });
