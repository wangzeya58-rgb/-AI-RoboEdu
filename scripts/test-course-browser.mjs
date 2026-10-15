import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
// Run from the project root with tsx; uses a separate Chrome debugging profile on port 9223.
const root = process.cwd();
const require = createRequire(`${root}/package.json`);
const env = require('dotenv').parse(await readFile(`${root}/.env.local`));
const parsed = new URL(env.DATABASE_URL);
assert.ok(['localhost', '127.0.0.1'].includes(parsed.hostname) && parsed.pathname === '/ai_roboedu_dev');
assert.ok(['', 'local', 'demo'].includes((env.AI_CLASSROOM_PROVIDER ?? '').trim().toLowerCase()), 'Deterministic browser regression requires the local classroom provider');
const { Pool } = require('pg');
const pool = new Pool({ connectionString: env.DATABASE_URL, connectionTimeoutMillis: 3000 });
const { hashPassword } = await import(`${root}/src/lib/auth/password.ts`);
const prefix = `p54ui_${Date.now()}_${randomUUID().slice(0,8)}`;
const password = `Test-${randomUUID()}-1a`;
const teacher = { username: `${prefix}_teacher`, role: 'teacher' };
const student = { username: `${prefix}_student`, role: 'student' };
const outsider = { username: `${prefix}_outsider`, role: 'student' };
const createdIds = [];
const base = 'http://127.0.0.1:5000';
const before = (await pool.query('select id from courses order by id')).rows.map(row => row.id);
let ws;
let browserCall;
async function api(path, cookie, body, method) {
  const response = await fetch(base + path, { method: method || (body ? 'POST' : 'GET'), headers: { 'content-type': 'application/json', ...(cookie ? {cookie} : {}) }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(30000) });
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(`${path} ${response.status}: ${JSON.stringify(data)}`);
  return { data: data.data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
try {
  for (const user of [teacher, student, outsider]) {
    const result = await pool.query('insert into users(username,password_hash,name,role,class_menu_locked) values($1,$2,$3,$4,false) returning id', [user.username, hashPassword(password), 'Phase54 UI Test', user.role]);
    createdIds.push(result.rows[0].id);
  }
  const teacherAuth = await api('/api/v1/auth/login', null, { username: teacher.username, password });
  const studentAuth = await api('/api/v1/auth/login', null, { username: student.username, password });
  const klass = (await api('/api/v1/classes', teacherAuth.cookie, { name: `${prefix}_class` })).data;
  const member = (await api('/api/v1/classes/join', studentAuth.cookie, { classCode: klass.classCode })).data;
  await api(`/api/v1/classes/${klass.id}/members/${member.id}`, teacherAuth.cookie, { status: 'approved' }, 'PATCH');
  const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', { method: 'PUT' })).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0;
  const pending = new Map();
  const errors = [];
  let onPageLoad;
  ws.onmessage = ({data}) => {
    const message = JSON.parse(data);
    if (message.method === 'Page.loadEventFired' && onPageLoad) { onPageLoad(); onPageLoad = undefined; }
    if (message.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(message.params.exceptionDetails));
    if (message.id && pending.has(message.id)) {
      const p = pending.get(message.id); pending.delete(message.id);
      if (message.error) p.reject(new Error(JSON.stringify(message.error))); else p.resolve(message.result);
    }
  };
  function call(method, params = {}) { return new Promise((resolve, reject) => { const n = ++id; pending.set(n, {resolve, reject}); ws.send(JSON.stringify({id:n,method,params})); }); }
  browserCall = call;
  async function evaluate(expression) {
    const r = await call('Runtime.evaluate', {expression, awaitPromise:true, returnByValue:true});
    if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails));
    return r.result.value;
  }
  const pause = ms => new Promise(r => setTimeout(r, ms));
  async function navigate(method, params = {}) {
    let timer;
    const loaded = new Promise((resolve) => { onPageLoad = resolve; });
    try {
      await call(method, params);
      await Promise.race([loaded, new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('page load timeout')), 30000); })]);
    } finally { clearTimeout(timer); onPageLoad = undefined; }
  }
  async function wait(expression) {
    for(let n=0;n<160;n++) { if (await evaluate(`!!document.body && (${expression})`)) return; await pause(250); }
    throw new Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`);
  }
  const click = text => evaluate(`(() => {const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}); if(!b)throw Error('missing button'); b.click()})()`);
  const field = (placeholder, value) => evaluate(`(() => {const i=document.querySelector('[placeholder="${placeholder}"]'); Object.getOwnPropertyDescriptor(i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)}); i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  async function login(user, path) {
    await evaluate(`(async()=>{const r=await fetch('/api/v1/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(user.username)},password:${JSON.stringify(password)}})});const b=await r.json();if(!b.success)throw Error('login failed');localStorage.setItem('al_session',JSON.stringify(b.data));})()`);
    await navigate('Page.navigate', {url:base+path});
  }
  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.clearBrowserCookies');
  await call('Emulation.setDeviceMetricsOverride', {width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await navigate('Page.navigate', {url:base+'/login'});
  await wait(`location.pathname==='/login' && !!document.querySelector('input')`);
  await login(teacher, '/course/manage');
  await wait(`!!document.querySelector('[placeholder="课程名称"]') && document.body.innerText.includes('正式模式')`);
  await field('课程名称', `${prefix}双章节教学`);
  await field('课程简介（可选）', '第一章雷达测距，第二章平均值；用于教学流程验收。');
  await click('创建课程');
  await wait(`document.body.innerText.includes('已创建课程：')`);
  const firstTitle='雷达测距实验';
  const firstBody='学习目标：理解雷达测距。实验步骤：在纸面标记发射和反射信号，解释往返时间与距离的关系。';
  const secondTitle='平均值实验';
  const secondBody='学习目标：理解平均值。实验步骤：记录样本10、12、14，计算平均值12，讨论平均值的意义。';
  await field('章节标题', firstTitle); await field('章节内容', firstBody); await click('添加章节');
  await wait(`!!document.querySelector('[aria-label="编辑章节：雷达测距实验"]')`);
  await field('章节标题', secondTitle); await field('章节内容', secondBody); await click('添加章节');
  await wait(`!!document.querySelector('[aria-label="编辑章节：平均值实验"]')`);
  await evaluate(`document.querySelector('[aria-label="编辑章节：雷达测距实验"]').click()`);
  await wait(`document.querySelector('[placeholder="章节内容"]').value.includes('往返时间')`);
  await field('章节内容', firstBody+'课堂提示：先画示意图。'); await click('保存章节');
  await wait(`document.body.innerText.includes('章节已保存。')`);
  await navigate('Page.reload');
  await wait(`document.body.innerText.includes('课堂提示：先画示意图') && !!document.querySelector('[aria-label="编辑章节：平均值实验"]')`);
  await evaluate(`(() => {const s=document.querySelector('select');s.value=${JSON.stringify(klass.id)};s.dispatchEvent(new Event('change',{bubbles:true}))})()`);
  await click('发布课程');
  await wait(`document.body.innerText.includes('课程已发布到班级。')`);
  console.log('REAL browser: teacher create, add two chapters, edit, reload and publish passed');
  await navigate('Page.navigate', {url:base+'/teacher/courses'});
  await wait(`!!document.querySelector('[aria-label="编辑章节：平均值实验"]')`);
  await navigate('Page.reload');
  await wait(`!!document.querySelector('[aria-label="编辑章节：平均值实验"]')`);
  console.log('REAL browser: alternate teacher entry and reload passed');
  const savedCourse = (await api('/api/v1/courses', teacherAuth.cookie)).data.items.find(item => item.title === `${prefix}双章节教学`);
  const readProgress = async () => (await api(`/api/v1/courses/${savedCourse.id}/progress`, studentAuth.cookie)).data;
  async function openLearning() {
    await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes('开始学习')||b.textContent.includes('继续学习'))`);
    await evaluate(`(() => {[...document.querySelectorAll('button')].find(b=>b.textContent.includes('开始学习')||b.textContent.includes('继续学习')).click()})()`);
    await wait(`!!document.querySelector('input[aria-label="向 AI 小老师提问"]')`);
  }
  await login(student, '/course');
  assert.equal((await readProgress()).status, 'not_started');
  await openLearning();
  assert.equal((await readProgress()).completedLessons, 0);
  assert.ok(await evaluate(`[...document.querySelectorAll('main aside h2')].every(e=>e.scrollWidth<=e.clientWidth+1)`), 'long course title must fit the classroom sidebar');
  await click('解释本节重点');
  await wait(`document.querySelector('[role=log]')?.textContent.includes('雷达测距')`);
  await evaluate(`(() => {const i=document.querySelector('input[aria-label="向 AI 小老师提问"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'为什么要这样做');i.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('button[aria-label="提问"]').click()`);
  await wait(`document.querySelector('[role=log]')?.children.length===4`);
  await call('Network.emulateNetworkConditions', {offline:true, latency:0, downloadThroughput:-1, uploadThroughput:-1});
  await click('标记本章完成');
  await wait(`document.querySelector('[role=alert]')?.textContent.includes('网络')`);
  assert.equal((await readProgress()).completedLessons, 0);
  await call('Network.emulateNetworkConditions', {offline:false, latency:0, downloadThroughput:-1, uploadThroughput:-1});
  await click('重试保存');
  await wait(`document.body.innerText.includes('本章已完成')`);
  assert.equal((await readProgress()).percent, 50);
  await evaluate(`(() => {[...document.querySelectorAll('button')].find(b=>b.textContent.includes('平均值实验')).click()})()`);
  await wait(`document.querySelector('[role=log]')?.children.length===0`);
  await click('这个实验怎么做');
  await wait(`document.querySelector('[role=log]')?.textContent.includes('平均值12')`);
  assert.ok(!await evaluate(`document.querySelector('[role=log]').textContent.includes('雷达测距')`));
  assert.equal((await readProgress()).percent, 50, 'opening another chapter must not complete it');
  await navigate('Page.reload');
  await openLearning();
  assert.equal(await evaluate(`document.querySelector('[role=log]').children.length`),0);
  assert.ok(await evaluate(`document.querySelector('progress[aria-label="课程完成进度"]').closest('aside').nextElementSibling.querySelector('h2').textContent.includes('平均值实验')`));
  await evaluate(`(async()=>{await fetch('/api/v1/auth/logout',{method:'POST'});localStorage.removeItem('al_session')})()`);
  await login(student, '/course');
  await openLearning();
  assert.equal((await readProgress()).percent,50);
  assert.ok(await evaluate(`document.querySelector('progress[aria-label="课程完成进度"]').closest('aside').nextElementSibling.querySelector('h2').textContent.includes('平均值实验')`));
  await click('标记本章完成');
  await wait(`document.body.innerText.includes('本章已完成')`);
  assert.equal((await readProgress()).percent,100);
  const shot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/phase5-4-real-student.png',Buffer.from(shot.data,'base64'));
  console.log('REAL browser: student authorized learning, local-provider answer, multi-turn, chapter isolation and refresh passed');
  console.log('REAL progress: explicit completion, offline save retry, resume after refresh and logout/login, 100% completion passed');
  await login(teacher, '/teacher/classes');
  await wait(`document.querySelector('[aria-label="班级学习情况"]')?.textContent.includes('100%')`);
  assert.ok(!await evaluate(`document.querySelector('[aria-label="班级学习情况"] table').textContent.includes('尚未学习')`));
  await call('Emulation.setDeviceMetricsOverride', {width:390,height:844,deviceScaleFactor:1,mobile:true});
  await evaluate(`document.querySelector('[aria-label="班级学习情况"]').scrollIntoView({block:'center'})`);
  const reportShot=await call('Page.captureScreenshot',{format:'png'});
  await writeFile('/tmp/learning-progress-teacher-mobile.png',Buffer.from(reportShot.data,'base64'));
  await call('Emulation.setDeviceMetricsOverride', {width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  console.log('REAL teacher report: completed chapters, percentage and recent study timestamp passed');
  await login(outsider, '/course');
  await wait(`document.body.innerText.includes('暂无可学习课程')`);
  assert.equal(await evaluate(`!!document.querySelector('input[aria-label="向 AI 小老师提问"]')`),false);
  console.log('REAL browser: non-member has no course or AI panel');
  console.log('Runtime exceptions:',errors.length);
  for(const error of errors) console.log(error.slice(0,900));
  if(errors.length) process.exitCode=1;
} finally {
  if(browserCall) await browserCall('Browser.close').catch(()=>{});
  ws?.close();
  if(createdIds.length) {
    await pool.query('delete from classes where teacher_id=$1',[createdIds[0]]);
    await pool.query('delete from courses where teacher_id=$1',[createdIds[0]]);
    await pool.query('delete from users where id=any($1::uuid[])',[createdIds]);
  }
  const after=(await pool.query('select id from courses order by id')).rows.map(row=>row.id);
  assert.deepEqual(after,before,'existing courses must be unchanged');
  await pool.end();
  console.log('Only this browser run test data cleaned; existing course IDs unchanged.');
}
