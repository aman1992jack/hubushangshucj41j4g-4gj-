/**
 * app-core.js — 戶部尚書核心邏輯
 * 負責：資產計算、分頁切換、畫面渲染、PIN 碼、自動補完
 *
 * 台灣習慣：上漲 → 紅色 (up)、下跌 → 綠色 (dn)
 *   CSS: --up:#9B2525 (紅) / --dn:#0A6648 (綠)  ← 在 style.css 內調換即可
 *   此處邏輯：v >= 0 → 'up' (紅)，v < 0 → 'dn' (綠)，與原邏輯相同，
 *   只需在 style.css 中將 --up / --dn 顏色對調為台灣習慣即可。
 *   本版 style.css 已將：--up:#9B2525 (紅/漲)、--dn:#0A6648 (綠/跌)
 */

// ═══════════════════════════════════════════════════════════
// 常數
// ═══════════════════════════════════════════════════════════

const SEGC = {
  台股:'#1D9E75', 美股:'#185FA5', 外幣:'#BA7517',
  加密:'#854F0B', 他國:'#534AB7', 其他:'#6B6A65', 備用金:'#C8962A'
};
const CATC = {
  餐飲:'#1D9E75', 交通:'#185FA5', 娛樂:'#BA7517',
  購物:'#D85A30', 醫療:'#993556', 收入:'#0A6648', 其他:'#6B6A65'
};

/** 預設匯率（未連網時使用） */
const FXR = {
  USD:32.5, JPY:0.218, EUR:35.8, GBP:41.5,
  CNY:4.48, KRW:0.024, HKD:4.17, SGD:24.5,
  AUD:21.2, CAD:23.8, THB:0.94, VND:0.0013
};

// ═══════════════════════════════════════════════════════════
// 自動補完：股票代號 ↔ 名稱
// ═══════════════════════════════════════════════════════════

const TW_NAMES = {
  '0050':'元大0050','0056':'元大高股息','006208':'富邦台50',
  '00878':'國泰永續高股息','00929':'復華台灣科技優息','00919':'群益台灣精選高息',
  '2330':'台積電','2317':'鴻海','2454':'聯發科','2382':'廣達',
  '2412':'中華電','2308':'台達電','2303':'聯電','2881':'富邦金',
  '2882':'國泰金','2886':'兆豐金','2884':'玉山金','2891':'中信金',
  '2892':'第一金','2880':'華南金','2883':'開發金','2885':'元大金',
  '2887':'台新金','2888':'新光金','2890':'永豐金','1301':'台塑',
  '1303':'南亞','1326':'台化','6505':'台塑化','2002':'中鋼',
  '1216':'統一','2912':'統一超','2207':'和泰車','3008':'大立光',
  '2395':'研華','2379':'瑞昱','2408':'南亞科','3711':'日月光投控',
  '2357':'華碩','2353':'宏碁','2327':'國巨','4904':'遠傳',
  '3045':'台灣大','2618':'長榮航','2603':'長榮','2609':'陽明',
  '2615':'萬海','5880':'合庫金','2823':'中壽','2801':'彰銀',
  '1101':'台泥','1102':'亞泥','9910':'豐泰',
};

/** 美股：TSLA, AMD, AAPL, GOOG, META, INTC, NVDA, MSFT 及其他常用 */
const US_NAMES = {
  'TSLA':'特斯拉 Tesla','AMD':'超微 AMD','AAPL':'蘋果 Apple',
  'GOOG':'Google Alphabet','GOOGL':'Alphabet Google','META':'Meta',
  'INTC':'英特爾 Intel','NVDA':'輝達 NVIDIA','MSFT':'微軟 Microsoft',
  'AVGO':'博通 Broadcom','TSM':'台積電 ADR','QCOM':'高通 Qualcomm',
  'MU':'美光 Micron','AMAT':'應用材料','LRCX':'科林研發',
  'KLAC':'科磊','TXN':'德儀','JPM':'摩根大通','BAC':'美國銀行',
  'WFC':'富國銀行','GS':'高盛','MS':'摩根士丹利','BRK.B':'波克夏B',
  'JNJ':'嬌生','UNH':'聯合健康','PFE':'輝瑞','ABBV':'艾伯維',
  'LLY':'禮來','V':'Visa','MA':'萬事達','PYPL':'PayPal',
  'DIS':'迪士尼','NFLX':'Netflix','SPOT':'Spotify','UBER':'優步',
  'LYFT':'Lyft','NKE':'耐吉 Nike','MCD':'麥當勞','SBUX':'星巴克',
  'KO':'可口可樂','PEP':'百事可樂','WMT':'沃爾瑪','COST':'好市多 Costco',
  'TGT':'塔吉特','HD':'家得寶','SPY':'標普500 ETF',
  'QQQ':'那斯達克100 ETF','VTI':'Vanguard全市場 ETF',
  'VOO':'Vanguard標普500 ETF','ARKK':'ARK Innovation ETF',
  'AMZN':'亞馬遜 Amazon',
};

/** 韓股：YG, SM, JYP, HYBE, CUBE 及其他 */
const INTL_NAMES = {
  '122870':'YG Entertainment','041510':'SM Entertainment',
  '035900':'JYP Entertainment','352820':'HYBE','182360':'CUBE Entertainment',
  '005930':'三星電子 Samsung','000660':'SK海力士','035420':'NAVER',
  '7203':'豐田 Toyota','6758':'索尼 Sony','9984':'軟銀 SoftBank',
  '6501':'日立','6702':'富士通','8306':'三菱UFJ',
  '700':'騰訊','9988':'阿里巴巴','3690':'美團','1810':'小米',
  'HSBA':'匯豐銀行','VOD':'沃達豐','BP':'英國石油',
  'SAP':'SAP','ASML':'艾司摩爾 ASML','LVMH':'路威酩軒 LVMH',
};

function lookupTWName(code)   { return TW_NAMES[code.trim()]   || ''; }
function lookupUSName(ticker) { return US_NAMES[ticker.trim().toUpperCase()] || ''; }
function lookupIntlName(code) { return INTL_NAMES[code.trim()] || ''; }

// ═══════════════════════════════════════════════════════════
// 狀態物件 S
// ═══════════════════════════════════════════════════════════

const S = {
  // PIN 碼（預設 355218）
  pin:           localStorage.getItem('czg_pin') || '355218',
  pinEnabled:    localStorage.getItem('czg_pin_enabled') === '1',
  buf:           '',

  // Google Sheets
  gsId:  localStorage.getItem('czg_gsid')  || '1FUhXesSModk6yJmjZ34Jn2eklwmNJPpfKkAxrwefyS4',
  gsKey: localStorage.getItem('czg_gskey') || '',
  gsOk:  false,

  // 匯率
  usdTwd: 32.5,

  // 欄位設定
  cfg: JSON.parse(localStorage.getItem('czg_cfg') || '0') || {
    sheet: '公式',
    cells: { '0050':'B2', '2330':'B3', 'NVDA':'D2', 'MSFT':'D3', 'USDTWD':'F2' },
    cfSheet: '固定支出'
  },

  // 資產資料
  twStocks: JSON.parse(localStorage.getItem('czg_tw') || '0') || [
    { code:'0050', name:'元大0050', shares:734,  cost:33.18,  livePrice:null, realPnl:0 },
    { code:'2330', name:'台積電',   shares:110,  cost:531.63, livePrice:null, realPnl:0 },
  ],
  usStocks: JSON.parse(localStorage.getItem('czg_us') || '0') || [
    { ticker:'NVDA', name:'輝達', shares:5,   costTwd:3820,   livePriceUsd:null },
    { ticker:'MSFT', name:'微軟', shares:0.5, costTwd:6528.5, livePriceUsd:null },
  ],
  fx: JSON.parse(localStorage.getItem('czg_fx') || '0') || [
    { cur:'KRW', amt:59950, rateBuy:0.024, rateLive:null },
    { cur:'JPY', amt:1273,  rateBuy:0.218, rateLive:null },
    { cur:'CNY', amt:2,     rateBuy:4.48,  rateLive:null },
    { cur:'THB', amt:19,    rateBuy:0.94,  rateLive:null },
  ],
  crypto:    JSON.parse(localStorage.getItem('czg_cr')    || '[]'),
  intl:      JSON.parse(localStorage.getItem('czg_intl')  || '0') || [],
  other:     JSON.parse(localStorage.getItem('czg_oth')   || '[]'),
  emergency: JSON.parse(localStorage.getItem('czg_em')    || JSON.stringify({ balance:0, log:[], lastAutoDate:'' })),
  expenses:  [],
  txHistory: JSON.parse(localStorage.getItem('czg_txhist') || '[]'),
  history:   JSON.parse(localStorage.getItem('czg_hist')   || '[]'),

  // 圖表實例
  dchart: null, tchart: null, stkPie: null,
  twMiniPie: null, usMiniPie: null,

  // UI 狀態
  curM: null, trendYr: 1, chartMode: 'pie',
};

