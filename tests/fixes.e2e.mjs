// Nov 2026 fixes: (1) a student whose device still has answers to an exercise the teacher has already checked can
// still send other exercises (the database rule refuses any change to a checked exercise, so such answers are not sent);
// (2) model answers of whole sentences are not sent to students when the teacher checks an exercise.
// The mock is given the submissions rule of firestore.rules (refuse changes to answers of checked exercises).
// Run: python3 -m http.server 5055 -d docs &  node tests/fixes.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-fixes";
mkdirSync(SHOTS, { recursive: true });
let mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const RULE = `export async function setDoc(ref, data, opts) {
  if (ref.coll === "submissions") {
    const all = load(LS_DB), old = all[ref.path], g = all["groups/" + data.groupId] || {};
    const rel = (g.releasedEx || {})[data.unitId] || [], oa = old?.answers || {}, na = data.answers || {};
    const bad = old ? rel.some((e) => JSON.stringify(oa[e] ?? null) !== JSON.stringify(na[e] ?? null)) : rel.some((e) => e in na);
    if (bad) { await tick(); throw err("permission-denied"); }
  }`;
mock = mock.replace("export async function setDoc(ref, data, opts) {", RULE);
assert.ok(mock.includes("permission-denied"));
const course = readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8");
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
const errors = [];
const step = (x) => console.log("•", x);
async function answerFirst(page, exId, text) {
  const el = page.locator(`[data-ex="${exId}"][data-item]`).first();
  if ((await el.evaluate((e) => e.tagName)) === "SELECT") await el.selectOption({ index: 1 });
  else { await el.fill(text); await el.dispatchEvent("input"); }
}
const t = await ctx.newPage();
t.on("pageerror", (e) => errors.push("T: " + e.message)); t.on("dialog", (d) => d.accept());
await t.goto(BASE + "/teacher.html");
await t.evaluate(() => {
  localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" }, "anna@uni.ru": { uid: "S1", password: "secret1" } }));
  localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } }));
});
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru"); await t.fill("#auth-form [name=password]", "secret1"); await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, course);
await t.click("[data-act=import]"); await t.waitForSelector("text=Imported", { timeout: 60000 });
await t.click('a[href="#tools/groups"]'); await t.waitForSelector("#g-name");
await t.fill("#g-name", "L-25"); await t.fill("#g-code", "L-25"); await t.click("[data-act=create-group]");
await t.waitForSelector("td:has-text('L-25')");
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = Object.keys(db).find((k) => k.startsWith("groups/")).split("/")[1];
  db["groups/" + gid].openUnits = ["w9"];
  db["users/S1"] = { name: "Anna Ivanova", email: "anna@uni.ru", groupId: gid };
  localStorage.setItem("mock:db", JSON.stringify(db));
});

step("Student types in o12 but does not click Done");
const s = await ctx.newPage();
s.on("pageerror", (e) => errors.push("S: " + e.message)); s.on("dialog", (d) => d.accept());
await s.goto(BASE + "/index.html#w9/obj-class3");
await s.fill("#auth-form [name=email]", "anna@uni.ru"); await s.fill("#auth-form [name=password]", "secret1"); await s.click("#auth-submit");
await s.waitForSelector("#ex-o12");
await answerFirst(s, "o12", "for");

step("Teacher checks o12 (the student's answer has not reached the database)");
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = Object.keys(db).find((k) => k.startsWith("groups/")).split("/")[1];
  db["groups/" + gid].releasedEx = { w9: ["o12"] };
  localStorage.setItem("mock:db", JSON.stringify(db));
});
await s.waitForTimeout(800);

step("Student answers o13 and clicks Done: it must reach the teacher");
await answerFirst(s, "o13", "Ann was offered a new job.");
await s.click("[data-done=o13]");
await s.waitForTimeout(800);

const sub = await s.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["submissions/w9__S1"]);
assert.ok(sub, "the submission reached the database");
assert.ok(sub.answers.o13, "o13 was sent");
assert.ok(!sub.answers.o12, "the checked exercise o12 was not sent");
assert.equal(sub.answers._done.o13, "1");
assert.equal(await s.locator(".save-err").count(), 0, "no error in the bar");
assert.match(await s.textContent("#ex-o12 .ex-h"), /did not reach your teacher/);
await s.screenshot({ path: SHOTS + "/1-student.png" });

