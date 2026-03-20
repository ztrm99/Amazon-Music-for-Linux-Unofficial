import { spawnSync } from "node:child_process";

const target = process.argv[2] ?? "linux";

function hasCommand(command) {
  const result = spawnSync("sh", ["-lc", `command -v ${command}`], {
    stdio: "ignore"
  });

  return result.status === 0;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (target === "pacman" || target === "linux") {
  if (!hasCommand("bsdtar")) {
    fail(
      [
        "Missing required packaging dependency: bsdtar",
        "",
        "The pacman target used by electron-builder/FPM requires bsdtar.",
        "On Ubuntu, install it with:",
        "  sudo apt install libarchive-tools",
        "",
        "Then rerun:",
        target === "pacman" ? "  npm run dist:arch" : "  npm run dist:linux"
      ].join("\n")
    );
  }
}
