/**
 * api-sync.js — 戶部尚書 API 同步層
 *
 * 負責所有與 Google Sheets / Google Apps Script 的連動：
 *  1. testConn()          — 測試連線
 *  2. pullAll()           — 拉取所有即時數據（股價 / 匯率 / 現金流 / 快照）
 *  3. pushSnap()          — 推送每月快照
 *  4. parseCF()           — 解析現金流分頁
 *  5. syncCorrection()    — 讀取 gid=2078256663 校正股數（任務二.3）
 *  6. backupAssetsToSheet()   — 備份資產到「戶部尚書資料庫」分頁
 *  7. restoreAssetsFromSheet()— 從「戶部尚書資料庫」還原
 *  8. doSync()            — Banner 同步按鈕
 *  9. readPiggyBank()     — 預留介面：讀取「存錢罐」gid=1158266342（任務二.6）
 */

// ═══════════════════════════════════════════════════════════
// 匯率欄位對照（公式分頁）
// gid=102108546 的即時匯率儲存格（任務二.5）
// ═══════════════════════════════════════════════════════════

const FX_CELLS = {
  USD: 'F2',   // USD/TWD
  JPY: 'F3',   // JPY/TWD
  KRW: 'F4',   // KRW/TWD
  CNY: 'F5',   // CNY/TWD
  HKD: 'F6',   // HKD/TWD
  EUR: 'F7',   // EUR/TWD
  THB: 'F8',   // THB/TWD
  VND: 'F9',   // VND/TWD
};

// ═══════════════════════════════════════════════════════════
// 低層：fetch 單一儲存格 / 範圍
// ═══════════════════════════════════════════════════════════

/**
 * 讀取試算表單一儲存格，回傳 Number 或 null
 * @param {string} sheet  分頁名稱
 * @param {string} cell   例如 'B2'
 */
async function fc(sheet, cell) {
  const enc = encodeURIComponent(sheet + '!' + cell);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${enc}?key=${S.gsKey}`;
  const r = await fetch(url);
  const d = await r.json();
  const raw = d.values?.[0]?.[0];
  return raw != null ? parseFloat(String(raw).replace(/,/g, '')) : null;
}

/**
 * 讀取試算表範圍，回傳 rows 二維陣列
 * @param {string} sheet  分頁名稱
 * @param {string} range  例如 'A2:I500'
 */
async function fr2(sheet, range) {
  const enc = encodeURIComponent(sheet + '!' + range);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${enc}?key=${S.gsKey}`;
  const r = await fetch(url);
  const d = await r.json();
  return d.values || [];
}

/**
 * 讀取試算表範圍（依 gid），回傳 rows 二維陣列
 * 用於直接以分頁 ID 存取（不需知道名稱）
 */
async function fr2ByGid(gid, range) {
  // 先取得分頁名稱列表，找出對應 gid 的 title
  const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}?key=${S.gsKey}&fields=sheets.properties`;
  const mr = await fetch(metaUrl);
  const md = await mr.json();
  const sheet = md.sheets?.find(s => String(s.properties.sheetId) === String(gid));
  if (!sheet) throw new Error(`找不到 gid=${gid} 的分頁`);
  return fr2(sheet.properties.title, range);
}

// ═══════════════════════════════════════════════════════════
// 1. 測試連線
// ═══════════════════════════════════════════════════════════

async function testConn() {
  if (!S.gsKey) {
    document.getElementById('gs-note').textContent = '請先輸入 API 金鑰';
    return;
  }
  setSC('spin', '連接中...');
  try {
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}?key=${S.gsKey}&fields=sheets.properties.title`;
    const r = await fetch(url);
    const d = await r.json();
    if (d.sheets) {
      S.gsOk = true;
      setSC('ok', '已連接');
      document.getElementById('gs-note').textContent =
        '連接成功！分頁：' + d.sheets.map(s => s.properties.title).join('、');
      await pullAll();
    } else {
      S.gsOk = false;
      setSC('err', '失敗');
      document.getElementById('gs-note').textContent =
        '失敗：' + (d.error?.message || '請確認金鑰與試算表分享設定');
    }
  } catch (e) {
    S.gsOk = false;
    setSC('err', '錯誤');
    document.getElementById('gs-note').textContent = '錯誤：' + e.message;
  }
}

