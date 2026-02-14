const FRONT_BUILD = "DDD"; // 更新確認用
const APP_VERSION = "1.2.0"; // ★ここだけ更新

async function pingGas() {
  // ★キャッシュ回避（クエリに時刻を付ける）
  const url = CONFIG.GAS_API_URL + "?t=" + Date.now();
  const res = await fetch(url, { method: "GET" });
  const text = await res.text();
  log("PING RAW=", text);
  try { return JSON.parse(text); } catch { return { ok:false, raw:text }; }
}
// ↑更新用


const CONFIG = {
  LIFF_ID: "2009106846-kM1wF0eU",
  GAS_API_URL: "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec",
};

const $ = (id) => document.getElementById(id);
const log = (...args) => {
  const s = args.map(a => (typeof a === "string" ? a : JSON.stringify(a))).join(" ");
  $("diag").textContent += s + "\n";
  console.log(...args);
};

async function api(action, payload = {}) {
  const res = await fetch(CONFIG.GAS_API_URL, {
    method: "POST",
    // ★ヘッダを付けない（プリフライト回避）
    body: JSON.stringify({ action, ...payload }),
  });

  const text = await res.text();
  log("RAW=", text);

  let json;
  try { json = JSON.parse(text); }
  catch { throw new Error("JSONパース失敗: " + text.slice(0, 200)); }

  if (!json.ok) throw new Error(json.message || "APIエラー");
  return json;
}

async function boot() {
  document.getElementById("appver").textContent = `ver ${APP_VERSION}`;

  // ↓更新確認用
  $("status").textContent = `起動中…（Front:${FRONT_BUILD}）`;
  try {
    const pong = await pingGas();
    if (pong.ok) {
      $("status").textContent = `起動中…（Front:${FRONT_BUILD} / GAS:${pong.gasTime}）`;
    } else {
      $("status").textContent = `起動中…（Front:${FRONT_BUILD} / GAS:応答NG）`;
    }
  } catch (e) {
    $("status").textContent = `起動中…（Front:${FRONT_BUILD} / GAS:到達不可）`;
    log("PING ERR=", e?.message || e);
  }

  $("status").textContent = `起動中…（Front:${FRONT_BUILD}）`;
  log("Front build=", FRONT_BUILD);
  // ↑更新確認用
  
  $("diag").textContent = "";
  $("status").textContent = "LIFF初期化中…";
  log("url=", location.href);
  log("ua=", navigator.userAgent);

  await liff.init({ liffId: CONFIG.LIFF_ID, withLoginOnExternalBrowser: true });

  if (!liff.isLoggedIn()) {
    $("status").textContent = "ログイン誘導中…";
    liff.login();
    return;
  }

  $("status").textContent = "ログインOK";
  log("inClient=", liff.isInClient());

  const idToken = liff.getIDToken();
  if (!idToken) throw new Error("NO_ID_TOKEN（scope openid必要）");

  $("boot").onclick = async () => {
    $("status").textContent = "bootstrap中…";
    const r = await api("bootstrap", { idToken });
    log("bootstrap=", r);
    $("status").textContent = "bootstrap完了";
  };

  $("send").onclick = async () => {
    if ($("send").disabled) return;
    $("send").disabled = true;
    const old = $("send").textContent;
    $("send").textContent = "送信中…";

    try {
      $("status").textContent = "送信中…";

      // まずはdebugLog代わりに saveDraft/submitReport を入れていく想定
      const payload = {
        lineUserId: "debug",
        displayName: "debug",
        site: $("site").value.trim(),
        work: $("work").value.trim(),
        ts: new Date().toISOString()
      };

      // あなたのGASは actionが必須なので、まず疎通用に bootstrap が推奨。
      // ここではサンプルとして saveDraft/submitReport ではなく、現状の入力をログ出ししたいなら
      // GAS側に "debugLog" actionを用意するのもアリ。（必要なら言って）
      log("input=", payload);
      alert("入力取得OK（このボタンは今はフロント確認用）");

      $("status").textContent = "完了";
      try { liff.closeWindow(); } catch(e) {}

    } finally {
      $("send").disabled = false;
      $("send").textContent = old;
    }
  };
}

boot().catch(e => {
  const now = new Date().toISOString();
  $("status").textContent = `エラー（${now} / Front:${FRONT_BUILD}）: ` + (e?.message || e);
  log("ERR=", e?.stack || e);
});
document.addEventListener("DOMContentLoaded", () => {
  const el = document.getElementById("appver");
  if (el) {
    el.textContent = `ver ${APP_VERSION}`;
  }
});

;
