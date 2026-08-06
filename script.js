import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js';
import { getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, sendPasswordResetEmail, onAuthStateChanged, signOut } from 'https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js';

const firebaseApp = initializeApp({
  apiKey: 'AIzaSyBJkyPXoC2GK0AsFxfFaOow5GaoGWbOvq4', authDomain: 'battlequiz-bfa3f.firebaseapp.com', projectId: 'battlequiz-bfa3f',
  storageBucket: 'battlequiz-bfa3f.firebasestorage.app', messagingSenderId: '1012207700550', appId: '1:1012207700550:web:c2c20f4cbad004d7515847'
});
const auth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();

// BattleQuiz — واجهة اللعبة وربط حسابات Firebase.
document.addEventListener('DOMContentLoaded', () => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const state = { selectedTeam: 'red', redName: 'الصقور', blueName: 'العواصف', redPlayers: [], bluePlayers: [], currentPlayer: '', redScore: 0, blueScore: 0, question: 0, timer: 15, timerId: null, answered: false };

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

  const names = ['أحمد','سارة','محمد','ليان','خالد'];
  function renderLobby(extraName='') {
    const make = (name, leader=false) => `<div class="player"><span class="avatar">${name[0]}</span><strong>${name}</strong><small>${leader?'قائد':'●'}</small></div>`;
    const red=[...names.slice(0,4)], blue=['نور','عمر','جود','مازن','ريم'];
    if(extraName){ const arr=state.selectedTeam==='red'?red:blue; if(arr.length<5) arr.push(extraName); }
    state.redPlayers=red; state.bluePlayers=blue; state.currentPlayer=extraName;
    $('#redPlayers').innerHTML=red.map((n,i)=>make(n,i===0)).join('')+(red.length<5?'<div class="player empty">＋ مقعد فارغ</div>':'');
    $('#bluePlayers').innerHTML=blue.map((n,i)=>make(n,i===0)).join('')+(blue.length<5?'<div class="player empty">＋ مقعد فارغ</div>':'');
    $('#lobbyStatus').textContent=`${red.length+blue.length}/10`;
  }
  renderLobby();
  function generateCode(){ const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join(''); }
  $('#createForm').addEventListener('submit', e => { e.preventDefault(); const inputs=$$('.team-input input'); state.redName=inputs[0].value||'الفريق الأحمر'; state.blueName=inputs[1].value||'الفريق الأزرق'; $('#redTeamTitle').textContent=state.redName; $('#blueTeamTitle').textContent=state.blueName; $('#roomCode').textContent=generateCode(); renderLobby(); showView('lobby'); toast('تم إنشاء الغرفة بنجاح'); });
  $('#joinForm').addEventListener('submit', e => { e.preventDefault(); const name=$('#playerName').value.trim(); if(!name) return; $('#roomCode').textContent=$('#roomCodeInput').value.toUpperCase(); renderLobby(name); showView('lobby'); toast(`مرحبًا ${name}، انضممت إلى الفريق`); });
  $('#copyCode').addEventListener('click', async () => { try{ await navigator.clipboard.writeText($('#roomCode').textContent); toast('تم نسخ كود الغرفة'); } catch{ toast(`كود الغرفة: ${$('#roomCode').textContent}`); } });

  // دورة المباراة: سؤال، مؤقت، كشف الإجابة، ثم انتقال تلقائي.
  function startGame(){ state.question=0; state.redScore=0; state.blueScore=0; $('#gameRedName').textContent=state.redName; $('#gameBlueName').textContent=state.blueName; renderGamePlayers(); showView('game'); renderQuestion(); }
  function renderGamePlayers(){
    const playerCard=name=>`<div class="game-player ${name===state.currentPlayer?'you':''}"><span class="avatar">${name[0]}</span><small>${name}</small></div>`;
    $('#gameRedPlayers').innerHTML=state.redPlayers.map(playerCard).join('');
    $('#gameBluePlayers').innerHTML=state.bluePlayers.map(playerCard).join('');
  }
  function renderQuestion(){
    clearInterval(state.timerId); state.answered=false; state.timer=15;
    const q=questions[state.question]; $('#questionText').textContent=q.text; $('#questionCategory').textContent=q.category; $('#questionCount').textContent=`السؤال ${state.question+1} من ${questions.length}`; $('#questionProgress').style.width=`${((state.question+1)/questions.length)*100}%`; $('#answerStatus').className='answer-status'; $('#answerStatus').textContent='اختر الإجابة الصحيحة قبل انتهاء الوقت';
    $('#answers').innerHTML=q.options.map((opt,i)=>`<button class="answer" data-index="${i}"><b>${['أ','ب','ج','د'][i]}</b><span>${opt}</span></button>`).join('');
    $$('.answer').forEach(b=>b.addEventListener('click',()=>selectAnswer(+b.dataset.index)));
    updateTimer(); state.timerId=setInterval(()=>{ state.timer--; updateTimer(); if(state.timer<=0){ clearInterval(state.timerId); revealAnswer(-1); } },1000);
  }
  function updateTimer(){ $('#timerValue').textContent=state.timer; const pct=(state.timer/15)*100; $('#timer').style.setProperty('--timer-progress',`${pct}%`); $('#timer').classList.toggle('danger',state.timer<=5); }
  function selectAnswer(index){ if(state.answered)return; clearInterval(state.timerId); revealAnswer(index); }
  function revealAnswer(index){
    state.answered=true; const q=questions[state.question]; const buttons=$$('.answer'); buttons.forEach(b=>b.disabled=true); buttons[q.answer].classList.add('correct');
    const correct=index===q.answer; if(index>=0&&!correct)buttons[index].classList.add('wrong');
    if(correct){ const points=100+state.timer*5; state.redScore+=points; $('#answerStatus').textContent=`إجابة صحيحة! +${points} نقطة`; $('#answerStatus').classList.add('correct'); } else { state.blueScore+=80; $('#answerStatus').textContent=index<0?'انتهى الوقت!':'إجابة غير صحيحة'; $('#answerStatus').classList.add('wrong'); }
    $('#redScore').textContent=state.redScore; $('#blueScore').textContent=state.blueScore;
    setTimeout(()=>{ state.question++; if(state.question<questions.length) renderQuestion(); else finishGame(); },1800);
  }
  function finishGame(){ clearInterval(state.timerId); $('#finalRed').textContent=state.redScore; $('#finalBlue').textContent=state.blueScore; $('.result-hero h2').textContent=state.redScore>=state.blueScore?`${state.redName} ينتصر!`:`${state.blueName} ينتصر!`; renderStats(); showView('result'); launchConfetti(); }
  $('#startGame').addEventListener('click',startGame); $('#playAgain').addEventListener('click',startGame);

  function renderStats(){ const data=[['سارة',4,1,'3.2ث'],['أحمد',3,2,'4.1ث'],['نور',3,2,'4.8ث'],['محمد',2,3,'5.3ث']]; $('#statsRows').innerHTML=data.map((p,i)=>`<div class="stat-row"><b>${i+1}</b><strong>${p[0]}</strong><span class="right">${p[1]}</span><span class="wrong">${p[2]}</span><small>${p[3]}</small></div>`).join(''); }
  function launchConfetti(){ for(let i=0;i<50;i++){ const c=document.createElement('i'); Object.assign(c.style,{position:'fixed',zIndex:'90',top:'-12px',left:`${Math.random()*100}%`,width:'7px',height:'12px',background:['#557cff','#9b66ff','#ff4d6d','#ffd35c'][i%4],transform:`rotate(${Math.random()*180}deg)`,transition:`transform ${2+Math.random()*2}s linear, top ${2+Math.random()*2}s ease-in`}); document.body.appendChild(c); requestAnimationFrame(()=>{c.style.top='105vh';c.style.transform+=` translateX(${Math.random()*240-120}px) rotate(720deg)`}); setTimeout(()=>c.remove(),4200); } }

  // تبدأ لوحة المتصدرين فارغة، وتُملأ لاحقًا بنتائج اللاعبين الحقيقية من الخادم.
  function renderLeaders(){ $('#podium').innerHTML=''; $('#leaderTable').innerHTML='<div class="empty-board"><div class="empty-board__icon">🏆</div><h3>لا توجد نتائج بعد</h3><p>ستظهر هنا أسماء اللاعبين والفرق بعد انتهاء أولى المباريات الرسمية. العب واربح لتكون أول المتصدرين!</p></div>'; }
  $('#leaderTabs').addEventListener('click',e=>{ if(e.target.dataset.tab){ $$('#leaderTabs button').forEach(b=>b.classList.remove('active')); e.target.classList.add('active'); renderLeaders(e.target.dataset.tab); } }); renderLeaders(); renderStats();

  // نافذة تسجيل الدخول والتنبيهات.
  const modal=$('#loginModal'), authCard=$('.auth-card'); let authMode='login';
  $('[data-modal="login"]').addEventListener('click',async()=>{ if(auth.currentUser){ if(confirm('هل تريد تسجيل الخروج من حسابك؟')) await signOut(auth); } else modal.classList.add('open'); }); $('#closeModal').addEventListener('click',()=>modal.classList.remove('open')); modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')}); document.addEventListener('keydown',e=>{if(e.key==='Escape')modal.classList.remove('open')});
  $$('.auth-tabs button').forEach(btn=>btn.addEventListener('click',()=>{ authMode=btn.dataset.auth; $$('.auth-tabs button').forEach(b=>b.classList.toggle('active',b===btn)); authCard.classList.toggle('signup-mode',authMode==='signup'); $('#loginSubmit').textContent=authMode==='signup'?'إنشاء الحساب':'تسجيل الدخول'; $('#googleLabel').textContent=authMode==='signup'?'إنشاء حساب باستخدام Google':'المتابعة باستخدام Google'; $('#authPassword').autocomplete=authMode==='signup'?'new-password':'current-password'; }));
  const authErrors={ 'auth/invalid-credential':'البريد الإلكتروني أو كلمة المرور غير صحيحة', 'auth/email-already-in-use':'البريد مستخدم في حساب آخر', 'auth/weak-password':'كلمة المرور ضعيفة', 'auth/popup-closed-by-user':'أُغلقت نافذة Google قبل إكمال الدخول', 'auth/popup-blocked':'المتصفح منع نافذة Google المنبثقة', 'auth/operation-not-allowed':'فعّل طريقة الدخول من Firebase أولًا', 'auth/unauthorized-domain':'أضف نطاق الموقع إلى النطاقات المصرح بها', 'auth/network-request-failed':'تحقق من اتصال الإنترنت' };
  const authMessage=error=>authErrors[error.code]||'تعذر تسجيل الدخول، حاول مرة أخرى';
  function setAuthLoading(loading){ $('#loginSubmit').disabled=loading; $('#googleLogin').disabled=loading; $('#loginSubmit').textContent=loading?'جارٍ التحقق...':(authMode==='signup'?'إنشاء الحساب':'تسجيل الدخول'); }
  $('#authForm').addEventListener('submit',async e=>{ e.preventDefault(); const email=$('#authEmail').value.trim(),password=$('#authPassword').value; if(authMode==='signup'&&!$('#authName').value.trim()){toast('اكتب اسم اللاعب أولًا');return} if(authMode==='signup'&&password!==$('#authConfirm').value){toast('كلمتا المرور غير متطابقتين');return} try{setAuthLoading(true);if(authMode==='signup'){const result=await createUserWithEmailAndPassword(auth,email,password);await updateProfile(result.user,{displayName:$('#authName').value.trim()})}else await signInWithEmailAndPassword(auth,email,password);modal.classList.remove('open');toast(authMode==='signup'?'تم إنشاء حسابك بنجاح':'مرحبًا بعودتك');$('#authForm').reset()}catch(error){toast(authMessage(error))}finally{setAuthLoading(false)} });
  $('#googleLogin').addEventListener('click',async()=>{try{setAuthLoading(true);googleProvider.setCustomParameters({prompt:'select_account'});await signInWithPopup(auth,googleProvider);modal.classList.remove('open');toast('تم تسجيل الدخول باستخدام Google')}catch(error){toast(authMessage(error))}finally{setAuthLoading(false)}});
  $('.auth-options button').addEventListener('click',async()=>{const email=$('#authEmail').value.trim();if(!email){toast('اكتب بريدك الإلكتروني أولًا');return}try{await sendPasswordResetEmail(auth,email);toast('أرسلنا رابط إعادة تعيين كلمة المرور')}catch(error){toast(authMessage(error))}});
  onAuthStateChanged(auth,user=>{const trigger=$('#authTrigger'),text=$('#authTriggerText'),icon=$('.icon',trigger);if(user){const name=user.displayName||user.email.split('@')[0];text.textContent=name;icon.textContent=name[0].toUpperCase();trigger.classList.add('signed-in');state.currentPlayer=name}else{text.textContent='تسجيل الدخول';icon.textContent='♙';trigger.classList.remove('signed-in')}});
  let toastTimer; function toast(message){ clearTimeout(toastTimer); $('#toast').textContent=message; $('#toast').classList.add('show'); toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2500); }
});
