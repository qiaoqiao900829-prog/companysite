const id=qp.get('id');
document.getElementById('header').innerHTML=header('');
document.getElementById('footer').innerHTML=footer();

async function loadDetail(){
  if(!id)return fail(t.empty);
  const [{data:p,error},{data:media}]=await Promise.all([
    SB.from('properties').select('*').eq('id',id).single(),
    SB.from('property_media').select('*').eq('property_id',id).order('display_order')
  ]);
  if(error||!p)return fail(t.empty);
  document.title=titleOf(p)+'｜瑞鳳堂株式会社';
  applyPropertySeo(p,media||[]);
  const items=(media||[]).length?media:(p.cover_image_url?[{media_type:'image',file_url:p.cover_image_url}]:[]);
  const isRental=p.business_type!=='sale';
  const typeLabel=p.business_type==='rent'?t.rent:p.business_type==='short'?t.short:t.sale;
  const inquiryParams=new URLSearchParams({property:titleOf(p),property_code:p.property_code||'',property_id:p.id,property_type:p.business_type,property_url:location.href});
  const inquiryUrl=homeFor()+'?'+inquiryParams.toString()+'#contact';
  document.getElementById('detail').innerHTML=`<a class="back-link" href="properties.html?type=${p.business_type}&lang=${lang}">← ${t.back}</a><div class="detail-grid"><div><div class="gallery-main" id="gallery-main">${items.length?mediaTag(items[0],false):'<div class="empty-state">ZUIHOUDOU</div>'}</div><div class="thumbs" id="thumbs">${items.map((m,i)=>`<button class="${i===0?'active':''}" data-i="${i}">${mediaTag(m,true)}</button>`).join('')}</div><div class="description"><h2>${t.description}</h2>${escapeHtml(descOf(p)||'').replace(/\n/g,'<br>')}</div></div><aside class="detail-panel"><span class="eyebrow">${typeLabel}</span><h1>${escapeHtml(titleOf(p))}</h1><div class="price">${isRental?money(p.rent)+t.month:money(p.sale_price)}</div><div class="detail-list"><div><b>${t.layout}</b>${escapeHtml(p.floor_plan||'—')}</div><div><b>${t.area}</b>${p.area_sqm?p.area_sqm+'㎡':'—'}</div>${isRental?`<div><b>${t.fee}</b>${money(p.management_fee)}</div><div><b>${t.deposit} / ${t.keyMoney}</b>${escapeHtml(p.deposit||'—')} / ${escapeHtml(p.key_money||'—')}</div>`:''}<div><b>${t.station}</b>${escapeHtml(p.nearest_station||'—')}${p.station_walk_minutes?' '+t.walk+p.station_walk_minutes+t.min:''}</div><div><b>${t.address}</b>${escapeHtml(p.address_public||p.city||'京都府')}</div></div><div class="meta">${p.foreigner_allowed?`<span>${t.foreign}</span>`:''}${p.student_allowed?`<span>${t.student}</span>`:''}${(p.features||[]).map(x=>`<span>${escapeHtml(x)}</span>`).join('')}</div><button class="button" id="contact-toggle" style="width:100%;margin-top:14px" type="button">${t.contact}</button><div class="contact-options hidden" id="contact-options"><p>${t.contactTitle}</p><div class="contact-actions"><a class="button small" href="${inquiryUrl}">${t.contactForm}</a><a class="button secondary small" href="tel:+81757085269">${t.call}</a><button class="button secondary small" id="copy-email" type="button">${t.email}</button></div></div></aside></div>`;
  document.querySelectorAll('#thumbs button').forEach(button=>button.onclick=()=>{
    document.getElementById('gallery-main').innerHTML=mediaTag(items[+button.dataset.i],false);
    document.querySelectorAll('#thumbs button').forEach(item=>item.classList.remove('active'));
    button.classList.add('active');
  });
  document.getElementById('contact-toggle').onclick=()=>document.getElementById('contact-options').classList.toggle('hidden');
  document.getElementById('copy-email').onclick=async event=>{
    const email='info@zuihoudou.com';
    try{
      await navigator.clipboard.writeText(email);
    }catch(_error){
      const input=document.createElement('textarea');
      input.value=email;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      input.remove();
    }
    event.currentTarget.textContent=t.emailCopied;
  };
}

function applyPropertySeo(p,media){
  const title=titleOf(p);
  const description=(descOf(p)||`${title}。瑞鳳堂株式会社がご案内する京都の物件情報です。`).replace(/\s+/g,' ').trim().slice(0,155);
  const canonical=new URL('property.html',location.origin+'/');
  canonical.searchParams.set('id',p.id);
  canonical.searchParams.set('lang',lang);
  document.querySelector('meta[name="description"]').setAttribute('content',description);
  document.querySelector('link[rel="canonical"]').setAttribute('href',canonical.href);
  const images=(media||[]).filter(x=>x.media_type!=='video').map(x=>x.file_url).filter(Boolean);
  if(!images.length&&p.cover_image_url)images.push(p.cover_image_url);
  const schema={
    '@context':'https://schema.org',
    '@type':'RealEstateListing',
    name:title,
    description,
    url:canonical.href,
    identifier:p.property_code||String(p.id),
    image:images,
    datePosted:p.published_at||p.created_at,
    about:{
      '@type':'Accommodation',
      name:title,
      floorSize:p.area_sqm?{'@type':'QuantitativeValue',value:Number(p.area_sqm),unitCode:'MTK'}:undefined,
      address:{'@type':'PostalAddress',addressLocality:p.city||'京都市',streetAddress:p.address_public||'',addressRegion:'京都府',addressCountry:'JP'}
    },
    offers:{
      '@type':'Offer',
      price:Number(p.business_type==='sale'?p.sale_price:p.rent)||undefined,
      priceCurrency:'JPY',
      availability:'https://schema.org/InStock',
      url:canonical.href
    }
  };
  const script=document.createElement('script');
  script.type='application/ld+json';
  script.id='property-structured-data';
  script.textContent=JSON.stringify(schema);
  document.head.appendChild(script);
}

function mediaTag(m,thumb){return m.media_type==='video'?`<video ${thumb?'muted':'controls'} preload="metadata" src="${encodeURI(m.file_url)}"></video>`:`<img src="${encodeURI(m.file_url)}" alt="" loading="${thumb?'lazy':'eager'}">`}
function escapeHtml(v){return String(v||'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function fail(m){document.getElementById('detail').innerHTML=`<div class="empty-state">${m}</div>`}
loadDetail();
