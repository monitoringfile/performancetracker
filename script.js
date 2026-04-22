import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, remove, push, set, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

const firebaseConfig = { 
    apiKey: "AIzaSyCmfUxwaeAyoTTlLvU6qHwT22MGtcLa2aU", 
    databaseURL: "https://mis-tracker-83357-default-rtdb.asia-southeast1.firebasedatabase.app", 
    projectId: "mis-tracker-83357" 
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);
const dbRef = ref(db, 'client_records');
const capRef = ref(db, 'captured_folders');

let rawData = null; 
let capturedData = {};
const branches = ["Balingasag - Main2", "Balingoan - Main2", "Camiguin - Main2", "Claveria - Main2", "Gingoog - Main2", "Salay - Main"];
const products = ["Mauswagon Reloan", "Supplemental Reloan", "New Supplemental", "Newloan", "Balik RMF", "Saver's"];

// Populate Branch Select
const branchSelect = document.getElementById('fBranch');
if (branchSelect) {
    branches.forEach(b => branchSelect.add(new Option(b, b)));
}

setInterval(() => { 
    const clock = document.getElementById('live-clock');
    if(clock) clock.innerText = new Date().toLocaleString(); 
}, 1000);

// --- AUTHENTICATION & PRESENCE LOGIC ---
let isFirstLoad = true;

onAuthStateChanged(auth, (user) => {
    if (user) {
        const userName = user.email.split('@')[0].toUpperCase();
        document.getElementById('login-overlay').style.display = 'none';
        document.getElementById('app-wrapper').style.display = 'flex';
        document.getElementById('current-user').innerText = userName;

        managePresence(user.uid, userName);
        listenForUsers();

        onValue(dbRef, (snap) => { rawData = snap.val(); renderDashboard(); });
        onValue(capRef, (snap) => { 
            capturedData = snap.val() || {}; 
            renderDashboard(); 
            if(document.getElementById('capturedModalOverlay').style.display === 'flex') renderCapturedGrid(); 
        });

        if(!isFirstLoad) showToast(`WELCOME BACK, ${userName}`);
        isFirstLoad = false;
    } else {
        document.getElementById('login-overlay').style.display = 'flex';
        document.getElementById('app-wrapper').style.display = 'none';
        isFirstLoad = false;
    }
});

document.getElementById('loginBtn').addEventListener('click', () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pass').value;
    signInWithEmailAndPassword(auth, e, p).catch(err => alert("⚠️ ACCESS DENIED: Invalid Credentials"));
});

document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));

function managePresence(uid, name) {
    const userStatusRef = ref(db, `online_users/${uid}`);
    const connectedRef = ref(db, ".info/connected");
    onValue(connectedRef, (snap) => {
        if (snap.val() === true) {
            onDisconnect(userStatusRef).remove();
            set(userStatusRef, { name: name, lastActive: Date.now() });
        }
    });
}

