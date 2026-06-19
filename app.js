const config = window.BIO_CONFIG;
const $ = (id) => document.getElementById(id);
const icons = { discord: "◖◗", github: "⌘", instagram: "◎", website: "↗", twitter: "𝕏", youtube: "▷", email: "@" };
document.documentElement.style.setProperty("--accent", config.accent);
document.documentElement.style.setProperty("--accent-2", config.accentSecondary);
document.title = `${config.displayName} · bio`;
document.querySelector('meta[name="description"]').content = config.bio;
document.querySelector('meta[property="og:title"]').content = `${config.displayName} · bio`;
document.querySelector('meta[property="og:description"]').content = config.bio;

$("displayName").textContent = config.displayName;
$("handle").textContent = config.handle;
$("statusText").textContent = config.status;
$("bio").textContent = config.bio;
$("avatar").src = config.avatar;
$("entryText").textContent = config.entryText;
$("footerText").textContent = config.footerText;
$("badges").innerHTML = config.badges.map((b) => `<span class="badge" title="${b.label}"><span>${b.icon}</span>${b.label}</span>`).join("");
$("links").innerHTML = config.links.map((l) => `<a class="link" href="${l.url}" target="_blank" rel="noopener noreferrer"><span class="link-icon">${icons[l.icon] || "↗"}</span><span class="link-copy"><strong>${l.name}</strong><small>${l.label}</small></span></a>`).join("");

const videoConfig = config.backgroundVideo;
const backgroundVideo = $("backgroundVideo");
if (videoConfig?.enabled && videoConfig.src) {
  $("videoBackground").hidden = false;
  $("videoBackground").style.setProperty("--video-opacity", videoConfig.opacity ?? 0.62);
  backgroundVideo.src = videoConfig.src;
  if (videoConfig.poster) backgroundVideo.poster = videoConfig.poster;
  backgroundVideo.playbackRate = videoConfig.playbackRate || 1;
}

const audio = $("audio");
if (config.audio.enabled) {
  audio.src = config.audio.src; audio.volume = config.audio.volume;
  $("trackTitle").textContent = config.audio.title; $("trackArtist").textContent = config.audio.artist;
} else $("player").hidden = true;

const statusColors = { online: "#35d07f", idle: "#f2b84b", dnd: "#ef5350", offline: "#73737d" };
function discordAvatar(user) {
  if (!user.avatar) return `https://cdn.discordapp.com/embed/avatars/${Number(user.discriminator || 0) % 5}.png`;
  const extension = user.avatar.startsWith("a_") ? "gif" : "webp";
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.${extension}?size=256`;
}
function activityImage(activity) {
  const image = activity.assets?.large_image;
  if (!image) return "";
  if (image.startsWith("mp:")) return `https://media.discordapp.net/${image.slice(3)}`;
  if (image.startsWith("spotify:")) return `https://i.scdn.co/image/${image.slice(8)}`;
  return activity.application_id ? `https://cdn.discordapp.com/app-assets/${activity.application_id}/${image}.webp` : "";
}
function renderActivity(data) {
  const custom = data.activities.find((item) => item.type === 4);
  const active = data.spotify || data.activities.find((item) => item.type !== 4);
  if (!active && !custom) { $("activity").hidden = true; return; }
  const item = active || custom;
  const types = ["PLAYING", "STREAMING", "LISTENING TO", "WATCHING", "CUSTOM STATUS", "COMPETING IN"];
  $("activityType").textContent = data.spotify ? "LISTENING TO SPOTIFY" : (types[item.type] || "ACTIVE");
  $("activityName").textContent = data.spotify?.song || item.name || "Discord";
  $("activityDetails").textContent = data.spotify?.artist || item.details || item.state || "";
  const image = data.spotify?.album_art_url || activityImage(item);
  $("activityArt").innerHTML = image ? `<img src="${image}" alt="">` : "◈";
  $("activity").hidden = false;
}
async function loadDiscord() {
  const live = config.discordLive;
  if (!live?.enabled || !/^\d{17,20}$/.test(config.discordUserId)) return;
  try {
    const response = await fetch(`https://api.lanyard.rest/v1/users/${config.discordUserId}`);
    if (!response.ok) throw new Error("Discord profile request failed");
    const payload = await response.json();
    if (!payload.success) throw new Error("Discord user is not available through Lanyard");
    const data = payload.data, user = data.discord_user;
    if (live.useDisplayName) $("displayName").textContent = user.global_name || user.display_name || user.username;
    if (live.useUsername) $("handle").textContent = `@${user.username}`;
    if (live.useAvatar) $("avatar").src = discordAvatar(user);
    if (live.useStatus) {
      $("statusText").textContent = data.discord_status;
      const color = statusColors[data.discord_status] || statusColors.offline;
      document.querySelectorAll(".status i,.presence").forEach((el) => { el.style.background=color; el.style.boxShadow=`0 0 12px ${color}`; });
    }
    if (live.showActivity) renderActivity(data);
  } catch (error) { console.warn(error.message); }
}
loadDiscord();
if (config.discordLive?.refreshSeconds) setInterval(loadDiscord, Math.max(15, config.discordLive.refreshSeconds) * 1000);

