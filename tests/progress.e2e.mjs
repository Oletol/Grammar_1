// Teacher: Speaking / Writing progress (table, chart, In-Class vs HA, cards), "Answers shown" on a unit page,
// student switcher in Student work, Analytics with drafts. Students' work is put straight into the mock database.
// The real course is taken from content-private (it has keys); a speaking task with a transcript is added to Week 7
// in memory only, to try Speaking progress.
// Run: python3 -m http.server 5055 -d docs &  node tests/progress.e2e.mjs
import { chromium } from "playwright";
import { readFileSync, mkdirSync } from "node:fs";
import assert from "node:assert/strict";
const BASE = "http://127.0.0.1:5055";
const SHOTS = process.env.SHOTS || "/tmp/shots-progress";
mkdirSync(SHOTS, { recursive: true });
const mock = readFileSync(new URL("./mock-fb.js", import.meta.url), "utf8");
const course = JSON.parse(readFileSync(new URL("../content-private/course.json", import.meta.url), "utf8"));
const w7 = course.units.find((u) => u.id === "w7").sections.find((s) => s.id === "used-class");
const at = w7.blocks.findIndex((b) => b.id === "w7-then-now-a");
w7.blocks.splice(at, 2, { type: "speaking", id: "w7-then-now", label: "Your childhood (2 minutes)", sec: 120, transcribe: "sp7" },
  { type: "exercise", id: "sp7", kind: "open", transcript: true, check: "teacher", max: 5, title: "Your talk as text", vocab: ["used to", "would"],
    items: [{ id: "1", text: "", answer: "When I was a child, I used to live in a small town." }] });
const courseText = JSON.stringify(course);
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1360, height: 950 } });
await ctx.route("**/js/fb.js*", (r) => r.fulfill({ contentType: "text/javascript", body: mock }));
await ctx.route("https://api.languagetool.org/**", (r) => r.fulfill({ contentType: "application/json", headers: { "Access-Control-Allow-Origin": "*" }, body: '{"matches":[]}' }));
const errors = [];
const t = await ctx.newPage();
t.on("pageerror", (e) => errors.push(e.message)); t.on("dialog", (d) => d.accept());
const step = (x) => console.log("•", x);
await t.goto(BASE + "/teacher.html");
await t.evaluate(() => { localStorage.setItem("mock:auth", JSON.stringify({ "teacher@uni.ru": { uid: "T1", password: "secret1" } })); localStorage.setItem("mock:db", JSON.stringify({ "teachers/T1": { name: "Teacher" } })); });
await t.reload();
await t.fill("#auth-form [name=email]", "teacher@uni.ru"); await t.fill("#auth-form [name=password]", "secret1"); await t.click("#auth-submit");
await t.waitForSelector("#tool-nav .sb-item");
assert.ok(await t.isVisible('a[href="#tools/writing"]'), "Writing progress in the sidebar");
assert.ok(await t.isVisible('a[href="#tools/speaking"]'), "Speaking progress in the sidebar");
await t.click('a[href="#tools/content"]');
await t.evaluate((c) => { document.querySelector("#import-text").value = c; }, courseText);
await t.click("[data-act=import]"); await t.waitForSelector("text=Imported");
await t.click('a[href="#tools/groups"]'); await t.waitForSelector("#g-name");
await t.fill("#g-name", "L-25"); await t.fill("#g-code", "L-25"); await t.click("[data-act=create-group]");
await t.waitForSelector("td:has-text('L-25')");

step("Seeding three students");
await t.evaluate(() => {
  const db = JSON.parse(localStorage.getItem("mock:db"));
  const gid = Object.keys(db).find((k) => k.startsWith("groups/")).split("/")[1];
  const g = db["groups/" + gid];
  g.openUnits = ["w6", "w7", "w8", "w9"];
  g.plan = { w6: { t3: { as: "home" } }, w7: { p3: { as: "class" }, sp7: { as: "class" } }, w8: { e5: { as: "class" }, e6: { as: "home" } } };
  const day = (d) => ({ __ts: Date.parse(`2026-10-${d}T10:00:00Z`) });
  const studs = [["S1", "Anna Ivanova", 1], ["S2", "Li Wei", 0.6], ["S3", "Vera Smirnova", 0.3]];
  const tr = (n, q) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1), i / n <= q ? `I have known her since we were at school, and we have been friends ever since ${i}.` : ""]));
  for (const [uid, name, q] of studs) {
    db["users/" + uid] = { name, email: uid.toLowerCase() + "@uni.ru", groupId: gid };
    db[`submissions/w6__${uid}`] = { uid, groupId: gid, unitId: "w6", status: "draft", updatedAt: day(14), answers: { t3: tr(15, q), _done: { t3: "1" } } };
    db[`submissions/w7__${uid}`] = { uid, groupId: gid, unitId: "w7", status: "draft", updatedAt: day(21),
      answers: { p3: tr(15, q), p4: { 1: q > 0.5 ? "used to" : "would", 2: "wrong" },
        sp7: { 1: "When I was a child I used to live in a village. Every summer we would go to the river and we would swim all day. ".repeat(1 + Math.round(q * 2)) },
        _speech: { sp7: JSON.stringify({ speech: 50 + 20 * q, total: 80, wpm: Math.round(90 + 40 * q), pauses: Math.round(8 - 5 * q), longest: 3, at: Date.parse("2026-10-21T10:00:00Z") }) },
        _done: { p3: "1", sp7: "1" } } };
    db[`submissions/w8__${uid}`] = { uid, groupId: gid, unitId: "w8", status: "draft", updatedAt: day(28),
      answers: { e5: tr(7, q), e6: tr(13, q),
        _speech: {} } };
  }
  db["exerciseResults/w8__S1"] = { uid: "S1", groupId: gid, unitId: "w8", feedback: { e5: {
    1: { text: "I have known her since we were at school, and we have been friends ever since 0.", issues: [{ type: "grammar", category: "Grammar" }] } } } };
  localStorage.setItem("mock:db", JSON.stringify(db));
});
await t.reload(); await t.waitForSelector("#tool-nav .sb-item");