// ═══════════════════════════════════════════════════════════
// 工具函數
// ═══════════════════════════════════════════════════════════

const fmt  = n => Math.round(n).toLocaleString('zh-TW');
const fmtD = (n, d=2) => Number(n).toFixed(d);
/** 台灣習慣：漲 → 紅(up)、跌 → 綠(dn)，邏輯不變，顏色由 CSS 控制 */
const upcl = v => v >= 0 ? 'up' : 'dn';
const sign = v => v >= 0 ? '+' : '';
const gv   = id => { const e = document.getElementById(id); return e ? e.value : ''; };

function saveL() {
  localStorage.setItem('czg_tw',     JSON.stringify(S.twStocks));
  localStorage.setItem('czg_us',     JSON.stringify(S.usStocks));
  localStorage.setItem('czg_fx',     JSON.stringify(S.fx));
  localStorage.setItem('czg_cr',     JSON.stringify(S.crypto));
  localStorage.setItem('czg_intl',   JSON.stringify(S.intl));
  localStorage.setItem('czg_oth',    JSON.stringify(S.other));
  localStorage.setItem('czg_em',     JSON.stringify(S.emergency));
  localStorage.setItem('czg_hist',   JSON.stringify(S.history));
  localStorage.setItem('czg_txhist', JSON.stringify(S.txHistory));
}

// ═══════════════════════════════════════════════════════════
// 啟動邏輯：PIN 碼修復 — 若未啟用 PIN 鎖，直接顯示 App
// ═══════════════════════════════════════════════════════════

(function startupCheck() {
  if (!S.pinEnabled) {
    // PIN 鎖未啟用 → 隱藏 lock screen，直接顯示 App
    const lock = document.getElementById('lock');
    if (lock) lock.style.display = 'none';
    const app = document.getElementById('app');
    if (app) { app.style.display = 'flex'; app.style.flexDirection = 'column'; }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }
  } else {
    // PIN 鎖啟用 → 顯示 lock screen，等待輸入
    const lock = document.getElementById('lock');
    if (lock) lock.style.display = 'flex';
    updDots();
  }
})();

// ═══════════════════════════════════════════════════════════
// PIN 碼邏輯
// ═══════════════════════════════════════════════════════════

function pk(d) {
  const maxLen = S.pin.length || 6;
  if (S.buf.length >= maxLen) return;
  S.buf += String(d);
  updDots();
  if (S.buf.length === maxLen) {
    setTimeout(() => {
      if (S.buf === S.pin) {
        document.getElementById('lock').style.display = 'none';
        const app = document.getElementById('app');
        app.style.display = 'flex';
        app.style.flexDirection = 'column';
        initApp();
      } else {
        document.getElementById('perr').textContent = 'PIN 碼錯誤';
        S.buf = '';
        updDots();
        setTimeout(() => {
          const e = document.getElementById('perr');
          if (e) e.textContent = '';
        }, 1500);
      }
    }, 160);
  }
}

function pdel() { S.buf = S.buf.slice(0, -1); updDots(); }

function updDots() {
  const pinLen = S.pin.length || 6;
  const container = document.getElementById('pin-dots');
  if (!container) return;
  container.innerHTML = '';
  for (let i = 0; i < pinLen; i++) {
    const d = document.createElement('div');
    d.className = 'dot';
    d.style.cssText = `width:12px;height:12px;border-radius:50%;border:2px solid var(--gold);background:${i < S.buf.length ? 'var(--gold)' : 'transparent'};transition:background .15s;flex-shrink:0`;
    container.appendChild(d);
  }
}

function lockApp() {
  if (!S.pinEnabled) return;
  S.buf = '';
  updDots();
  const e = document.getElementById('perr');
  if (e) e.textContent = '';
  document.getElementById('app').style.display = 'none';
  document.getElementById('lock').style.display = 'flex';
  closeSP();
}

function togglePinLock(enabled) {
  S.pinEnabled = enabled;
  localStorage.setItem('czg_pin_enabled', enabled ? '1' : '0');
  const body = document.getElementById('pin-settings-body');
  if (body) body.style.display = enabled ? 'block' : 'none';
  const track = document.getElementById('pin-toggle-track');
  const thumb = document.getElementById('pin-toggle-thumb');
  if (track) track.style.background = enabled ? 'var(--gold)' : 'var(--bd2)';
  if (thumb) thumb.style.left = enabled ? '23px' : '3px';
  const lockBtn = document.querySelector('button[onclick="lockApp()"]');
  if (lockBtn) lockBtn.style.display = enabled ? '' : 'none';
}

function chgPin() {
  const np  = document.getElementById('new-pin').value;
  const np2 = document.getElementById('new-pin2').value;
  if (!/^\d{4,8}$/.test(np)) { document.getElementById('pin-note').textContent = 'PIN 碼必須是 4 到 8 位數字'; return; }
  if (np !== np2)             { document.getElementById('pin-note').textContent = '兩次輸入不一致，請再確認'; return; }
  S.pin = np;
  localStorage.setItem('czg_pin', np);
  document.getElementById('pin-note').textContent = `✓ PIN 碼已更新（${np.length}位）`;
  document.getElementById('new-pin').value  = '';
  document.getElementById('new-pin2').value = '';
}

// ═══════════════════════════════════════════════════════════
// 分頁導航
// ═══════════════════════════════════════════════════════════

function navTo(id, btn) {
  document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
  document.getElementById('pane-overview').style.display = 'none';
  document.querySelector('.banner-hint').textContent = '▲ 點此查看總覽';
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('pane-' + id).classList.add('on');
  btn.classList.add('on');
  if (id !== 'stocks') exitL2();
}

function enterL2(mkt) {
  document.getElementById('stk-l1').style.display = 'none';
  document.getElementById('stk-l2').style.display = 'block';
  ['tw','us','intl'].forEach(m =>
    document.getElementById('detail-' + m).style.display = m === mkt ? 'block' : 'none'
  );
}
function exitL2() {
  document.getElementById('stk-l1').style.display = 'block';
  document.getElementById('stk-l2').style.display = 'none';
}

function openSP()  { document.getElementById('settings-panel').classList.add('open');    document.getElementById('sp-ov').classList.add('open');    }
function closeSP() { document.getElementById('settings-panel').classList.remove('open'); document.getElementById('sp-ov').classList.remove('open'); }