function toast(message) { const el=$("toast"); el.textContent=message; el.classList.add("show"); clearTimeout(toast.timer); toast.timer=setTimeout(()=>el.classList.remove("show"),1800); }
$("enterButton").addEventListener("click", async () => {
  $("entry").classList.add("hidden"); $("page").classList.add("visible"); $("page").setAttribute("aria-hidden","false");
  if (videoConfig?.enabled) { try { await backgroundVideo.play(); } catch {} }
  if (config.audio.enabled && config.audio.autoplayAfterEntry) { try { await audio.play(); } catch {} }
});
$("copyHandle").addEventListener("click", async () => { await navigator.clipboard.writeText($("handle").textContent.replace(/^@/,"")); toast("Discord username copied"); });
$("shareButton").addEventListener("click", async () => { if (navigator.share) await navigator.share({title:document.title,url:location.href}); else { await navigator.clipboard.writeText(location.href); toast("Profile link copied"); } });
$("effectsButton").addEventListener("click", () => { document.body.classList.toggle("effects-off"); toast(document.body.classList.contains("effects-off")?"Effects off":"Effects on"); });
$("playButton").addEventListener("click", () => audio.paused ? audio.play() : audio.pause());
$("volumeButton").addEventListener("click", () => { audio.muted=!audio.muted; $("volumeButton").textContent=audio.muted?"×":"♪"; });
audio.addEventListener("play",()=>$("playButton").textContent="Ⅱ"); audio.addEventListener("pause",()=>$("playButton").textContent="▶");
audio.addEventListener("timeupdate",()=>{ const p=audio.duration?audio.currentTime/audio.duration*100:0; $("progressFill").style.width=`${p}%`; $("trackTime").textContent=`${Math.floor(audio.currentTime/60)}:${String(Math.floor(audio.currentTime%60)).padStart(2,"0")}`; });
$("progress").addEventListener("click",(e)=>{ if(audio.duration) audio.currentTime=(e.offsetX/e.currentTarget.clientWidth)*audio.duration; });

let word=0,letter=0,deleting=false;
function type() { const text=config.typing[word]||""; $("typedText").textContent=text.slice(0,letter); if(!deleting&&letter<text.length) letter++; else if(!deleting){deleting=true;return setTimeout(type,1300)} else if(letter>0) letter--; else {deleting=false;word=(word+1)%config.typing.length} setTimeout(type,deleting?45:85); }
type();

const count=Number(localStorage.getItem("bio_views")||0)+1; localStorage.setItem("bio_views",count); $("viewCount").textContent=count.toLocaleString();
const card=$("profileCard");
if(config.effects.tilt && matchMedia("(pointer:fine)").matches){ card.addEventListener("pointermove",e=>{const r=card.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;card.style.setProperty("--x",`${x*100}%`);card.style.setProperty("--y",`${y*100}%`);card.style.transform=`rotateX(${(0.5-y)*5}deg) rotateY(${(x-0.5)*5}deg)`}); card.addEventListener("pointerleave",()=>card.style.transform=""); }

const canvas=$("particles"),ctx=canvas.getContext("2d"); let dots=[];
function size(){canvas.width=innerWidth*devicePixelRatio;canvas.height=innerHeight*devicePixelRatio;ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);dots=Array.from({length:Math.min(75,Math.floor(innerWidth/16))},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,r:Math.random()*1.3+.3,v:Math.random()*.18+.05}))}
function draw(){ctx.clearRect(0,0,innerWidth,innerHeight);ctx.fillStyle="rgba(255,255,255,.3)";dots.forEach(d=>{d.y-=d.v;if(d.y<0)d.y=innerHeight;ctx.beginPath();ctx.arc(d.x,d.y,d.r,0,7);ctx.fill()});requestAnimationFrame(draw)}
if(config.effects.particles){addEventListener("resize",size);size();draw()}
