// Local browser verification, using an installed Chrome (no packages or downloads).
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const base = process.argv[2] || "http://127.0.0.1:3000";
const chromePath = process.env.CHROME_PATH || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const output = await mkdtemp(join(tmpdir(), "4pointo-dashboard-"));
const chrome = spawn(chromePath, ["--headless=new", "--no-first-run", "--no-default-browser-check", "--disable-background-networking", "--remote-debugging-port=9337", `--user-data-dir=${join(output, "browser")}`, "about:blank"], { windowsHide: true, stdio: "ignore" });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
let sequence = 0;
const pending = new Map();
const network = [];
const exceptions = [];
const checks = [];
try {
  let browser;
  for (let i = 0; i < 40; i++) {
    try { browser = await (await fetch("http://127.0.0.1:9337/json/version")).json(); break; } catch { await delay(250); }
  }
  assert(browser, "Chrome debugging endpoint is available");
  socket = new WebSocket(browser.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  socket.onmessage = ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) request?.reject(new Error(JSON.stringify(message.error)));
      else request?.resolve(message.result);
    }
    if (message.method === "Network.requestWillBeSent") network.push(message.params.request.url);
    if (message.method === "Runtime.exceptionThrown") exceptions.push(message.params.exceptionDetails.text + ": " + (message.params.exceptionDetails.exception?.description || ""));
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") console.error("Browser log:", message.params.entry.text);
  };
  function send(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  const { targetId } = await send("Target.createTarget", { url: "about:blank" });
  const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
  const cdp = (method, params) => send(method, params, sessionId);
  await cdp("Page.enable"); await cdp("Runtime.enable"); await cdp("Network.enable"); await cdp("Log.enable");
  async function evaluate(expression) {
    const result = await cdp("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || expression);
    return result.result.value;
  }
  async function until(expression) {
    for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await delay(250); }
    throw new Error(`Timed out: ${expression}`);
  }
  async function navigate(path = "/", selector = ".dashboard") {
    await cdp("Page.navigate", { url: base + path });
    await until(`!!document.querySelector(${JSON.stringify(selector)})`);
    await evaluate("document.fonts.ready.then(() => true)");
    await delay(450);
    if (selector === ".dashboard") await until("Object.keys(document.querySelector('.greeting-actions button')).some(x=>x.startsWith('__reactProps'))");
  }
  async function click(selector) { assert(await evaluate(`!!document.querySelector(${JSON.stringify(selector)})`), `Control exists: ${selector}`); await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`); await delay(180); }
  async function screenshot(name) { const { data } = await cdp("Page.captureScreenshot", { format: "png", captureBeyondViewport: true }); await writeFile(join(output, `${name}.png`), Buffer.from(data, "base64")); }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await navigate();
  assert(await evaluate("document.body.innerText.includes('Local demo preview.')"));
  assert.equal(await evaluate("document.querySelectorAll('.dashboard-card').length"), 8);
  assert.deepEqual(await evaluate("Array.from(document.querySelectorAll('.week-days button')).map(x => x.innerText)"), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert(await evaluate("document.querySelector('.week-days button').getAttribute('aria-label').includes('2026')"));
  await screenshot("desktop-1366");
  for (const [width, height, name] of [[1366, 768, "desktop-1366"], [1920, 1080, "desktop-1920"], [834, 1112, "tablet"], [390, 844, "mobile"], [320, 740, "small-mobile"]]) {
    await cdp("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: 1, mobile: width < 600 });
    await evaluate("window.scrollTo(0, 0)"); await delay(180);
    assert(await evaluate("document.documentElement.scrollWidth <= innerWidth"), `${name}: no horizontal overflow`);
    const boxes = await evaluate("Array.from(document.querySelectorAll('.dashboard-card')).map(x => {const r=x.getBoundingClientRect(); return {x:r.x,y:r.y,w:r.width,h:r.height}})");
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      assert(!(a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1), `${name}: cards do not overlap`);
    }
    await screenshot(name);
    assert(await evaluate("document.querySelector('.dashboard-grid').getBoundingClientRect().bottom < document.querySelector('.app-dock').getBoundingClientRect().top"), `${name}: dock has reserved space after cards`);
    await evaluate("window.scrollTo(0, document.documentElement.scrollHeight)");
    await delay(150);
    assert(await evaluate("Math.max(...Array.from(document.querySelectorAll('.dashboard-card')).map(x => x.getBoundingClientRect().bottom)) < document.querySelector('.app-dock').getBoundingClientRect().top"), `${name}: dock leaves the final content accessible`);
    checks.push(`${name}: no overflow, card overlap, or dock obstruction at page end`);
  }
  await cdp("Emulation.setDeviceMetricsOverride", { width: 1366, height: 768, deviceScaleFactor: 1, mobile: false });
  await evaluate("window.scrollTo(0,0)");
  await click(".assignment-list input");
  assert.equal(await evaluate("document.querySelector('.assignment-tabs button:nth-child(2) span').textContent"), "2", await evaluate("JSON.stringify({text:document.querySelector('.assignment-tabs').innerText, storage:localStorage.getItem('4pointo.demo.v1.completed')})"));
  await click(".assignment-tabs button:nth-child(2)");
  assert.equal(await evaluate("document.querySelectorAll('.task-complete').length"), 2);
  await click(".assignment-list input");
  await click(".assignment-tabs button:first-child");
  await click(".week-days button:nth-child(2)");
  assert(await evaluate("document.querySelector('.calendar-events').innerText.includes('Computer architecture')"));
  await click(".week-days button:first-child");
  await evaluate(`(() => { const input = document.querySelector('#personal-note'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(input, 'A note saved by local browser verification.'); input.dispatchEvent(new Event('input', {bubbles:true})); })()`);
  await delay(150);
  await click(".greeting-actions button:last-child");
  assert(await evaluate("document.querySelector('.customize-dialog').open"));
  await click(".widget-toggle:nth-of-type(3) input");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
  await delay(150);
  assert(await evaluate("!document.querySelector('.customize-dialog').open && document.activeElement === document.querySelector('.greeting-actions button:last-child')"), "Escape closes dialog and restores focus");
  await navigate();
  assert.equal(await evaluate("document.querySelector('#personal-note').value"), "A note saved by local browser verification.");
  assert.equal(await evaluate("document.querySelectorAll('.card-degree').length"), 0);
  checks.push("Notes and widget visibility survive refresh; dialog Escape and focus restoration work");
  await click(".greeting-actions button:last-child");
  await click(".dialog-footer .text-button");
  await click(".dialog-footer .button");
  assert.equal(await evaluate("document.querySelectorAll('.dashboard-card').length"), 8);
  await click(".app-dock button:last-child");
  await evaluate("document.querySelector('.dialog-footer .button').focus()");
  await cdp("Input.dispatchKeyEvent", { type: "keyDown", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  await cdp("Input.dispatchKeyEvent", { type: "keyUp", key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 });
  assert(await evaluate("document.querySelector('.customize-dialog').contains(document.activeElement)"), "Native modal traps keyboard focus");
  await click(".dialog-footer .button");
  assert(await evaluate("document.activeElement === document.querySelector('.app-dock button:last-child')"), "Dock-triggered dialog restores focus to dock");
  await click(".demo-toolbar button");
  assert.equal(await evaluate("document.querySelectorAll('.assignment-list li').length"), 0);
  assert.equal(await evaluate("document.querySelectorAll('.semester-courses li').length"), 0);
  await screenshot("empty-states");
  await click(".demo-toolbar button");
  await click(".greeting-actions button:first-child");
  assert.equal(await evaluate("document.querySelectorAll('.dashboard-card').length"), 2);
  await click(".timer-start"); await delay(1200);
  assert.notEqual(await evaluate("document.querySelector('.timer-value').innerText"), "25:00");
  await click(".timer-start");
  const paused = await evaluate("document.querySelector('.timer-value').innerText");
  await delay(1200);
  assert.equal(await evaluate("document.querySelector('.timer-value').innerText"), paused);
  await click(".focus-actions .icon-button");
  assert.equal(await evaluate("document.querySelector('.timer-value').innerText"), "25:00");
  await screenshot("study-mode");
  checks.push("Assignment completion, weekday filtering, empty states, timer start/pause/reset, and study mode work");
  await navigate("/?view=academic");
  assert.equal(await evaluate("document.querySelectorAll('.dashboard-card').length"), 6);
  await navigate("/?view=personal");
  assert.equal(await evaluate("document.querySelectorAll('.dashboard-card').length"), 3);
  checks.push("Overview / Academic / Personal filter the workspace");
  await navigate("/gpa-calc", ".gpa-page");
  await screenshot("gpa-calculator");
  const gpaBefore = await evaluate("document.querySelector('[aria-label=\"GPA results\"]').innerText");
  await click("button[aria-pressed='false']"); // Existing What if control.
  await evaluate(`(() => { const input = document.querySelector('select[aria-label^="Letter grade"]'); const setter=Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set; setter.call(input,'F'); input.dispatchEvent(new Event('change', {bubbles:true})); })()`);
  await delay(200);
  assert.notEqual(await evaluate("document.querySelector('[aria-label=\"GPA results\"]').innerText"), gpaBefore);
  await click("button[aria-pressed='true']");
  assert.equal(await evaluate("document.querySelector('[aria-label=\"GPA results\"]').innerText"), gpaBefore);
  const writesBefore = network.length;
  await evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.innerText==='Edit').click()");
  await evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.innerText==='Done').click()");
  await delay(200);
  assert.equal(network.length, writesBefore, "Sample edit does not invoke a server action");
  await evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.innerText==='Add').click()");
  await until("document.querySelector('dialog').open");
  await evaluate(`(() => { const input=document.querySelector('#course-search'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'CS'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await evaluate("document.querySelector('dialog form').requestSubmit()"); await delay(250);
  assert(await evaluate("document.querySelector('dialog').innerText.includes('CS 146')"));
  await evaluate("document.querySelector('dialog').close()");
  await evaluate("Array.from(document.querySelectorAll('button')).find(x=>x.innerText==='Add').click()");
  await evaluate("Array.from(document.querySelectorAll('dialog button')).find(x=>x.innerText==='Enter manually').click()");
  await evaluate("document.querySelector('dialog form').requestSubmit()");
  await delay(150);
  assert(await evaluate("document.querySelector('dialog').innerText.includes('Enter a course name.')"), "Original manual form validation remains active");
  await evaluate(`(() => { const input=document.querySelector('#manual-course-name'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'Local verification course'); input.dispatchEvent(new Event('input',{bubbles:true})); })()`);
  await evaluate("document.querySelector('dialog form').requestSubmit()");
  await delay(200);
  assert(await evaluate("document.querySelector('.gpa-page').innerText.includes('Local verification course')"));
  await click("button[aria-label='Remove Local verification course']");
  assert(await evaluate("!document.querySelector('.gpa-page').innerText.includes('Local verification course')"));
  checks.push("Existing GPA what-if recalculates and restores; edit, catalog search, manual add, and removal stay local");
  for (const path of ["/syllabus-tracker", "/syllabus-tracker?tab=calendar", "/grade-calc", "/example"]) {
    await navigate(path, ".preview-unavailable");
    assert(await evaluate("document.body.innerText.includes('unavailable in the isolated preview')"));
  }
  const callback = await fetch(base + "/auth/callback?code=demo", { redirect: "manual" });
  assert.equal(callback.status, 307);
  const mutation = await fetch(base + "/", { method: "POST", body: "preview-check" });
  assert.equal(mutation.status, 403);
  assert(mutation.headers.get("content-type")?.includes("text"));
  const response = await fetch(base);
  assert(response.headers.get("content-security-policy")?.includes("connect-src 'self'"));
  const external = network.filter((url) => /^https?:/.test(url) && !["127.0.0.1", "localhost"].includes(new URL(url).hostname));
  assert.deepEqual(external, [], "No remote requests across the preview and linked pages");
  assert.deepEqual(exceptions, [], "No browser runtime exceptions");
  checks.push("Linked tools and auth callback are safe; POST actions blocked; no remote browser requests or runtime exceptions");
  const report = { passed: true, checks, requestCount: network.length, externalRequests: external, exceptions, output };
  await writeFile(join(output, "report.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error);
  console.error(JSON.stringify({ exceptions, requests: network.slice(-12) }, null, 2));
  console.error(`Browser evidence: ${output}`);
  process.exitCode = 1;
} finally {
  socket?.close();
  chrome.kill();
}
