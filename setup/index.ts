import { join } from "path";
import { homedir } from "os";
import { lstatSync } from "fs";
import { $ } from "bun";
import { program } from "commander";
import { input, confirm } from "@inquirer/prompts";

const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const OPENCODE_SOURCE_DIR = join(import.meta.dir, "..", "opencode");

function pathExists(path: string): boolean {
  try {
    lstatSync(path);
    return true;
  } catch {
    return false;
  }
}

program
  .name("setup")
  .description("Setup opencode configuration by copying files to ~/.config/opencode")
  .action(async () => {
    console.log("\n=== OpenCode Setup ===\n");

    // Check if config directory/symlink exists
    if (pathExists(OPENCODE_CONFIG_DIR)) {
      console.log(`Found existing config at: ${OPENCODE_CONFIG_DIR}`);
      const shouldContinue = await confirm({
        message: "This will DELETE the existing directory/symlink. Continue?",
        default: false,
      });

      if (!shouldContinue) {
        console.log("Aborted.");
        process.exit(0);
      }

      console.log("Removing existing config...");
      await $`rm -rf ${OPENCODE_CONFIG_DIR}`.quiet();
    }

    // Ensure parent directory exists
    const parentDir = join(homedir(), ".config");
    await $`mkdir -p ${parentDir}`.quiet();

    // Copy all files from opencode directory (excluding .gitignore, bun.lock, package.json)
    console.log(`Copying files from: ${OPENCODE_SOURCE_DIR}`);
    console.log(`To: ${OPENCODE_CONFIG_DIR}`);
    
    await $`mkdir -p ${OPENCODE_CONFIG_DIR}`.quiet();
    
    // Copy directories
    await $`cp -r ${join(OPENCODE_SOURCE_DIR, "commands")} ${OPENCODE_CONFIG_DIR}/`.quiet();
    await $`cp -r ${join(OPENCODE_SOURCE_DIR, "config")}/* ${OPENCODE_CONFIG_DIR}/`.quiet();
    await $`cp -r ${join(OPENCODE_SOURCE_DIR, "plugin")} ${OPENCODE_CONFIG_DIR}/`.quiet();
    
    console.log("Files copied successfully!");

    // Ask for API configuration
    console.log("\n=== Token Tracker API Configuration ===\n");

    const apiUrl = await input({
      message: "Enter the API URL for sending events:",
    });

    const apiKey = await input({
      message: "Enter the API key:",
    });

    if (apiUrl && apiKey) {
      const config = {
        apiUrl,
        apiKey,
      };

      const configPath = join(OPENCODE_CONFIG_DIR, "token-tracker.json");
      await Bun.write(configPath, JSON.stringify(config, null, 2));
      console.log(`\nConfig saved to: ${configPath}`);
    } else {
      console.log(
        "\nSkipping API config (no URL or key provided). Token tracking disabled."
      );
    }

    console.log("\n=== Setup Complete ===\n");
  });

program.parse();
