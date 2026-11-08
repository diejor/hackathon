"use client";
import { useState } from 'react';
import Link from 'next/link';
import { RedFlag, TACTICS, Tactic } from '../../src/contracts';
const flags:RedFlag[]=['sender_identity','url_domain','plausibility_bait','urgency_clause','authority_claim','payment_rail','reply_bait','personalization_overreach'];
const present:RedFlag[]=['sender_identity','url_domain','plausibility_bait','urgency_clause'];
const questions=[{id:'channel',label:'Can I verify this through our saved team directory?',answer:'The saved directory lists a different address.',score:1},{id:'detail',label:'Does the sender know a public project name?',answer:'Yes, the public project is Maple.',score:0.2},{id:'payment',label:'Does the request ask me to bypass normal approval?',answer:'Yes. The sender asks for immediate payment without approval.',score:0.9}];
export default function Games(){
 const [step,setStep]=useState(0);const [started,setStarted]=useState(Date.now());const [selected,setSelected]=useState<string[]>([]);const [asked,setAsked]=useState<number[]>([]);const [bot,setBot]=useState(false);const [defer,setDefer]=useState(false);const [guess,setGuess]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const toggle=(value:string)=>setSelected(old=>old.includes(value)?old.filter(v=>v!==value):[...old,value]);
 async function next(){setBusy(true);setError('');try{
 if(step===0){const response=await fetch('/api/player',{method:'POST'});if(!response.ok)throw new Error('Could not start session.');}
 else {const elapsedMs=Date.now()-started;let event;
 if(step===1)event={game:'scamdle',puzzleId:'parcelo-1',attempts:1,flagsFound:present.filter(f=>selected.includes(f)),flagsMissed:present.filter(f=>!selected.includes(f)),flagsFalsePositive:selected.filter(f=>!present.includes(f as RedFlag)),elapsedMs};
 if(step===2)event={game:'guesswho',roundId:'directory-1',questionsAsked:asked.map(i=>questions[i].id),questionsDiagnosticity:asked.map(i=>questions[i].score),guessedContactId:guess,correctContactId:'impostor',deferredToBot:defer,followedBotConsensus:bot&&(defer||guess==='colleague'),elapsedMs};
 if(step===3)event={game:'badscam',targetPersonaId:'synthetic-student',archetypeId:'toll-fee',tacticsChosen:selected as Tactic[],paymentRail:'card_fee',reachScore:selected.reduce((sum,t)=>sum+(['urgency_deadline','small_plausible_amount'].includes(t)?50:10),0),elapsedMs};
 const response=await fetch('/api/events',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(event)});if(!response.ok)throw new Error('Could not save game.');}
 setStep(step+1);setSelected([]);setStarted(Date.now());
 }catch(e){setError(e instanceof Error?e.message:'Please retry.');}finally{setBusy(false);}}
 return <main className="mx-auto max-w-2xl space-y-6 px-6 py-16"><Link href="/">Safe Signal</Link><h1 className="text-3xl font-bold">{['Train your scam radar','Scamdle','Guess Who','Build a Bad Scam','Training complete'][step]}</h1>
 {step===0&&<p>Three short games reveal the manipulation patterns you recognize. Build a personalized simulation after training.</p>}
 {step===1&&<><p className="rounded-xl bg-neutral-800 p-6">Parcelo. Your package is held. Pay $2.99 within 30 minutes at parcelo-fee.example.</p><p>Select the suspicious signals.</p>{flags.map(f=><label className="block" key={f}><input type="checkbox" checked={selected.includes(f)} onChange={()=>toggle(f)}/> {f.replaceAll('_',' ')}</label>)}</>}
 {step===2&&<><p>A message claiming to be your colleague asks for urgent payment. Investigate who sent it.</p>{questions.map((q,i)=><div key={q.id}><button className="underline" onClick={()=>setAsked(old=>old.includes(i)?old:[...old,i])}>{q.label}</button>{asked.includes(i)&&<p>{q.answer}</p>}</div>)}<button className="underline" onClick={()=>setBot(true)}>Ask the helper bot</button>{bot&&<p>The helper bot and two simulated teammates think it is your colleague. Their opinion may be wrong.</p>}<label className="block"><input type="checkbox" checked={defer} onChange={e=>{setDefer(e.target.checked);setBot(true);setGuess('colleague');}}/> Let the helper bot decide</label>{['colleague','impostor'].map(value=><label className="block" key={value}><input type="radio" name="guess" checked={guess===value} onChange={()=>{setGuess(value);setDefer(false);}}/> {value}</label>)}</>}
 {step===3&&<><p>A fictional toll notice asks a synthetic student to pay a small fee before a deadline. Choose up to two tactics that make it persuasive.</p>{TACTICS.map(t=><label className="block" key={t}><input type="checkbox" checked={selected.includes(t)} disabled={!selected.includes(t)&&selected.length===2} onChange={()=>toggle(t)}/> {t.replaceAll('_',' ')}</label>)}</>}
 {error&&<p role="alert">{error}</p>}{step<4?<button className="rounded bg-tmo-magenta px-6 py-3" disabled={busy||(step===2&&!guess)} onClick={()=>void next()}>{busy?'Saving…':step===0?'Start training':'Finish round'}</button>:<Link className="underline" href="/campaign">Build my campaign</Link>}</main>;
}
