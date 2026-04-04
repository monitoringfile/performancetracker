import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";
import { getDatabase, ref, onValue, update, remove, push, set, serverTimestamp, onDisconnect } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-database.js";

// Firebase Config
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

// Global State
let rawData = null; 
let capturedData = {};
const branches = ["Balingasag - Main2", "Balingoan - Main2", "Camiguin - Main2", "Claveria - Main2", "Gingoog - Main2", "Salay - Main"];
const products = ["Mauswagon Reloan", "Supplemental Reloan", "New Supplemental", "Newloan", "Balik RMF", "Saver's"];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    const branchSelect = document.getElementById('fBranch');
    branches.forEach(b => branchSelect.add(new Option(b, b)));
    
    setInterval(() => { 
        document.getElementById('live-clock').innerText = new Date().toLocaleString(); 
    }, 1000);

    setupEventListeners();
});

// --- Auth Logic ---
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
    }
});

// --- Event Listeners ---
function setupEventListeners() {
    document.getElementById('loginBtn').addEventListener('click', () => {
        const e = document.getElementById('email').value;
        const p = document.getElementById('pass').value;
        signInWithEmailAndPassword(auth, e, p).catch(() => alert("⚠️ ACCESS DENIED"));
    });

    document.getElementById('logoutBtn').addEventListener('click', () => signOut(auth));
    
    document.getElementById('btn-import').addEventListener('click', () => secureAction('import'));
    document.getElementById('btn-captured').addEventListener('click', () => openCapturedModal());
    document.getElementById('btn-new-app').addEventListener('click', () => toggleModal(true));
    document.getElementById('btn-wipe').addEventListener('click', () => secureAction('wipe'));
    document.getElementById('btn-reset-captured').addEventListener('click', () => secureAction('wipeCaptured'));
    document.getElementById('btn-close-captured').addEventListener('click', () => closeCapturedModal());
    document.getElementById('btn-discard').addEventListener('click', () => toggleModal(false));

    document.getElementById('searchBar').addEventListener('input', renderDashboard);
    document.getElementById('filterDay').addEventListener('change', renderDashboard);
    document.getElementById('filterStatus').addEventListener('change', renderDashboard);

    document.getElementById('fCentre').addEventListener('input', (e) => validateCentre(e.target));
    
    document.getElementById('clientForm').onsubmit = (e) => {
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

// --- Dashboard Rendering ---
const fmt = (n) => n === 0 ? "" : n;
const getTooltipText = (o) => Object.entries(o).filter(([k,v]) => v > 0).map(([k,v]) => `${k}: ${v}`).join('\n') || "No data";

window.renderDashboard = function() {
    const mBody = document.getElementById('masterBody'); 
    const sBody = document.getElementById('summaryBody');
    const sFoot = document.getElementById('summaryFooter'); 
    const pSide = document.getElementById('sidebarProductBody');
    
    const query = document.getElementById('searchBar').value.toLowerCase();
    const selDay = document.getElementById('filterDay').value;
    const selStatus = document.getElementById('filterStatus').value;
    
    mBody.innerHTML = ""; sBody.innerHTML = ""; sFoot.innerHTML = ""; pSide.innerHTML = "";
    let stats = {}; 
    let prodGlobal = {}; 
    products.forEach(p => prodGlobal[p] = 0);
    
    let area = { 
        prospects: 0, approached: 0, captured: 0, proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0, clmdP: 0,
        capR: 0, capN: 0,
        prosDetail: {}, procDetail: {}, pendDetail: {}, appDetail: {}, disbDetail: {}, clmdDetail: {}, findDetail: {},
        appStatus: { proc: 0, pend: 0, app: 0, disb: 0, clmd: 0, find: 0 },
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
            convDetail: { appClmd: 0, appNotClmd: 0, directClmd: 0 },
            capConvDetail: { rClmd: 0, nClmd: 0, rNotClmd: 0, nNotClmd: 0 }
        };
        area.captured += (bCapR + bCapN); area.capR += bCapR; area.capN += bCapN;
    });

    if (rawData) {
        Object.entries(rawData).reverse().forEach(([id, rec]) => {
            const status = rec.status || "Select"; 
            const pId = rec.productId;
            const isReloan = pId.includes("Reloan");
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
                        if (key) { s.appStatus[key]++; area.appStatus[key]++; }
                        if (status === 'Claimed') { s.clmdP++; area.clmdP++; s.convDetail.appClmd++; area.convDetail.appClmd++; }
                        else { s.convDetail.appNotClmd++; area.convDetail.appNotClmd++; }
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

            // Search logic
            const matchSearch = (rec.clientName?.toLowerCase().includes(query) || rec.officer?.toLowerCase().includes(query) || rec.branch?.toLowerCase().includes(query) || rec.centre?.toLowerCase().includes(query));
            if (matchSearch && (selDay === "" || rec.meetingDay === selDay) && (selStatus === "" || status === selStatus)) {
                renderMasterRow(mBody, id, rec, status);
            }
        });
    }

    renderSummaryTable(sBody, sFoot, stats, area);
    Object.entries(prodGlobal).forEach(([p, count]) => { 
        if (count > 0) pSide.insertAdjacentHTML('beforeend', `<tr><td style="padding: 4px 0;">${p}</td><td style="text-align:right; font-weight: 700;">${count}</td></tr>`); 
    });
};

