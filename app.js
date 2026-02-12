// ===== 設定（ここだけ編集） =====
const LIFF_ID = "2009106846-kM1wF0eU";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec";


// ===== util =====
const $ = (id) => document.getElementById(id);
const log = (s) => { $("log").textContent += s + "\n"; };
const setStatus = (s) => { $("status").textContent = s; };

async function postJson(url, obj, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(obj), // Content-Type付けない（GAS安定）
      signal: controller.signal,
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}

    return { res, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function main() {
  $("log").textContent = "";

  // ===== LIFF SDKロード確認 =====
  if (typeof liff === "undefined") {
    setStatus("LIFF SDKが読み込めていません ❌");
    log("Check script URL:");
    log("https://static.line-scdn.net/liff/edge/2/sdk.js");
    throw new Error("LIFF_SDK_NOT_LOADED");
  }

  setStatus("LIFF初期化中…");

  await liff.init({
    liffId: LIFF_ID,
    withLoginOnExternalBrowser: true
  });

  if (!liff.isLoggedIn()) {
    setStatus("ログイン中…");
    liff.login();
    return;
  }

  const profile = await liff.getProfile();
  setStatus(`ログインOK：${profile.displayName}`);
  log("userId=" + profile.userId);
  log("inClient=" + liff.isInClient());

  $("send").onclick = async () => {
    $("send").disabled = true;
    setStatus("送信中…");

    try {
      const payload = {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        site: $("site").value.trim(),
        work: $("work").value.trim(),
        ts: new Date().toISOString(),
      };

      log("sending...");
      const { res, text, json } = await postJson(GAS_URL, payload);

      log("HTTP " + res.status);
      log("Response:");
      log(text);

      if (!res.ok) throw new Error("HTTP_ERROR_" + res.status);
      if (!json?.ok) throw new Error(json?.error || "SAVE_FAILED");

      setStatus("送信完了 ✅");
      alert("保存成功");
      try { liff.closeWindow(); } catch (_) {}

    } catch (e) {
      setStatus("送信失敗 ❌");
      log("ERROR:");
      log(String(e?.message || e));
      alert("エラー: " + (e?.message || e));
    } finally {
      $("send").disabled = false;
    }
  };
}

main().catch(e => {
  setStatus("起動エラー ❌");
  log(String(e?.stack || e));
});

