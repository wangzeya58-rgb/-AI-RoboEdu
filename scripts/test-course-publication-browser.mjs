import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

// Use a dedicated Chrome profile on 9223; never run against a user's normal profile.
const base = 'http://127.0.0.1:5000';
const prefix = `demo_publication_${randomUUID().slice(0,8)}`;
const publicTitle = prefix + '_公共课';
const classTitle = prefix + '_班级课';
let ws;
let call;
let evaluate;
let previousClasses;
let observer;
const errors = [];
const formalRequests = [];
const createdCourseIds = new Set();
try {
  const target = await (await fetch('http://127.0.0.1:9223/json/new?about:blank', {method:'PUT'})).json();
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let seq=0;
  let onLoad;
  const pending = new Map();
  ws.onmessage = ({data}) => {
    const msg = JSON.parse(data);
    if (msg.id) { const item=pending.get(msg.id); pending.delete(msg.id); if(msg.error)item?.reject(Error(JSON.stringify(msg.error))); else item?.resolve(msg.result); }
    if (msg.method==='Page.loadEventFired') onLoad?.();
    if (msg.method==='Runtime.exceptionThrown') errors.push(JSON.stringify(msg.params.exceptionDetails));
    if (msg.method==='Runtime.consoleAPICalled') {
      const text=msg.params.args.map(a=>a.value??a.description??'').join(' ');
      if (/hydration|server rendered|ISO-8859|Cannot update a component/i.test(text)) errors.push(text);
    }
    if (msg.method==='Network.requestWillBeSent' && /\/api\/v1\/(courses|classes)/.test(msg.params.request.url)) formalRequests.push(msg.params.request.url);
    if (msg.method==='Page.javascriptDialogOpening') void call('Page.handleJavaScriptDialog',{accept:true});
  };
  call=(method,params={})=>new Promise((resolve,reject)=>{ const id=++seq; pending.set(id,{resolve,reject}); ws.send(JSON.stringify({id,method,params})); });
  evaluate=async expression=>{ const r=await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails)); return r.result.value; };
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  async function wait(expression) { for(let n=0;n<160;n++){ if(await evaluate(`!!document.body&&(${expression})`))return; await pause(250); } throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`); }
  async function nav(path) { let timer; const loaded=new Promise(resolve=>{onLoad=resolve;}); await call('Page.navigate',{url:base+path}); try {await Promise.race([loaded,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('navigation timeout')),30000);})]);} finally {clearTimeout(timer);onLoad=undefined;} }
  async function click(text) { await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`); await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled).click()})()`); }
  async function field(placeholder,value) { await wait(`!!document.querySelector('[placeholder="${placeholder}"]')&&!document.querySelector('[placeholder="${placeholder}"]').disabled`); await evaluate(`(()=>{const i=document.querySelector('[placeholder="${placeholder}"]');Object.getOwnPropertyDescriptor(i.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(value)});i.dispatchEvent(new Event('input',{bubbles:true}));})()`); }
  async function login(username,path) {
    await evaluate(`(async()=>{const r=await fetch('/api/v1/auth/demo-login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(username)},password:'123456'})});const b=await r.json();if(!r.ok)throw Error('Demo login failed');localStorage.setItem('al_session',JSON.stringify(b.data));})()`);
    await nav(path);
  }
  const allCourses=()=>evaluate(`new Promise((resolve,reject)=>{const o=indexedDB.open('ai-roboedu-teacher-courses');o.onerror=()=>reject(o.error);o.onsuccess=()=>{const d=o.result;if(!d.objectStoreNames.contains('courses')){d.close();resolve([]);return;}const r=d.transaction('courses').objectStore('courses').getAll();r.onsuccess=()=>{d.close();resolve(r.result)};r.onerror=()=>reject(r.error);};})`);
  async function selectCourse(title) { await wait(`[...document.querySelectorAll('button')].some(b=>b.textContent.includes(${JSON.stringify(title)}))`); await evaluate(`(()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.includes(${JSON.stringify(title)})).click()})()`); }
  async function createCourse(title) {
    const beforeIds=new Set((await allCourses()).map(c=>c.id));
    await click('新建课程');
    try { await wait(`document.body.innerText.includes('课程已创建，可以继续编辑') && document.querySelector('[placeholder="例如：AI小车识人停靠实战"]')?.value.startsWith('新建课程')`); }
    finally { for(const c of await allCourses()) if(!beforeIds.has(c.id)) createdCourseIds.add(c.id); }
    await field('例如：AI小车识人停靠实战',title); await click('保存课程');
    await wait(`document.body.innerText.includes('课程名称和简介已保存')`);
    const managerPath=await evaluate('location.pathname');
    const draft=(await allCourses()).find(c=>c.title===title);
    await nav('/teaching-resources');
    await wait(`!!document.querySelector('[data-course-id="${draft.id}"]')`);
    assert.match(await evaluate(`document.querySelector('[data-course-id="${draft.id}"]').innerText`), /0 个课程文件/);
    assert.match(await evaluate(`document.querySelector('[data-course-id="${draft.id}"]').innerText`), /草稿/);
    await call('Page.reload'); await wait(`!!document.querySelector('[data-course-id="${draft.id}"]')`);
    await nav(managerPath); await selectCourse(title);
    await evaluate(`(async()=>{const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');ctx.fillStyle='#eff6ff';ctx.fillRect(0,0,640,360);ctx.fillStyle='#15803d';ctx.fillRect(48,48,72,72);ctx.fillStyle='#17212b';ctx.font='bold 36px sans-serif';ctx.fillText('AI RoboEdu',48,190);ctx.font='24px sans-serif';ctx.fillText('Published course resource',48,240);const blob=await new Promise(resolve=>c.toBlob(resolve,'image/png'));const file=new File([blob],'${prefix}.png',{type:'image/png'});const dt=new DataTransfer();dt.items.add(file);const i=document.querySelector('input[type=file]');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await wait(`document.body.innerText.includes('${prefix}.png 上传成功')`);
    const course=(await allCourses()).find(c=>c.title===title); assert.ok(course,JSON.stringify(await allCourses())); return course;
  }
  await call('Page.enable'); await call('Runtime.enable'); await call('Network.enable');
  await call('Network.clearBrowserCookies'); await call('Network.clearBrowserCache');
  await call('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await nav('/login');
  previousClasses=await evaluate(`localStorage.getItem('ai_roboedu_demo_classes_v1')`);
  await login('admin','/admin/courses');
  await wait(`document.body.innerText.includes('IndexedDB')`);
  // Create one historical record without ownership, preserving all existing records.
  await evaluate(`new Promise((resolve,reject)=>{const o=indexedDB.open('ai-roboedu-teacher-courses');o.onsuccess=()=>{const d=o.result;const tx=d.transaction('courses','readwrite');tx.objectStore('courses').put({id:'${prefix}_legacy',title:'${prefix}_旧课',description:'historical',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});tx.oncomplete=()=>{d.close();resolve(true)};tx.onerror=()=>reject(tx.error);};})`);
  await evaluate(`new Promise((resolve,reject)=>{const o=indexedDB.open('ai-roboedu-teacher-courses');o.onsuccess=()=>{const d=o.result;const tx=d.transaction(['assets','assetBlobs'],'readwrite');tx.objectStore('assets').put({id:'${prefix}_legacy_asset',courseId:'${prefix}_legacy',name:'historical.pdf',type:'presentation',mimeType:'application/pdf',size:14,createdAt:'2025-01-01'});tx.objectStore('assetBlobs').put({assetId:'${prefix}_legacy_asset',blob:new Blob(['original bytes'])});tx.oncomplete=()=>{d.close();resolve(true)};tx.onerror=()=>reject(tx.error);};})`);
  await nav('/teaching-resources');
  await wait(`!!document.querySelector('[data-course-id="${prefix}_legacy"]')`);
  assert.match(await evaluate(`document.querySelector('[data-course-id="${prefix}_legacy"]').innerText`), /待确认归属/);
  assert.match(await evaluate(`document.querySelector('[data-course-id="${prefix}_legacy"]').innerText`), /1 个课程文件/);
  assert.match(await evaluate(`document.querySelector('[aria-label="内置示例课程"]').innerText`), /项目内置示例/);
  await nav('/admin/courses'); await selectCourse(prefix+'_旧课');
  await wait(`document.body.innerText.includes('归属待确认')`);
  await evaluate(`(()=>{const s=document.querySelector('[aria-label="旧课程创建者"]');s.value='demo-admin';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('确认旧课程归属');
  await wait(`document.body.innerText.includes('草稿（学生不可见）')`);
  const legacy=(await allCourses()).find(c=>c.id===prefix+'_legacy');
  assert.equal(legacy.creatorRole,'admin'); assert.equal(legacy.status,'draft');
  const legacyBytes=await evaluate(`new Promise(resolve=>{const o=indexedDB.open('ai-roboedu-teacher-courses');o.onsuccess=()=>{const d=o.result;const r=d.transaction('assetBlobs').objectStore('assetBlobs').get('${prefix}_legacy_asset');r.onsuccess=async()=>{d.close();resolve(await r.result.blob.text())};};})`);
  assert.equal(legacyBytes,'original bytes','ownership confirmation must preserve the original file');
  const adminCourse=await createCourse(publicTitle);
  assert.equal(adminCourse.creatorRole,'admin'); assert.equal(adminCourse.status,'draft');
  await login('student','/course');
  await wait(`document.body.innerText.includes('公共课程与我的班级课程')&&!document.body.innerText.includes('正在加载课程...')`);
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(publicTitle)})`));
  await nav('/course/player?courseId='+adminCourse.id);
  await wait(`document.body.innerText.includes('没有访问权限')`);
  await login('admin','/admin/courses'); await selectCourse(publicTitle); await click('发布为公共课程');
  await wait(`document.body.innerText.includes('取消公共发布')`);
  await login('student','/course'); await selectCourse(publicTitle);
  await wait(`!![...document.querySelectorAll('a')].find(a=>a.textContent.includes('进入课堂'))`);
  await nav('/course/player?courseId='+adminCourse.id);
  await wait(`!!document.querySelector('img[src^="blob:"]') && document.body.innerText.includes(${JSON.stringify(publicTitle)})`);
  await call('Page.reload'); await wait(`!!document.querySelector('img[src^="blob:"]')`);
  console.log('PASS: Demo legacy ownership confirmation, hidden drafts, admin public publication, student resource playback and reload.');
  await login('teacher','/teacher/classes'); await field('班级名称',prefix+'_班级'); await click('创建');
  await wait(`document.body.innerText.includes('${prefix}_班级') && JSON.parse(localStorage.getItem('ai_roboedu_demo_classes_v1')).classes.some(c=>c.name==='${prefix}_班级')`);
  const classId=await evaluate(`JSON.parse(localStorage.getItem('ai_roboedu_demo_classes_v1')).classes.find(c=>c.name==='${prefix}_班级').id`);
  await nav('/teacher/courses'); await wait(`document.body.innerText.includes('IndexedDB')`);
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(publicTitle)})`));
  await nav('/teaching-resources'); await wait(`!!document.querySelector('[data-course-id="${adminCourse.id}"]')`);
  assert.match(await evaluate(`document.querySelector('[data-course-id="${adminCourse.id}"]').innerText`), /进入课程/);
  assert.ok(!await evaluate(`!!document.querySelector('[data-course-id="${prefix}_legacy"]')`));
  await nav('/course/player?courseId='+adminCourse.id); await wait(`!!document.querySelector('img[src^="blob:"]')`);
  await nav('/teacher/courses');
  const observedTarget=await (await fetch('http://127.0.0.1:9223/json/new?'+encodeURIComponent(base+'/teaching-resources'),{method:'PUT'})).json();
  observer=new WebSocket(observedTarget.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{observer.onopen=resolve;observer.onerror=reject;});
  let observerSeq=0;
  const observerPending=new Map();
  observer.onmessage=({data})=>{const message=JSON.parse(data);if(message.id){const item=observerPending.get(message.id);observerPending.delete(message.id);if(message.error)item?.reject(Error(JSON.stringify(message.error)));else item?.resolve(message.result);}};
  const observeCall=(method,params={})=>new Promise((resolve,reject)=>{const id=++observerSeq;observerPending.set(id,{resolve,reject});observer.send(JSON.stringify({id,method,params}));});
  const observe=async expression=>(await observeCall('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result?.value;
  for(let n=0;n<160&&!await observe(`!!document.querySelector('[data-course-id="${adminCourse.id}"]')`);n++)await pause(250);
  const teacherCourse=await createCourse(classTitle);
  let refreshed=false;
  for(let n=0;n<160;n++){
    if(await observe(`document.querySelector('[data-course-id="${teacherCourse.id}"]')?.innerText.includes('1 个课程文件')`)){refreshed=true;break;}
    await pause(250);
  }
  assert.ok(refreshed,'already-open resource tab must refresh after creation/edit/upload in manager');
  await writeFile('/tmp/roboedu-course-resources-desktop.png',Buffer.from((await observeCall('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await call('Target.closeTarget',{targetId:observedTarget.id}); observer.close(); observer=undefined;
  console.log('PASS: already-open resource tab refreshed after teacher creation, editing and file upload.');
  await evaluate(`(()=>{const s=document.querySelector('[aria-label="发布班级"]');s.value=${JSON.stringify(classId)};s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await click('发布到班级'); await wait(`document.body.innerText.includes('取消班级发布')`);
  await login('student','/class/join'); await field('例如 CLS-TEACHER-001',classId); await click('提交申请');
  await wait(`document.body.innerText.includes('等待教师审核')`);
  await nav('/course'); await wait(`document.body.innerText.includes(${JSON.stringify(publicTitle)})`);
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(classTitle)})`));
  await login('teacher','/teacher/classes');
  await selectCourse(prefix+'_班级');
  await click('通过'); await wait(`JSON.parse(localStorage.getItem('ai_roboedu_demo_classes_v1')).members.some(m=>m.classId===${JSON.stringify(classId)}&&m.studentId==='demo-student'&&m.status==='approved')`);
  await login('student','/course'); await selectCourse(classTitle);
  await nav('/course/player?courseId='+teacherCourse.id); await wait(`document.querySelector('img[src^="blob:"]')?.naturalWidth===640`);
  await writeFile('/tmp/roboedu-demo-course-published-desktop.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await login('admin','/admin/courses'); await selectCourse(classTitle);
  assert.ok(!await evaluate(`[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='发布为公共课程')`));
  await field('例如：AI小车识人停靠实战',classTitle+'_编辑'); await click('保存课程');
  await wait(`document.body.innerText.includes('课程名称和简介已保存')`);
  const unchanged=(await allCourses()).find(c=>c.id===teacherCourse.id);
  assert.equal(unchanged.creatorId,'demo-teacher'); assert.equal(unchanged.publicationScope,'class');
  await login('teacher','/teacher/classes');
  await selectCourse(prefix+'_班级');
  await click('移除'); await wait(`!JSON.parse(localStorage.getItem('ai_roboedu_demo_classes_v1')).members.some(m=>m.classId===${JSON.stringify(classId)}&&m.studentId==='demo-student')`);
  await login('student','/course/player?courseId='+teacherCourse.id); await wait(`document.body.innerText.includes('没有访问权限')`);
  console.log('PASS: teacher-only management, class publication, pending isolation, approval, immutable creator after admin edit, removal revokes resource access.');
  await login('admin','/admin/courses'); await selectCourse(publicTitle); await click('取消公共发布');
  await wait(`document.body.innerText.includes('发布为公共课程')`);
  await login('student','/course/player?courseId='+adminCourse.id); await wait(`document.body.innerText.includes('没有访问权限')`);
  await nav('/course'); await wait(`document.body.innerText.includes('公共课程与我的班级课程')&&!document.body.innerText.includes('正在加载课程...')`);
  assert.ok(!await evaluate(`document.body.innerText.includes(${JSON.stringify(publicTitle)})`));
  await login('admin','/teaching-resources');
  await wait(`!!document.querySelector('[data-course-id="${adminCourse.id}"]')`);
  const injection=await call('Page.addScriptToEvaluateOnNewDocument',{source:`window.__originalCourseDbOpen=indexedDB.open.bind(indexedDB);Object.defineProperty(indexedDB,'open',{configurable:true,value:function(...args){if(args[0]!=='ai-roboedu-teacher-courses')return window.__originalCourseDbOpen(...args);const r={error:new DOMException('Test IndexedDB unavailable','UnknownError')};setTimeout(()=>r.onerror?.(),0);return r;}});`});
  try {
    await nav('/teaching-resources');
    await wait(`document.querySelector('[role="alert"]')?.innerText.includes('课程读取失败')`);
    assert.match(await evaluate(`document.querySelector('[role="alert"]').innerText`), /不是上传课程的替代数据/);
    assert.equal(await evaluate(`document.querySelectorAll('[data-course-id]').length`),0);
    assert.ok(await evaluate(`!!document.querySelector('[aria-label="内置示例课程"]')`));
    await evaluate(`Object.defineProperty(indexedDB,'open',{configurable:true,value:window.__originalCourseDbOpen})`);
    await click('重试读取课程');
    await wait(`!!document.querySelector('[data-course-id="${adminCourse.id}"]')&&!document.querySelector('[role="alert"]')`);
  } finally { await call('Page.removeScriptToEvaluateOnNewDocument',{identifier:injection.identifier}); }
  console.log('PASS: legacy asset links/bytes preserved, zero-file drafts visible after reload, public teacher read-only access, explicit IndexedDB failure and same-page retry.');
  await call('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  await pause(300);
  assert.ok(await evaluate(`document.querySelector('main').scrollWidth <= document.querySelector('main').clientWidth+1`));
  await writeFile('/tmp/roboedu-demo-course-mobile.png',Buffer.from((await call('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(formalRequests,[],'Demo must not request formal course or class APIs');
  assert.deepEqual(errors,[],'No runtime/hydration errors');
  console.log('PASS: public cancellation, resource grid narrow viewport, no formal business API requests and no runtime/hydration errors.');
} finally {
  if(evaluate) {
    await evaluate(`new Promise((resolve,reject)=>{const o=indexedDB.open('ai-roboedu-teacher-courses');o.onsuccess=()=>{const d=o.result;if(!d.objectStoreNames.contains('courses')){d.close();resolve(true);return;}const tx=d.transaction(['courses','assets','assetBlobs'],'readwrite');const r=tx.objectStore('courses').getAll();r.onsuccess=()=>{const ids=r.result.filter(c=>c.title.startsWith('${prefix}')||c.id==='${prefix}_legacy'||${JSON.stringify([...createdCourseIds])}.includes(c.id)).map(c=>c.id);for(const id of ids)tx.objectStore('courses').delete(id);const a=tx.objectStore('assets').getAll();a.onsuccess=()=>{for(const asset of a.result)if(ids.includes(asset.courseId)){tx.objectStore('assets').delete(asset.id);tx.objectStore('assetBlobs').delete(asset.id);}};};tx.oncomplete=()=>{d.close();resolve(true)};tx.onerror=()=>reject(tx.error);};})`).catch(()=>{});
    if(previousClasses!==undefined) await evaluate(previousClasses===null ? `localStorage.removeItem('ai_roboedu_demo_classes_v1')` : `localStorage.setItem('ai_roboedu_demo_classes_v1',${JSON.stringify(previousClasses)})`).catch(()=>{});
  }
  await call?.('Browser.close').catch(()=>{}); ws?.close();
  observer?.close();
  console.log('Dedicated browser test records cleaned; pre-existing records preserved.');
}
