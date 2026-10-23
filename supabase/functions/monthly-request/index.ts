// Supabase Edge Function: monthly-request
// Deploy with secrets SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TURNSTILE_SECRET_KEY,
// RESEND_API_KEY, NOTIFY_EMAIL. Set JWT verification off only for this public endpoint.
// The function validates all pricing server-side; no browser write access to requests.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors={'Access-Control-Allow-Origin':'https://zuihoudou.com','Access-Control-Allow-Headers':'content-type,authorization,apikey','Access-Control-Allow-Methods':'POST,OPTIONS'};
const reply=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json'}});
const day=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&!Number.isNaN(Date.parse(s+'T00:00:00Z'))?Date.parse(s+'T00:00:00Z'):NaN;
Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{headers:cors});
 if(req.method!=='POST')return reply({error:'Method not allowed'},405);
 const origin=req.headers.get('origin');if(origin!=='https://zuihoudou.com')return reply({error:'Invalid origin'},403);
 try{
 const data=await req.json();
 const {property_id,start_date,end_date,guests,guest_name,guest_email,message='',turnstile_token}=data||{};
 if(typeof property_id!=='string'||! /^[0-9a-f-]{36}$/i.test(property_id)||typeof guest_name!=='string'||guest_name.trim().length<1||guest_name.length>120||typeof guest_email!=='string'||! /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guest_email)||guest_email.length>254||typeof message!=='string'||message.length>2000)return reply({error:'Invalid application'},400);
 const start=day(start_date),end=day(end_date),n=(end-start)/86400000;
 if(!Number.isInteger(n)||n<1||n>3650||!Number.isInteger(guests)||guests<1||guests>30||start<Date.now()-86400000)return reply({error:'Invalid dates or guests'},400);
 const secret=Deno.env.get('TURNSTILE_SECRET_KEY');if(!secret)return reply({error:'Booking verification is not configured'},503);
 if(typeof turnstile_token!=='string'||!turnstile_token)return reply({error:'Verification required'},400);
 const check=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({secret,response:turnstile_token})});const valid=await check.json();if(!valid.success||valid.hostname!=='zuihoudou.com')return reply({error:'Verification failed'},403);
 const url=Deno.env.get('SUPABASE_URL'),key=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(!url||!key)return reply({error:'Service unavailable'},503);
 const db=createClient(url,key,{auth:{persistSession:false}});
 const [{data:p,error:pe},{data:s,error:se}]=await Promise.all([db.from('properties').select('id,status,business_type').eq('id',property_id).single(),db.from('monthly_settings').select('*').eq('property_id',property_id).single()]);
 if(pe||se||p?.status!=='published'||p?.business_type!=='short'||!s?.enabled)return reply({error:'Listing unavailable'},404);
 if(n<Number(s.min_nights)||guests>Number(s.max_guests))return reply({error:'Dates or guest count not permitted'},400);
 const {data:blocks,error:be}=await db.from('monthly_blocks').select('start_date,end_date').eq('property_id',property_id).lt('start_date',end_date).gt('end_date',start_date);
 if(be)return reply({error:'Availability unavailable'},503);
 if(blocks?.length)return reply({error:'Dates unavailable'},409);
 const {data:approved,error:ae}=await db.from('monthly_requests').select('id').eq('property_id',property_id).eq('status','approved').lt('start_date',end_date).gt('end_date',start_date).limit(1);
 if(ae)return reply({error:'Availability unavailable'},503);
 if(approved?.length)return reply({error:'Dates unavailable'},409);
 const peaks=Array.isArray(s.peak_periods)?s.peak_periods:[];let peakN=0;for(let t=start;t<end;t+=86400000){const d=new Date(t).toISOString().slice(0,10);if(peaks.some(x=>x&&typeof x.start==='string'&&typeof x.end==='string'&&d>=x.start&&d<x.end))peakN++}
 const total=Math.round(Number(s.monthly_rent)*n/30+n*(Number(s.utilities_per_person_day)+(guests-1)*Number(s.extra_person_day))+peakN*Number(s.peak_surcharge_day)+Number(s.deposit)+Number(s.contract_fee));
 if(!Number.isFinite(total)||total<0)return reply({error:'Pricing unavailable'},503);
 const {data:created,error:ie}=await db.from('monthly_requests').insert({property_id,start_date,end_date,guests,guest_name:guest_name.trim(),guest_email:guest_email.trim(),message,quote_total:total,status:'pending'}).select('id').single();
 if(ie)return reply({error:'Could not save request'},503);
 const api=Deno.env.get('RESEND_API_KEY'),to=Deno.env.get('NOTIFY_EMAIL');
 if(api&&to){try{await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+api,'Content-Type':'application/json'},body:JSON.stringify({from:'瑞鳳堂予約 <onboarding@resend.dev>',to:[to],subject:'月租预约申请 '+created.id,text:['申请编号: '+created.id,'房源: '+property_id,'入住: '+start_date,'退房: '+end_date,'人数: '+guests,'姓名: '+guest_name,'邮箱: '+guest_email,'试算: '+total+' JPY','留言: '+message].join('\n')})})}catch(e){console.error('Notification failed',e)}}
 return reply({ok:true,request_id:created.id,quote_total:total,status:'pending'},201);
 }catch(e){console.error(e);return reply({error:'Request failed'},400)}
});