// ═══════════════════════════════════════════════════════════
// 2. pullAll — 拉取所有即時數據
// ═══════════════════════════════════════════════════════════

async function pullAll() {
  if (!S.gsOk || !S.gsKey) return;
  setSC('spin', '同步中...');
  try {
    const c  = S.cfg.cells;
    const sh = S.cfg.sheet;
    const fxCurs = Object.keys(FX_CELLS);

    // 並行拉取：股價 + 所有匯率
    const [p0050, p2330, pNVDA, pMSFT, ...fxVals] = await Promise.all([
      fc(sh, c['0050']),
      fc(sh, c['2330']),
      fc(sh, c['NVDA']),
      fc(sh, c['MSFT']),
      ...fxCurs.map(cur => fc(sh, FX_CELLS[cur])),
    ]);

    // ── 台股即時價 ──
    if (p0050 != null) { const s = S.twStocks.find(x => x.code === '0050'); if (s) s.livePrice = p0050; }
    if (p2330 != null) { const s = S.twStocks.find(x => x.code === '2330'); if (s) s.livePrice = p2330; }

    // ── 匯率（任務二.5：同步 gid=102108546 的匯率）──
    fxCurs.forEach((cur, i) => {
      if (fxVals[i] != null) {
        FXR[cur] = fxVals[i];
        if (cur === 'USD') S.usdTwd = fxVals[i];
        // 更新外幣持倉的即時匯率
        S.fx.forEach(f => { if (f.cur === cur) f.rateLive = fxVals[i]; });
      }
    });

    // ── 美股即時價（美元） ──
    if (pNVDA != null) { const s = S.usStocks.find(x => x.ticker === 'NVDA'); if (s) s.livePriceUsd = pNVDA; }
    if (pMSFT != null) { const s = S.usStocks.find(x => x.ticker === 'MSFT'); if (s) s.livePriceUsd = pMSFT; }

    // ── 歷史快照（資產走勢圖） ──
    try {
      const rows = await fr2('資產紀錄「存錢冠」', 'A2:I500');
      const hist = rows
        .map(r => ({
          date:  (r[0]||'').trim(),
          total: parseFloat(r[1])||0,
          tw:    parseFloat(r[2])||0,
          us:    parseFloat(r[3])||0,
          fx:    parseFloat(r[4])||0,
          cr:    parseFloat(r[5])||0,
          intl:  parseFloat(r[6])||0,
          oth:   parseFloat(r[7])||0,
          em:    parseFloat(r[8])||0,
        }))
        .filter(h => h.date && h.total > 0);
      if (hist.length > 0) S.history = hist;
    } catch (_) { /* 快照分頁不存在時靜默 */ }

    // ── 現金流 ──
    try {
      const cfRows = await fr2(S.cfg.cfSheet, 'A1:E300');
      parseCF(cfRows);
    } catch (_) { /* 現金流分頁不存在時靜默 */ }

    // ── 每月備用金自動補充 ──
    checkEmergencyAutoTopup();

    setSC('ok', '已同步');
    const upd = document.getElementById('upd');
    if (upd) upd.textContent = '最後同步 ' + new Date().toLocaleTimeString('zh-TW', { hour:'2-digit', minute:'2-digit' });
    saveL();
    renderAll();
  } catch (e) {
    setSC('err', '同步失敗');
    const upd = document.getElementById('upd');
    if (upd) upd.textContent = '失敗 ' + new Date().toLocaleTimeString('zh-TW', { hour:'2-digit', minute:'2-digit' });
    console.error('[pullAll]', e);
    renderAll();
  }
}

// ═══════════════════════════════════════════════════════════
// 3. pushSnap — 推送每月快照
// ═══════════════════════════════════════════════════════════