step("o11: the database has an answer of the student");
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = Object.keys(db).find((k) => k.startsWith("groups/")).split("/")[1];
  db["groups/" + gid].releasedEx = { w9: ["o12", "o11"] };
  db["submissions/w9__S1"].answers.o11 = { 1: "x" };   // the database has o11, the device has something else
  localStorage.setItem("mock:db", JSON.stringify(db));
});
await s.waitForTimeout(800);

step("Teacher checks o13 and o11: no model sentences for o13, words for o11");
await t.evaluate(() => { location.hash = "#w9/obj-class3"; });
await t.waitForSelector('[data-act=check-ex][data-ex=o13]');
await t.click('[data-act=check-ex][data-ex=o13]');
await t.waitForTimeout(800);
await t.click('[data-act=check-ex][data-ex=o11]');
await t.waitForTimeout(800);
const exr = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["exerciseResults/w9__S1"]);
const o13r = Object.values(exr.items.o13);
assert.ok(o13r.length && o13r.every((r) => r.correct === ""), "o13: no model answers");
assert.ok(Object.values(exr.items.o11).some((r) => r.correct), "o11: correct words shown");
await s.waitForTimeout(800);
assert.equal(await s.locator("#ex-o13 .corr").count(), 0, "the student sees no model sentence");
assert.ok(await s.locator("#ex-o11 .corr").count() > 0, "the student sees the correct words in o11");
await s.locator("#ex-o13").screenshot({ path: SHOTS + "/2-o13.png" });

step("Release of the whole unit: the results document has no model sentences either");
await s.click("[data-done=o9]").catch(() => {});
await s.waitForTimeout(300);
await s.evaluate(() => { const b = document.querySelector("#submit-unit"); if (b) b.disabled = false; });
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  db["submissions/w9__S1"].status = "submitted";
  localStorage.setItem("mock:db", JSON.stringify(db));
});
await t.click('a[href="#tools/access"]');
await t.click('[data-act=release][data-unit=w9]');
await t.waitForTimeout(1000);
const res = await t.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["results/w9__S1"]);
assert.ok(Object.values(res.auto.o13).every((r) => !r.correct), "results: o13 without model sentences");
assert.ok(Object.values(res.auto.o11).some((r) => r.correct), "results: o11 with the correct words");
assert.ok(Object.values(res.auto.f8 || {}).length === 0);
step("A student whose sends were refused before the fix: the Done marks on the device are sent when the week opens");
const s2 = await ctx.newPage();
s2.on("pageerror", (e) => errors.push("S2: " + e.message)); s2.on("dialog", (d) => d.accept());
await s2.goto(BASE + "/index.html");
await s2.evaluate(() => {
  const a = JSON.parse(localStorage.getItem("mock:auth")); a["li@uni.ru"] = { uid: "S2", password: "secret1" }; localStorage.setItem("mock:auth", JSON.stringify(a));
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = db["users/S1"].groupId;
  db["users/S2"] = { name: "Li Wei", email: "li@uni.ru", groupId: gid };
  db["groups/" + gid].releasedUnits = [];
  localStorage.setItem("mock:db", JSON.stringify(db));
  // what the old code left on the device: answers to a checked exercise (o12) and to o9, both marked Done
  localStorage.setItem("draft:S2:w9", JSON.stringify({ ts: Date.now(), answers: { o12: { 1: "for" }, o9: { 1: "What did he open the tin with?" }, _done: { o9: "1", o12: "1" } } }));
});
await s2.reload();
await s2.fill("#auth-form [name=email]", "li@uni.ru"); await s2.fill("#auth-form [name=password]", "secret1"); await s2.click("#auth-submit");
await s2.waitForSelector("#unit-nav .sb-uh");
await s2.evaluate(() => { location.hash = "#w9/obj-class3"; });
await s2.waitForSelector("#ex-o9");
await s2.waitForTimeout(1000);
const sub2 = await s2.evaluate(() => JSON.parse(localStorage.getItem("mock:db"))["submissions/w9__S2"]);
assert.ok(sub2?.answers?.o9, "o9 reached the teacher without a new click");
assert.ok(!sub2.answers.o12, "the checked exercise was not sent");

assert.deepEqual(errors, []);
console.log("ALL OK");
await browser.close();
