(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.ValueHistory=api;})(typeof window!=='undefined'?window:globalThis,function(){
  'use strict';
  function series(data,broker='ALL',symbols=[]){
    const rows=data.positions.filter(row=>broker==='ALL'||row.broker===broker);
    const observed=[...new Set(rows.map(row=>row.date?.slice(0,7)).filter(Boolean))].sort();
    const months=[];if(observed.length)for(let m=observed[0];m<=observed.at(-1);m=new Date(Date.UTC(+m.slice(0,4),+m.slice(5),1)).toISOString().slice(0,7))months.push(m);
    const byMonth=new Map(months.map(month=>[month,rows.filter(row=>row.date.slice(0,7)===month)]));
    const allSymbols=[...new Set(rows.map(row=>row.symbol).filter(Boolean))].sort();
    return {months,symbols:allSymbols,nav:months.map(month=>{const all=byMonth.get(month);if(!all.length)return null;const values=all.map(row=>row['Market Value HKD']);return values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;}),positions:Object.fromEntries(symbols.map(symbol=>[symbol,months.map(month=>{const all=byMonth.get(month);if(!all.length)return null;const values=all.filter(row=>row.symbol===symbol).map(row=>row['Market Value HKD']);return values.every(Number.isFinite)?values.reduce((a,b)=>a+b,0):null;})]))};
  }
  function range(months,mode,start='',end=''){const last=months.at(-1);if(!last)return [];let lo='0000-00',hi=last;if(mode==='CUSTOM'){lo=start||lo;hi=end||hi;}else if(mode==='YTD')lo=last.slice(0,4)+'-01';else if(['3M','6M','1Y'].includes(mode)){const n=mode==='1Y'?12:+mode[0];lo=new Date(Date.UTC(+last.slice(0,4),+last.slice(5)-n,1)).toISOString().slice(0,7);}return lo>hi?[]:months.filter(m=>m>=lo&&m<=hi);}
  return Object.freeze({series,range});
});
(function(root){if(typeof document==='undefined')return;const $=id=>document.getElementById(id);let data,selected=new Set(),bound=false;
  function render(){if(!data)return;const broker=$('overview-broker').value,mode=$('value-mode').value;let all=ValueHistory.series(data,broker,[...selected]);
    $('value-symbols').hidden=mode!=='positions';$('value-symbols').innerHTML=all.symbols.map(s=>`<label><input type="checkbox" data-symbol="${s.replace(/&/g,'&amp;').replace(/"/g,'&quot;')}" ${selected.has(s)?'checked':''}> ${s.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</label>`).join('');
    const months=ValueHistory.range(all.months,$('value-range').value,$('value-start').value,$('value-end').value),indices=months.map(m=>all.months.indexOf(m));
    const names=mode==='nav'?['Total NAV']:[...selected].filter(s=>all.symbols.includes(s));const arrays=names.map(n=>indices.map(i=>n==='Total NAV'?all.nav[i]:all.positions[n]?.[i]));
    if(!months.length||!names.length){$('value-chart').innerHTML='<p class="empty">Choose a range and at least one position.</p>';return;}
    const w=900,h=290,l=85,r=20,t=30,b=50,values=arrays.flat().filter(Number.isFinite),low=Math.min(0,...values),high=Math.max(1,...values),x=i=>l+(w-l-r)*(i+.5)/months.length,y=v=>t+(high-v)*(h-t-b)/(high-low),colors=['#0e7d6c','#2b8ba3','#8769a8','#c27074','#d18a58','#5a78b8'];
    const lines=arrays.map((a,j)=>{let segments=[],points=[];a.forEach((v,i)=>{if(Number.isFinite(v))points.push(`${x(i)},${y(v)}`);else if(points.length){segments.push(points);points=[];}});if(points.length)segments.push(points);return segments.map(p=>`<polyline points="${p.join(' ')}" fill="none" stroke="${colors[j%colors.length]}" stroke-width="2.5"/>`).join('')+a.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="3" fill="${colors[j%colors.length]}"><title>${months[i]} · ${names[j]} · HK$${v.toLocaleString('en-HK',{minimumFractionDigits:2,maximumFractionDigits:2})}</title></circle>`:'').join('');}).join('');
    const labels=months.map((m,i)=>i%Math.max(1,Math.ceil(months.length/8))===0?`<text x="${x(i)}" y="${h-12}" text-anchor="middle">${m}</text>`:'').join('');
    $('value-chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="Historical ${mode==='nav'?'NAV':'position market value'} in HKD"><g class="chart-axis"><text x="${l}" y="17">${mode==='nav'?'NAV':'Market value'} (HKD)</text>${[0,.5,1].map(f=>`<text x="${l-8}" y="${y(low+(high-low)*f)+4}" text-anchor="end">${Math.round(low+(high-low)*f).toLocaleString()}</text>`).join('')}${labels}</g>${lines}</svg><div class="value-legend">${names.map((n,j)=>`<span style="color:${colors[j%colors.length]}">● ${n.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</span>`).join('　')}</div>`;
  }
  function mount(next){data=next;const months=[...new Set(next.positions.map(r=>r.date.slice(0,7)))].sort();$('value-start').value=months[0]||'';$('value-end').value=months.at(-1)||'';if(!bound){bound=true;for(const id of ['overview-broker','value-mode','value-range','value-start','value-end'])$(id).addEventListener('change',()=>{for(const e of document.querySelectorAll('.value-custom'))e.hidden=$('value-range').value!=='CUSTOM';render();});$('value-symbols').addEventListener('change',e=>{const s=e.target.dataset.symbol;if(!s)return;if(e.target.checked)selected.add(s);else selected.delete(s);render();});}render();}
  root.ValueHistoryUI={mount,clear(){data=null;selected.clear();$('value-chart').innerHTML='';}};
})(typeof window!=='undefined'?window:globalThis);
