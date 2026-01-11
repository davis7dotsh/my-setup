import { join } from "path";
import { homedir } from "os";
import { $ } from "bun";

const OPENCODE_CONFIG_DIR = join(homedir(), ".config", "opencode");
const SOURCE_DIR = join(import.meta.dir, "..", "opencode");

async function prompt(question: string): Promise<string> {
  process.stdout.write(question);
  for await (const line of console) {
    return line.trim();
  }
  return "";
}

async function main() {
  console.log("\n=== OpenCode Setup ===\n");

  // Check if config directory exists
  const configDir = Bun.file(OPENCODE_CONFIG_DIR);
  if (await configDir.exists()) {
    console.log(`Found existing config at: ${OPENCODE_CONFIG_DIR}`);
    const confirm = await prompt(
      "This will DELETE the existing directory. Continue? (y/N): "
    );

    if (confirm.toLowerCase() !== "y") {
      console.log("Aborted.");
      process.exit(0);
    }

    console.log("Removing existing config directory...");
    await $`rm -rf ${OPENCODE_CONFIG_DIR}`.quiet();
  }

  // Ensure parent directory exists
  const parentDir = join(homedir(), ".config");
  await $`mkdir -p ${parentDir}`.quiet();

  // Create symlink
  console.log(`Creating symlink: ${OPENCODE_CONFIG_DIR} -> ${SOURCE_DIR}`);
  await $`ln -s ${SOURCE_DIR} ${OPENCODE_CONFIG_DIR}`.quiet();
  console.log("Symlink created successfully!");

  // Ask for API configuration
  console.log("\n=== Token Tracker API Configuration ===\n");

  const apiUrl = await prompt("Enter the API URL for sending events: ");
  const apiKey = await prompt("Enter the API key: ");

  if (apiUrl && apiKey) {
    const config = {
      apiUrl,
      apiKey,
    };

    const configPath = join(SOURCE_DIR, "token-tracker.json");
    await Bun.write(configPath, JSON.stringify(config, null, 2));
    console.log(`\nConfig saved to: ${configPath}`);
  } else {
    console.log(
      "\nSkipping API config (no URL or key provided). Token tracking disabled."
    );
  }

  console.log("\n=== Setup Complete ===\n");
}

main().catch(console.error);