step("Writing progress");
await t.click('a[href="#tools/writing"]');
await t.waitForSelector(".t.prog");
const wtxt = await t.textContent("#view");
assert.match(wtxt, /Writing progress/); assert.match(wtxt, /Anna Ivanova/); assert.match(wtxt, /In class and at home/);
assert.ok(await t.locator(".prog-chart svg").count(), "chart");
assert.equal(await t.locator(".spk-card").count(), 3, "a card for each student");
assert.match(wtxt, /translation/);
await t.screenshot({ path: SHOTS + "/1-writing.png", fullPage: true });
await t.selectOption("#prog-student", { label: "Li Wei" });
await t.waitForSelector(".prog-chart .st.one");
assert.equal(await t.locator(".spk-card").count(), 1);
await t.screenshot({ path: SHOTS + "/2-writing-one.png", fullPage: true });
await t.click('[data-act=prog-set][data-set=home]');
await t.waitForTimeout(200);
await t.click('[data-act=prog-set][data-set=""]');

step("Speaking progress");
await t.click('a[href="#tools/speaking"]');
await t.waitForSelector(".t.prog");
await t.selectOption("#prog-student", "");
await t.waitForTimeout(200);
await t.click(".t.prog tbody a[data-act=prog-open]");
await t.waitForSelector("#prog-detail");
assert.match(await t.textContent("#view"), /Words per minute/);
await t.screenshot({ path: SHOTS + "/3-speaking.png", fullPage: true });

step("Analytics with drafts");
await t.click('a[href="#tools/stats"]');
await t.selectOption("#ctx-unit", "w7");
await t.waitForSelector(".stats-t");
await t.screenshot({ path: SHOTS + "/4-analytics.png", fullPage: true });
assert.match(await t.textContent(".stats-t"), /Anna Ivanova/);

step("Answers shown on the unit page");
await t.click('.stats-t [data-act=view-unit-as]');
await t.waitForSelector(".viewas-bar.on");
await t.evaluate(() => { location.hash = "#w7/used-class"; });
await t.waitForTimeout(400);
assert.ok(await t.locator("#ex-p4 .gap.bad").count() >= 1, "the student's wrong answers are marked red");
await t.locator("#ex-p4").screenshot({ path: SHOTS + "/5-unit-as.png" });
const before = await t.inputValue("#view-as");
await t.click(".viewas-bar [data-act=view-as]:has-text('Next')");
await t.waitForTimeout(200);
assert.notEqual(await t.inputValue("#view-as"), before, "Next switches the student");
await t.screenshot({ path: SHOTS + "/5b-unit-as.png" });
// switching the week keeps the student (the list of students loads again)
await t.selectOption("#ctx-unit", "w8");
await t.evaluate(() => { location.hash = "#w8/pc-class"; });
await t.waitForTimeout(500);
assert.notEqual(await t.inputValue("#view-as"), "", "the student stays chosen after a change of week");
await t.click(".viewas-bar [data-act=view-as]:has-text('Back to my practice')");
await t.waitForTimeout(200);
assert.equal(await t.inputValue("#view-as"), "");

step("Student work switcher");
await t.click('a[href="#tools/works"]');
await t.click("[data-act=select-student] >> nth=0");
await t.waitForSelector("#works-student");
await t.click("#detail [data-act=select-student]:has-text('Next')");
await t.waitForTimeout(300);
await t.screenshot({ path: SHOTS + "/6-works.png" });

const html = await t.content();
for (const ch of ["→", "←", "‹", "›"]) assert.ok(!html.includes(ch), "arrow " + ch);
assert.deepEqual(errors, []);
console.log("ALL OK");
await browser.close();