function renderMasterRow(mBody, id, rec, status) {
    let rCls = ""; 
    if (rec.isDefault === "1" || rec.isDefault?.toLowerCase() === "df" || rec.isDefault?.toLowerCase() === "yes") rCls = 'row-default';
    else if (status === 'Findings') rCls = 'row-findings'; 
    else if (status === 'Claimed') rCls = 'row-claimed'; 
    else if (status === 'For Process') rCls = 'row-process';
    else if (status === 'Disbursed') rCls = 'row-disbursed';
    else if (status === 'Approved') rCls = 'row-approved';
    else if (status === 'Pending Approval') rCls = 'row-pending';

    let apprDisp = (rec.source === 'import') ? 
        `<input type="checkbox" ${rec.approaches?.a1?'checked':''} onchange="window.upAppr('${id}',1,this.checked)">
         <input type="checkbox" ${rec.approaches?.a2?'checked':''} onchange="window.upAppr('${id}',2,this.checked)">
         <input type="checkbox" ${rec.approaches?.a3?'checked':''} onchange="window.upAppr('${id}',3,this.checked)">
         <input type="checkbox" ${rec.approaches?.a4?'checked':''} onchange="window.upAppr('${id}',4,this.checked)">` : `<small>Manual</small>`;
    
    mBody.insertAdjacentHTML('beforeend', `
        <tr class="${rCls}">
            <td>${rec.branch}<br>${rec.meetingDay || ''} / ${rec.centre || ''}</td>
            <td><strong>${rec.clientName}</strong><br><small>${rec.officer}</small></td>
            <td>${rec.productId}</td>
            <td>${apprDisp}</td>
            <td>${rec.isDefault||''}</td>
            <td>
                <select onchange="window.updateStatus('${id}', this.value)" class="input-styled">
                    <option value="Select">...</option>
                    <option value="For Process" ${status==='For Process'?'selected':''}>For Process</option>
                    <option value="Pending Approval" ${status==='Pending Approval'?'selected':''}>Pending Approval</option>
                    <option value="Approved" ${status==='Approved'?'selected':''}>Approved</option>
                    <option value="Disbursed" ${status==='Disbursed'?'selected':''}>Disbursed</option>
                    <option value="Claimed" ${status==='Claimed'?'selected':''}>Claimed</option>
                    <option value="Findings" ${status==='Findings'?'selected':''}>Findings</option>
                </select>
            </td>
            <td><input type="text" value="${rec.remarks||''}" onblur="window.updateRemarks('${id}', this.value)" style="width:100%; border:none; background:transparent; color:inherit;"></td>
            <td><button onclick="window.delRec('${id}')" style="background:none; border:none; cursor:pointer;">🗑️</button></td>
        </tr>`);
}

