import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import ts from "typescript";

function compile(source) {
  return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
}
const guardSource = compile(await readFile(new URL("../utils/preview.ts", import.meta.url), "utf8"));
const clientSource = compile(await readFile(new URL("../utils/supabase/server.ts", import.meta.url), "utf8"));
function previewFor(env) {
  const context = { exports: {}, process: { env } };
  vm.runInNewContext(guardSource, context);
  return context.exports.isLocalPreview();
}
assert.equal(previewFor({ NODE_ENV: "development", LOCAL_DEMO_PREVIEW: "true" }), true);
for (const NODE_ENV of ["production", "test", undefined]) {
  assert.equal(previewFor({ NODE_ENV, LOCAL_DEMO_PREVIEW: "true" }), false, `${NODE_ENV}: preview cannot bypass authentication`);
}
assert.equal(previewFor({ NODE_ENV: "development" }), false, "Missing keys/flag do not implicitly enable demo");
for (const preview of [true, false]) {
  let clientCalls = 0;
  const context = {
    exports: {},
    require(name) {
      if (name === "@/utils/preview") return { isLocalPreview: () => preview };
      if (name === "@/utils/supabase/env") return { getSupabaseEnv: () => null };
      if (name === "@supabase/ssr") return { createServerClient: () => { clientCalls++; throw new Error("Unexpected client creation"); } };
      if (name === "next/headers") return { cookies: () => { throw new Error("Unexpected cookie access"); } };
      throw new Error(`Unexpected import: ${name}`);
    },
  };
  vm.runInNewContext(clientSource, context);
  await assert.rejects(context.exports.createClient(), preview ? /disabled in Local demo preview/ : /Set NEXT_PUBLIC_SUPABASE_URL/);
  assert.equal(clientCalls, 0, "No client or network is created without credentials");
}
console.log("PASS: explicit development-only preview; production/test guards; normal missing-key validation; no Supabase client creation.");
