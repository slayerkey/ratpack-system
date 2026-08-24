import { rm } from "node:fs/promises";
await Promise.all([rm("out", { recursive: true, force: true }), rm("dist", { recursive: true, force: true })]);
