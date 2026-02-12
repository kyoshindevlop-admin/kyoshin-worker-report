// ★ここだけ自分の値に置換
const LIFF_ID = "2009106846-kM1wF0eU";  // 画面で見えてたやつ
const GAS_API_URL = "https://script.google.com/macros/s/AKfycbzVCaTeUa1bNEhORgbi1qzJBM3mYxV1HO7-Ak0cvEoSbLH6zIAcQ41okseYLikuqr6Qmg/exec";

const $ = (id) => document.getElementById(id);
const log = (s) => { $("diag").textContent += s + "\n"; };

async function boot(){
  $("diag").textContent = "";
  $("status").textContent = "LIFF初期化中…";
  log("url=" + location.href);
  log("ua=" + navigator.userAgent);

  await liff.init({ liffId: LIFF_ID, withLoginOnExternalBrowser: true });

  if (!liff.isLoggedIn()){
    $("status").textContent = "ログイン誘導中…";
    liff.login();
    return;
  }

  $("status").textContent = "ログインOK。送信待ち";
  log("inClient=" + liff.isInClient());

  const idToken = liff.getIDToken(); // openid scope必須
  if (!idToken) throw new Error("NO_ID_TOKEN");

  $("send").onclick = async () => {
    $("status").textContent = "送信中…";

    const payload = {
      idToken,
      site: $("site").value.trim(),
      work: $("work").value.trim(),
      ts: new Date().toISOString()
    };

    // GASはCORSが厳しいので「Content-Typeを付けない」投げ方が安定
    const res = await fetch(GAS_API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
    });

    // GASの戻りをJSONで返すなら↓
    const text = await res.text();
    log("response=" + text);

    alert("送信しました");
    try{ liff.closeWindow(); }catch(e){}
  };
}

boot().catch(e=>{
  $("status").textContent = "エラー: " + (e?.message || e);
  log("ERR=" + (e?.stack || e));
});
