const LIFF_ID = "2009106846-kM1wF0eU";
const GAS_URL = "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec";

const $ = (id) => document.getElementById(id);
const log = (s) => ($("log").textContent += s + "\n");

async function postJson(url, obj, timeoutMs = 15000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      body: JSON.stringify(obj), // Content-Typeは付けない（GASで詰まりにくい）
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
  $("status").textContent = "LIFF初期化中…";
  await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });

  if (!liff.isLoggedIn()) {
    $("status").textContent = "ログイン中…";
    liff.login();
    return;
  }

  const profile = await liff.getProfile();
  $("status").textContent = `ログインOK：${profile.displayName}`;

  $("send").onclick = async () => {
    $("send").disabled = true;
    $("status").textContent = "送信中…";

    try {
      const payload = {
        lineUserId: profile.userId,
        displayName: profile.displayName,
        site: $("site").value.trim(),
        work: $("work").value.trim(),
        ts: new Date().toISOString(),
      };

      const { res, text, json } = await postJson(GAS_URL, payload);
      log("HTTP " + res.status);
      log(text);

      if (!res.ok) throw new Error("HTTP_ERROR " + res.status);
      if (!json?.ok) throw new Error(json?.error || "SAVE_FAILED");

      $("status").textContent = "送信完了 ✅";
      alert("保存OK");
      try { liff.closeWindow(); } catch (_) {}
    } catch (e) {
      $("status").textContent = "送信失敗 ❌";
      log(String(e?.message || e));
      alert("失敗：" + (e?.message || e));
    } finally {
      $("send").disabled = false;
    }
  };
}

main().catch(e => {
  $("status").textContent = "起動エラー ❌";
  log(String(e?.stack || e));
});