function listenForUsers() {
    const listContainer = document.getElementById('active-users-list');
    onValue(ref(db, 'online_users'), (snapshot) => {
        listContainer.innerHTML = '';
        const users = snapshot.val() || {};
        Object.values(users).forEach(u => {
            if (u && u.name && u.name !== "UNDEFINED" && u.name.trim() !== "") {
                const item = document.createElement('div');
                item.className = 'user-pill';
                item.innerHTML = `<span class="status-dot"></span> ${u.name}`;
                listContainer.appendChild(item);
            }
        });
    });
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

// --- DASHBOARD LOGIC ---
const fmt = (n) => n === 0 ? "" : n;
const getTooltipText = (o) => Object.entries(o).filter(([k,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join('\n') || "No data";

window.renderDashboard = function() {
    const mBody = document.getElementById('masterBody'); 
    const sBody = document.getElementById('summaryBody');
    const sFoot = document.getElementById('summaryFooter'); 
    const pSide = document.getElementById('sidebarProductBody');
    const query = document.getElementById('searchBar').value.toLowerCase();
    const selBranch = document.getElementById('filterBranch').value; // ADDED BRANCH FILTER
    const selDay = document.getElementById('filterDay').value;
    const selStatus = document.getElementById('filterStatus').value;
    
    mBody.innerHTML = ""; sBody.innerHTML = ""; sFoot.innerHTML = ""; pSide.innerHTML = "";
    let stats = {}; let prodGlobal = {}; products.forEach(p => prodGlobal[p] = 0);
    
    let area = { 
        prospects: 0, approached: 0, captured: 0, proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0, clmdP: 0,
        capR: 0, capN: 0,
        prosDetail: {}, procDetail: {}, pendDetail: {}, appDetail: {}, disbDetail: {}, clmdDetail: {}, findDetail: {},
        appStatus: { proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0 },
        apprCounts: { a1: 0, a2: 0, a3: 0, a4: 0 },
        convDetail: { appClmd: 0, appNotClmd: 0, directClmd: 0 },
        capConvDetail: { rClmd: 0, nClmd: 0, rNotClmd: 0, nNotClmd: 0 }
    };

    branches.forEach(b => {
        let bCapR = 0, bCapN = 0;
        for(let d=1; d<=31; d++) { 
            bCapR += parseInt(capturedData[`${b}_Reloan_${d}`] || 0); 
            bCapN += parseInt(capturedData[`${b}_Newloan_${d}`] || 0); 
        }
        stats[b] = { 
            prospects: 0, approached: 0, captured: (bCapR + bCapN), proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0, clmdP: 0,
            capR: bCapR, capN: bCapN,
            prosDetail: {}, procDetail: {}, pendDetail: {}, appDetail: {}, disbDetail: {}, clmdDetail: {}, findDetail: {},
            appStatus: { proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0 },
            apprCounts: { a1: 0, a2: 0, a3: 0, a4: 0 },
            convDetail: { appClmd: 0, appNotClmd: 0, directClmd: 0 },
            capConvDetail: { rClmd: 0, nClmd: 0, rNotClmd: 0, nNotClmd: 0 }
        };
        area.captured += (bCapR + bCapN); area.capR += bCapR; area.capN += bCapN;
    });

    if (rawData) {
        Object.entries(rawData).reverse().forEach(([id, rec]) => {
            const status = rec.status || "Select"; 
            const pId = rec.productId;
            const isReloan = pId?.includes("Reloan");
            if (prodGlobal[pId] !== undefined) prodGlobal[pId]++;

            if (stats[rec.branch]) {
                const s = stats[rec.branch];
                const isAppr = (rec.approaches?.a1 || rec.approaches?.a2 || rec.approaches?.a3 || rec.approaches?.a4);
                const map = { 'For Process':'proc','Pending Approval':'pend','Approved':'app','Disbursed':'disb','Claimed':'clmd','Findings':'find' };
                const key = map[status];

                if (rec.source === 'import') {
                    s.prospects++; area.prospects++;
                    s.prosDetail[pId] = (s.prosDetail[pId] || 0) + 1;
                    area.prosDetail[pId] = (area.prosDetail[pId] || 0) + 1;
                    
                    if (isAppr) {
                        s.approached++; area.approached++;
                        
                        if (rec.approaches?.a1) { s.apprCounts.a1++; area.apprCounts.a1++; }
                        if (rec.approaches?.a2) { s.apprCounts.a2++; area.apprCounts.a2++; }
                        if (rec.approaches?.a3) { s.apprCounts.a3++; area.apprCounts.a3++; }
                        if (rec.approaches?.a4) { s.apprCounts.a4++; area.apprCounts.a4++; }

                        if (key) { s.appStatus[key]++; area.appStatus[key]++; }
                        if (status === 'Claimed') { 
                            s.clmdP++; area.clmdP++; 
                            s.convDetail.appClmd++; area.convDetail.appClmd++;
                        } else {
                            s.convDetail.appNotClmd++; area.convDetail.appNotClmd++;
                        }
                    } else if (status === 'Claimed') {
                        s.convDetail.directClmd++; area.convDetail.directClmd++;
                    }
                }

                if (key) {
                    s[key]++; area[key]++;
                    s[key + 'Detail'][pId] = (s[key + 'Detail'][pId] || 0) + 1;
                    area[key + 'Detail'][pId] = (area[key + 'Detail'][pId] || 0) + 1;

                    if (status === 'Claimed') {
                        if (isReloan) { s.capConvDetail.rClmd++; area.capConvDetail.rClmd++; }
                        else { s.capConvDetail.nClmd++; area.capConvDetail.nClmd++; }
                    }
                }
            }

            const matchSearch = (rec.clientName?.toLowerCase().includes(query) || rec.officer?.toLowerCase().includes(query) || rec.branch?.toLowerCase().includes(query) || rec.centre?.toLowerCase().includes(query));
            // MODIFIED CONDITION TO INCLUDE BRANCH FILTER
            if (matchSearch && (selBranch === "" || rec.branch === selBranch) && (selDay === "" || rec.meetingDay === selDay) && (selStatus === "" || status === selStatus)) {
                let rCls = ""; 
                if (rec.isDefault === "1" || rec.isDefault?.toLowerCase() === "df" || rec.isDefault?.toLowerCase() === "yes") rCls = 'row-default';
                else if (status === 'Findings') rCls = 'row-findings'; 
                else if (status === 'Claimed') rCls = 'row-claimed'; 
                else if (status === 'For Process') rCls = 'row-process';
                else if (status === 'Disbursed') rCls = 'row-disbursed';
                else if (status === 'Approved') rCls = 'row-approved';
                else if (status === 'Pending Approval') rCls = 'row-pending';

                let apprDisp = (rec.source === 'import') ? 
                    `<input type="checkbox" ${rec.approaches?.a1?'checked':''} onchange="upAppr('${id}',1,this.checked)">
                     <input type="checkbox" ${rec.approaches?.a2?'checked':''} onchange="upAppr('${id}',2,this.checked)">
                     <input type="checkbox" ${rec.approaches?.a3?'checked':''} onchange="upAppr('${id}',3,this.checked)">
                     <input type="checkbox" ${rec.approaches?.a4?'checked':''} onchange="upAppr('${id}',4,this.checked)">` : `<small>From Manual Entry</small>`;
                
                mBody.insertAdjacentHTML('beforeend', `<tr class="${rCls}"><td>${rec.branch}<br>${rec.meetingDay || ''} / ${rec.centre || ''}</td><td><strong>${rec.clientName}</strong> <span onclick="navigator.clipboard.writeText('${rec.clientName}')" style="cursor:pointer">📋</span><br><small>${rec.officer}</small></td><td>${rec.productId}</td><td>${apprDisp}</td><td>${rec.isDefault||''}</td><td><select onchange="updateStatus('${id}', this.value)" class="input-styled"><option value="Select">...</option><option value="For Process" ${status==='For Process'?'selected':''}>For Process</option><option value="Pending Approval" ${status==='Pending Approval'?'selected':''}>Pending Approval</option><option value="Approved" ${status==='Approved'?'selected':''}>Approved</option><option value="Disbursed" ${status==='Disbursed'?'selected':''}>Disbursed</option><option value="Claimed" ${status==='Claimed'?'selected':''}>Claimed</option><option value="Findings" ${status==='Findings'?'selected':''}>Findings</option></select></td><td><input type="text" value="${rec.remarks||''}" onblur="updateRemarks('${id}', this.value)" style="width:100%; border:none; background:transparent; color:inherit;"></td><td><button onclick="delRec('${id}')" style="background:none; border:none; cursor:pointer;">🗑️</button></td></tr>`);
            }
        });
    }

    branches.forEach(b => {
        const s = stats[b];
        const conv = s.approached > 0 ? Math.round((s.clmdP / s.approached) * 100) : 0;
        const capConv = s.captured > 0 ? Math.round((s.clmd / s.captured) * 100) : 0;
        s.capConvDetail.rNotClmd = Math.max(0, s.capR - s.capConvDetail.rClmd);
        s.capConvDetail.nNotClmd = Math.max(0, s.capN - s.capConvDetail.nNotClmd);

        // Funnel Percentages for Branch
        const p1 = s.prospects > 0 ? Math.round((s.apprCounts.a1 / s.prospects) * 100) : 0;
        const p2 = s.apprCounts.a1 > 0 ? Math.round((s.apprCounts.a2 / s.apprCounts.a1) * 100) : 0;
        const p3 = s.apprCounts.a2 > 0 ? Math.round((s.apprCounts.a3 / s.apprCounts.a2) * 100) : 0;
        const p4 = s.apprCounts.a3 > 0 ? Math.round((s.apprCounts.a4 / s.apprCounts.a3) * 100) : 0;

        const appTooltip = `[APPROAPACHED ANALYSIS]\n1st Apps : ${s.apprCounts.a1} (${p1}%)\n2nd Apps : ${s.apprCounts.a2} (${p2}%)\n3rd Apss : ${s.apprCounts.a3} (${p3}%)\n4th Apps : ${s.apprCounts.a4} (${p4}%)\n\n[STATUS BREAKDOWN]\nProc: ${s.appStatus.proc}\nPend: ${s.appStatus.pend}\nApp: ${s.appStatus.app}\nDisb: ${s.appStatus.disb}\nClmd: ${s.appStatus.clmd}\nFind: ${s.appStatus.find}`;

        const rowClass = (b === "Balingasag - Main2" || b === "Balingoan - Main2") ? "tooltip-top" : "";

        sBody.insertAdjacentHTML('beforeend', `
            <tr>
                <td style="text-align:left;">${b}</td>
                <td class="${rowClass}" data-tooltip="${getTooltipText(s.prosDetail)}">${fmt(s.prospects)}</td>
                <td class="${rowClass}" data-tooltip="${appTooltip}">${fmt(s.approached)}</td>
                <td class="${rowClass}" data-tooltip="App. Converted: ${s.convDetail.appClmd}\nApp. Not Converted: ${s.convDetail.appNotClmd}\nConv. But Not Appr: ${s.convDetail.directClmd}" style="color:var(--brand-accent); font-weight:700;">${conv?conv+'%':''}</td>
                <td class="${rowClass}" data-tooltip="Reloan: ${s.capR}\nNewloan: ${s.capN}" style="background:rgba(255,255,255,0.05)">${fmt(s.captured)}</td>
                <td class="${rowClass}" data-tooltip="Total Captured Converted: ${s.capConvDetail.rClmd + s.capConvDetail.nClmd}\nTotal Captured Not Converted: ${s.capConvDetail.rNotClmd + s.capConvDetail.nNotClmd}" style="color:var(--brand-accent); font-weight:700;">${capConv?capConv+'%':''}</td>
                <td class="${rowClass}" data-tooltip="${getTooltipText(s.procDetail)}">${fmt(s.proc)}</td>
                <td class="${rowClass}" data-tooltip="${getTooltipText(s.pendDetail)}">${fmt(s.pend)}</td>
                <td class="${rowClass}" data-tooltip="${getTooltipText(s.appDetail)}">${fmt(s.app)}</td>
                <td class="${rowClass} tooltip-edge" data-tooltip="${getTooltipText(s.disbDetail)}">${fmt(s.disb)}</td>
                <td class="${rowClass} tooltip-edge" data-tooltip="${getTooltipText(s.clmdDetail)}">${fmt(s.clmd)}</td>
                <td class="${rowClass} tooltip-edge" data-tooltip="${getTooltipText(s.findDetail)}">${fmt(s.find)}</td>
            </tr>`);
    });

    const areaConv = area.approached > 0 ? Math.round((area.clmdP / area.approached) * 100) : 0;
    const areaCapConv = area.captured > 0 ? Math.round((area.clmd / area.captured) * 100) : 0;
    area.capConvDetail.rNotClmd = Math.max(0, area.capR - area.capConvDetail.rClmd);
    area.capConvDetail.nNotClmd = Math.max(0, area.capN - area.capConvDetail.nNotClmd);

    // Funnel Percentages for Area
    const ap1 = area.prospects > 0 ? Math.round((area.apprCounts.a1 / area.prospects) * 100) : 0;
    const ap2 = area.apprCounts.a1 > 0 ? Math.round((area.apprCounts.a2 / area.apprCounts.a1) * 100) : 0;
    const ap3 = area.apprCounts.a2 > 0 ? Math.round((area.apprCounts.a3 / area.apprCounts.a2) * 100) : 0;
    const ap4 = area.apprCounts.a3 > 0 ? Math.round((area.apprCounts.a4 / area.apprCounts.a3) * 100) : 0;

    const areaAppTooltip = `[Area Approached]\n1st Apps: ${area.apprCounts.a1} (${ap1}%)\n2nd Apps : ${area.apprCounts.a2} (${ap2}%)\n3rd Apps : ${area.apprCounts.a3} (${ap3}%)\n4th Apps : ${area.apprCounts.a4} (${ap4}%)\n\n[STATUS BREAKDOWN]\nProc: ${area.appStatus.proc}\nPend: ${area.appStatus.pend}\nApp: ${area.appStatus.app}\nDisb: ${area.appStatus.disb}\nClmd: ${area.appStatus.clmd}\nFind: ${area.appStatus.find}`;

    sFoot.innerHTML = `
        <tr style="background:#020617; color:var(--brand-accent); font-weight:800;">
            <td style="text-align:left;">AREA TOTAL</td>
            <td data-tooltip="${getTooltipText(area.prosDetail)}">${area.prospects}</td>
            <td data-tooltip="${areaAppTooltip}">${area.approached}</td>
            <td data-tooltip="App. Converted: ${area.convDetail.appClmd}\nApp. Not Converted: ${area.convDetail.appNotClmd}\nConv. But Not Appr: ${area.convDetail.directClmd}">${areaConv?areaConv+'%':''}</td>
            <td data-tooltip="Reloan: ${area.capR}\nNewloan: ${area.capN}">${area.captured}</td>
            <td data-tooltip="Total Captured Converted: ${area.capConvDetail.rClmd + area.capConvDetail.nClmd}\nTotal Captured Not Converted: ${area.capConvDetail.rNotClmd + area.capConvDetail.nNotClmd}">${areaCapConv?areaCapConv+'%':''}</td>
            <td data-tooltip="${getTooltipText(area.procDetail)}">${area.proc}</td>
            <td data-tooltip="${getTooltipText(area.pendDetail)}">${area.pend}</td>
            <td data-tooltip="${getTooltipText(area.appDetail)}">${area.app}</td>
            <td data-tooltip="${getTooltipText(area.disbDetail)}" class="tooltip-edge">${area.disb}</td>
            <td data-tooltip="${getTooltipText(area.clmdDetail)}" class="tooltip-edge">${area.clmd}</td>
            <td data-tooltip="${getTooltipText(area.findDetail)}" class="tooltip-edge">${area.find}</td>
        </tr>`;
        
    Object.entries(prodGlobal).forEach(([p, count]) => { if (count > 0) pSide.insertAdjacentHTML('beforeend', `<tr><td style="padding: 4px 0;">${p}</td><td style="text-align:right; font-weight: 700;">${count}</td></tr>`); });
};

window.processFile = function(file) {
    if (!file) return; const reader = new FileReader(); 
    reader.onload = async function(e) {
        const workbook = XLSX.read(e.target.result, { type: 'binary' }); const sheet = workbook.Sheets[workbook.SheetNames[0]]; const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }); const headers = rows[0].map(h => String(h).toLowerCase().trim()); const dataRows = rows.slice(1);
        const findIdx = (keywords) => headers.findIndex(h => keywords.some(k => h.includes(k)));
        const idx = { branch: findIdx(['br','office']), client: findIdx(['clie','name']), officer: findIdx(['ts','officer']), product: findIdx(['prod','loan']), centre: findIdx(['cent','group']), day: findIdx(['day','sch']), def: findIdx(['def','df']) };
        for (let i = 0; i < dataRows.length; i++) {
            const r = dataRows[i]; if (!r) continue;
            await push(dbRef, { branch: idx.branch!==-1?r[idx.branch]:"Unspecified", clientName: idx.client!==-1?r[idx.client]:"N/A", officer: idx.officer!==-1?r[idx.officer]:"N/A", productId: idx.product!==-1?r[idx.product]:"Newloan", centre: idx.centre!==-1?r[idx.centre]:"", meetingDay: idx.day!==-1?r[idx.day]:"Monday", isDefault: (idx.def!==-1 && r[idx.def]!=null)?String(r[idx.def]):"", status: "Select", source: "import", lastUpdated: serverTimestamp() });
        }
    };
    reader.readAsBinaryString(file);
};

window.openCapturedModal = () => { document.getElementById('capturedModalOverlay').style.display = 'flex'; renderCapturedGrid(); };
window.closeCapturedModal = () => { document.getElementById('capturedModalOverlay').style.display = 'none'; };

window.renderCapturedGrid = function() {
    const head = document.getElementById('capturedHead'); const body = document.getElementById('capturedBody'); const foot = document.getElementById('capturedSummary'); const cats = ["Reloan", "Newloan", "C/P Leaders Approached", "Oriented Centers"];
    head.innerHTML = `<tr><th class="frozen-intersection">BRANCH PERFORMANCE</th>${Array.from({length:31}, (_,i)=>`<th>${i+1}</th>`).join('')}</tr>`;
    body.innerHTML = ""; let areaCatTotals = { "Reloan": Array(32).fill(0), "Newloan": Array(32).fill(0), "C/P Leaders Approached": Array(32).fill(0), "Oriented Centers": Array(32).fill(0) };
    branches.forEach(b => {
        cats.forEach((cat, idx) => {
            let row = `<tr class="${idx === 3 ? 'branch-divider' : ''}"><td class="captured-row-title">${idx === 0 ? `<span style="color:var(--brand-accent)">${b}</span>` : ''}<br><small>${cat}</small></td>`;
            for(let d=1; d<=31; d++) {
                const val = capturedData[`${b}_${cat.replace('/', '_')}_${d}`] || 0; areaCatTotals[cat][d] += parseInt(val);
                row += `<td><input type="number" value="${val > 0 ? val : ''}" class="captured-input" onblur="updateCaptured('${b}','${cat}',${d},this.value)"></td>`;
            }
            body.insertAdjacentHTML('beforeend', row + "</tr>");
        });
    });
    foot.innerHTML = cats.map(cat => {
        let sRow = `<tr style="background:#020617; color:var(--brand-accent)"><td class="captured-row-title">AREA TOTAL: ${cat}</td>`;
        for(let d=1; d<=31; d++) { sRow += `<td><strong>${areaCatTotals[cat][d] || 0}</strong></td>`; }
        return sRow + "</tr>";
    }).join('');
};

window.updateCaptured = (b, cat, d, val) => { const path = `${b}_${cat.replace('/', '_')}_${d}`; if(!val) remove(ref(db, `captured_folders/${path}`)); else set(ref(db, `captured_folders/${path}`), parseInt(val)); };
window.updateStatus = (id, v) => update(ref(db, `client_records/${id}`), { status: v, lastUpdated: serverTimestamp() });
window.updateRemarks = (id, v) => update(ref(db, `client_records/${id}`), { remarks: v });
window.upAppr = (id, n, v) => set(ref(db, `client_records/${id}/approaches/a${n}`), v);
window.delRec = (id) => confirm("Delete?") && remove(ref(db, `client_records/${id}`));
window.toggleModal = (s) => document.getElementById('modalOverlay').style.display = s ? 'flex' : 'none';
window.secureAction = (type) => { if (prompt("PIN:") === "1234") { if (type === 'wipe') remove(dbRef); else if (type === 'wipeCaptured') remove(capRef); else document.getElementById('csvFileInput').click(); } };

window.validateCentre = function(input) { 
    let v = input.value.toUpperCase(); 
    input.value = v; 
    const d = document.getElementById('fDay'); 
    if (v.startsWith("MA") || v.startsWith("MB")) d.value = "Monday"; 
    else if (v.startsWith("TA") || v.startsWith("TB")) d.value = "Tuesday"; 
    else if (v.startsWith("WA") || v.startsWith("WB")) d.value = "Wednesday"; 
    else if (v.startsWith("TH")) d.value = "Thursday"; 
    else d.value = "Incorrect Format - Center Name"; 
};

const clientForm = document.getElementById('clientForm');
if (clientForm) {
    clientForm.onsubmit = (e) => { 
        e.preventDefault(); 
        push(dbRef, { 
            branch: document.getElementById('fBranch').value, 
            clientName: document.getElementById('fClient').value, 
            officer: document.getElementById('fOfficer').value, 
            centre: document.getElementById('fCentre').value, 
            productId: document.getElementById('fProduct').value, 
            meetingDay: document.getElementById('fDay').value, 
            status: "Select", 
            source: "manual" 
        }).then(() => { 
            toggleModal(false); 
            e.target.reset(); 
        }); 
    };
}
