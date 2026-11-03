import { spawn } from "node:child_process";

// No credential substitution. Next's development runtime is required by the guard.
const child = spawn(process.execPath, ["node_modules/next/dist/bin/next", "dev", "--hostname", "127.0.0.1", ...process.argv.slice(2)], {
  stdio: "inherit",
  // Empty variables prevent .env files from supplying credentials to this child.
  // No environment files or secrets are edited.
  env: { ...process.env, LOCAL_DEMO_PREVIEW: "true", NEXT_PUBLIC_SUPABASE_URL: "", NEXT_PUBLIC_SUPABASE_ANON_KEY: "" },
});
child.on("exit", (code) => process.exit(code ?? 0));
