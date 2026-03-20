import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const sourceRendererDir = path.join(projectRoot, "src", "renderer");
const targetRendererDir = path.join(projectRoot, "dist", "renderer");

await mkdir(targetRendererDir, { recursive: true });
await cp(sourceRendererDir, targetRendererDir, { recursive: true });
