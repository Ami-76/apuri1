// ------------------------ モード ------------------------
let mode = document.querySelector('input[name="mode"]:checked').value;
document.querySelectorAll('input[name="mode"]').forEach(radio=>{
  radio.addEventListener('change', e => { 
    mode=e.target.value; 
    loadEvents(); 
  });
});

// ------------------------ IndexedDB ------------------------
let db;
function openDB(){
  return new Promise((resolve,reject)=>{
    const req=indexedDB.open("daysCountDB",1);
    req.onupgradeneeded=e=>{
      const db=e.target.result;
      db.createObjectStore("events",{keyPath:"id"});
    };
    req.onsuccess=e=>{ db=e.target.result; resolve(db); };
    req.onerror=e=>reject(e);
  });
}
function saveEvent(event){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("events","readwrite");
    const store=tx.objectStore("events");
    store.put(event);
    tx.oncomplete=()=>resolve();
    tx.onerror=e=>reject(e);
  });
}
function deleteEventDB(id){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("events","readwrite");
    const store=tx.objectStore("events");
    store.delete(id);
    tx.oncomplete=()=>resolve();
    tx.onerror=e=>reject(e);
  });
}
function getAllEvents(){
  return new Promise((resolve,reject)=>{
    const tx=db.transaction("events","readonly");
    const store=tx.objectStore("events");
    const req=store.getAll();
    req.onsuccess=e=>resolve(e.target.result);
    req.onerror=e=>reject(e);
  });
}

// ------------------------ DOM ------------------------
const titleInput=document.getElementById("title");
const colorInput=document.getElementById("color");
const list=document.getElementById("list");
const addBtn=document.getElementById("addBtn");

let editId=null;

// ------------------------ 日付取得 ------------------------
function getStartDate() {
  const dateVal = document.getElementById("start-date").value;
  if (!dateVal) return null;
  const [y,m,d] = dateVal.split("-").map(Number);
  const time = document.getElementById("start-time").value;
  const [h,min] = time ? time.split(":").map(Number) : [0,0];
  const hasTime = !!time;
  return { date: new Date(y,m-1,d,h,min), hasTime };
}

function getEndDate() {
  const dateVal = document.getElementById("end-date").value;
  if (!dateVal) return { date: null, hasTime:false };
  const [y,m,d] = dateVal.split("-").map(Number);
  const time = document.getElementById("end-time").value;
  const [h,min] = time ? time.split(":").map(Number) : [0,0];
  const hasTime = !!time;
  return { date: new Date(y,m-1,d,h,min), hasTime };
}

// ------------------------ フォーマット ------------------------
function formatDuration(ms, showTime=true){
  if(ms<0) ms=0;
  const totalMinutes = Math.floor(ms/60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440)/60);
  const minutes = totalMinutes % 60;
  if(showTime){
    return `${days}日 ${String(hours).padStart(2,"0")}:${String(minutes).padStart(2,"0")}`;
  } else {
    return `${days}日`;
  }
}

// ------------------------ イベント操作 ------------------------
addBtn.addEventListener("click", async ()=>{
  const startObj = getStartDate();
  const endObj = getEndDate();
  if(!titleInput.value || !startObj.date) return;
  const e = {
    id: editId||Date.now(),
    title: titleInput.value,
    start: startObj.date.toISOString(),
    startHasTime: startObj.hasTime,
    end: endObj.date ? endObj.date.toISOString() : null,
    endHasTime: endObj.hasTime,
    color: colorInput.value
  };
  await saveEvent(e);
  editId=null;
  resetForm();
  loadEvents();
});

function resetForm(){
  titleInput.value="";
  colorInput.value="#009688";
  ["start-date","start-time","end-date","end-time"].forEach(id=>document.getElementById(id).value="");
  addBtn.textContent="追加";
}

async function deleteEventHandler(id){
  await deleteEventDB(id);
  loadEvents();
}

function editEventHandler(e){
  const start=new Date(e.start);
  const end=e.end ? new Date(e.end) : null;

  titleInput.value=e.title;
  colorInput.value=e.color;

  document.getElementById("start-date").value = start.toISOString().split("T")[0];
  document.getElementById("start-time").value = e.startHasTime ? `${String(start.getHours()).padStart(2,"0")}:${String(start.getMinutes()).padStart(2,"0")}` : "";

  if(end){
    document.getElementById("end-date").value = end.toISOString().split("T")[0];
    document.getElementById("end-time").value = e.endHasTime ? `${String(end.getHours()).padStart(2,"0")}:${String(end.getMinutes()).padStart(2,"0")}` : "";
  } else {
    ["end-date","end-time"].forEach(id=>document.getElementById(id).value="");
  }

  editId=e.id;
  addBtn.textContent="保存";
}

// ------------------------ 表示 ------------------------
async function loadEvents(){
  const events = await getAllEvents();
  const now = new Date();

  // 残り日数順でソート（カウントダウンのみ）
  events.sort((a,b)=>{
    if(mode==="countdown"){
      const aRemain = a.end ? new Date(a.end)-now : Infinity;
      const bRemain = b.end ? new Date(b.end)-now : Infinity;
      return aRemain - bRemain;
    }
    return 0;
  });

  list.innerHTML="";

  events.forEach(e=>{
    const start=new Date(e.start);
    const passedMs = now-start;
    const remainMs = e.end ? new Date(e.end)-now : null;

    const div=document.createElement("div");
    div.className="card event";
    div.style.borderColor=e.color;

    let numberHTML="";
    let endHTML="";
    if(mode==="countup"){
      numberHTML=`<div class="numbers countup-number">${formatDuration(passedMs, e.startHasTime)}</div>`;
    } else if(mode==="countdown"){
      if(remainMs !== null){
        numberHTML=`<div class="numbers countdown-number">${formatDuration(remainMs, e.endHasTime)}</div>`;
      } else {
        endHTML=`<div class="no-end">終了日未設定</div>`;
      }
    }

    div.innerHTML=`
      ${numberHTML}
      ${endHTML}
      <div class="title">${e.title}</div>
      <div class="buttons">
        <button class="edit">編集</button>
        <button class="delete">削除</button>
      </div>
    `;

    div.querySelector(".delete").addEventListener("click",()=>deleteEventHandler(e.id));
    div.querySelector(".edit").addEventListener("click",()=>editEventHandler(e));

    list.appendChild(div);
  });
}

setInterval(loadEvents,60000);
openDB().then(()=>loadEvents());
