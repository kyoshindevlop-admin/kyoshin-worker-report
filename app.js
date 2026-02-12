// ====== 設定（ここだけ編集） ======
const LIFF_ID = "2009106846-kM1wF0eU";
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec";

// 0 = いまは「登録チェックなし」
// 1 = 社員シートで登録チェック（GAS側もONにする）
const REQUIRE_REGISTERED = 1;

// ====== util ======
const $ = (id) => document.getElementById(id);
const log = (s) => { $("diag").textContent += s + "\n"; };
const setStatus = (s) => { $("status").textContent = s; };
const setErr = (s) => { $("err").textContent = s || ""; };
const setSending = (on) => {
  $("send").disabled = on;
  $("sending").hidden = !on;
};

async function postJsonWithTimeout(url, bodyObj, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // ★GASでCORSプリフライトを避けるため、敢えて Content-Type を付けない
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(bodyObj),
      signal: controller.signal,
    });

    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch (_) {}
    return { status: res.status, okHttp: res.ok, text, json };
  } finally {
    clearTimeout(t);
  }
}

async function boot() {
  $("diag").textContent = "";
  setErr("");

  log("url=" + location.href);
  log("ua=" + navigator.userAgent);
  setStatus("LIFF初期化中…");

  await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });

  if (!liff.isLoggedIn()) {
    setStatus("ログイン誘導中…");
    liff.login();
    return;
  }

  const idToken = liff.getIDToken();
  if (!idToken) {
    setErr("IDトークンが取得できません。LIFFのscopeに openid が入っているか確認してください。");
    return;
  }

  const profile = await liff.getProfile();
  log("inClient=" + liff.isInClient());
  log("lineUserId=" + profile.userId);

  // 画面表示
  $("form").style.display = "block";
  setStatus(`ログインOK：${profile.displayName} さん`);

  // （任意）サーバ側で登録チェック/Bootstrap
  if (REQUIRE_REGISTERED) {
    setStatus("社員照合中…");
    const r = await postJsonWithTimeout(GAS_API_URL, {
      action: "bootstrap",
      idToken,
    });

    log("bootstrap.status=" + r.status);
    log("bootstrap.body=" + r.text);

    if (!r.okHttp || !r.json || !r.json.ok) {
      setErr("利用できません。\n" + (r.json?.message || r.json?.reason || r.text));
      return;
    }

    setStatus(`ログインOK：${r.json.user.name}（${r.json.user.employeeId}）`);
  }

  $("send").onclick = async () => {
    setErr("");
    setSending(true);
    setStatus("送信中…");

    const payload = {
      action: "report.create",
      idToken,
      site: $("site").value.trim(),
      work: $("work").value.trim(),
      ts: new Date().toISOString(),
    };

    try {
      const r = await postJsonWithTimeout(GAS_API_URL, payload, 20000);
      log("submit.status=" + r.status);
      log("submit.body=" + r.text);

      if (!r.okHttp) throw new Error("HTTP_ERROR " + r.status);
      if (!r.json) throw new Error("INVALID_JSON_RESPONSE");
      if (!r.json.ok) throw new Error(r.json.reason || r.json.message || "SAVE_FAILED");

      setStatus("送信完了 ✅");
      alert("保存しました：" + (r.json.reportId || ""));
      try { liff.closeWindow(); } catch (_) {}
    } catch (e) {
      setStatus("送信失敗 ❌");
      setErr(String(e?.message || e));
    } finally {
      setSending(false);
    }
  };
}

boot().catch(e => {
  setStatus("エラー ❌");
  setErr(String(e?.message || e));
  log("ERR=" + (e?.stack || e));
});