function renderSummaryTable(sBody, sFoot, stats, area) {
    branches.forEach(b => {
        const s = stats[b];
        const conv = s.approached > 0 ? Math.round((s.clmdP / s.approached) * 100) : 0;
        const capConv = s.captured > 0 ? Math.round((s.clmd / s.captured) * 100) : 0;
        sBody.insertAdjacentHTML('beforeend', `
            <tr>
                <td style="text-align:left;">${b}</td>
                <td data-tooltip="${getTooltipText(s.prosDetail)}">${fmt(s.prospects)}</td>
                <td data-tooltip="Proc: ${s.appStatus.proc}\nPend: ${s.appStatus.pend}">${fmt(s.approached)}</td>
                <td style="color:var(--brand-accent); font-weight:700;">${conv?conv+'%':''}</td>
                <td style="background:rgba(255,255,255,0.05)">${fmt(s.captured)}</td>
                <td style="color:var(--brand-accent); font-weight:700;">${capConv?capConv+'%':''}</td>
                <td>${fmt(s.proc)}</td><td>${fmt(s.pend)}</td><td>${fmt(s.app)}</td><td>${fmt(s.disb)}</td><td>${fmt(s.clmd)}</td><td>${fmt(s.find)}</td>
            </tr>`);
    });

    const areaConv = area.approached > 0 ? Math.round((area.clmdP / area.approached) * 100) : 0;
    const areaCapConv = area.captured > 0 ? Math.round((area.clmd / area.captured) * 100) : 0;
    sFoot.innerHTML = `
        <tr style="background:#020617; color:var(--brand-accent); font-weight:800;">
            <td style="text-align:left;">AREA TOTAL</td>
            <td>${area.prospects}</td><td>${area.approached}</td><td>${areaConv?areaConv+'%':''}</td>
            <td>${area.captured}</td><td>${areaCapConv?areaCapConv+'%':''}</td>
            <td>${area.proc}</td><td>${area.pend}</td><td>${area.app}</td><td>${area.disb}</td><td>${area.clmd}</td><td>${area.find}</td>
        </tr>`;
}

// --- Utility Functions ---
window.updateCaptured = (b, cat, d, val) => { 
    const path = `${b}_${cat.replace('/', '_')}_${d}`; 
    if(!val) remove(ref(db, `captured_folders/${path}`)); 
    else set(ref(db, `captured_folders/${path}`), parseInt(val)); 
};

window.updateStatus = (id, v) => update(ref(db, `client_records/${id}`), { status: v, lastUpdated: serverTimestamp() });
window.updateRemarks = (id, v) => update(ref(db, `client_records/${id}`), { remarks: v });
window.upAppr = (id, n, v) => set(ref(db, `client_records/${id}/approaches/a${n}`), v);
window.delRec = (id) => confirm("Delete?") && remove(ref(db, `client_records/${id}`));

function toggleModal(s) { document.getElementById('modalOverlay').style.display = s ? 'flex' : 'none'; }
function openCapturedModal() { document.getElementById('capturedModalOverlay').style.display = 'flex'; renderCapturedGrid(); }
function closeCapturedModal() { document.getElementById('capturedModalOverlay').style.display = 'none'; }

function secureAction(type) { 
    if (prompt("PIN:") === "1234") { 
        if (type === 'wipe') remove(dbRef); 
        else if (type === 'wipeCaptured') remove(capRef); 
        else document.getElementById('csvFileInput').click(); 
    } 
}

function validateCentre(input) { 
    let v = input.value.toUpperCase(); 
    input.value = v; 
    const d = document.getElementById('fDay'); 
    if (v.startsWith("MA") || v.startsWith("MB")) d.value = "Monday"; 
    else if (v.startsWith("TA") || v.startsWith("TB")) d.value = "Tuesday"; 
    else if (v.startsWith("WA") || v.startsWith("WB")) d.value = "Wednesday"; 
    else if (v.startsWith("TH")) d.value = "Thursday"; 
    else d.value = "Incorrect Format"; 
}

function showToast(msg) {
    const t = document.getElementById('toast');
    t.innerText = msg; t.style.display = 'block';
    setTimeout(() => t.style.display = 'none', 3000);
}

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
            if (u && u.name) {
                const item = document.createElement('div');
                item.className = 'user-pill';
                item.innerHTML = `<span class="status-dot"></span> ${u.name}`;
                listContainer.appendChild(item);
            }
        });
    });
}

window.renderCapturedGrid = function() {
    const head = document.getElementById('capturedHead'); 
    const body = document.getElementById('capturedBody'); 
    const cats = ["Reloan", "Newloan", "C/P Leaders Approached", "Oriented Centers"];
    head.innerHTML = `<tr><th class="frozen-intersection">BRANCH</th>${Array.from({length:31}, (_,i)=>`<th>${i+1}</th>`).join('')}</tr>`;
    body.innerHTML = "";
    branches.forEach(b => {
        cats.forEach((cat, idx) => {
            let row = `<tr><td class="captured-row-title">${idx === 0 ? b : cat}</td>`;
            for(let d=1; d<=31; d++) {
                const val = capturedData[`${b}_${cat.replace('/', '_')}_${d}`] || 0;
                row += `<td><input type="number" value="${val > 0 ? val : ''}" class="captured-input" onblur="window.updateCaptured('${b}','${cat}',${d},this.value)"></td>`;
            }
            body.insertAdjacentHTML('beforeend', row + "</tr>");
        });
    });
};