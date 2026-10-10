import { io } from 'socket.io-client';

if (!window.__togetherInitialized) {
 window.__togetherInitialized = true;
 let socket=null, room=null, myId=null, muted=true, localStream=null, lockedUntil=0;
 let video=null, lastId=null, lastTime=0, lastRate=1, previousPause=null, currentServer='http://localhost:3100';
 let peerConnections=new Map(), remoteAudios=new Map();
 const host=document.createElement('div'); host.id='together-extension-root';document.documentElement.appendChild(host);
 const shadow=host.attachShadow({mode:'open'});
 const styles=`
 *{box-sizing:border-box}button,input,textarea,select{font:inherit}button{cursor:pointer}#fab{position:fixed;bottom:24px;right:24px;border:0;background:#f7f7f5;color:#151515;padding:12px 17px;border-radius:999px;box-shadow:0 8px 30px #0004;font:600 14px system-ui;z-index:2147483646}#panel{position:fixed;right:24px;bottom:79px;width:min(370px,calc(100vw - 32px));max-height:min(690px,calc(100vh - 106px));display:none;overflow:auto;background:#17191e;color:#f8f8f8;box-shadow:0 15px 55px #0009;border:1px solid #43454c;border-radius:18px;z-index:2147483647;font:13px system-ui,sans-serif;}#panel.open{display:block}.head{display:flex;align-items:center;justify-content:space-between;padding:17px 18px;border-bottom:1px solid #33363d}.brand{font-weight:750;font-size:18px;letter-spacing:-.5px}.sub{font-size:11px;color:#abb1bd;margin-top:3px}.body{padding:15px 18px}.row{display:flex;gap:9px;align-items:center}.between{justify-content:space-between}.stack{display:grid;gap:10px}.input{background:#262930;color:white;border:1px solid #424651;border-radius:9px;padding:10px;width:100%;outline:none;min-width:0}.input:focus{border-color:#b2bedc}.small{font-size:11px;color:#aab0bb}label{display:grid;gap:5px;font-size:12px;color:#ced2dc}.primary{background:#eaf0ff;color:#101828;border:0;border-radius:9px;padding:11px 12px;font-weight:700}.secondary{background:#30343c;color:white;border:1px solid #4b505b;border-radius:9px;padding:9px 11px}.ghost{background:none;border:0;color:#bbb;font-size:20px}.tab{flex:1;background:#272a31;border:1px solid #424651;color:#d3d8e3;border-radius:9px;padding:9px 5px}.tab.active{background:#eaf0ff;color:#121622}.chip{background:#2b3038;border:1px solid #404754;padding:6px 9px;border-radius:999px;color:#dedee8;font-size:11px}.section{border-top:1px solid #36393f;padding-top:12px;margin-top:12px}.section-title{font-weight:700;margin-bottom:9px}.feed{height:130px;overflow:auto;display:grid;align-content:start;gap:8px;padding:9px;background:#202329;border-radius:9px}.item{font-size:12px;color:#d8dce5;overflow-wrap:anywhere}.item b{color:#fff}.muted{color:#a6aeb9;font-size:11px}.pill{color:#a4dbb3}.hidden{display:none!important}.perms{display:grid;grid-template-columns:1fr 1fr;gap:8px}.perms label{display:flex;align-items:center;gap:5px}.perms input{accent-color:#b9cdfb}.notice{font-size:11px;color:#c8c5a7}.error{color:#ffaca8;font-size:12px}.noteTime{color:#a9c7ff;cursor:pointer;text-decoration:underline}#voiceList{display:flex;flex-wrap:wrap;gap:6px}#voiceList .chip{padding:6px}#close{color:#eee} `;
 shadow.innerHTML=`<style>${styles}</style><button id="fab" type="button">◉ Together</button><section id="panel" aria-label="Together room">
 <div class="head"><div><div class="brand">Together <span style="font-size:10px;color:#a4dbb3">BETA</span></div><div class="sub">YouTube, but together.</div></div><button id="close" class="ghost" aria-label="Close">×</button></div>
 <div class="body" id="setup"><div class="stack">
 <label>Your display name<input id="name" class="input" maxlength="24" placeholder="Your name" value="Guest"></label>
 <label>Realtime server URL<input id="server" class="input" value="http://localhost:3100" spellcheck="false"></label>
 <div class="row"><button id="social" class="tab active">🍿 Watch Party</button><button id="study" class="tab">📚 Study Room</button></div>
 <button id="create" class="primary">Create a room</button><div class="small" style="text-align:center">— or join your friends —</div>
 <div class="row"><input id="code" class="input" maxlength="12" placeholder="Room code"><button id="join" class="secondary">Join</button></div>
 <div id="setup-error" class="error"></div><div class="notice">Your video stays on YouTube. Room chat and notes are sent to the selected server.</div>
 </div></div>
 <div class="body hidden" id="inside">
 <div class="row between"><div><strong id="room-code">ROOM</strong> <span id="room-mode" class="chip">Watch Party</span><div id="host-label" class="sub"></div></div><button class="secondary" id="copy">Copy code</button></div>
 <div class="section"><div class="section-title">Watching together <span class="pill" id="status">● Connected</span></div><div id="voiceList"></div>
 <div class="row" style="margin-top:10px"><button class="secondary" id="mic">🎙 Turn mic on</button><button class="secondary" id="resync">↻ Resync</button><button class="secondary" id="leave">Leave</button></div></div>
 <div id="host-area" class="section hidden"><div class="section-title">Host controls</div><div class="row" style="margin-bottom:9px"><button id="mode-social" class="tab">🍿 Watch</button><button id="mode-study" class="tab">📚 Study</button></div><div class="perms">
 <label><input type="checkbox" data-perm="pause"> Guest pause</label><label><input type="checkbox" data-perm="seek"> Guest seek</label>
 <label><input type="checkbox" data-perm="speed"> Guest speed</label><label><input type="checkbox" data-perm="video"> Guest video</label>
 </div></div>
 <div class="section"><div class="section-title">Room chat</div><div id="chat-feed" class="feed"></div><form id="chat-form" class="row" style="margin-top:8px"><input class="input" id="chat-input" maxlength="1000" placeholder="Say something…" required><button class="primary">Send</button></form></div>
 <div class="section hidden" id="study-area"><div class="section-title">Shared timestamped notes</div><div id="note-feed" class="feed"></div><form id="note-form" class="row" style="margin-top:8px"><input class="input" id="note-input" maxlength="500" placeholder="Note this moment…" required><button class="primary">Save</button></form></div>
 <div class="notice" style="margin-top:12px">If YouTube buffers or shows ads, use Resync. Voice may require browser permission.</div>
 </div></section>`;
 const $=id=>shadow.getElementById(id);
 const escapeText=(element,text)=>{element.textContent=text;};
 let preferredMode='social';
 const setOpen=open=>$('panel').classList.toggle('open',open);
 $('fab').onclick=()=>setOpen(!$('panel').classList.contains('open'));
 $('close').onclick=()=>setOpen(false);
 const setPreferred=mode=>{preferredMode=mode;$('social').classList.toggle('active',mode==='social');$('study').classList.toggle('active',mode==='study');};
 $('social').onclick=()=>setPreferred('social');$('study').onclick=()=>setPreferred('study');
 const currentVideo=()=>document.querySelector('video.html5-main-video')||document.querySelector('video');
 function currentId(){return new URL(location.href).searchParams.get('v')||null;}
 function emitAction(action,data={}) {if(socket?.connected&&room&&can(action))socket.emit('playback:action',{action,...data});}
 function can(action){const key={play:'pause',pause:'pause',seek:'seek',speed:'speed',video:'video'}[action];return !!room&&(room.host===myId||!!room.permissions[key]);}
 function withLock(fn){lockedUntil=Date.now()+1100;fn();}
 function pushFeed(feed,entry,isNote){
   const el=document.createElement('div');el.className='item';
   const name=document.createElement('b');name.textContent=entry.by+': ';el.append(name);
   if(isNote){const time=document.createElement('span');time.className='noteTime';time.textContent=`[${Math.floor(entry.time/60)}:${String(Math.floor(entry.time%60)).padStart(2,'0')}] `;
     time.onclick=()=>{if(can('seek'))emitAction('seek',{time:entry.time});else $('status').textContent='Host has locked seeking';};el.append(time);}
   const message=document.createElement('span');message.textContent=entry.message;el.append(message);feed.append(el);feed.scrollTop=feed.scrollHeight;
 }
 function drawRoom(){ if(!room)return;
   $('room-code').textContent=room.code;$('room-mode').textContent=room.mode==='study'?'📚 Study':'🍿 Watch';
   $('host-label').textContent=room.host===myId?'You are the host':'Guest controls depend on host';
   $('host-area').classList.toggle('hidden',room.host!==myId);
   $('study-area').classList.toggle('hidden',room.mode!=='study');
   $('mode-social').classList.toggle('active',room.mode==='social');$('mode-study').classList.toggle('active',room.mode==='study');
   for(const key of ['pause','seek','speed','video']) {const item=shadow.querySelector(`[data-perm="${key}"]`);item.checked=!!room.permissions[key];}
   $('voiceList').replaceChildren();
   for(const p of room.people){const el=document.createElement('span');el.className='chip';el.textContent=`${p.mic?'🎙':'🔇'} ${p.name}${p.id===room.host?' ★':''}${p.id===myId?' (you)':''}`;$('voiceList').append(el);}
 }
 function resetRoom(){
   for(const pc of peerConnections.values())pc.close();peerConnections.clear();
   for(const el of remoteAudios.values())el.remove();remoteAudios.clear();
   if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;}
   muted=true;$('mic').textContent='🎙 Turn mic on';room=null;myId=null;
   $('setup').classList.remove('hidden');$('inside').classList.add('hidden');
 }
 function expected(p){return Math.max(0,p.time+(p.paused?0:(Date.now()-p.updatedAt)/1000*p.rate));}
 function applyPlayback(p){const v=currentVideo();if(!v||!p)return;
   if(p.videoId && p.videoId!==currentId()){withLock(()=>{location.href=`https://www.youtube.com/watch?v=${encodeURIComponent(p.videoId)}`;});return;}
   const target=expected(p);
   withLock(()=>{
     if(Math.abs(v.currentTime-target)>0.75&&Number.isFinite(target))v.currentTime=target;
     if(Math.abs(v.playbackRate-p.rate)>0.01)v.playbackRate=p.rate;
     if(p.paused&&!v.paused)v.pause();
     else if(!p.paused&&v.paused)v.play().catch(()=>{$('status').textContent='Click YouTube play to enable';});
   });
 }
 function bindVideo(){
   const v=currentVideo();if(!v||v===video)return;
   if(video){video.removeEventListener('play',onPlay);video.removeEventListener('pause',onPause);video.removeEventListener('seeked',onSeek);video.removeEventListener('ratechange',onRate);}
   video=v;lastTime=v.currentTime;lastRate=v.playbackRate;previousPause=v.paused;
   v.addEventListener('play',onPlay);v.addEventListener('pause',onPause);v.addEventListener('seeked',onSeek);v.addEventListener('ratechange',onRate);
 }
 function onPlay(){if(Date.now()>lockedUntil)emitAction('play');previousPause=false;}
 function onPause(){if(Date.now()>lockedUntil)emitAction('pause');previousPause=true;}
 function onSeek(){if(Date.now()>lockedUntil)emitAction('seek',{time:video.currentTime});lastTime=video.currentTime;}
 function onRate(){if(Date.now()>lockedUntil)emitAction('speed',{rate:video.playbackRate});lastRate=video.playbackRate;}
 function activate(snapshot,id){room=snapshot;myId=id;$('setup').classList.add('hidden');$('inside').classList.remove('hidden');
   $('chat-feed').replaceChildren();$('note-feed').replaceChildren();room.chats.forEach(m=>pushFeed($('chat-feed'),m,false));room.notes.forEach(n=>pushFeed($('note-feed'),n,true));
   drawRoom();applyPlayback(room.playback);}
 function connect(code,make){
   const server=$('server').value.trim().replace(/\/$/,'');
   if(!/^https?:\/\//.test(server)){$('setup-error').textContent='Enter an http(s) server URL.';return;}
   if(!/^https:\/\//.test(server)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(server)){
      $('setup-error').textContent='Remote servers must use HTTPS.';return;
   }
   $('setup-error').textContent='Connecting…';
   socket?.disconnect();
   currentServer=server;socket=io(server,{transports:['websocket','polling'],timeout:6000,reconnectionAttempts:8});
   socket.on('connect',()=>{socket.emit('room:join',{code,name:$('name').value,mode:preferredMode,videoId:currentId(),time:currentVideo()?.currentTime||0,paused:currentVideo()?.paused??true},reply=>{
      if(!reply?.ok){$('setup-error').textContent=reply?.error||'Could not join room.';return;}
      $('setup-error').textContent='';sessionStorage.setItem('togetherResume',JSON.stringify({code:reply.snapshot.code,name:$('name').value,server,mode:reply.snapshot.mode}));activate(reply.snapshot,reply.id);
    });});
   socket.on('connect_error',err=>{$('setup-error').textContent=`Cannot connect: ${err.message}`;$('status').textContent='Disconnected';});
   socket.on('disconnect',()=>{$('status').textContent='● Reconnecting…';});
   socket.on('room:state',data=>{if(!room)return;const old=room.people||[];room=data;drawRoom();if(localStream) syncPeers(old,data.people);});
   socket.on('playback:sync',p=>{if(room){room.playback=p;applyPlayback(p);$('status').textContent='● Synced';}});
   socket.on('chat:new',m=>{if(room)pushFeed($('chat-feed'),m,false);});
   socket.on('note:new',n=>{if(room)pushFeed($('note-feed'),n,true);});
   socket.on('voice:signal',signal=>{if(room)handleSignal(signal).catch(console.error);});
   socket.on('voice:left',({id})=>closePeer(id));
 }
 function codeGen(){const alpha='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';return Array.from(crypto.getRandomValues(new Uint8Array(6)),v=>alpha[v%alpha.length]).join('');}
 $('create').onclick=()=>connect(codeGen(),true);
 $('join').onclick=()=>connect($('code').value.trim().toUpperCase(),false);
 $('copy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);$('copy').textContent='Copied!';setTimeout(()=>$('copy').textContent='Copy code',1200);}catch{$('copy').textContent=room.code;}};
 $('leave').onclick=()=>{sessionStorage.removeItem('togetherResume');socket?.emit('room:leave');socket?.disconnect();resetRoom();};
 $('resync').onclick=()=>socket?.emit('playback:request');
 $('chat-form').onsubmit=e=>{e.preventDefault();const el=$('chat-input');if(el.value.trim())socket?.emit('chat:send',el.value.trim());el.value='';};
 $('note-form').onsubmit=e=>{e.preventDefault();const el=$('note-input');if(el.value.trim())socket?.emit('note:add',{message:el.value.trim(),time:currentVideo()?.currentTime||0});el.value='';};
 for(const key of ['pause','seek','speed','video'])shadow.querySelector(`[data-perm="${key}"]`).onchange=e=>socket?.emit('room:permissions',{[key]:e.target.checked});
 $('mode-social').onclick=()=>socket?.emit('room:mode','social');$('mode-study').onclick=()=>socket?.emit('room:mode','study');
 async function getPeer(id){
   if(peerConnections.has(id))return peerConnections.get(id);
   const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});peerConnections.set(id,pc);
   pc.onicecandidate=e=>{if(e.candidate)socket?.emit('voice:signal',{to:id,type:'candidate',data:e.candidate.toJSON()});};
   pc.ontrack=e=>{let audio=remoteAudios.get(id);if(!audio){audio=document.createElement('audio');audio.autoplay=true;audio.controls=false;audio.style.display='none';shadow.append(audio);remoteAudios.set(id,audio);}audio.srcObject=e.streams[0];audio.play().catch(()=>{$('status').textContent='Click to enable voice audio';});};
   if(localStream)localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
   return pc;
 }
 function closePeer(id){peerConnections.get(id)?.close();peerConnections.delete(id);remoteAudios.get(id)?.remove();remoteAudios.delete(id);}
 async function callPeer(id){if(!localStream)return;const pc=await getPeer(id);const offer=await pc.createOffer();await pc.setLocalDescription(offer);socket?.emit('voice:signal',{to:id,type:'offer',data:pc.localDescription.toJSON()});}
 async function handleSignal({from,type,data}){
   if(type==='offer') {const pc=await getPeer(from);await pc.setRemoteDescription(data);
     const answer=await pc.createAnswer();await pc.setLocalDescription(answer);socket?.emit('voice:signal',{to:from,type:'answer',data:pc.localDescription.toJSON()});}
   if(type==='answer'){const pc=peerConnections.get(from);if(pc && pc.signalingState==='have-local-offer')await pc.setRemoteDescription(data);}
   if(type==='candidate'){const pc=await getPeer(from);try{await pc.addIceCandidate(data);}catch(e){console.warn('Together ICE candidate',e);}}
 }
 async function syncPeers(old,now){
   const ids=new Set(now.map(p=>p.id));for(const id of peerConnections.keys())if(!ids.has(id))closePeer(id);
   for(const p of now){if(p.id!==myId && p.mic && !peerConnections.has(p.id) && myId<p.id)await callPeer(p.id);}
 }
 $('mic').onclick=async()=>{
   if(!room)return;
   if(localStream){localStream.getTracks().forEach(t=>t.stop());localStream=null;muted=true;
     for(const id of peerConnections.keys())closePeer(id);
     socket?.emit('voice:mic',false);$('mic').textContent='🎙 Turn mic on';return;}
   try{localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});
      muted=false;socket?.emit('voice:mic',true);$('mic').textContent='🔇 Turn mic off';
      for(const p of room.people)if(p.id!==myId)await callPeer(p.id);
   }catch(e){$('status').textContent='Microphone blocked/unavailable';console.warn(e);}
 };
 // YouTube uses SPA navigation. Rebind the current video after navigation and sample drift.
 let observedUrl=location.href;
 setInterval(()=>{
   bindVideo();if(!room)return;
   if(location.href!==observedUrl){observedUrl=location.href;const id=currentId();if(id&&id!==lastId&&can('video')&&Date.now()>lockedUntil)emitAction('video',{videoId:id});lastId=id;}
   const v=currentVideo();if(v&&room.playback?.videoId===currentId()){
     const drift=Math.abs(v.currentTime-expected(room.playback));
     if(Date.now()>lockedUntil && drift>1.8 && !v.seeking)applyPlayback(room.playback);
     // Keep the server snapshot fresh (used as a baseline for future drift correction).
   }
 },1400);
 document.addEventListener('yt-navigate-finish',()=>setTimeout(bindVideo,300));
 lastId=currentId();bindVideo();
 try {const saved=JSON.parse(sessionStorage.getItem('togetherResume')||'null');if(saved?.code&&saved.server){$('name').value=saved.name||'Guest';$('server').value=saved.server;setPreferred(saved.mode==='study'?'study':'social');connect(saved.code,false);}}catch{}
}