// ═══════════════════════════════════════════════════════════
// 圖表切換
// ═══════════════════════════════════════════════════════════

function switchChart(mode) {
  S.chartMode = mode;
  document.getElementById('ca-pie').style.display   = mode === 'pie'   ? 'block' : 'none';
  document.getElementById('ca-trend').style.display = mode === 'trend' ? 'block' : 'none';
  document.getElementById('ctg-pie').classList.toggle('on',   mode === 'pie');
  document.getElementById('ctg-trend').classList.toggle('on', mode === 'trend');
  if (mode === 'trend') renderTrend();
}

function setRange(yr, btn) {
  S.trendYr = yr;
  document.querySelectorAll('.tr-btn').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderTrend();
}

// ═══════════════════════════════════════════════════════════
// 設定：儲存 / 測試
// ═══════════════════════════════════════════════════════════

function setSC(state, txt) {
  const d = document.getElementById('sdot');
  d.className = 'sdot' + (state==='ok'?' ok': state==='err'?' err': state==='spin'?' spin':'');
  document.getElementById('stxt').textContent = txt;
}

function saveGS() {
  S.gsId  = document.getElementById('gs-id').value.trim();
  S.gsKey = document.getElementById('gs-key').value.trim();
  localStorage.setItem('czg_gsid',  S.gsId);
  localStorage.setItem('czg_gskey', S.gsKey);
  testConn();
}

function saveCfg() {
  S.cfg.sheet            = document.getElementById('cfg-sheet').value.trim()   || '公式';
  S.cfg.cells['0050']    = document.getElementById('cfg-0050').value.trim()    || 'B2';
  S.cfg.cells['2330']    = document.getElementById('cfg-2330').value.trim()    || 'B3';
  S.cfg.cells['NVDA']    = document.getElementById('cfg-nvda').value.trim()    || 'D2';
  S.cfg.cells['MSFT']    = document.getElementById('cfg-msft').value.trim()    || 'D3';
  S.cfg.cells['USDTWD']  = document.getElementById('cfg-usdtwd').value.trim()  || 'F2';
  S.cfg.cfSheet          = document.getElementById('cfg-cf').value.trim()      || '固定支出';
  localStorage.setItem('czg_cfg', JSON.stringify(S.cfg));
  document.getElementById('cfg-note').textContent = '已儲存，請重新同步。';
}

// ═══════════════════════════════════════════════════════════
// 計算函數
// ═══════════════════════════════════════════════════════════

function calcTW()   { return S.twStocks.reduce((s,h) => s + h.shares  * (h.livePrice   ?? h.cost),   0); }
function calcUS()   { return S.usStocks.reduce((s,h) => s + h.shares  * (h.livePriceUsd!=null ? h.livePriceUsd*S.usdTwd : h.costTwd), 0); }
function calcFX()   { return S.fx.reduce       ((s,f) => s + f.amt    * (f.rateLive    || FXR[f.cur] || f.rateBuy), 0); }
function calcCR()   { return S.crypto.reduce   ((s,c) => s + c.amt    * (c.priceTwd   || c.costPer), 0); }
function calcIntl() { return S.intl.reduce     ((s,h) => s + h.shares * (h.priceTwd   || h.costTwd), 0); }
function calcOth()  { return S.other.reduce    ((s,o) => s + o.val, 0); }
function calcEM()   { return S.emergency.balance; }
function twP(h)     { return h.livePrice ?? h.cost; }
function usP(h)     { return h.livePriceUsd != null ? h.livePriceUsd * S.usdTwd : h.costTwd; }

// ═══════════════════════════════════════════════════════════
// 備用金邏輯
// ═══════════════════════════════════════════════════════════

function checkEmergencyAutoTopup() {
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (now.getDate() >= 5 && S.emergency.lastAutoDate && S.emergency.lastAutoDate !== monthKey) {
    S.emergency.balance += 1000;
    S.emergency.lastAutoDate = monthKey;
    S.emergency.log.unshift({ date: monthKey + '-05', type:'auto', note:'每月自動存入', amt:1000 });
    saveL();
  }
}

function emAdjust(type) {
  const inp = document.getElementById('em-input');
  const amt = parseFloat(inp.value) || 0;
  if (amt <= 0) return;
  const now = new Date();
  const dateStr  = now.toISOString().split('T')[0];
  const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  if (type === 'add') {
    S.emergency.balance += amt;
    if (!S.emergency.lastAutoDate) S.emergency.lastAutoDate = monthKey;
    S.emergency.log.unshift({ date:dateStr, type:'add', note:'手動存入', amt });
  } else {
    if (amt > S.emergency.balance) { alert('提取金額不可超過備用金餘額'); return; }
    S.emergency.balance -= amt;
    S.emergency.log.unshift({ date:dateStr, type:'withdraw', note:'提取使用', amt:-amt });
  }
  inp.value = '';
  saveL(); renderEM(); updateTotal();
}

// ═══════════════════════════════════════════════════════════
// 更新頂部 Banner 總覽
// ═══════════════════════════════════════════════════════════

function updateTotal() {
  const tw = calcTW(), us = calcUS(), fx = calcFX(),
        cr = calcCR(), intl = calcIntl(), oth = calcOth(), em = calcEM();
  const total = tw + us + fx + cr + intl + oth + em;
  document.getElementById('b-amt').textContent = 'NT$ ' + fmt(total);

  const twC = S.twStocks.reduce((s,h) => s + h.shares * h.cost,   0);
  const usC = S.usStocks.reduce((s,h) => s + h.shares * h.costTwd, 0);
  const unreal = tw + us - twC - usC;
  const real   = S.twStocks.reduce((s,h) => s + (h.realPnl||0), 0);
  document.getElementById('b-pnl').innerHTML =
    `<span class="${upcl(unreal)}">${sign(unreal)}NT$ ${fmt(unreal)} 未實現</span>` +
    `<span class="${upcl(real)}">${sign(real)}NT$ ${fmt(real)} 已實現</span>`;

  const segs = [
    {l:'台股',v:tw},{l:'美股',v:us},{l:'外幣',v:fx},
    {l:'加密',v:cr},{l:'他國',v:intl},{l:'備用金',v:em},{l:'其他',v:oth}
  ].filter(s => s.v > 0);

  if (total > 0) {
    document.getElementById('sbar').innerHTML =
      segs.map(s => `<div class="seg" style="flex:${s.v/total};background:${SEGC[s.l]}"></div>`).join('');
    document.getElementById('sleg').innerHTML =
      segs.map(s => `<div class="sli"><div class="sld" style="background:${SEGC[s.l]}"></div>${s.l} ${(s.v/total*100).toFixed(0)}%</div>`).join('');
  }
  updPie(segs, total);
  updOvCards(tw, us, fx, cr, intl, oth, em, total);
  updStkSummary(tw, us, intl);
  if (S.chartMode === 'trend') renderTrend();
}

// ═══════════════════════════════════════════════════════════
// 圓餅圖 & 走勢圖
// ═══════════════════════════════════════════════════════════

function updPie(segs, total) {
  const c = document.getElementById('dc');
  if (!c || total === 0) return;
  if (S.dchart) S.dchart.destroy();
  S.dchart = new Chart(c, {
    type: 'doughnut',
    data: {
      labels: segs.map(s => s.l),
      datasets: [{ data: segs.map(s => s.v), backgroundColor: segs.map(s => SEGC[s.l]), borderWidth:3, borderColor:'transparent' }]
    },
    options: {
      responsive:true, maintainAspectRatio:false, cutout:'68%',
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>`NT$ ${fmt(ctx.raw)} (${(ctx.raw/total*100).toFixed(1)}%)`}} }
    }
  });
}

