import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';

let input = '';
for await (const chunk of process.stdin) input += chunk;
const config = JSON.parse(input);
assert.equal(new URL(config.base).hostname, '127.0.0.1');
const version = await (await fetch('http://127.0.0.1:9223/json/version')).json();
const sockets = [];
const contexts = [];
const errors = [];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function connect(url) {
  const ws = new WebSocket(url); sockets.push(ws);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let id = 0; const pending = new Map();
  ws.onmessage = ({ data }) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(JSON.stringify(msg.params.exceptionDetails));
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error' && /hydration|ISO-8859|Cannot update a component/i.test(JSON.stringify(msg.params.args))) errors.push(JSON.stringify(msg.params.args));
    if (msg.id && pending.has(msg.id)) { const p = pending.get(msg.id); pending.delete(msg.id); clearTimeout(p.timer); if (msg.error) p.reject(Error(JSON.stringify(msg.error))); else p.resolve(msg.result); }
  };
  return (method, params = {}) => new Promise((resolve, reject) => { const n = ++id; const timer = setTimeout(() => { pending.delete(n); reject(Error(`CDP timeout ${method}`)); }, 30000); pending.set(n, { resolve, reject, timer }); ws.send(JSON.stringify({ id: n, method, params })); });
}
const browser = await connect(version.webSocketDebuggerUrl);
async function page() {
  const { browserContextId } = await browser('Target.createBrowserContext'); contexts.push(browserContextId);
  const { targetId } = await browser('Target.createTarget', { url: 'about:blank', browserContextId });
  const targets = await (await fetch('http://127.0.0.1:9223/json/list')).json();
  const target = targets.find((t) => t.id === targetId);
  const call = await connect(target.webSocketDebuggerUrl);
  await call('Page.enable'); await call('Runtime.enable');
  await call('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const evaluate = async (expression) => { const r = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const wait = async (expression) => { for (let i = 0; i < 140; i++) { if (await evaluate(`!!document.body && (${expression})`)) return; await sleep(150); } throw Error(`Browser timeout: ${expression}\n${await evaluate('document.body.innerText')}`); };
  const nav = async (path) => { await call('Page.navigate', { url: config.base + path }); await wait(`location.pathname===${JSON.stringify(path.split('?')[0])} && document.readyState==='complete'`); };
  const field = async (selector, value) => { await wait(`!!document.querySelector(${JSON.stringify(selector)})`); await evaluate(`(()=>{const i=document.querySelector(${JSON.stringify(selector)});Object.getOwnPropertyDescriptor(i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`); };
  const click = async (text) => { await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`); await evaluate(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled).click()`); };
  const api = (path, method = 'GET', body) => evaluate(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'content-type':'application/json'},${body === undefined ? '' : `body:JSON.stringify(${JSON.stringify(body)}),`}cache:'no-store'});return {status:r.status,body:await r.json()};})()`);
  const login = async (account, path) => { await nav('/login'); await field('input[placeholder="student / teacher / admin"]', account.username); await field('input[type=password]', config.password); await click('登录'); await wait(`location.pathname!=='/login'`); await nav(path); };
  return { call, evaluate, wait, nav, field, click, api, login };
}
// Keep every authenticated actor in a different isolated browser context.
try {
  if (config.outage) {
    const p = await page(); await p.nav('/login');
    await p.field('input[placeholder="student / teacher / admin"]', 'student');
    await p.field('input[type=password]', '123456'); await p.click('登录');
    await p.wait(`document.body.innerText.includes('未切换至 Demo')`);
    assert.equal((await p.api('/api/v1/auth/me')).status, 401);
    console.log('PASS browser: unavailable database shows formal login error and never signs in as Demo.');
  } else {
  const admin = await page(), teacher = await page(), student = await page(), secondStudent = await page(), guest = await page();
  await guest.call('Page.navigate', { url: config.base + '/teacher/classes' });
  await guest.wait(`location.pathname==='/login'`);
  assert.equal((await guest.api('/api/v1/courses')).status, 401);
  await admin.login(config.admin, '/admin/courses');
  await teacher.login(config.teacher, '/teacher/courses');
  await student.login(config.student, '/course');
  await secondStudent.login(config.student, '/course');
  async function create(p, role) {
    const title = `${config.prefix}_browser_${role}`;
    await p.field('[aria-label="课程名称"]', title); await p.click('创建课程');
    await p.wait(`document.body.innerText.includes(${JSON.stringify(title)}) && !!document.querySelector('[aria-label="选择课程附件"]')`);
    await p.field('[placeholder="章节标题"]', '超声波测距');
    await p.field('[placeholder="章节内容"]', '超声波通过声波往返时间测量距离，需要除以二。'); await p.click('添加章节');
    await p.wait(`document.body.innerText.includes('1. 超声波测距')`);
    await p.evaluate(`(async()=>{const c=document.createElement('canvas');c.width=600;c.height=300;const x=c.getContext('2d');x.fillStyle='#e8f5ed';x.fillRect(0,0,600,300);x.fillStyle='#155e35';x.font='28px sans-serif';x.fillText('AI RoboEdu course attachment',24,140);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'${role}-教学课件.png',{type:'image/png'}));const i=document.querySelector('input[type=file]');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await p.click('上传课件'); await p.wait(`document.body.innerText.includes('${role}-教学课件.png') && !document.body.innerText.includes('正在读取附件')`);
    const courses = await p.api('/api/v1/courses'); assert.equal(courses.status, 200);
    const course = courses.body.data.items.find((c) => c.title === title); assert.ok(course);
    if (role === 'admin') await p.click('发布为公共课程');
    else {
      await p.evaluate(`(()=>{const s=[...document.querySelectorAll('select')].find(s=>[...s.options].some(o=>o.value==='${config.classId}'));s.value='${config.classId}';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
      await p.click('发布课程');
    }
    await p.wait(`document.body.innerText.includes(${role === 'admin' ? "'取消公共发布'" : "'取消班级发布'"})`);
    return course;
  }
  const publicCourse = await create(admin, 'admin');
  const privateCourse = await create(teacher, 'teacher');
  await student.nav('/course');
  await student.wait(`document.body.innerText.includes('${publicCourse.title}')&&document.body.innerText.includes('${privateCourse.title}')`);
  await student.nav('/course/player?courseId=' + publicCourse.id);
  await student.wait(`!!document.querySelector('[aria-label="预览 admin-教学课件.png"]') && document.body.innerText.includes('标记本章完成')`);
  await student.evaluate(`document.querySelector('[aria-label="预览 admin-教学课件.png"]').click()`);
  await student.wait(`!!document.querySelector('img[src*="/materials/"]') && document.querySelector('img[src*="/materials/"]').naturalWidth===600`);
  const download = await student.evaluate(`(async()=>{const a=document.querySelector('[aria-label="下载 admin-教学课件.png"]');const r=await fetch(a.href);return {status:r.status,size:(await r.arrayBuffer()).byteLength,disposition:r.headers.get('content-disposition')};})()`);
  assert.equal(download.status, 200); assert.ok(download.size > 100); assert.match(download.disposition, /attachment/);
  await student.click('标记本章完成'); await student.wait(`document.body.innerText.includes('本章已完成')`);
  await student.field('[aria-label="向 AI 小老师提问"]', '测距为什么除以二？');
  await student.evaluate(`document.querySelector('[aria-label="提问"]').click()`);
  await student.wait(`document.body.innerText.includes('课程本地答疑（非大模型）') && document.body.innerText.includes('我的提问')`);
  await student.call('Page.reload'); await student.wait(`document.body.innerText.includes('本章已完成') && document.body.innerText.includes('admin-教学课件.png')`);
  await secondStudent.nav('/course/player?courseId=' + publicCourse.id);
  await secondStudent.wait(`document.body.innerText.includes('本章已完成') && document.body.innerText.includes('admin-教学课件.png')`);
  const shot = await secondStudent.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile('/tmp/roboedu-deployment-desktop.png', Buffer.from(shot.data, 'base64'));
  await secondStudent.call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
  await sleep(250);
  assert.ok(await secondStudent.evaluate('document.documentElement.scrollWidth <= innerWidth + 1'), 'mobile has no horizontal overflow');
  const mobile = await secondStudent.call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile('/tmp/roboedu-deployment-mobile.png', Buffer.from(mobile.data, 'base64'));
  await student.nav('/course/player?courseId=' + privateCourse.id); await student.wait(`document.body.innerText.includes('teacher-教学课件.png')`);
  const bad = await student.api('/api/v1/courses', 'POST', { title: 'forbidden' }); assert.equal(bad.status, 403);
  await student.api('/api/v1/auth/logout', 'POST');
  assert.equal((await student.api(`/api/v1/courses/${publicCourse.id}/materials`)).status, 401);
  assert.equal(errors.length, 0, 'no browser runtime/hydration errors');
  console.log('PASS browser: independent admin/teacher/student/second-student/guest contexts; real login, form create/lesson/upload/publish, preview/download, AI, reload/cross-session progress, logout and mobile layout.');
  }
} finally {
  for (const browserContextId of contexts) await browser('Target.disposeBrowserContext', { browserContextId }).catch(() => {});
  for (const ws of sockets) ws.close();
}
