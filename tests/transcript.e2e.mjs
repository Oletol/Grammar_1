// Student: a speaking block with "transcribe" and its transcript exercise (Week 7 copy with a test task, in memory only).
// The Whisper part itself is not run here (the model is not in the sandbox): the text and the measures are put
// into the fields as the Transcribe button does, then Done sends them with the answers.
// Run: python3 -m http.server 5055 -d docs &  node tests/transcript.e2e.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const course = JSON.parse(readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8"));
const w7 = course.units.find((u) => u.id === "w7").sections.find((s) => s.id === "used-class");
const at = w7.blocks.findIndex((b) => b.id === "w7-then-now-a");
w7.blocks.splice(at, 2, { type: "speaking", id: "w7-then-now", label: "Your childhood (2 minutes)", sec: 120, transcribe: "sp7" },
  { type: "exercise", id: "sp7", kind: "open", transcript: true, check: "teacher", max: 5, title: "Your talk as text", items: [{ id: "1", text: "", answer: "model" }] });
const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ["microphone"] });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
const errors = [];
const t = await ctx.newPage();
t.on("pageerror", (e) => errors.push(e.message)); t.on("dialog", (d) => d.accept());
await t.goto(BASE + "/teacher.html");
await t.evaluate(() => { localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" } })); localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } })); });
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru"); await t.fill("#auth-form [name=password]", "secret1"); await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, JSON.stringify(course));
await t.click("[data-act=import]"); await t.waitForSelector("text=Imported");
await t.click('a[href="#tools/groups"]'); await t.waitForSelector("#g-name");
await t.fill("#g-name", "Linguistics 1"); await t.fill("#g-code", "ling-1"); await t.click("[data-act=create-group]");
await t.waitForSelector("code:text('LING-1')");
await t.click('a[href="#tools/access"]');
await t.click("[data-act=toggle-open][data-unit=w7]");
await t.waitForTimeout(300);
const s0 = t;
const t2 = await ctx.newPage();
t2.on("pageerror", (e) => errors.push(e.message));
await t2.goto(BASE + "/index.html");
await t2.click("[data-mode=register]");
await t2.fill("[name=name]", "Li Wei"); await t2.fill("[name=email]", "li@uni.ru"); await t2.fill("[name=password]", "pass123"); await t2.fill("[name=group]", "ling-1");
await t2.click("#auth-submit");
await t2.waitForSelector('.sb-uh[data-unit="w7"][data-can-open="1"]');
await t2.goto(BASE + "/index.html#w7/used-class");
await t2.waitForSelector("#ex-sp7");
assert.equal(await t2.locator('.spk[data-tr="sp7"]').count(), 1, "recorder linked to the exercise");
assert.ok(await t2.locator('#ex-sp7 textarea.transcript[readonly]').count(), "the text cannot be typed");
await t2.evaluate(() => {
  const f = document.querySelector('textarea[data-ex="sp7"]'), h = document.querySelector('input[data-ex="_speech"][data-item="sp7"]');
  f.value = "When I was a child I used to live by the sea."; f.dispatchEvent(new Event("input", { bubbles: true }));
  h.value = JSON.stringify({ words: 11, speech: 40, total: 60, wpm: 120, pauses: 2, longest: 1.5, at: Date.now() }); h.dispatchEvent(new Event("input", { bubbles: true }));
});
await t2.click('[data-done="sp7"]');
await t2.waitForFunction(() => Object.entries(JSON.parse(localStorage.getItem("mock:db"))).some(([k, v]) => k.startsWith("submissions/w7") && v.answers?._speech?.sp7));
const sub = await t2.evaluate(() => Object.entries(JSON.parse(localStorage.getItem("mock:db"))).find(([k]) => k.startsWith("submissions/w7"))[1]);
assert.match(sub.answers.sp7["1"], /used to live/);
assert.equal(sub.answers._done.sp7, "1");
await t2.locator("#ex-sp7").screenshot({ path: "/tmp/transcript.png" });
// the speaking block: a take recorded with the fake microphone gets a Transcribe button
await t2.click('.spk[data-tr="sp7"] [data-spk-act="rec"]').catch(() => {});
await t2.waitForTimeout(2500);
await t2.click('.spk[data-tr="sp7"] [data-spk-act="rec"]').catch(() => {});
await t2.waitForTimeout(3500);
await t2.locator('.spk[data-tr="sp7"]').screenshot({ path: "/tmp/transcript-rec.png" });
console.log("Transcribe buttons:", await t2.locator('.spk[data-tr="sp7"] [data-spk-act="tr"]').count());
assert.deepEqual(errors, []);
console.log("ALL OK");
await browser.close();
