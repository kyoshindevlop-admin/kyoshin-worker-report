/* ========= 設定 ========= */
const CONFIG = {
  LIFF_ID: "2009106846-kM1wF0eU",
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec", // https://script.google.com/macros/s/.../exec
  OT_STEP: 0.5,
};

/* ========= 状態 ========= */
let S = {
  idToken: "",
  lineUserId: "",
  user: null,     // { employeeId, name }
  masters: null,  // { customers, sites, employees, partners }
  last: null,     // 前回 { header, details, redenFlag }
  work: {
    workDate: "",
    customerId: "",
    siteId: "",
    workContent: "",
    employees: [], // [{id,name,people,ot}]
    partners: [],  // [{id,name,people,ot}]
    hasPartners: false,
    hasReden: false,
  }
};

/* ========= DOM ========= */
const $ = (id)=>document.getElementById(id);
function show(id){ $(id).style.display="block"; }
function hide(id){ $(id).style.display="none"; }
function msg(text, kind){
  const el = $("msg");
  el.className = "msg" + (kind ? (" " + kind) : "");
  el.textContent = text || "";
  el.style.display = text ? "block" : "none";
}
function todayYmd(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const dd= String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${dd}`;
}

/* ========= API ========= */
async function api(action, payload){
  const res = await fetch(CONFIG.GAS_API_URL, {
    method:"POST",
    headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ action, ...payload })
  });
  const json = await res.json();
  if (!json || json.ok !== true) {
    const m = (json && json.message) ? json.message : "APIエラー";
    const code = (json && json.reason) ? json.reason : "ERROR";
    const err = new Error(m);
    err.code = code;
    err.raw = json;
    throw err;
  }
  return json;
}

/* ========= 初期化 ========= */
async function boot(){
  hide("notRegistered"); hide("form"); hide("initChoice"); hide("detail"); hide("confirm");
  show("loading"); msg("");

  $("workDate").value = todayYmd();

  await liff.init({ liffId: CONFIG.LIFF_ID });

  if (!liff.isLoggedIn()) {
    liff.login(); // 戻ってくる
    return;
  }

  S.idToken = liff.getIDToken() || "";
  const prof = await liff.getProfile();
  S.lineUserId = prof && prof.userId ? prof.userId : "";

  $("who").textContent = `ログインOK：${prof.displayName || ""}`;

  // マスタ取得 & 社員照合
  const r = await api("bootstrap", { idToken: S.idToken });
  S.user = r.user;
  S.masters = r.masters;
  S.last = r.last || null;

  if (!S.user) {
    hide("loading");
    $("lineUserId").textContent = S.lineUserId || "(取得失敗)";
    show("notRegistered");
    $("copyBtn").onclick = async ()=>{
      try{ await navigator.clipboard.writeText(S.lineUserId); msg("コピーしました"); }catch(e){ msg("コピーに失敗しました","danger"); }
    };
    $("closeBtn").onclick = ()=>{ try{ liff.closeWindow(); }catch(e){} };
    return;
  }

  $("who").textContent = `ログインOK：${S.user.name}（社員ID:${S.user.employeeId}）`;

  // 顧客/現場プルダウン
  buildCustomerSelect();
  wireFormEvents();

  hide("loading");
  show("form");

  // 前回情報があれば「OK」後に選ばせる（仕様通り）
}

function buildCustomerSelect(){
  const cs = $("customerSelect");
  cs.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "選択してください";
  cs.appendChild(opt0);

  (S.masters.customers || []).forEach(c=>{
    const o = document.createElement("option");
    o.value = c.id;
    o.textContent = c.name;
    cs.appendChild(o);
  });
}

function buildSiteSelect(customerId){
  const ss = $("siteSelect");
  ss.innerHTML = "";
  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "選択してください";
  ss.appendChild(opt0);

  const sites = (S.masters.sites || []).filter(s => s.customerId === customerId && s.active);
  sites.forEach(s=>{
    const o = document.createElement("option");
    o.value = s.id;
    o.textContent = s.name;
    ss.appendChild(o);
  });
}

function wireFormEvents(){
  $("customerSelect").onchange = ()=>{
    const cid = $("customerSelect").value;
    buildSiteSelect(cid);
  };

  $("draftBtn").onclick = async ()=>{
    try{
      const p = collectHeaderInputs();
      await api("saveDraft", { idToken: S.idToken, payload: p });
      msg("下書きを保存しました");
    }catch(e){
      msg(`下書き保存に失敗：${e.message}`,"danger");
    }
  };

  $("nextBtn").onclick = ()=>{
    try{
      const p = collectHeaderInputs();
      S.work = Object.assign(S.work, p);

      // 前回情報があるなら選択画面へ
      if (S.last && S.last.summaryText) {
        $("lastSummary").textContent = S.last.summaryText;
        hide("form"); show("initChoice");
      } else {
        // そのまま新規で人数入力へ
        initDetailsNew();
      }
    }catch(e){
      msg(e.message,"danger");
    }
  };

  $("inheritBtn").onclick = ()=>{ initDetailsInherit(); };
  $("newBtn").onclick = ()=>{ initDetailsNew(); };

  $("backBtn").onclick = ()=>{ hide("detail"); show("form"); };

  $("confirmBtn").onclick = ()=>{
    try{
      collectDetailInputs();
      showConfirm();
    }catch(e){
      msg(e.message,"danger");
    }
  };

  $("fixBtn").onclick = ()=>{ hide("confirm"); show("detail"); };

  $("submitBtn").onclick = async ()=>{
    try{
      collectDetailInputs();
      const r = await api("submitReport", { idToken: S.idToken, payload: S.work });
      msg(`登録完了しました（出面ID:${r.reportId}）`);
      setTimeout(()=>{ try{ liff.closeWindow(); }catch(e){} }, 800);
    }catch(e){
      msg(`登録NG：${e.message}`,"danger");
    }
  };

  $("hasPartners").onchange = ()=>{
    const on = $("hasPartners").checked;
    S.work.hasPartners = on;
    $("partnerArea").style.display = on ? "block" : "none";
  };

  $("hasReden").onchange = ()=>{
    const on = $("hasReden").checked;
    S.work.hasReden = on;
    $("redenArea").style.display = on ? "block" : "none";
  };
}

function collectHeaderInputs(){
  const workDate = $("workDate").value;
  const customerId = $("customerSelect").value;
  const siteId = $("siteSelect").value;
  const workContent = $("workContent").value.trim();

  if (!workDate) throw new Error("作業日が未入力です。");
  if (!customerId) throw new Error("顧客名を選択してください。");
  if (!siteId) throw new Error("現場名を選択してください。");
  if (!workContent) throw new Error("作業内容を入力してください。");

  return { workDate, customerId, siteId, workContent };
}

/* ========= 人数入力 ========= */
function initDetailsNew(){
  hide("form"); hide("initChoice");
  // デフォルト：自社社員のみ（仕様）
  S.work.hasPartners = false;
  S.work.hasReden = false;
  $("hasPartners").checked = false;
  $("hasReden").checked = false;
  $("partnerArea").style.display = "none";
  $("redenArea").style.display = "none";

  // 社員全員リスト（有効のみ）
  buildPeopleList("empList", (S.masters.employees || []).filter(x=>x.active), true);
  buildPeopleList("partnerList", (S.masters.partners || []).filter(x=>x.active), false);

  show("detail");
}

function initDetailsInherit(){
  hide("initChoice");
  // 前回の人数だけ引き継ぎ（残業/赤伝は引き継がない仕様）
  const last = S.last && S.last.lastData ? S.last.lastData : null;

  S.work.hasPartners = false;
  S.work.hasReden = false;
  $("hasPartners").checked = false;
  $("hasReden").checked = false;
  $("partnerArea").style.display = "none";
  $("redenArea").style.display = "none";

  const emps = (S.masters.employees || []).filter(x=>x.active);
  const pars = (S.masters.partners || []).filter(x=>x.active);

  buildPeopleList("empList", emps, true, last ? last.employees : null);
  buildPeopleList("partnerList", pars, false, last ? last.partners : null);

  show("detail");
}

function buildPeopleList(containerId, list, isEmployee, inheritArr){
  const box = $(containerId);
  box.innerHTML = "";

  // inherit: {id -> people} を作る（残業は引き継がない）
  const inheritMap = {};
  if (Array.isArray(inheritArr)) {
    inheritArr.forEach(x=>{
      if (x && x.id) inheritMap[String(x.id)] = Number(x.people || 0);
    });
  }

  list.forEach(x=>{
    const row = document.createElement("div");
    row.className = "item";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = x.name;

    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.step = "1";
    input.placeholder = "人数";
    input.dataset.kind = isEmployee ? "EMP" : "PAR";
    input.dataset.id = x.id;
    input.dataset.name = x.name;
    input.value = (inheritMap[x.id] ? String(inheritMap[x.id]) : "");

    const ot = document.createElement("input");
    ot.type = "number";
    ot.min = "0";
    ot.step = String(CONFIG.OT_STEP);
    ot.placeholder = "残業";
    ot.dataset.kind = isEmployee ? "EMP_OT" : "PAR_OT";
    ot.dataset.id = x.id;
    ot.value = ""; // 引き継がない

    row.appendChild(name);
    row.appendChild(input);
    row.appendChild(ot);
    box.appendChild(row);
  });
}

function collectDetailInputs(){
  // 人数は整数、残業は0.5刻み（仕様）
  const emp = [];
  const par = [];

  const empInputs = $("empList").querySelectorAll("input[type='number']");
  for (let i=0;i<empInputs.length;i+=2){
    const peopleEl = empInputs[i];
    const otEl = empInputs[i+1];
    const people = Number(peopleEl.value || 0);
    const ot = Number(otEl.value || 0);
    if (people > 0 || ot > 0){
      if (!Number.isInteger(people)) throw new Error("人工（人数）は整数で入力してください。");
      if (!isStep(ot, CONFIG.OT_STEP)) throw new Error("残業は0.5h刻みで入力してください。");
      emp.push({ id: peopleEl.dataset.id, name: peopleEl.dataset.name, people, ot });
    }
  }

  const parInputs = $("partnerList").querySelectorAll("input[type='number']");
  for (let i=0;i<parInputs.length;i+=2){
    const peopleEl = parInputs[i];
    const otEl = parInputs[i+1];
    const people = Number(peopleEl.value || 0);
    const ot = Number(otEl.value || 0);
    if (people > 0 || ot > 0){
      if (!Number.isInteger(people)) throw new Error("人工（人数）は整数で入力してください。");
      if (!isStep(ot, CONFIG.OT_STEP)) throw new Error("残業は0.5h刻みで入力してください。");
      par.push({ id: peopleEl.dataset.id, name: peopleEl.dataset.name, people, ot });
    }
  }

  S.work.employees = emp;

  S.work.hasPartners = $("hasPartners").checked;
  S.work.partners = S.work.hasPartners ? par : [];

  S.work.hasReden = $("hasReden").checked;

  // 最低：社員が1人以上
  if (!S.work.employees || S.work.employees.length === 0) {
    throw new Error("自社（社員）の人数を1人以上入力してください。");
  }
}

function isStep(val, step){
  const s = Number(step);
  if (!isFinite(val) || !isFinite(s) || s<=0) return false;
  const n = Math.round(val / s);
  return Math.abs(n*s - val) < 1e-9;
}

function showConfirm(){
  hide("detail"); show("confirm");

  const c = (S.masters.customers || []).find(x=>x.id===S.work.customerId);
  const s = (S.masters.sites || []).find(x=>x.id===S.work.siteId);

  const sumPeople = (arr)=>arr.reduce((a,x)=>a+(Number(x.people)||0),0);
  const sumOt = (arr)=>arr.reduce((a,x)=>a+(Number(x.ot)||0),0);

  const empP = sumPeople(S.work.employees);
  const parP = sumPeople(S.work.partners);
  const empO = sumOt(S.work.employees);
  const parO = sumOt(S.work.partners);

  const lines = [];
  lines.push(`作業日：${S.work.workDate}`);
  lines.push(`顧客：${c ? c.name : S.work.customerId}`);
  lines.push(`現場：${s ? s.name : S.work.siteId}`);
  lines.push(`作業内容：${S.work.workContent}`);
  lines.push("");
  lines.push(`自社人数：${empP} ／ 自社残業：${empO}`);
  lines.push(`協力人数：${parP} ／ 協力残業：${parO}`);
  lines.push(`総人数：${empP + parP}`);
  lines.push(`赤伝：${S.work.hasReden ? "あり" : "なし"}`);
  $("confirmBox").textContent = lines.join("\n");
}

/* ========= 起動 ========= */
boot().catch(e=>{
  hide("loading");
  msg(`起動エラー：${e.message}`,"danger");
});
