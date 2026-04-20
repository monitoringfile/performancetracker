// --- DASHBOARD LOGIC (MODIFIED PERCENTAGE COMPUTATION) ---
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
            if (matchSearch && (selDay === "" || rec.meetingDay === selDay) && (selStatus === "" || status === selStatus)) {
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
        s.capConvDetail.nNotClmd = Math.max(0, s.capN - s.capConvDetail.nClmd);

        // ADJUSTED: Calculate Percentages relative to total Prospects
        const getP = (val) => s.prospects > 0 ? Math.round((val / s.prospects) * 100) + '%' : '0%';
        
        const appTooltip = `[CHECKBOX PENETRATION vs PROSPECTS]\n1st Approached: ${s.apprCounts.a1} (${getP(s.apprCounts.a1)})\n2nd Approached: ${s.apprCounts.a2} (${getP(s.apprCounts.a2)})\n3rd Approached: ${s.apprCounts.a3} (${getP(s.apprCounts.a3)})\n4th Approached: ${s.apprCounts.a4} (${getP(s.apprCounts.a4)})\n\n[STATUS BREAKDOWN]\nProc: ${s.appStatus.proc}\nPend: ${s.appStatus.pend}\nApp: ${s.appStatus.app}\nDisb: ${s.appStatus.disb}\nClmd: ${s.appStatus.clmd}\nFind: ${s.appStatus.find}`;

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
    area.capConvDetail.nNotClmd = Math.max(0, area.capN - area.capConvDetail.nClmd);

    // ADJUSTED: Calculate Area Percentages relative to total Prospects
    const getAP = (val) => area.prospects > 0 ? Math.round((val / area.prospects) * 100) + '%' : '0%';
    
    const areaAppTooltip = `[CHECKBOX PENETRATION vs PROSPECTS]\nBox 1: ${area.apprCounts.a1} (${getAP(area.apprCounts.a1)})\nBox 2: ${area.apprCounts.a2} (${getAP(area.apprCounts.a2)})\nBox 3: ${area.apprCounts.a3} (${getAP(area.apprCounts.a3)})\nBox 4: ${area.apprCounts.a4} (${getAP(area.apprCounts.a4)})\n\n[STATUS BREAKDOWN]\nProc: ${area.appStatus.proc}\nPend: ${area.appStatus.pend}\nApp: ${area.appStatus.app}\nDisb: ${area.appStatus.disb}\nClmd: ${area.appStatus.clmd}\nFind: ${area.appStatus.find}`;

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
