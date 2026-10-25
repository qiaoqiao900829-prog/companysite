(function(){
const q=new URLSearchParams(location.search),id=q.get('id');if(!id)return;
const language=q.get('lang')||'zh-cn',ja=language==='ja',tw=language==='zh-tw';
const T=ja?{title:'月額賃料の概算',start:'入居日',end:'退去日',guests:'人数',button:'計算',invalid:'日付と人数を確認してください。',unavailable:'選択期間は受付できません。',fee:'管理費',total:'概算初期費用',note:'仮見積です。空室・契約条件は担当者が確認します。',contact:'この条件で問い合わせ'}:tw?{title:'月租費用試算',start:'入住日期',end:'退房日期',guests:'人數',button:'計算',invalid:'請確認日期和入住人數。',unavailable:'所選日期不可入住。',fee:'管理費',total:'預計初期費用',note:'僅供參考，空房與簽約條件須由工作人員確認。',contact:'按此條件諮詢'}:{title:'月租费用试算',start:'入住日期',end:'退房日期',guests:'人数',button:'计算',invalid:'请确认入住日期、退房日期和人数。',unavailable:'所选日期不可入住。',fee:'管理费',total:'预计初期费用',note:'仅为试算，空房和签约条件须由工作人员确认。',contact:'按此条件咨询'};
const yen=n=>new Intl.NumberFormat('ja-JP',{style:'currency',currency:'JPY',maximumFractionDigits:0}).format(Math.round(n));
const date=d=>Date.parse(d+'T00:00:00Z'),overlap=(a,b,c,d)=>a<d&&b>c;
function peakDays(a,b,periods){let count=0;for(let t=date(a);t<date(b);t+=86400000){const d=new Date(t).toISOString().slice(0,10);if(periods.some(p=>d>=p.start&&d<p.end))count++}return count}
async function init(){const {data:p,error}=await SB.from('properties').select('id,business_type,status,title_ja,title_zh_cn,property_code').eq('id',id).single();if(error||p?.business_type!=='short'||p.status!=='published')return;
const {data:s,error:se}=await SB.from('monthly_settings').select('*').eq('property_id',id).maybeSingle();if(se||!s)return;
const root=document.getElementById('detail');if(!root)return;
const box=document.createElement('section');box.id='monthly-quote';box.style.cssText='padding:24px;border:1px solid #e2d9d6;margin:26px 0;background:white;border-radius:8px';
box.innerHTML='<h2>'+T.title+'</h2><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px"><label>'+T.start+'<input id="mq-start" type="date" style="display:block;width:100%;padding:10px"></label><label>'+T.end+'<input id="mq-end" type="date" style="display:block;width:100%;padding:10px"></label><label>'+T.guests+'<input id="mq-guests" type="number" min="1" max="'+Number(s.max_guests)+'" value="1" style="display:block;width:100%;padding:10px"></label></div><p><button type="button" class="button" id="mq-calc">'+T.button+'</button></p><div id="mq-result" aria-live="polite"></div><p style="font-size:13px;color:#777">'+T.note+'</p>';const panel=root.querySelector('.detail-panel');if(panel)panel.appendChild(box);else root.appendChild(box);
const $=id=>box.querySelector('#'+id); $('mq-calc').onclick=async()=>{try{const a=$('mq-start').value,b=$('mq-end').value,g=Number($('mq-guests').value),n=(date(b)-date(a))/86400000,res=$('mq-result');res.replaceChildren();
if(!a||!b||!Number.isInteger(n)||n<Number(s.min_nights)||!Number.isInteger(g)||g<1||g>Number(s.max_guests)){res.textContent=T.invalid+'（最少 '+s.min_nights+' 晚）';return}
// Price estimates do not depend on reservation availability; staff confirms dates separately.
const mode=s.price_mode||'thirty_day',monthRates=s.calendar_month_rates||{};let rent=0;
if(mode==='daily')rent=Number(s.daily_rent||0)*n;
else if(mode==='calendar'){for(let t=date(a);t<date(b);t+=86400000){const dt=new Date(t),m=dt.getUTCMonth()+1,year=dt.getUTCFullYear(),days=new Date(Date.UTC(year,m,0)).getUTCDate(),monthly=Number(monthRates[String(year)+'-'+String(m).padStart(2,'0')]??monthRates[String(m)]??s.monthly_rent);rent+=monthly/days}}
else rent=Number(s.monthly_rent)*n/30;
const utilities=n*(Number(s.utilities_per_person_day)+Math.max(0,g-1)*Number(s.extra_person_day));
const peak=mode==='calendar'?0:peakDays(a,b,Array.isArray(s.peak_periods)?s.peak_periods:[])*Number(s.peak_surcharge_day);
const beddingQty=Number($('mq-bedding')?.value??s.included_bedding??1);if(!Number.isInteger(beddingQty)||beddingQty<0||beddingQty>30){res.textContent='请确认床品套数';return}
const bedding=Math.max(0,beddingQty-Number(s.included_bedding??1))*Number(s.bedding_fee||0),cleaning=Number(s.cleaning_fee||0),deposit=Number(s.deposit),fee=Number(s.contract_fee);
rent=Math.round(rent);const total=Math.round(rent+utilities+peak+bedding+cleaning+deposit+fee);
const rows=[['租金',rent],['水电煤',utilities],['旺季加价',peak],['床品费用',bedding],['退房清扫费',cleaning],['合同手续费',fee],['可退押金',deposit],['住宿费用合计',total-deposit],[T.total,total]].filter(([label,value])=>value!==0||label===T.total||label==='住宿费用合计');
for(const [label,value] of rows){const line=document.createElement('p');line.textContent=label+'：'+yen(value);if(label===T.total)line.style.fontWeight='bold';res.appendChild(line)}
const link=document.createElement('a');link.className='button';link.textContent=T.contact;const title=p.title_zh_cn||p.title_ja||p.property_code||id;link.href='mailto:info@zuihoudou.com?subject='+encodeURIComponent('月租咨询：'+title)+'&body='+encodeURIComponent('房源：'+title+'\n入住：'+a+'\n退房：'+b+'\n人数：'+g+'\n试算费用：'+yen(total)+'\n请确认空房及签约条件。');res.appendChild(link);
}catch(e){console.error('Quote calculation error',e);$('mq-result').textContent='计算遇到错误，请联系瑞鳳堂确认报价。';}
};
}
document.addEventListener('zuihoudou:property-rendered',()=>init().catch(e=>console.warn('Monthly quote',e)));
})();