async function pushSnap() {
  if (!S.gsOk || !S.gsKey) {
    document.getElementById('snap-note').textContent = '請先連接試算表';
    return;
  }
  const tw=calcTW(), us=calcUS(), fx=calcFX(), cr=calcCR(),
        intl=calcIntl(), oth=calcOth(), em=calcEM(),
        total = tw+us+fx+cr+intl+oth+em;
  const now   = new Date();
  const label = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
  const snap  = { date:label, total, tw, us, fx, cr, intl, oth, em };

  // 更新本地快照
  const ei = S.history.findIndex(h => h.date === label);
  if (ei >= 0) S.history[ei] = snap; else S.history.push(snap);
  S.history.sort((a,b) => a.date.localeCompare(b.date));
  saveL();

  try {
    const sn   = encodeURIComponent('資產紀錄「存錢冠」');
    const url  = `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${sn}!A:I:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS&key=${S.gsKey}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [[label, total, tw, us, fx, cr, intl, oth, em]] }),
    });
    const d = await resp.json();
    if (d.updates) {
      document.getElementById('snap-note').textContent = `✓ ${label} 快照已寫入（含備用金）`;
      if (S.chartMode === 'trend') renderTrend();
    } else {
      document.getElementById('snap-note').textContent = '寫入失敗：' + (d.error?.message || JSON.stringify(d));
    }
  } catch (e) {
    document.getElementById('snap-note').textContent = '錯誤：' + e.message;
  }
}

// ═══════════════════════════════════════════════════════════
// 4. parseCF — 解析現金流
// ═══════════════════════════════════════════════════════════

function parseCF(rows) {
  S.expenses = [];
  rows.slice(1).forEach(row => {
    const name = (row[0]||'').trim();
    const amt  = parseFloat((row[1]||row[2]||'0').replace(/[^0-9.\-]/g, ''));
    const cat  = (row[3]||'其他').trim();
    const date = (row[4]||'').trim();
    if (name && !isNaN(amt) && Math.abs(amt) > 0)
      S.expenses.push({ name, amt: -Math.abs(amt), cat, date });
  });
}

// ═══════════════════════════════════════════════════════════
// 5. syncCorrection — 從試算表校正資產（任務二.3）
//    讀取 gid=2078256663 的「資產校正」分頁，自動更新股數與成本
//
//    試算表格式（建議）：
//    A欄: 市場  (tw / us / intl / fx / crypto)
//    B欄: 代號  (股票代號 / 幣種)
//    C欄: 名稱
//    D欄: 股數 / 數量
//    E欄: 成本（每股台幣 / 匯率 / 每單位成本）
// ═══════════════════════════════════════════════════════════

async function syncCorrection() {
  if (!S.gsOk || !S.gsKey) {
    document.getElementById('sync-correction-note').textContent = '請先連接試算表';
    return;
  }
  document.getElementById('sync-correction-note').textContent = '校正中...';
  try {
    const GID_CORRECTION = '2078256663';
    const rows = await fr2ByGid(GID_CORRECTION, 'A2:F200');
    if (!rows.length) {
      document.getElementById('sync-correction-note').textContent = '校正分頁無資料（A2:F200）';
      return;
    }

    let updated = 0;
    rows.forEach(row => {
      const mkt    = (row[0]||'').trim().toLowerCase();  // tw / us / fx / intl / crypto
      const code   = (row[1]||'').trim();                 // 代號
      const name   = (row[2]||'').trim();                 // 名稱
      const qty    = parseFloat(row[3]);                  // 股數 / 數量
      const cost   = parseFloat(row[4]);                  // 成本
      if (!code || isNaN(qty)) return;

      if (mkt === 'tw') {
        const exist = S.twStocks.find(x => x.code === code);
        if (exist) {
          exist.shares = qty;
          if (!isNaN(cost)) exist.cost = cost;
          if (name) exist.name = name;
          updated++;
        } else if (name && !isNaN(cost)) {
          S.twStocks.push({ code, name, shares:qty, cost, livePrice:null, realPnl:0 });
          updated++;
        }
      }

      else if (mkt === 'us') {
        const ticker = code.toUpperCase();
        const exist  = S.usStocks.find(x => x.ticker === ticker);
        if (exist) {
          exist.shares = qty;
          if (!isNaN(cost)) exist.costTwd = cost;
          if (name) exist.name = name;
          updated++;
        } else if (name && !isNaN(cost)) {
          S.usStocks.push({ ticker, name, shares:qty, costTwd:cost, livePriceUsd:null });
          updated++;
        }
      }

      else if (mkt === 'fx') {
        const cur   = code.toUpperCase();
        const exist = S.fx.find(x => x.cur === cur);
        if (exist) {
          exist.amt = qty;
          if (!isNaN(cost)) exist.rateBuy = cost;
          updated++;
        } else if (!isNaN(cost)) {
          S.fx.push({ cur, amt:qty, rateBuy:cost, rateLive:null });
          updated++;
        }
      }

      else if (mkt === 'intl') {
        const exist = S.intl.find(x => x.code === code);
        const mktLabel = (row[5]||'其他').trim();
        if (exist) {
          exist.shares = qty;
          if (!isNaN(cost)) exist.costTwd = cost;
          if (name) exist.name = name;
          updated++;
        } else if (name && !isNaN(cost)) {
          S.intl.push({ code, name, mkt:mktLabel, shares:qty, costTwd:cost, priceTwd:null });
          updated++;
        }
      }

      else if (mkt === 'crypto') {
        const coin  = code.toUpperCase();
        const exist = S.crypto.find(x => x.coin === coin);
        if (exist) {
          exist.amt = qty;
          if (!isNaN(cost)) exist.costPer = cost;
          updated++;
        } else if (!isNaN(cost)) {
          S.crypto.push({ coin, amt:qty, costPer:cost, priceTwd:null });
          updated++;
        }
      }
    });

    saveL();
    renderAll();
    document.getElementById('sync-correction-note').textContent =
      `✓ 校正完成，共更新 ${updated} 筆資產`;
  } catch (e) {
    console.error('[syncCorrection]', e);
    document.getElementById('sync-correction-note').textContent = '校正失敗：' + e.message;
  }
}

// ═══════════════════════════════════════════════════════════
// 6. 備份 / 還原
// ═══════════════════════════════════════════════════════════

async function backupAssetsToSheet() {
  if (!S.gsOk || !S.gsKey) {
    document.getElementById('backup-note').textContent = '請先連接試算表';
    return;
  }
  document.getElementById('backup-note').textContent = '備份中...';
  try {
    const sheetName = '戶部尚書資料庫';
    const sn  = encodeURIComponent(sheetName);
    const ts  = new Date().toLocaleString('zh-TW');
    const rows = [
      ['備份時間',  ts],
      ['台股',      JSON.stringify(S.twStocks)],
      ['美股',      JSON.stringify(S.usStocks)],
      ['外幣',      JSON.stringify(S.fx)],
      ['加密貨幣',  JSON.stringify(S.crypto)],
      ['他國股票',  JSON.stringify(S.intl)],
      ['其他資產',  JSON.stringify(S.other)],
      ['備用金',    JSON.stringify(S.emergency)],
      ['交易歷史',  JSON.stringify(S.txHistory||[])],
      ['PIN碼',     S.pin],
      ['PIN啟用',   S.pinEnabled ? '1' : '0'],
    ];

    // 清除舊資料後寫入
    await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${sn}!A1:B20:clear?key=${S.gsKey}`,
      { method:'POST', headers:{'Content-Type':'application/json'}, body:'{}' }
    );
    const resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${sn}!A1?valueInputOption=RAW&key=${S.gsKey}`,
      { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ values: rows }) }
    );
    const d = await resp.json();
    if (d.updatedCells || d.updatedRows) {
      document.getElementById('backup-note').textContent = `✓ 備份成功！已寫入「${sheetName}」分頁，時間：${ts}`;
    } else {
      document.getElementById('backup-note').textContent = '寫入失敗：' + (d.error?.message || JSON.stringify(d));
    }
  } catch (e) {
    document.getElementById('backup-note').textContent = '錯誤：' + e.message;
  }
}

async function restoreAssetsFromSheet() {
  if (!S.gsOk || !S.gsKey) {
    document.getElementById('backup-note').textContent = '請先連接試算表';
    return;
  }
  if (!confirm('確定要從「戶部尚書資料庫」分頁還原資產數據嗎？這將覆蓋 App 目前的所有資產數據。')) return;
  document.getElementById('backup-note').textContent = '還原中...';
  try {
    const sn   = encodeURIComponent('戶部尚書資料庫');
    const r    = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${S.gsId}/values/${sn}!A1:B20?key=${S.gsKey}`);
    const d    = await r.json();
    if (!d.values || d.values.length < 2) {
      document.getElementById('backup-note').textContent = '找不到備份數據，請先備份一次。';
      return;
    }
    const map = {};
    d.values.forEach(row => { if (row[0] && row[1]) map[row[0]] = row[1]; });

    const tryParse = (key, fallback) => {
      try { return map[key] ? JSON.parse(map[key]) : fallback; }
      catch (_) { return fallback; }
    };

    if (map['台股'])     S.twStocks  = tryParse('台股',    S.twStocks);
    if (map['美股'])     S.usStocks  = tryParse('美股',    S.usStocks);
    if (map['外幣'])     S.fx        = tryParse('外幣',    S.fx);
    if (map['加密貨幣']) S.crypto    = tryParse('加密貨幣',S.crypto);
    if (map['他國股票']) S.intl      = tryParse('他國股票',S.intl);
    if (map['其他資產']) S.other     = tryParse('其他資產',S.other);
    if (map['備用金'])   S.emergency = tryParse('備用金',  S.emergency);
    if (map['交易歷史']) S.txHistory = tryParse('交易歷史',[]);
    if (map['PIN碼'])    { S.pin = map['PIN碼']; localStorage.setItem('czg_pin', S.pin); }
    if (map['PIN啟用'])  { S.pinEnabled = map['PIN啟用'] === '1'; localStorage.setItem('czg_pin_enabled', S.pinEnabled?'1':'0'); }

    saveL();
    renderAll();
    document.getElementById('backup-note').textContent = '✓ 還原成功！備份時間：' + (map['備份時間'] || '未知');
  } catch (e) {
    document.getElementById('backup-note').textContent = '錯誤：' + e.message;
  }
}

