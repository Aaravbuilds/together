import express from 'express';
import { createServer } from 'node:http';
import { Server } from 'socket.io';

const app = express();
const http = createServer(app);
const io = new Server(http, { cors: { origin: '*', methods: ['GET','POST'] }, maxHttpBufferSize: 20_000 });
const rooms = new Map();
const MAX_PEOPLE = 8;
const clean = (x, max = 200) => String(x ?? '').trim().slice(0, max);
const time = x => Number.isFinite(Number(x)) ? Math.max(0, Math.min(86400, Number(x))) : 0;
const videoId = x => /^[a-zA-Z0-9_-]{11}$/.test(String(x ?? '')) ? String(x) : null;
function settings(mode) { return mode === 'study'
  ? { pause:true, seek:false, speed:false, video:false }
  : { pause:true, seek:true, speed:false, video:false }; }
function getRoom(s) { return s.data.room ? rooms.get(s.data.room) : null; }
function people(room) { return [...room.people.entries()].map(([id, p]) => ({id, name:p.name, mic:p.mic})); }
function snapshot(room) { return { code:room.code, mode:room.mode, host:room.host, permissions:room.permissions,
  people:people(room), playback:room.playback, chats:room.chats, notes:room.notes }; }
function currentPlayback(room) {
  const p = room.playback;
  return {...p, time: p.paused ? p.time : p.time + (Date.now()-p.updatedAt)/1000*p.rate, updatedAt:Date.now()};
}
function publish(room) { io.to(room.code).emit('room:state', snapshot(room)); }
function leave(socket) {
  const room = getRoom(socket); if (!room) return;
  room.people.delete(socket.id); socket.leave(room.code);
  socket.to(room.code).emit('voice:left', {id:socket.id});
  socket.data.room = undefined;
  if (!room.people.size) rooms.delete(room.code);
  else { if (room.host === socket.id) room.host = room.people.keys().next().value; publish(room); }
}
app.get('/health', (_req,res) => res.json({ok:true,rooms:rooms.size}));
io.on('connection', s => {
  s.on('room:join', (data={}, reply=()=>{}) => {
    leave(s);
    const code = clean(data.code,12).toUpperCase();
    if (!/^[A-Z0-9]{4,12}$/.test(code)) return reply({ok:false,error:'Room code must contain 4–12 letters or numbers.'});
    let room = rooms.get(code);
    if (room && room.people.size >= MAX_PEOPLE) return reply({ok:false,error:'Room is full (8 participants).'});
    if (!room) {
      const mode = data.mode === 'study' ? 'study' : 'social';
      room = {code,mode,host:s.id,permissions:settings(mode),people:new Map(),chats:[],notes:[],
        playback:{videoId:videoId(data.videoId),time:time(data.time),paused:!!data.paused,rate:1,updatedAt:Date.now()}};
      rooms.set(code,room);
    }
    room.people.set(s.id,{name:clean(data.name,24)||'Guest',mic:false});
    s.data.room=code; s.join(code);
    reply({ok:true,id:s.id,snapshot:snapshot(room)});
    publish(room);
  });
  s.on('room:leave', () => leave(s));
  s.on('room:mode', value => { const r=getRoom(s); if (!r || s.id!==r.host || !['social','study'].includes(value)) return;
    r.mode=value; r.permissions=settings(value);publish(r); });
  s.on('room:permissions', value => { const r=getRoom(s);if (!r||s.id!==r.host||!value||typeof value!=='object') return;
    for (const key of ['pause','seek','speed','video']) if(typeof value[key]==='boolean') r.permissions[key]=value[key];
    publish(r); });
  s.on('playback:action', value => {
    const r=getRoom(s);if(!r||!value||typeof value!=='object') return;
    const action=clean(value.action,20);
    const category={play:'pause',pause:'pause',seek:'seek',speed:'speed',video:'video'}[action];
    if(!category || (s.id!==r.host && !r.permissions[category])) return;
    const before=currentPlayback(r);
    if(action==='play'||action==='pause') r.playback={...before,paused:action==='pause',updatedAt:Date.now()};
    if(action==='seek') r.playback={...before,time:time(value.time),updatedAt:Date.now()};
    if(action==='speed') {
      const rate=Number(value.rate);if(!Number.isFinite(rate)||rate<0.25||rate>2) return;
      r.playback={...before,rate,updatedAt:Date.now()};
    }
    if(action==='video') {
      const id=videoId(value.videoId);if(!id) return;
      r.playback={videoId:id,time:0,paused:false,rate:1,updatedAt:Date.now()};
    }
    io.to(r.code).emit('playback:sync',r.playback);
  });
  s.on('playback:request', () => { const r=getRoom(s);if(r) s.emit('playback:sync',currentPlayback(r)); });
  s.on('chat:send', value => { const r=getRoom(s);if(!r)return;const message=clean(value,1000);if(!message)return;
    const entry={id:crypto.randomUUID(),by:r.people.get(s.id)?.name||'Guest',message,at:Date.now()};
    r.chats.push(entry);r.chats=r.chats.slice(-60);io.to(r.code).emit('chat:new',entry);
  });
  s.on('note:add', value => { const r=getRoom(s);if(!r||r.mode!=='study')return;
    const message=clean(value?.message,500);if(!message)return;
    const entry={id:crypto.randomUUID(),by:r.people.get(s.id)?.name||'Guest',message,time:time(value?.time),at:Date.now(),videoId:r.playback.videoId};
    r.notes.push(entry);r.notes=r.notes.slice(-100);io.to(r.code).emit('note:new',entry);
  });
  s.on('voice:mic', mic => { const r=getRoom(s);if(!r)return;const p=r.people.get(s.id);if(p){p.mic=!!mic;publish(r);} });
  s.on('voice:signal', value => { const r=getRoom(s);if(!r||!value||typeof value!=='object')return;
    if(typeof value.to!=='string'||!r.people.has(value.to)||!['offer','answer','candidate'].includes(value.type))return;
    io.to(value.to).emit('voice:signal',{from:s.id,type:value.type,data:value.data});
  });
  s.on('disconnect',()=>leave(s));
});
const port=Number(process.env.PORT)||3100;
http.listen(port,()=>console.log(`Together room server listening on http://localhost:${port}`));