function updOvCards(tw, us, fx, cr, intl, oth, em, total) {
  document.getElementById('ov-cards').innerHTML =
    [{l:'台股',v:tw},{l:'美股',v:us},{l:'外幣',v:fx},{l:'加密',v:cr},{l:'他國',v:intl},{l:'備用金',v:em},{l:'其他',v:oth}]
    .filter(i => i.v > 0)
    .map(i => `<div class="ov-card"><div class="ov-lbl"><div class="ov-d" style="background:${SEGC[i.l]}"></div>${i.l}</div><div class="ov-v">NT$ ${fmt(i.v)}</div><div class="ov-pct">${total>0?(i.v/total*100).toFixed(1):'0'}%</div></div>`)
    .join('');
}

function renderTrend() {
  const c = document.getElementById('tc'); if (!c) return;
  let hist = [...S.history];
  const tw=calcTW(),us=calcUS(),fx=calcFX(),cr=calcCR(),intl=calcIntl(),oth=calcOth(),em=calcEM(),total=tw+us+fx+cr+intl+oth+em;
  if (total > 0) {
    const now = new Date();
    const nl = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    if (!hist.find(h => h.date === nl)) hist = [...hist, {date:nl,total,tw,us,fx,cr,intl,oth,em}];
  }
  if (S.trendYr > 0 && hist.length > 0) {
    const cut = new Date(); cut.setFullYear(cut.getFullYear() - S.trendYr);
    const cs = `${cut.getFullYear()}-${String(cut.getMonth()+1).padStart(2,'0')}`;
    hist = hist.filter(h => h.date >= cs);
  }
  if (S.tchart) { S.tchart.destroy(); S.tchart = null; }
  if (hist.length < 1) return;
  const isDark = matchMedia('(prefers-color-scheme:dark)').matches;
  const gc = isDark ? 'rgba(255,255,255,.07)' : 'rgba(0,0,0,.07)';
  const tc2 = isDark ? '#9E9D97' : '#6B6A65';
  S.tchart = new Chart(c, {
    type: 'line',
    data: { labels: hist.map(h => h.date), datasets: [
      { label:'總資產', data:hist.map(h=>h.total), borderColor:'#C8962A', backgroundColor:'rgba(200,150,42,.1)', fill:true, tension:.35, pointRadius:hist.length<=24?3:1, pointBackgroundColor:'#C8962A', borderWidth:2.5 },
      { label:'台股',   data:hist.map(h=>h.tw),    borderColor:'#1D9E75', fill:false, tension:.35, pointRadius:0, borderWidth:1.5, borderDash:[5,3] },
      { label:'美股',   data:hist.map(h=>h.us),    borderColor:'#185FA5', fill:false, tension:.35, pointRadius:0, borderWidth:1.5, borderDash:[5,3] },
    ]},
    options: {
      responsive:true, maintainAspectRatio:false,
      interaction: { mode:'index', intersect:false },
      scales: {
        x: { grid:{color:gc}, ticks:{color:tc2,maxTicksLimit:8,font:{size:10}}, border:{display:false} },
        y: { grid:{color:gc}, ticks:{color:tc2,font:{size:10},callback:v=>v>=1e6?'$'+(v/1e6).toFixed(1)+'M':'$'+(v/1000).toFixed(0)+'K'}, border:{display:false} }
      },
      plugins: { legend:{display:false}, tooltip:{callbacks:{label:ctx=>`${ctx.dataset.label}: NT$ ${fmt(ctx.raw)}`}} }
    }
  });
}

// ═══════════════════════════════════════════════════════════
// 股票彙總（stk panel L1）
// ═══════════════════════════════════════════════════════════