// ═══════════════════════════════════════════════════════════
// 7. doSync — Banner 同步按鈕
// ═══════════════════════════════════════════════════════════

function doSync() {
  if (S.gsOk) pullAll(); else openSP();
}

// ═══════════════════════════════════════════════════════════
// 8. readPiggyBank — 預留介面（任務二.6）
//    讀取「存錢罐」分頁 gid=1158266342
//    目的：方便日後 Debug GAS 現金流同步
//
//    試算表格式（預期）：
//    A欄: 日期, B欄: 類別, C欄: 金額, D欄: 備註
//
//    使用方式：
//      const rows = await readPiggyBank();
//      console.log(rows);   // 檢視原始資料
// ═══════════════════════════════════════════════════════════

async function readPiggyBank(range = 'A1:D500') {
  if (!S.gsOk || !S.gsKey) {
    console.warn('[readPiggyBank] 尚未連接試算表');
    return null;
  }
  try {
    const GID_PIGGY = '1158266342';
    const rows = await fr2ByGid(GID_PIGGY, range);
    console.log(`[readPiggyBank] 讀取 ${rows.length} 列（gid=${GID_PIGGY}）`, rows);
    return rows;
  } catch (e) {
    console.error('[readPiggyBank] 失敗：', e.message);
    return null;
  }
}

/**
 * 將「存錢罐」分頁資料解析為現金流記錄並合併至 S.expenses
 * （預留，目前不主動呼叫，供日後 GAS Debug 使用）
 */
async function syncPiggyBankToExpenses() {
  const rows = await readPiggyBank();
  if (!rows || rows.length < 2) return;
  const newExp = [];
  rows.slice(1).forEach(row => {
    const date = (row[0]||'').trim();
    const cat  = (row[1]||'其他').trim();
    const amt  = parseFloat((row[2]||'0').replace(/[^0-9.\-]/g,''));
    const name = (row[3]||'存錢罐').trim();
    if (date && !isNaN(amt) && Math.abs(amt) > 0)
      newExp.push({ name, amt, cat, date });
  });
  // 合併（以分頁資料為主，去除重複日期+名稱的舊紀錄）
  const keys = new Set(newExp.map(e => e.date+'|'+e.name));
  S.expenses = [
    ...S.expenses.filter(e => !keys.has(e.date+'|'+e.name)),
    ...newExp,
  ].sort((a,b) => b.date.localeCompare(a.date));
  renderExp();
  console.log(`[syncPiggyBankToExpenses] 合併 ${newExp.length} 筆存錢罐記錄`);
}
