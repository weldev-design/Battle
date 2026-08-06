import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';
import { getDatabase, ref, set, get, update, remove, onValue, onDisconnect, serverTimestamp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-database.js';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyBJkyPXoC2GK0AsFxfFaOow5GaoGWbOvq4', authDomain: 'battlequiz-bfa3f.firebaseapp.com', projectId: 'battlequiz-bfa3f',
  storageBucket: 'battlequiz-bfa3f.firebasestorage.app', messagingSenderId: '1012207700550', appId: '1:1012207700550:web:c2c20f4cbad004d7515847',
  databaseURL: 'https://battlequiz-bfa3f-default-rtdb.asia-southeast1.firebasedatabase.app'
});
const auth = getAuth(firebaseApp);
const db = getDatabase(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// BattleQuiz — واجهة اللعبة وربط حسابات Firebase.
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { selectedTeam: 'red', redName: 'الفريق الأحمر', blueName: 'الفريق الأزرق', maxPlayers: 10, redPlayers: [], bluePlayers: [], currentPlayer: '', roomCode: '', hostUid: '', roomUnsubscribe: null, disconnectTask: null, redScore: 0, blueScore: 0, question: 0, gameQuestions: [], timer: 15, timerId: null, answered: false };

  // بيانات تجريبية للمباراة (استبدلها لاحقًا ببيانات API).
  const questions = [
    { category:'جغرافيا', text:'ما هي أكبر قارة في العالم من حيث المساحة؟', options:['أفريقيا','آسيا','أوروبا','أمريكا الجنوبية'], answer:1 },
    { category:'علوم', text:'ما هو العنصر الكيميائي الذي يرمز له بالرمز O؟', options:['الذهب','الأكسجين','الهيدروجين','الفضة'], answer:1 },
    { category:'تقنية', text:'أي لغة تُستخدم أساسًا لإضافة التفاعل إلى صفحات الويب؟', options:['HTML','CSS','JavaScript','SQL'], answer:2 },
    { category:'تاريخ', text:'في أي قارة تقع الحضارة الفرعونية القديمة؟', options:['آسيا','أوروبا','أفريقيا','أستراليا'], answer:2 },
    { category:'ثقافة عامة', text:'كم عدد أضلاع الشكل السداسي؟', options:['خمسة','ستة','سبعة','ثمانية'], answer:1 }
  ];

  // تنقّل داخلي بين أقسام الموقع.
  function showView(name) {
    const insideRoom=$('#lobbyView').classList.contains('active')||$('#gameView').classList.contains('active');
    if(state.roomCode&&insideRoom&&!['lobby','game','result'].includes(name)){if(!confirm('أنت داخل غرفة الآن. هل تريد مغادرتها؟'))return;leaveRoom(false);return}
    $$('.view').forEach(v => v.classList.remove('active'));
    const target = $(`#${name}View`);
    if (target) target.classList.add('active');
    $$('.nav__link').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    $('.nav').classList.remove('open'); $('#menuBtn').setAttribute('aria-expanded','false');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (name !== 'game') clearInterval(state.timerId);
  }
  $$('[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $('#menuBtn').addEventListener('click', e => { const open = $('.nav').classList.toggle('open'); e.currentTarget.setAttribute('aria-expanded', open); });

  // جسيمات خفيفة للخلفية.
  for (let i=0; i<22; i++) { const p=document.createElement('span'); p.style.left=`${Math.random()*100}%`; p.style.bottom=`${-10+Math.random()*100}%`; p.style.animationDuration=`${8+Math.random()*14}s`; p.style.animationDelay=`-${Math.random()*12}s`; $('#particles').appendChild(p); }

  // خيارات النماذج.
  $$('.choice-group').forEach(group => group.addEventListener('click', e => { if(e.target.tagName==='BUTTON'){ $$('button',group).forEach(b=>b.classList.remove('selected')); e.target.classList.add('selected'); } }));
  $$('.team-choice').forEach(btn => btn.addEventListener('click', () => { $$('.team-choice').forEach(b=>b.classList.remove('selected')); btn.classList.add('selected'); state.selectedTeam=btn.dataset.team; }));

  function renderLobby(roomData=null) {
    const make = (name, leader=false) => `<div class="player"><span class="avatar">${name[0]}</span><strong>${name}</strong><small>${leader?'قائد':'●'}</small></div>`;
    const redEntries=Object.entries(roomData?.teams?.red||{}), blueEntries=Object.entries(roomData?.teams?.blue||{});
    const red=redEntries.map(([,p])=>p.name), blue=blueEntries.map(([,p])=>p.name);
    state.redPlayers=red; state.bluePlayers=blue;
    if(roomData){ state.redName=roomData.redName; state.blueName=roomData.blueName; state.hostUid=roomData.hostUid; state.maxPlayers=Math.min(10,Math.max(2,Number(roomData.maxPlayers)||10)); $('#redTeamTitle').textContent=state.redName; $('#blueTeamTitle').textContent=state.blueName; }
    const redLimit=Math.ceil(state.maxPlayers/2),blueLimit=Math.floor(state.maxPlayers/2);
    const emptySeats=count=>Array.from({length:count},()=>'<div class="player empty">＋ مقعد فارغ</div>').join('');
    $('#redPlayers').innerHTML=redEntries.map(([uid,p])=>make(p.name,uid===state.hostUid)).join('')+emptySeats(Math.max(0,redLimit-red.length));
    $('#bluePlayers').innerHTML=blueEntries.map(([uid,p])=>make(p.name,uid===state.hostUid)).join('')+emptySeats(Math.max(0,blueLimit-blue.length));
    $('.roster--red .roster__head>b').textContent=`${red.length}/${redLimit}`; $('.roster--blue .roster__head>b').textContent=`${blue.length}/${blueLimit}`;
    $('#lobbyStatus').textContent=`${red.length+blue.length}/${state.maxPlayers}`;
    const isHost=auth.currentUser?.uid===state.hostUid, ready=red.length===redLimit&&blue.length===blueLimit; $('#startGame').disabled=!ready||!isHost; $('#startGame').textContent=isHost?(ready?'ابدأ المباراة':'بانتظار اللاعبين'):'القائد يبدأ المباراة'; $('#lobbyHint').textContent=ready?'اكتمل الفريقان — المعركة جاهزة!':`المطلوب: الأحمر ${redLimit} لاعبين والأزرق ${blueLimit} لاعبين`;
  }
  renderLobby();
  function generateCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
  async function hashPassword(value){ if(!value)return ''; const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)); return [...new Uint8Array(bytes)].map(b=>b.toString(16).padStart(2,'0')).join(''); }
  function requireLogin(){ if(auth.currentUser)return true; modal.classList.add('open'); toast('سجّل الدخول أولًا لإنشاء غرفة أو الانضمام'); return false; }
  function watchRoom(code){ if(state.roomUnsubscribe)state.roomUnsubscribe(); const roomReference=ref(db,`rooms/${code}`); state.roomUnsubscribe=onValue(roomReference,snapshot=>{ if(!snapshot.exists()){toast('تم إغلاق الغرفة');state.roomCode='';showView('home');return} const data=snapshot.val();renderLobby(data);if(data.status==='started'&&!$('#gameView').classList.contains('active'))beginGame((data.questionOrder||[]).map(i=>questions[i])); },()=>toast('تعذر قراءة بيانات الغرفة')); }
  async function occupySeat(code,team,name){ const playerReference=ref(db,`rooms/${code}/teams/${team}/${auth.currentUser.uid}`); await set(playerReference,{name,joinedAt:serverTimestamp()}); state.disconnectTask=onDisconnect(playerReference); await state.disconnectTask.remove(); state.currentPlayer=name; state.roomCode=code; $('#roomCode').textContent=code; watchRoom(code); showView('lobby'); }
  $('#createForm').addEventListener('submit',async e=>{ e.preventDefault(); if(!requireLogin())return; const submit=e.submitter;submit.disabled=true;try{const inputs=$$('.team-input input'),password=$('#createForm input[type="password"]').value;state.redName=inputs[0].value.trim();state.blueName=inputs[1].value.trim();state.maxPlayers=Number($('#playerCount').value);let code;do{code=generateCode()}while((await get(ref(db,`rooms/${code}`))).exists());const leader=auth.currentUser.displayName||auth.currentUser.email.split('@')[0];await set(ref(db,`rooms/${code}`),{hostUid:auth.currentUser.uid,redName:state.redName,blueName:state.blueName,maxPlayers:state.maxPlayers,passwordHash:await hashPassword(password),status:'waiting',createdAt:serverTimestamp(),teams:{red:{[auth.currentUser.uid]:{name:leader,joinedAt:serverTimestamp()}}}});state.selectedTeam='red';await occupySeat(code,'red',leader);toast(`تم إنشاء الغرفة لـ ${state.maxPlayers} لاعبين`)}catch(error){toast(error.code==='PERMISSION_DENIED'?'انشر قواعد قاعدة البيانات أولًا':'تعذر إنشاء الغرفة')}finally{submit.disabled=false} });
  $('#joinForm').addEventListener('submit',async e=>{ e.preventDefault(); if(!requireLogin())return; const submit=e.submitter,name=$('#playerName').value.trim(),code=$('#roomCodeInput').value.trim().toUpperCase();submit.disabled=true;try{const snapshot=await get(ref(db,`rooms/${code}`));if(!snapshot.exists()){toast('كود الغرفة غير موجود');return}const room=snapshot.val();if(room.status!=='waiting'){toast('المباراة بدأت ولا يمكن الانضمام الآن');return}if(room.passwordHash&&room.passwordHash!==await hashPassword($('#joinPassword').value)){toast('كلمة مرور الغرفة غير صحيحة');return}const maxPlayers=Math.min(10,Math.max(2,Number(room.maxPlayers)||10)),teamLimit=state.selectedTeam==='red'?Math.ceil(maxPlayers/2):Math.floor(maxPlayers/2),members=Object.keys(room.teams?.[state.selectedTeam]||{});if(members.length>=teamLimit){toast(`هذا الفريق مكتمل ${teamLimit}/${teamLimit}، اختر الفريق الآخر`);return}if(room.teams?.red?.[auth.currentUser.uid]||room.teams?.blue?.[auth.currentUser.uid]){toast('أنت منضم إلى هذه الغرفة بالفعل');return}await occupySeat(code,state.selectedTeam,name);toast(`مرحبًا ${name}، تم انضمامك فعليًا`)}catch(error){toast(error.code==='PERMISSION_DENIED'?'تعذر الانضمام: تحقق من قواعد قاعدة البيانات':'تعذر الانضمام الآن')}finally{submit.disabled=false} });
  async function leaveRoom(ask=true){if(!state.roomCode)return true;const isHost=auth.currentUser?.uid===state.hostUid,message=isHost?'أنت قائد الغرفة. المغادرة ستغلق الغرفة للجميع، هل أنت متأكد؟':'هل تريد مغادرة الغرفة؟ سيصبح مقعدك فارغًا.';if(ask&&!confirm(message))return false;const code=state.roomCode;try{await state.disconnectTask?.cancel();if(isHost)await remove(ref(db,`rooms/${code}`));else{await remove(ref(db,`rooms/${code}/teams/red/${auth.currentUser.uid}`));await remove(ref(db,`rooms/${code}/teams/blue/${auth.currentUser.uid}`))}}catch{}state.roomUnsubscribe?.();state.roomUnsubscribe=null;state.roomCode='';renderLobby();showView('home');toast(isHost?'تم إغلاق الغرفة':'غادرت الغرفة');return true}
  $('#leaveRoom').addEventListener('click',()=>leaveRoom(true));
  $('#copyCode').addEventListener('click', async () => { try{ await navigator.clipboard.writeText($('#roomCode').textContent); toast('تم نسخ كود الغرفة'); } catch{ toast(`كود الغرفة: ${$('#roomCode').textContent}`); } });

  // دورة المباراة: سؤال، مؤقت، كشف الإجابة، ثم انتقال تلقائي.
  function arrangeQuestions(){ return [...questions].sort(()=>Math.random()-.5); }
  async function startGame(){ const redLimit=Math.ceil(state.maxPlayers/2),blueLimit=Math.floor(state.maxPlayers/2);if(state.redPlayers.length!==redLimit||state.bluePlayers.length!==blueLimit){toast(`لا يمكن البدء: الأحمر ${state.redPlayers.length}/${redLimit} والأزرق ${state.bluePlayers.length}/${blueLimit}`);return}if(auth.currentUser?.uid!==state.hostUid){toast('قائد الغرفة فقط يستطيع بدء المباراة');return}const order=questions.map((_,i)=>i).sort(()=>Math.random()-.5);try{await update(ref(db,`rooms/${state.roomCode}`),{status:'started',questionOrder:order,startedAt:serverTimestamp()})}catch{toast('تعذر بدء المباراة')} }
  function beginGame(orderedQuestions){ if(!orderedQuestions.length)return; state.question=0; state.gameQuestions=orderedQuestions; state.redScore=0; state.blueScore=0; $('#gameRedName').textContent=state.redName; $('#gameBlueName').textContent=state.blueName; renderGamePlayers(); showView('game'); renderQuestion(); }
  function renderGamePlayers(){
    const playerCard=name=>`<div class="game-player ${name===state.currentPlayer?'you':''}"><span class="avatar">${name[0]}</span><small>${name}</small></div>`;
    $('#gameRedPlayers').innerHTML=state.redPlayers.map(playerCard).join('');
    $('#gameBluePlayers').innerHTML=state.bluePlayers.map(playerCard).join('');
  }
  function renderQuestion(){
    clearInterval(state.timerId); state.answered=false; state.timer=15;
    const q=state.gameQuestions[state.question]; $('#questionText').textContent=q.text; $('#questionCategory').textContent=q.category; $('#questionCount').textContent=`السؤال ${state.question+1} من ${state.gameQuestions.length}`; $('#questionProgress').style.width=`${((state.question+1)/state.gameQuestions.length)*100}%`; $('#answerStatus').className='answer-status'; $('#answerStatus').textContent='اختر الإجابة الصحيحة قبل انتهاء الوقت';
    $('#answers').innerHTML=q.options.map((opt,i)=>`<button class="answer" data-index="${i}"><b>${['أ','ب','ج','د'][i]}</b><span>${opt}</span></button>`).join('');
    $$('.answer').forEach(b=>b.addEventListener('click',()=>selectAnswer(+b.dataset.index)));
    updateTimer(); state.timerId=setInterval(()=>{ state.timer--; updateTimer(); if(state.timer<=0){ clearInterval(state.timerId); revealAnswer(-1); } },1000);
  }
  function updateTimer(){ $('#timerValue').textContent=state.timer; const pct=(state.timer/15)*100; $('#timer').style.setProperty('--timer-progress',`${pct}%`); $('#timer').classList.toggle('danger',state.timer<=5); }
  function selectAnswer(index){ if(state.answered)return; clearInterval(state.timerId); revealAnswer(index); }
  function revealAnswer(index){
    state.answered=true; const q=state.gameQuestions[state.question]; const buttons=$$('.answer'); buttons.forEach(b=>b.disabled=true); buttons[q.answer].classList.add('correct');
    const correct=index===q.answer; if(index>=0&&!correct)buttons[index].classList.add('wrong');
    if(correct){ const points=100+state.timer*5; state.redScore+=points; $('#answerStatus').textContent=`إجابة صحيحة! +${points} نقطة`; $('#answerStatus').classList.add('correct'); } else { state.blueScore+=80; $('#answerStatus').textContent=index<0?'انتهى الوقت!':'إجابة غير صحيحة'; $('#answerStatus').classList.add('wrong'); }
    $('#redScore').textContent=state.redScore; $('#blueScore').textContent=state.blueScore;
    setTimeout(()=>{ state.question++; if(state.question<state.gameQuestions.length) renderQuestion(); else finishGame(); },1800);
  }
  function finishGame(){ clearInterval(state.timerId); $('#finalRed').textContent=state.redScore; $('#finalBlue').textContent=state.blueScore; $('#finalTeamNames').innerHTML=`${state.redName} <b>—</b> ${state.blueName}`; $('.result-hero h2').textContent=state.redScore>=state.blueScore?`${state.redName} ينتصر!`:`${state.blueName} ينتصر!`; renderStats(); showView('result'); launchConfetti(); }
  $('#startGame').addEventListener('click',startGame); $('#playAgain').addEventListener('click',startGame);

  function renderStats(){ const players=[...state.redPlayers,...state.bluePlayers]; $('#statsRows').innerHTML=players.length?players.map((name,i)=>`<div class="stat-row"><b>${i+1}</b><strong>${name}</strong><span class="right">—</span><span class="wrong">—</span><small>—</small></div>`).join(''):'<div class="empty-board"><h3>لا توجد بيانات لاعبين</h3><p>تظهر الإحصائيات بعد مشاركة لاعبين حقيقيين.</p></div>'; $('#mvpName').textContent='يُحدد من النتائج الحقيقية'; $('#mvpAvatar').textContent='?'; $('#mvpSummary').textContent='لا توجد بيانات وهمية'; $('#mvpXp').textContent='—'; }
  function launchConfetti(){ for(let i=0;i<50;i++){ const c=document.createElement('i'); Object.assign(c.style,{position:'fixed',zIndex:'90',top:'-12px',left:`${Math.random()*100}%`,width:'7px',height:'12px',background:['#557cff','#9b66ff','#ff4d6d','#ffd35c'][i%4],transform:`rotate(${Math.random()*180}deg)`,transition:`transform ${2+Math.random()*2}s linear, top ${2+Math.random()*2}s ease-in`}); document.body.appendChild(c); requestAnimationFrame(()=>{c.style.top='105vh';c.style.transform+=` translateX(${Math.random()*240-120}px) rotate(720deg)`}); setTimeout(()=>c.remove(),4200); } }

  // تبدأ لوحة المتصدرين فارغة، وتُملأ لاحقًا بنتائج اللاعبين الحقيقية من الخادم.
  function renderLeaders(){ $('#podium').innerHTML=''; $('#leaderTable').innerHTML='<div class="empty-board"><div class="empty-board__icon">🏆</div><h3>لا توجد نتائج بعد</h3><p>ستظهر هنا أسماء اللاعبين والفرق بعد انتهاء أولى المباريات الرسمية. العب واربح لتكون أول المتصدرين!</p></div>'; }
  $('#leaderTabs').addEventListener('click',e=>{ if(e.target.dataset.tab){ $$('#leaderTabs button').forEach(b=>b.classList.remove('active')); e.target.classList.add('active'); renderLeaders(e.target.dataset.tab); } }); renderLeaders(); renderStats();

  // نافذة تسجيل الدخول والتنبيهات.
  const modal=$('#loginModal'), authCard=$('.auth-card'); let authMode='login';
  $('[data-modal="login"]').addEventListener('click',e=>{e.stopPropagation();if(auth.currentUser){const open=$('.account-area').classList.toggle('open');$('#authTrigger').setAttribute('aria-expanded',open)}else modal.classList.add('open')}); $('#closeModal').addEventListener('click',()=>modal.classList.remove('open')); modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')}); document.addEventListener('keydown',e=>{if(e.key==='Escape'){modal.classList.remove('open');$('#profileModal').classList.remove('open');$('.account-area').classList.remove('open')}}); document.addEventListener('click',e=>{if(!e.target.closest('.account-area')){$('.account-area').classList.remove('open');$('#authTrigger').setAttribute('aria-expanded','false')}});
  $$('.auth-tabs button').forEach(btn=>btn.addEventListener('click',()=>{ authMode=btn.dataset.auth; $$('.auth-tabs button').forEach(b=>b.classList.toggle('active',b===btn)); authCard.classList.toggle('signup-mode',authMode==='signup'); $('#loginSubmit').textContent=authMode==='signup'?'إنشاء الحساب':'تسجيل الدخول'; $('#googleLabel').textContent=authMode==='signup'?'إنشاء حساب باستخدام Google':'المتابعة باستخدام Google'; $('#authPassword').autocomplete=authMode==='signup'?'new-password':'current-password'; }));
  const authErrors={ 'auth/invalid-credential':'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'auth/email-already-in-use':'البريد مستخدم في حساب آخر', 'auth/weak-password':'كلمة المرور ضعيفة', 'auth/popup-closed-by-user':'أُغلقت نافذة Google قبل إكمال الدخول', 'auth/popup-blocked':'المتصفح منع نافذة Google المنبثقة', 'auth/operation-not-allowed':'فعّل طريقة الدخول من Firebase أولًا', 'auth/unauthorized-domain':'أضف نطاق الموقع إلى النطاقات المصرح بها', 'auth/network-request-failed':'تحقق من اتصال الإنترنت' };
  const authMessage=error=>authErrors[error.code]||'تعذر تسجيل الدخول، حاول مرة أخرى';
  function setAuthLoading(loading){ $('#loginSubmit').disabled=loading; $('#googleLogin').disabled=loading; $('#loginSubmit').textContent=loading?'جارٍ التحقق...':(authMode==='signup'?'إنشاء الحساب':'تسجيل الدخول'); }
  $('#authForm').addEventListener('submit',async e=>{ e.preventDefault(); const email=$('#authEmail').value.trim(),password=$('#authPassword').value; if(authMode==='signup'&&!$('#authName').value.trim()){toast('اكتب اسم اللاعب أولًا');return} if(authMode==='signup'&&password!==$('#authConfirm').value){toast('كلمتا المرور غير متطابقتين');return} try{setAuthLoading(true);if(authMode==='signup'){const result=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(result.user,{displayName:$('#authName').value.trim()})}else await signInWithEmailAndPassword(auth,email,password);modal.classList.remove('open');toast(authMode==='signup'?'تم إنشاء حسابك بنجاح':'مرحبًا بعودتك');$('#authForm').reset()}catch(error){toast(authMessage(error))}finally{setAuthLoading(false)} });
  $('#googleLogin').addEventListener('click',async()=>{try{setAuthLoading(true);googleProvider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,googleProvider);modal.classList.remove('open');toast('تم تسجيل الدخول باستخدام Google')}catch(error){toast(authMessage(error))}finally{setAuthLoading(false)}});
  $('.auth-options button').addEventListener('click',async()=>{const email=$('#authEmail').value.trim();if(!email){toast('اكتب بريدك الإلكتروني أولًا');return}try{await sendPasswordResetEmail(auth,email);toast('أرسلنا رابط إعادة تعيين كلمة المرور')}catch(error){toast(authMessage(error))}});
  const profileModal=$('#profileModal');
  function fillProfile(){const user=auth.currentUser;if(!user)return;const name=user.displayName||user.email.split('@')[0];$('#profileName').value=name;$('#profileEmail').value=user.email||'';$('#profileAvatar').textContent=name[0].toUpperCase();$('#soundSetting').checked=localStorage.getItem('battlequiz-sound')!=='off'}
  $('#openProfile').addEventListener('click',()=>{fillProfile();$('.account-area').classList.remove('open');profileModal.classList.add('open')});
  $('#openSettings').addEventListener('click',()=>{fillProfile();$('.account-area').classList.remove('open');profileModal.classList.add('open');setTimeout(()=>$('.settings-box').scrollIntoView({behavior:'smooth',block:'center'}),100)});
  $('#closeProfile').addEventListener('click',()=>profileModal.classList.remove('open'));profileModal.addEventListener('click',e=>{if(e.target===profileModal)profileModal.classList.remove('open')});
  $('#profileForm').addEventListener('submit',async e=>{e.preventDefault();const name=$('#profileName').value.trim(),button=e.submitter;if(!name)return;button.disabled=true;try{await updateProfile(auth.currentUser,{displayName:name});localStorage.setItem('battlequiz-sound',$('#soundSetting').checked?'on':'off');if(state.roomCode){const playerRef=ref(db,`rooms/${state.roomCode}/teams/${state.selectedTeam}/${auth.currentUser.uid}`);await update(playerRef,{name})}state.currentPlayer=name;$('#authTriggerText').textContent=name;$('.icon',$('#authTrigger')).textContent=name[0].toUpperCase();$('#menuName').textContent=name;$('#menuAvatar').textContent=name[0].toUpperCase();profileModal.classList.remove('open');toast('تم حفظ الملف التعريفي')}catch{toast('تعذر تغيير الاسم أثناء المباراة؛ حاول بعد انتهائها')}finally{button.disabled=false}});
  $('#logoutButton').addEventListener('click',async()=>{$('.account-area').classList.remove('open');if(state.roomCode&&!(await leaveRoom(true)))return;await signOut(auth);toast('تم تسجيل الخروج')});
  onAuthStateChanged(auth,user=>{const trigger=$('#authTrigger'),text=$('#authTriggerText'),icon=$('.icon',trigger);if(user){const name=user.displayName||user.email.split('@')[0];text.textContent=name;icon.textContent=name[0].toUpperCase();trigger.classList.add('signed-in');state.currentPlayer=name;$('#menuName').textContent=name;$('#menuEmail').textContent=user.email||'';$('#menuAvatar').textContent=name[0].toUpperCase()}else{text.textContent='تسجيل الدخول';icon.textContent='♙';trigger.classList.remove('signed-in');$('.account-area').classList.remove('open')}});
  let toastTimer; function toast(message){ clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('show'); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2500); }
});