function updStkSummary(tw, us, intl) {
  const total = tw + us + intl;
  const twC   = S.twStocks.reduce((s,h) => s + h.shares * h.cost,   0);
  const usC   = S.usStocks.reduce((s,h) => s + h.shares * h.costTwd, 0);
  const intlC = S.intl.reduce    ((s,h) => s + h.shares * h.costTwd, 0);
  [{id:'tw',v:tw,c:twC},{id:'us',v:us,c:usC},{id:'intl',v:intl,c:intlC}].forEach(({id,v,c}) => {
    document.getElementById(id+'-sum-v').textContent = 'NT$ ' + fmt(v);
    const pnl = v - c;
    document.getElementById(id+'-sum-p').innerHTML = `<span class="${upcl(pnl)}" style="font-size:10px">${sign(pnl)}${fmt(pnl)}</span>`;
  });
  document.getElementById('stk-tot').textContent = 'NT$ ' + fmt(total);
  const tp = total - (twC+usC+intlC);
  document.getElementById('stk-tot-pnl').innerHTML = `<span class="${upcl(tp)}">${sign(tp)}NT$ ${fmt(tp)}</span>`;
  const sc = document.getElementById('stk-pie'); if (!sc || total === 0) return;
  if (S.stkPie) S.stkPie.destroy();
  S.stkPie = new Chart(sc, {
    type:'doughnut',
    data:{ labels:['台股','美股','他國'], datasets:[{ data:[tw,us,intl], backgroundColor:['#1D9E75','#185FA5','#534AB7'], borderWidth:2, borderColor:'transparent' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%',
      plugins:{ legend:{position:'right',labels:{boxWidth:8,boxHeight:8,font:{size:10},color:'#6B6A65',padding:8}},
        tooltip:{callbacks:{label:ctx=>`NT$ ${fmt(ctx.raw)} (${total>0?(ctx.raw/total*100).toFixed(1):'0'}%)`}} } }
  });
}

// ═══════════════════════════════════════════════════════════
// 渲染各分頁
// ═══════════════════════════════════════════════════════════

function renderTW() {
  const tb = document.getElementById('tw-body'); let tot=0,totC=0,totR=0;
  tb.innerHTML = S.twStocks.map(h => {
    const p=twP(h),v=h.shares*p,c=h.shares*h.cost,pnl=v-c; tot+=v; totC+=c; totR+=(h.realPnl||0);
    const chg=(p-h.cost)/h.cost*100, hasLive=h.livePrice!=null;
    return `<tr>
      <td><div class="sn">${h.name}</div><div class="sc">${h.code}</div></td>
      <td>${h.shares.toLocaleString()}</td>
      <td>${fmtD(h.cost,2)}</td>
      <td class="${upcl(p-h.cost)}">${hasLive?`<span class="live-price"><span class="ldot"></span>${fmtD(p,2)}</span>`:fmtD(p,2)}</td>
      <td class="${upcl(chg)}">${sign(chg)}${Math.abs(chg).toFixed(1)}%</td>
      <td>${fmt(v)}</td>
      <td class="${upcl(pnl)}">${sign(pnl)}${fmt(pnl)}</td>
    </tr>`;
  }).join('');
  document.getElementById('tw-val').textContent = 'NT$ ' + fmt(tot);
  const pnl = tot - totC;
  document.getElementById('tw-pnl').innerHTML = `<span class="${upcl(pnl)}">${sign(pnl)}NT$ ${fmt(pnl)} 未實現</span>`;
  document.getElementById('tw-real').textContent = totR !== 0 ? `已實現 ${sign(totR)}NT$ ${fmt(totR)}` : '';
  renderMiniPie('tw-mini-pie', totC, tot, 'tw-mini-legend');
}

function renderUS() {
  const tb = document.getElementById('us-body'); let tot=0,totC=0;
  tb.innerHTML = S.usStocks.map(h => {
    const p=usP(h),v=h.shares*p,c=h.shares*h.costTwd,pnl=v-c; tot+=v; totC+=c;
    const chg=(p-h.costTwd)/h.costTwd*100, hasLive=h.livePriceUsd!=null;
    return `<tr>
      <td><div class="sn">${h.name}</div><div class="sc">${h.ticker}</div></td>
      <td>${h.shares}</td>
      <td>${fmt(h.costTwd)}</td>
      <td class="${upcl(p-h.costTwd)}">${hasLive?`<span class="live-price"><span class="ldot"></span>${fmt(p)}</span>`:fmt(p)}${hasLive?`<div style="font-size:9px;color:var(--tx3)">US$${fmtD(h.livePriceUsd,2)}</div>`:''}</td>
      <td class="${upcl(chg)}">${sign(chg)}${Math.abs(chg).toFixed(1)}%</td>
      <td>${fmt(v)}</td>
      <td class="${upcl(pnl)}">${sign(pnl)}${fmt(pnl)}</td>
    </tr>`;
  }).join('');
  document.getElementById('us-val').textContent = 'NT$ ' + fmt(tot);
  const pnl = tot - totC;
  document.getElementById('us-pnl').innerHTML = `<span class="${upcl(pnl)}">${sign(pnl)}NT$ ${fmt(pnl)} 未實現</span>`;
  renderMiniPie('us-mini-pie', totC, tot, 'us-mini-legend');
}

function renderFX() {
  const g = document.getElementById('fx-grid');
  if (!S.fx.length) { g.innerHTML = '<div class="empty">尚無外幣紀錄</div>'; document.getElementById('fx-val').textContent = 'NT$ 0'; return; }
  let tot = 0;
  g.innerHTML = S.fx.map(f => {
    const r=f.rateLive||FXR[f.cur]||f.rateBuy, twd=f.amt*r, pnl=twd-f.amt*f.rateBuy; tot+=twd;
    return `<div class="fx-c"><div class="fx-cur">${f.cur}</div><div class="fx-amt">${f.amt.toLocaleString()}</div><div class="fx-twd">≈ NT$ ${fmt(twd)}</div><div class="fx-rate">匯率 ${fmtD(r,4)}</div><div class="fx-pnl ${upcl(pnl)}">${sign(pnl)}NT$ ${fmt(pnl)}</div></div>`;
  }).join('');
  document.getElementById('fx-val').textContent = 'NT$ ' + fmt(tot);
}

function renderCrypto() {
  const tb = document.getElementById('cr-body');
  if (!S.crypto.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">尚無加密貨幣紀錄</td></tr>'; document.getElementById('cr-val').textContent = 'NT$ 0'; return; }
  let tot=0, totC=0;
  tb.innerHTML = S.crypto.map(c => {
    const p=c.priceTwd||c.costPer, v=c.amt*p, cost=c.amt*c.costPer, pnl=v-cost; tot+=v; totC+=cost;
    const pct = cost>0 ? pnl/cost*100 : 0;
    return `<tr><td><div class="sn">${c.coin}</div></td><td>${c.amt}</td><td>${fmt(c.costPer)}</td><td>${fmt(p)}</td><td>NT$ ${fmt(v)}</td><td class="${upcl(pct)}">${sign(pct)}${Math.abs(pct).toFixed(1)}%</td><td class="${upcl(pnl)}">${sign(pnl)}${fmt(pnl)}</td></tr>`;
  }).join('');
  document.getElementById('cr-val').textContent = 'NT$ ' + fmt(tot);
  const pnl = tot - totC;
  document.getElementById('cr-pnl').innerHTML = `<span class="${upcl(pnl)}">${sign(pnl)}NT$ ${fmt(pnl)}</span>`;
}

function renderIntl() {
  const tb = document.getElementById('intl-body');
  if (!S.intl.length) { tb.innerHTML = '<tr><td colspan="7" class="empty">尚無他國股票</td></tr>'; document.getElementById('intl-val').textContent = 'NT$ 0'; return; }
  let tot = 0;
  tb.innerHTML = S.intl.map(h => {
    const p=h.priceTwd||h.costTwd, v=h.shares*p, pnl=v-h.shares*h.costTwd; tot+=v;
    return `<tr><td><div class="sn">${h.name}</div><div class="sc">${h.code}</div></td><td>${h.shares}</td><td style="font-family:'Noto Sans TC';font-size:10px">${h.mkt}</td><td>${fmt(h.costTwd)}</td><td>${fmt(p)}</td><td>NT$ ${fmt(v)}</td><td class="${upcl(pnl)}">${sign(pnl)}${fmt(pnl)}</td></tr>`;
  }).join('');
  document.getElementById('intl-val').textContent = 'NT$ ' + fmt(tot);
}

function renderOther() {
  const el = document.getElementById('oth-list');
  if (!S.other.length) { el.innerHTML = '<div class="empty">可記錄定存、不動產、借出款項等</div>'; document.getElementById('oth-val').textContent = 'NT$ 0'; return; }
  let tot = 0;
  el.innerHTML = S.other.map(o => { tot+=o.val; return `<div class="cf-row"><div><div class="cn">${o.name}</div>${o.note?`<div class="cm">${o.note}</div>`:''}</div><div class="ca">NT$ ${fmt(o.val)}</div></div>`; }).join('');
  document.getElementById('oth-val').textContent = 'NT$ ' + fmt(tot);
}

function renderExp() {
  const el = document.getElementById('exp-list');
  const now = new Date(), thisM = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const monthly = S.expenses.filter(e => e.date && e.date.startsWith(thisM));
  let inc=0, out=0;
  monthly.forEach(e => { if (e.amt>0) inc+=e.amt; else out+=Math.abs(e.amt); });
  document.getElementById('cf-in').textContent  = '+' + fmt(inc);
  document.getElementById('cf-out').textContent = '-' + fmt(out);
  const net = inc - out, ne = document.getElementById('cf-net');
  ne.textContent = (net>=0?'+':'') + fmt(net);
  ne.className = 'cf-val ' + (net>=0?'up':'dn');
  if (!S.expenses.length) { el.innerHTML = '<div class="empty">從試算表同步後顯示</div>'; return; }
  el.innerHTML = [...S.expenses].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,60).map(e =>
    `<div class="cf-row"><div class="cf-l"><div class="cdot" style="background:${CATC[e.cat]||'#6B6A65'}"></div><div><div class="cn">${e.name}</div><div class="cm">${e.cat} · ${e.date}</div></div></div><div class="ca ${e.amt<0?'dn':'up'}">${e.amt<0?'-':'+'} NT$ ${fmt(Math.abs(e.amt))}</div></div>`
  ).join('');
}

function renderEM() {
  const em = S.emergency;
  const el = document.getElementById('em-bal'); if (el) el.textContent = 'NT$ ' + fmt(em.balance);
  const prog = document.getElementById('em-progress');
  if (prog) prog.textContent = em.lastAutoDate ? `已累積約 ${Math.floor(em.balance/1000)} 個月` : '尚未啟動';
  const startBox = document.getElementById('em-start-box');
  if (startBox) startBox.style.display = em.lastAutoDate ? 'none' : 'block';
  const logEl = document.getElementById('em-log'); if (!logEl) return;
  if (!em.log.length) { logEl.innerHTML = '<div class="empty">尚無記錄</div>'; return; }
  logEl.innerHTML = em.log.slice(0,30).map(l =>
    `<div class="cf-row"><div class="cf-l"><div class="cdot" style="background:${l.amt>0?'#C8962A':'#9B2525'}"></div><div><div class="cn">${l.note}</div><div class="cm">${l.date}</div></div></div><div class="ca ${l.amt>0?'up':'dn'}">${l.amt>0?'+':''} NT$ ${fmt(Math.abs(l.amt))}</div></div>`
  ).join('');
}

// ═══════════════════════════════════════════════════════════
// Mini pie（個股損益圖）
// ═══════════════════════════════════════════════════════════

function renderMiniPie(canvasId, cost, gain, legendId) {
  const c = document.getElementById(canvasId); if (!c) return;
  const prev = canvasId === 'tw-mini-pie' ? S.twMiniPie : S.usMiniPie;
  if (prev) prev.destroy();
  const pnl = gain - cost, isProfit = pnl >= 0;
  const newChart = new Chart(c, {
    type:'doughnut',
    data:{ labels:['成本', isProfit?'報酬':'虧損'], datasets:[{ data:[cost,Math.abs(pnl)], backgroundColor:isProfit?['#E6F1FB','#1D9E75']:['#E6F1FB','#9B2525'], borderWidth:2, borderColor:'transparent' }] },
    options:{ responsive:true, maintainAspectRatio:false, cutout:'60%', plugins:{ legend:{display:false}, tooltip:{callbacks:{label:ctx=>'NT$ '+fmt(ctx.raw)}} } }
  });
  if (canvasId === 'tw-mini-pie') S.twMiniPie = newChart; else S.usMiniPie = newChart;
  const leg = document.getElementById(legendId); if (!leg) return;
  const pct = cost > 0 ? (pnl/cost*100) : 0;
  leg.innerHTML = `
    <div class="mini-leg-row"><span style="display:flex;align-items:center"><span class="mini-leg-dot" style="background:#E6F1FB;border:1px solid var(--bd2)"></span>成本</span><span style="font-family:'DM Mono',monospace;font-size:11px">NT$ ${fmt(cost)}</span></div>
    <div class="mini-leg-row"><span style="display:flex;align-items:center"><span class="mini-leg-dot" style="background:${isProfit?'#1D9E75':'#9B2525'}"></span>${isProfit?'報酬':'虧損'}</span><span class="${isProfit?'up':'dn'}" style="font-family:'DM Mono',monospace;font-size:11px">${sign(pnl)}NT$ ${fmt(Math.abs(pnl))}</span></div>
    <div class="mini-leg-row" style="margin-top:3px;border-top:0.5px solid var(--bd);padding-top:3px"><span style="color:var(--tx2)">報酬率</span><span class="${isProfit?'up':'dn'}" style="font-family:'DM Mono',monospace;font-size:11px">${sign(pct)}${Math.abs(pct).toFixed(1)}%</span></div>`;
}

// ═══════════════════════════════════════════════════════════
// 渲染全部 & 整體刷新
// ═══════════════════════════════════════════════════════════

function renderAll() {
  renderTW(); renderUS(); renderFX(); renderCrypto();
  renderIntl(); renderOther(); renderExp(); renderEM();
  updateTotal();
}
function refreshAll() {
  checkEmergencyAutoTopup();
  if (S.gsOk) pullAll(); else renderAll();
}

// ═══════════════════════════════════════════════════════════
// 總覽展開/收起
// ═══════════════════════════════════════════════════════════

function goOverview() {
  const pane = document.getElementById('pane-overview');
  const isVisible = pane.style.display !== 'none';
  if (isVisible) {
    pane.style.display = 'none';
    document.querySelector('.banner-hint').textContent = '▲ 點此查看總覽';
  } else {
    document.querySelectorAll('.pane').forEach(p => p.classList.remove('on'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
    pane.style.display = 'block';
    document.querySelector('.banner-hint').textContent = '▼ 點此收起';
    if (S.chartMode === 'pie') {
      const tw=calcTW(),us=calcUS(),fx=calcFX(),cr=calcCR(),intl=calcIntl(),oth=calcOth(),em=calcEM(),total=tw+us+fx+cr+intl+oth+em;
      updPie([{l:'台股',v:tw},{l:'美股',v:us},{l:'外幣',v:fx},{l:'加密',v:cr},{l:'他國',v:intl},{l:'備用金',v:em},{l:'其他',v:oth}].filter(s=>s.v>0), total);
    } else {
      renderTrend();
    }
  }
}

// ═══════════════════════════════════════════════════════════
// 歷史記錄
// ═══════════════════════════════════════════════════════════

function showHist(type) {
  const el = document.getElementById('hist-' + type); if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  const txMap = {
    tw:   (S.txHistory||[]).filter(t => t.cat==='tw'),
    us:   (S.txHistory||[]).filter(t => t.cat==='us'),
    intl: (S.txHistory||[]).filter(t => t.cat==='intl'),
    fx:   (S.txHistory||[]).filter(t => t.cat==='fx'),
    cr:   (S.txHistory||[]).filter(t => t.cat==='crypto'),
    oth:  (S.txHistory||[]).filter(t => t.cat==='other'),
  };
  const txs = txMap[type] || [];
  if (!txs.length) { el.innerHTML = '<div class="empty" style="padding:12px 0">尚無歷史交易</div>'; el.style.display='block'; return; }
  el.innerHTML = txs.slice().reverse().map(t =>
    `<div class="hist-row"><div><div class="sn" style="font-size:12px">${t.name||t.cur||t.coin||''} ${t.action==='buy'?'買入':'賣出'}</div><div class="hist-date">${t.date}</div></div><div style="text-align:right;font-family:monospace;font-size:12px">${t.shares||t.amt||''} @ NT$${Math.round(t.price||t.rate||0).toLocaleString('zh-TW')}</div></div>`
  ).join('');
  el.style.display = 'block';
}

// ═══════════════════════════════════════════════════════════
// 新增交易 Modal
// ═══════════════════════════════════════════════════════════

const MTITLES = { tw:'台股交易', us:'美股交易', fx:'外幣交易', crypto:'加密貨幣交易', intl:'他國股票交易', other:'新增其他資產' };

function buildTWModal() {
  const today = new Date().toISOString().split('T')[0];
  return `
<div class="fr"><label class="fl">股票代號</label><input class="fi" id="i0" placeholder="例：2330" oninput="onTWCodeInput(this.value)"></div>
<div class="fr"><label class="fl">股票名稱（輸入代號後自動帶入）</label><input class="fi" id="i1" placeholder="自動帶入或手動輸入"></div>
<div class="fr"><label class="fl">交易類型</label><select class="fi" id="i6" onchange="updateTWCalcHint()"><option value="buy">買入</option><option value="sell">賣出</option></select></div>
<div class="fr"><label class="fl">股票類型</label><select class="fi" id="i7" onchange="onTWUnitChange(this.value)"><option value="lot">整股（張）</option><option value="odd">零股（股）</option></select></div>
<div class="fr"><label class="fl" id="lbl-i2">數量（張，1張＝1000股）</label><input class="fi" id="i2" type="number" min="0" step="1" placeholder="0" oninput="updateTWCalcHint()"></div>
<div class="fr"><label class="fl">每股成交價（台幣）</label><input class="fi" id="i3" type="number" min="0" step="0.01" placeholder="0.00" oninput="updateTWCalcHint()"></div>
<div class="fr"><label class="fl">交易日期</label><input class="fi" id="i5" type="date" value="${today}"></div>
<div style="background:var(--surf2);border-radius:var(--r);padding:10px 12px;font-size:11px;color:var(--tx2);margin-top:4px" id="tw-calc-hint"></div>`;
}

function onTWCodeInput(code) {
  const name = lookupTWName(code);
  const el = document.getElementById('i1'); if (el && name) el.value = name;
  updateTWCalcHint();
}
function onTWUnitChange(val) {
  const lbl = document.getElementById('lbl-i2');
  if (lbl) lbl.textContent = val === 'lot' ? '數量（張，1張＝1000股）' : '數量（股）';
  updateTWCalcHint();
}
function updateTWCalcHint() {
  const hint = document.getElementById('tw-calc-hint'); if (!hint) return;
  const unit = gv('i7'), qty = parseFloat(gv('i2'))||0, price = parseFloat(gv('i3'))||0;
  const shares = unit === 'lot' ? qty*1000 : qty;
  const action = gv('i6') === 'sell' ? '賣出' : '買入';
  hint.textContent = (shares>0 && price>0) ? `${action} ${shares.toLocaleString()} 股，總金額 NT$ ${fmt(shares*price)}` : '';
}

function buildUSModal() {
  const today = new Date().toISOString().split('T')[0];
  return `
<div class="fr"><label class="fl">股票代碼</label><input class="fi" id="i0" placeholder="例：AAPL" oninput="onUSCodeInput(this.value)" style="text-transform:uppercase"></div>
<div class="fr"><label class="fl">股票名稱（輸入代碼後自動帶入）</label><input class="fi" id="i1" placeholder="自動帶入或手動輸入"></div>
<div class="fr"><label class="fl">交易類型</label><select class="fi" id="i6"><option value="buy">買入</option><option value="sell">賣出</option></select></div>
<div class="fr"><label class="fl">股數（可小數）</label><input class="fi" id="i2" type="number" step="0.001" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">每股成交價（台幣換算）</label><input class="fi" id="i3" type="number" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">交易日期</label><input class="fi" id="i5" type="date" value="${today}"></div>`;
}

function onUSCodeInput(code) {
  const name = lookupUSName(code);
  const el = document.getElementById('i1'); if (el && name) el.value = name;
}

function buildIntlModal() {
  const today = new Date().toISOString().split('T')[0];
  return `
<div class="fr"><label class="fl">股票代號</label><input class="fi" id="i0" oninput="onIntlCodeInput(this.value)" placeholder="例：352820"></div>
<div class="fr"><label class="fl">股票名稱（輸入代號後自動帶入）</label><input class="fi" id="i1" placeholder="自動帶入或手動輸入"></div>
<div class="fr"><label class="fl">市場</label><select class="fi" id="i4"><option>韓股</option><option>日股</option><option>港股</option><option>A股</option><option>英股</option><option>德股</option><option>其他</option></select></div>
<div class="fr"><label class="fl">交易類型</label><select class="fi" id="i6"><option value="buy">買入</option><option value="sell">賣出</option></select></div>
<div class="fr"><label class="fl">股數</label><input class="fi" id="i2" type="number" min="0" step="0.001" placeholder="0"></div>
<div class="fr"><label class="fl">每股成交價（台幣換算）</label><input class="fi" id="i3" type="number" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">交易日期</label><input class="fi" id="i5" type="date" value="${today}"></div>`;
}

function onIntlCodeInput(code) {
  const name = lookupIntlName(code);
  const el = document.getElementById('i1'); if (el && name) el.value = name;
}

function buildFXModal() {
  const today = new Date().toISOString().split('T')[0];
  return `
<div class="fr"><label class="fl">幣種</label><select class="fi" id="i0"><option>USD</option><option>JPY</option><option>EUR</option><option>GBP</option><option>CNY</option><option>KRW</option><option>HKD</option><option>SGD</option><option>AUD</option><option>CAD</option><option>THB</option><option>VND</option></select></div>
<div class="fr"><label class="fl">交易類型</label><select class="fi" id="i6"><option value="buy">買入（換匯）</option><option value="sell">賣出（換回台幣）</option></select></div>
<div class="fr"><label class="fl">數量</label><input class="fi" id="i1" type="number" step="0.01" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">匯率（兌台幣）</label><input class="fi" id="i2" type="number" step="0.0001" min="0" placeholder="0.00"></div>
<div class="fr"><label class="fl">交易日期</label><input class="fi" id="i5" type="date" value="${today}"></div>`;
}

function buildCryptoModal() {
  const today = new Date().toISOString().split('T')[0];
  return `
<div class="fr"><label class="fl">幣種代號</label><input class="fi" id="i0" placeholder="BTC、ETH、SOL"></div>
<div class="fr"><label class="fl">交易類型</label><select class="fi" id="i6"><option value="buy">買入</option><option value="sell">賣出</option></select></div>
<div class="fr"><label class="fl">數量</label><input class="fi" id="i1" type="number" step="0.00001" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">成交總金額（台幣）</label><input class="fi" id="i2" type="number" min="0" placeholder="0"></div>
<div class="fr"><label class="fl">交易日期</label><input class="fi" id="i5" type="date" value="${today}"></div>`;
}

function showM(t) {
  S.curM = t;
  document.getElementById('mt').textContent = MTITLES[t] || '新增';
  let body = '';
  if      (t==='tw')     body = buildTWModal();
  else if (t==='us')     body = buildUSModal();
  else if (t==='intl')   body = buildIntlModal();
  else if (t==='fx')     body = buildFXModal();
  else if (t==='crypto') body = buildCryptoModal();
  else if (t==='other')  body = `<div class="fr"><label class="fl">資產名稱</label><input class="fi" id="i0"></div><div class="fr"><label class="fl">估計價值（台幣）</label><input class="fi" id="i1" type="number"></div><div class="fr"><label class="fl">備註</label><input class="fi" id="i2"></div>`;
  document.getElementById('mb').innerHTML = body;
  document.getElementById('ov').classList.add('on');
}
function closeM() { document.getElementById('ov').classList.remove('on'); }

// ═══════════════════════════════════════════════════════════
// 儲存交易
// ═══════════════════════════════════════════════════════════

function saveM() {
  const t = S.curM;
  const date   = gv('i5') || new Date().toISOString().split('T')[0];
  const action = gv('i6') || 'buy';
  if (!S.txHistory) S.txHistory = [];

  if (t === 'tw') {
    const code  = gv('i0').trim(), name = gv('i1').trim() || lookupTWName(code) || code;
    const unit  = gv('i7') || 'lot';
    const qty   = parseFloat(gv('i2')) || 0;
    const shares= unit === 'lot' ? qty * 1000 : qty;
    const price = parseFloat(gv('i3')) || 0;
    if (!code || shares<=0 || price<=0) { alert('請填寫代號、數量和成交價'); return; }
    const exist = S.twStocks.find(x => x.code === code);
    if (action === 'buy') {
      if (exist) {
        const ot = exist.shares * exist.cost;
        exist.shares = Math.round((exist.shares + shares) * 10000) / 10000;
        exist.cost   = Math.round((ot + shares*price) / exist.shares * 10000) / 10000;
      } else {
        S.twStocks.push({ code, name, shares, cost:price, livePrice:null, realPnl:0 });
      }
    } else {
      if (exist) {
        exist.realPnl = (exist.realPnl||0) + shares*(price-exist.cost);
        exist.shares  = Math.round((exist.shares - shares) * 10000) / 10000;
        if (exist.shares <= 0) S.twStocks = S.twStocks.filter(x => x.code !== code);
      }
    }
    S.txHistory.push({ cat:'tw', code, name, shares, unit, price, action, date });
  }

  else if (t === 'us') {
    const ticker = gv('i0').trim().toUpperCase(), name = gv('i1').trim() || ticker;
    const shares = parseFloat(gv('i2')) || 0, price = parseFloat(gv('i3')) || 0;
    if (!ticker || shares<=0 || price<=0) { alert('請填寫代碼、股數和成交價'); return; }
    const exist = S.usStocks.find(x => x.ticker === ticker);
    if (action === 'buy') {
      if (exist) {
        const ot = exist.shares * exist.costTwd;
        exist.shares   = Math.round((exist.shares + shares) * 10000) / 10000;
        exist.costTwd  = Math.round((ot + shares*price) / exist.shares * 100) / 100;
      } else {
        S.usStocks.push({ ticker, name, shares, costTwd:price, livePriceUsd:null });
      }
    } else {
      if (exist) {
        exist.shares = Math.round((exist.shares - shares) * 10000) / 10000;
        if (exist.shares <= 0) S.usStocks = S.usStocks.filter(x => x.ticker !== ticker);
      }
    }
    S.txHistory.push({ cat:'us', ticker, name, shares, price, action, date });
  }

  else if (t === 'intl') {
    const code = gv('i0').trim(), name = gv('i1').trim() || code, mkt = gv('i4');
    const shares = parseFloat(gv('i2'))||0, price = parseFloat(gv('i3'))||0;
    if (!code || shares<=0 || price<=0) { alert('請填寫代號、股數和成交價'); return; }
    const exist = S.intl.find(x => x.code === code);
    if (action === 'buy') {
      if (exist) {
        const ot = exist.shares * exist.costTwd;
        exist.shares  = Math.round((exist.shares+shares)*10000)/10000;
        exist.costTwd = (ot + shares*price) / exist.shares;
      } else {
        S.intl.push({ code, name, mkt, shares, costTwd:price, priceTwd:null });
      }
    } else {
      if (exist) {
        exist.shares = Math.round((exist.shares-shares)*10000)/10000;
        if (exist.shares <= 0) S.intl = S.intl.filter(x => x.code !== code);
      }
    }
    S.txHistory.push({ cat:'intl', code, name, mkt, shares, price, action, date });
  }

  else if (t === 'fx') {
    const cur = gv('i0'), amt = parseFloat(gv('i1'))||0, rate = parseFloat(gv('i2'))||0;
    if (!cur || amt<=0 || rate<=0) { alert('請填寫數量和匯率'); return; }
    const exist = S.fx.find(x => x.cur === cur);
    if (action === 'buy') {
      if (exist) exist.amt = Math.round((exist.amt+amt)*10000)/10000;
      else S.fx.push({ cur, amt, rateBuy:rate, rateLive:null });
    } else {
      if (exist) {
        exist.amt = Math.round((exist.amt-amt)*10000)/10000;
        if (exist.amt <= 0) S.fx = S.fx.filter(x => x.cur !== cur);
      }
    }
    S.txHistory.push({ cat:'fx', cur, amt, rate, action, date });
  }

  else if (t === 'crypto') {
    const coin = gv('i0').trim().toUpperCase(), amt = parseFloat(gv('i1'))||0;
    const total = parseFloat(gv('i2'))||0, costPer = amt>0 ? total/amt : 0;
    if (!coin || amt<=0 || total<=0) { alert('請填寫幣種、數量和金額'); return; }
    const exist = S.crypto.find(x => x.coin === coin);
    if (action === 'buy') {
      if (exist) {
        const ot = exist.amt * exist.costPer;
        exist.amt     = Math.round((exist.amt+amt)*1e8)/1e8;
        exist.costPer = (ot + total) / exist.amt;
      } else {
        S.crypto.push({ coin, amt, costPer, priceTwd:null });
      }
    } else {
      if (exist) {
        exist.amt = Math.round((exist.amt-amt)*1e8)/1e8;
        if (exist.amt <= 0) S.crypto = S.crypto.filter(x => x.coin !== coin);
      }
    }
    S.txHistory.push({ cat:'crypto', coin, amt, costPer, action, date });
  }

  else if (t === 'other') {
    S.other.push({ name:gv('i0'), val:parseFloat(gv('i1'))||0, note:gv('i2') });
  }

  saveL(); closeM(); renderAll();
}

// ═══════════════════════════════════════════════════════════
// 重置為正確資產
// ═══════════════════════════════════════════════════════════

function resetToCorrectData() {
  if (!confirm('確定要將股票和外幣重置為正確的初始數據嗎？此操作無法復原。')) return;
  S.twStocks = [
    { code:'0050', name:'元大0050', shares:734,  cost:33.18,  livePrice:null, realPnl:0 },
    { code:'2330', name:'台積電',   shares:110,  cost:531.63, livePrice:null, realPnl:0 },
  ];
  S.usStocks = [
    { ticker:'NVDA', name:'輝達', shares:5,   costTwd:3820,   livePriceUsd:null },
    { ticker:'MSFT', name:'微軟', shares:0.5, costTwd:6528.5, livePriceUsd:null },
  ];
  S.fx = [
    { cur:'KRW', amt:59950, rateBuy:FXR['KRW']||0.024, rateLive:null },
    { cur:'JPY', amt:1273,  rateBuy:FXR['JPY']||0.218,  rateLive:null },
    { cur:'CNY', amt:2,     rateBuy:FXR['CNY']||4.48,   rateLive:null },
    { cur:'THB', amt:19,    rateBuy:FXR['THB']||0.94,   rateLive:null },
  ];
  S.txHistory = [];
  saveL(); renderAll();
  const n = document.getElementById('reset-note');
  if (n) { n.textContent = '✓ 已重置為正確資產數據'; setTimeout(() => { n.textContent=''; }, 3000); }
}

// ═══════════════════════════════════════════════════════════
// initApp
// ═══════════════════════════════════════════════════════════

function initApp() {
  // 一次性版本遷移
  if (!localStorage.getItem('czg_cleaned_v2')) {
    S.pin = '355218';
    localStorage.setItem('czg_pin', '355218');
    localStorage.setItem('czg_cleaned_v2', '1');
  }
  if (!localStorage.getItem('czg_cleaned_v1')) {
    S.intl = S.intl.filter(x => x.code !== 'YG');
    localStorage.setItem('czg_intl', JSON.stringify(S.intl));
    if (localStorage.getItem('czg_pin') === '1234') {
      S.pin = '355218';
      localStorage.setItem('czg_pin', '355218');
    }
    const msft = S.usStocks.find(x => x.ticker === 'MSFT');
    if (msft && msft.costTwd === 13057) { msft.costTwd = 6528.5; saveL(); }
    localStorage.setItem('czg_cleaned_v1', '1');
  }

  // 填入設定面板
  document.getElementById('gs-id').value       = S.gsId;
  document.getElementById('gs-key').value      = S.gsKey;
  document.getElementById('cfg-sheet').value   = S.cfg.sheet;
  document.getElementById('cfg-0050').value    = S.cfg.cells['0050'];
  document.getElementById('cfg-2330').value    = S.cfg.cells['2330'];
  document.getElementById('cfg-nvda').value    = S.cfg.cells['NVDA'];
  document.getElementById('cfg-msft').value    = S.cfg.cells['MSFT'];
  document.getElementById('cfg-usdtwd').value  = S.cfg.cells['USDTWD'] || 'F2';
  document.getElementById('cfg-cf').value      = S.cfg.cfSheet;

  // PIN 設定 UI 同步
  const pinCb = document.getElementById('pin-enabled');
  if (pinCb) { pinCb.checked = S.pinEnabled; togglePinLock(S.pinEnabled); }

  // 隱藏鎖定按鈕（若 PIN 未啟用）
  const lockBtn = document.querySelector('button[onclick="lockApp()"]');
  if (lockBtn) lockBtn.style.display = S.pinEnabled ? '' : 'none';

  // 初始顯示現金流分頁
  document.querySelectorAll('.pane').forEach(p => { p.classList.remove('on'); p.style.display=''; });
  document.getElementById('pane-overview').style.display = 'none';
  document.getElementById('pane-cashflow').classList.add('on');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('on'));
  document.getElementById('nav-cashflow').classList.add('on');

  checkEmergencyAutoTopup();
  renderAll();
  if (S.gsKey) testConn();
}
