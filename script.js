/* ============================================================
   EDIT CHARACTER DATA HERE
   - photos: image paths / public image URLs
   - videos: YouTube URL, embed URL, or local MP4 path
   Add a new object to create another character card + docs page.
   ============================================================ */
let characters = [];;

const $ = id => document.getElementById(id);
const welcome = $("welcome"), gallery = $("gallery"), docs = $("docs");
const grid = $("characterGrid"), routeTransition = $("routeTransition");
const overlay = $("detailOverlay"), lightbox = $("lightbox");
let currentCharacter = null, activePhotoIndex = 0, lastFocus = null, routeTimer = null;

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
async function loadCharacterData() {
  try {
    const manifestResponse = await fetch('./karakter/manifest.json');
    if (!manifestResponse.ok) throw new Error('manifest not found');
    const manifest = await manifestResponse.json();
    const folders = manifest.characters || [];
    const loaded = await Promise.all(folders.map(async folder => {
      const response = await fetch(`./karakter/${encodeURIComponent(folder)}/data.json`);
      if (!response.ok) return null;
      const data = await response.json();
      data.folder = folder;
      const base = `./karakter/${folder}/image/`;
      data.thumbnail = data.thumbnail || '';
      (data.photos || []).forEach((p) => { p.src = p.src || ''; });
      return data;
    }));
    characters.splice(0, characters.length, ...loaded.filter(Boolean));
    renderCards();
    if (window.renderRoute) window.renderRoute(false);
  } catch (error) { console.error('Gagal memuat karakter:', error); }
}

function getCharacter(id) { return characters.find(c => c.id === id); }
function currentRoute() {
  const raw = location.hash.replace(/^#\/?/, "");
  const parts = raw.split("/").filter(Boolean);
  if (!parts.length || parts[0] === "home") return { page: "home" };
  if (parts[0] === "docs" && parts[1]) return { page: "docs", id: parts[1], tab: parts[2] || "about" };
  if (parts[0] === "editor") return { page: "editor", id: parts[1] || "login", tab: parts[2] || "" };
  if (parts[0] === "karakter") return { page: "gallery" };
  if (parts[0] === "about" || parts[0] === "contact") return { page: "gallery", anchor: parts[0] };
  return { page: "gallery" };
}
function navigate(path, animate = true) {
  const target = `#/${path.replace(/^\/+|\/+$/g, "")}`;
  if (location.hash === target) { renderRoute(false); return; }
  if (!animate || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    location.hash = target;
    return;
  }
  clearTimeout(routeTimer);
  routeTransition.classList.remove("play");
  void routeTransition.offsetWidth;
  routeTransition.classList.add("play");
  document.body.classList.add("route-changing");
  routeTimer = setTimeout(() => {
    location.hash = target;
    routeTransition.classList.remove("play");
    document.body.classList.remove("route-changing");
  }, 390);
}
function showOnly(page) {
  welcome.classList.toggle("view-hidden", page !== "home");
  gallery.classList.toggle("view-hidden", page !== "gallery");
  docs.classList.toggle("view-hidden", page !== "docs");
  const editor = $("editorScreen");
  if (editor) editor.classList.toggle("view-hidden", page !== "editor");
}
let hoveredCardId = null;
function setCardAtmosphere(id) {
  const c = getCharacter(id), layer = $("galleryAtmosphere");
  if (!c || !layer) return;
  hoveredCardId = id;
  const image = c.thumbnail || c.photos?.find(p => p.src)?.src || "";
  const accent = c.accent || "#b67f98";
  layer.style.backgroundImage = image
    ? `radial-gradient(circle at 50% 45%, ${accent}44 0%, rgba(10, 9, 14, 0.82) 72%), linear-gradient(180deg, rgba(10, 9, 14, 0.52), rgba(10, 9, 14, 0.88)), url("${image.replace(/["\\]/g, "")}")`
    : `radial-gradient(ellipse at 50% 42%, ${accent}77 0%, ${accent}22 38%, rgba(11, 10, 15, 0.96) 75%), #111014`;
  layer.style.setProperty("--atmosphere-accent", accent);
  layer.classList.add("active");
}
function clearCardAtmosphere() {
  hoveredCardId = null;
  const layer = $("galleryAtmosphere");
  if (!layer) return;
  layer.classList.remove("active");
}

function renderCards() {
  grid.innerHTML = characters.map((c, i) => {
    const img = c.thumbnail || c.photos.find(p => p.src)?.src || "";
    const topFacts = (c.about?.facts || []).slice(0, 2);
    const pillsHtml = topFacts.map(([k, v]) => `<span class="card-fact-pill"><b>${escapeHtml(k)}:</b> ${escapeHtml(v)}</span>`).join("");
    return `<button class="character-card" type="button" data-character="${escapeHtml(c.id)}" style="--card-accent:${escapeHtml(c.accent)};animation-delay:${i * 90}ms" aria-label="Buka dokumentasi ${escapeHtml(c.name)}">
      <div class="card-art">
        <div class="card-holo-grid" aria-hidden="true"></div>
        <div class="card-portrait">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(c.name)}" loading="lazy">` : `<span class="card-initial-glyph">${escapeHtml(c.initial)}</span>`}</div>
      </div>
      <div class="card-topline">
        <span class="card-entry-badge">ENTRY / ${escapeHtml(c.number)}</span>
        <span class="card-tag-pill">${escapeHtml(c.tag || "ARCHIVE")}</span>
      </div>
      <span class="card-open" aria-hidden="true">↗</span>
      <div class="card-caption">
        <div class="card-name-wrap">
          <span class="card-subtitle">${escapeHtml(c.subtitle)}</span>
          <span class="card-name">${escapeHtml(c.name)}</span>
          <div class="card-facts-row">${pillsHtml}</div>
        </div>
        <p class="card-description">${escapeHtml(c.description)}</p>
      </div>
    </button>`;
  }).join("");

  if (!grid.dataset.clickHandlerAttached) {
    grid.addEventListener("click", event => {
      const card = event.target.closest("button[data-character]");
      if (!card || !grid.contains(card)) return;
      openDetail(card.dataset.character, card);
    });
    grid.addEventListener("pointerover", event => {
      const card = event.target.closest("button[data-character]");
      if (!card || !grid.contains(card) || card.contains(event.relatedTarget)) return;
      if (matchMedia("(hover: hover) and (pointer: fine)").matches) setCardAtmosphere(card.dataset.character);
    });
    grid.addEventListener("pointerout", event => {
      const card = event.target.closest("button[data-character]");
      if (!card || !grid.contains(card) || card.contains(event.relatedTarget)) return;
      clearCardAtmosphere();
    });
    grid.dataset.clickHandlerAttached = "true";
  }
  const count = String(characters.length).padStart(2, "0");
  $("navCount").textContent = count;
  $("mobileCount").textContent = count;
  $("entryCount").textContent = `${count} ENTRIES`;
  $("collectionCount").textContent = `001—${String(characters.length).padStart(3, "0")}`;
}
function openDetail(id, trigger) {
  const c=getCharacter(id); if(!c)return; currentCharacter=c; lastFocus=trigger||document.activeElement;
  const portrait=c.thumbnail||c.photos.find(p=>p.src)?.src||"";
  $("detailImage").src=portrait; $("detailImage").style.display=portrait?"block":"none"; $("detailImage").alt=c.name;
  $("detailImageWrap").style.background=`radial-gradient(ellipse at 50% 30%, ${c.accent}88, transparent 60%),linear-gradient(145deg,#30252f,#17151b)`;
  $("detailImageWrap").style.setProperty("--detail-accent",c.accent); $("detailPanel").style.setProperty("--detail-accent",c.accent);
  $("detailCounter").textContent=`CHARACTER / ${c.number}`; $("detailName").textContent=c.name; $("detailIndex").textContent=c.number;
  $("detailTag").textContent=c.tag; $("detailSubtitle").textContent=(c.subtitle||"CHARACTER PROFILE").toUpperCase();
  $("detailDescription").innerHTML=`<p>${escapeHtml(c.description)}</p>`;
  const facts=(c.about?.facts||[]).slice(0,8);
  $("detailFacts").innerHTML=facts.map(([label,value])=>`<div class="detail-fact"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`).join("")||`<div class="detail-fact"><span>PROFILE</span><strong>${escapeHtml(c.subtitle||c.tag||"Character")}</strong></div>`;
  $("detailBottomNumber").textContent=`${c.number} / ${String(characters.length).padStart(2,"0")}`; $("detailMoreNumber").textContent=c.number;
  $("detailPanel").scrollTop=0; overlay.classList.add("open"); overlay.setAttribute("aria-hidden","false"); document.body.classList.add("locked"); $("detailClose").focus({preventScroll:true});
}
function closeDetail() {
  if (!overlay.classList.contains("open")) return;
  overlay.classList.remove("open"); overlay.setAttribute("aria-hidden","true"); document.body.classList.remove("locked");
  if (lastFocus?.focus) lastFocus.focus({preventScroll:true});
}
function renderDocs(c, tab = "about") {
  currentCharacter = c;
  $("crumbName").textContent = c.name.toUpperCase();
  $("docsIndex").textContent = c.number; $("docsSubtitle").textContent = c.subtitle.toUpperCase();
  $("docsName").textContent = c.name; $("docsSummary").textContent = c.description;
  $("docsTag").textContent = c.tag; $("docsEntry").textContent = c.number;
  $("heroMonogram").textContent = c.initial;
  $("docsHero").style.background = `radial-gradient(ellipse at 72% 28%, ${c.accent}8a, transparent 42%),linear-gradient(120deg,#111014,#201a24)`;
  const heroImage = $("heroImage");
  const portrait = c.thumbnail || c.photos.find(p => p.src)?.src || "";
  if (portrait) { heroImage.src = portrait; heroImage.style.display = "block"; $("heroMonogram").style.display = "none"; }
  else { heroImage.removeAttribute("src"); heroImage.style.display = "none"; $("heroMonogram").style.display = "grid"; }
  $("docsHeroImage").style.background = `radial-gradient(ellipse at 50% 30%, ${c.accent}55, transparent 65%)`;
  $("photoCount").textContent = String(c.photos.length).padStart(2,"0");
  $("videoCount").textContent = String(c.videos.length).padStart(2,"0");
  setActiveTab(tab);
}
function setActiveTab(tab) {
  const valid = ["about","photos","videos"].includes(tab) ? tab : "about";
  document.querySelectorAll(".docs-tab").forEach(button => {
    const active = button.dataset.tab === valid;
    button.classList.toggle("active", active); button.setAttribute("aria-selected", String(active));
  });
  $("tabPanel").setAttribute("aria-labelledby", ({about:"tabAbout",photos:"tabPhotos",videos:"tabVideos"})[valid]);
  if (!currentCharacter) return;
  if (valid === "about") renderAbout(currentCharacter);
  if (valid === "photos") renderPhotos(currentCharacter);
  if (valid === "videos") renderVideos(currentCharacter);
}
function sanitizeRichHtml(html) {
  const allowed = new Set(["P","BR","STRONG","B","EM","I","H1","H2","H3","H4","H5","H6","UL","OL","LI","BLOCKQUOTE"]);
  const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
  const clean = node => {
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent);
    if (node.nodeType !== Node.ELEMENT_NODE) return document.createDocumentFragment();
    const fragment = document.createDocumentFragment();
    if (!allowed.has(node.tagName)) { [...node.childNodes].forEach(child => fragment.append(clean(child))); return fragment; }
    const el = document.createElement(node.tagName.toLowerCase());
    [...node.childNodes].forEach(child => el.append(clean(child)));
    fragment.append(el); return fragment;
  };
  const out = document.createElement("div");
  [...doc.body.childNodes].forEach(child => out.append(clean(child)));
  return out.innerHTML;
}
function renderCharacterFormat(source) {
  const text = String(source || '').replace(/\r/g, '').trim();
  const lines = text.split('\n'); let blocks=[], current={type:'text',lines:[]};
  const flush=()=>{ if(current.lines.length){blocks.push(current);current={type:'text',lines:[]};} };
  for(const line of lines){
    if(!line.trim() && current.type !== 'text'){ current.lines.push(line); continue; }
    const marker=line.trim().match(/^\[(h[1-6]|list|o-list|ul|ol|p|paragraph|blockquote)\]$/i);
    const paired=line.trim().match(/^\\(h[1-6]|p|ul|ol|blockquote)\s*(?:\([^)]*\))?$/i);
    if(marker||paired){flush();current={type:(marker?marker[1]:paired[1]).toLowerCase(),lines:[]};continue;}
    const close=line.trim().match(/^(?:([a-z][\w-]*)\/|\[\/[a-z]+\])$/i);
    if(close){flush();continue;}
    current.lines.push(line);
  }flush();
  return blocks.map(block=>{
    const body=block.lines.join('\n').trim();if(!body)return '';
    const type=block.type;
    if(type==='list'||type==='ul'||type==='o-list'||type==='ol'){
      const tag=(type==='o-list'||type==='ol')?'ol':'ul';
      return `<${tag}>`+body.split('\n').filter(x=>x.trim()).map(x=>`<li>${simpleInline(x.replace(/^\s*(?:[-*]|\d+\.)\s*/,''))}</li>`).join('')+`</${tag}>`;
    }
    if(/^h[1-6]$/.test(type))return `<${type}>${simpleInline(body.replace(/^\s*\d+\.\s*/,''))}</${type}>`;
    if(type==='blockquote')return `<blockquote>${body.split('\n').map(simpleInline).join('<br>')}</blockquote>`;
    if(type==='p'||type==='paragraph')return `<p>${body.split('\n').map(simpleInline).join('<br>')}</p>`;
    return body.split('\n').map(line=>{const l=line.trim();if(!l)return '';if(/^#{1,6}\s/.test(l)){const n=l.match(/^#+/)[0].length;return `<h${n}>${simpleInline(l.replace(/^#{1,6}\s*/,''))}</h${n}>`;}if(/^[-*]\s/.test(l))return `<ul><li>${simpleInline(l.replace(/^[-*]\s*/,''))}</li></ul>`;if(/^\d+\.\s/.test(l))return `<ol><li>${simpleInline(l.replace(/^\d+\.\s*/,''))}</li></ol>`;return `<p>${simpleInline(l)}</p>`;}).join('');
  }).join('');
}
function simpleInline(s){return escapeHtml(s).replace(/\*\*(.+?)\*\*/g,'<strong>$1</strong>').replace(/\*(.+?)\*/g,'<em>$1</em>');}
async function renderAbout(c) {
  if (c.informasi) {
    try {
      const response = await fetch(`./karakter/${c.folder}/${c.informasi}`);
      if (response.ok) {
        const raw = await response.text();
        const rendered = renderCharacterFormat(raw);
        $('tabPanel').innerHTML = `<div class="about-content"><div class="about-heading"><p class="section-label">01 / ABOUT</p><h2>Behind the<br><em>character.</em></h2></div><div class="about-body">${rendered}</div></div>`;
        return;
      }
    } catch (_) {}
  }
  const facts = (c.about.facts || []).map(([label,value]) => `<div class="info-item"><span>${escapeHtml(label.toUpperCase())}</span><strong>${escapeHtml(value)}</strong></div>`).join("");
  const paragraphs = c.about.html ? sanitizeRichHtml(c.about.html) : (c.about.paragraphs || []).map(p => `<p>${escapeHtml(p)}</p>`).join("");
  $("tabPanel").innerHTML = `<div class="about-content"><div class="about-heading"><p class="section-label">01 / ABOUT</p><h2>Behind the<br><em>character.</em></h2></div><div class="about-body"><p class="about-lead">${escapeHtml(c.about.lead)}</p>${paragraphs}<div class="info-grid">${facts}</div><div class="notes-block"><h3>Character notes</h3><p>${escapeHtml(c.about.notes)}</p></div></div></div>`;
}
function renderPhotos(c) {
  const withPhotos = c.photos || [];
  const head = `<div class="photos-heading"><h2>Photo archive<span style="color:var(--accent)">.</span></h2><p>${String(withPhotos.length).padStart(2,"0")} IMAGES / SELECT TO EXPAND</p></div>`;
  if (!withPhotos.length) { $("tabPanel").innerHTML = `${head}<div class="photo-empty"><strong>No photos yet.</strong><p>Tambahkan foto untuk karakter ini di array <code>photos</code> pada script.js.</p></div>`; return; }
  const cards = withPhotos.map((p,i) => `<button class="photo-item" type="button" data-photo-index="${i}" style="--photo-accent:${escapeHtml(p.tone || c.accent)};animation-delay:${Math.min(i*45,360)}ms" aria-label="Perbesar foto ${escapeHtml(p.title)}">${p.src ? `<img src="${escapeHtml(p.src)}" alt="${escapeHtml(p.title)}" loading="lazy">` : `<span class="photo-placeholder">${escapeHtml(c.initial)}</span>`}<span class="photo-label">${escapeHtml(p.title || `PHOTO ${i+1}`)}</span></button>`).join("");
  $("tabPanel").innerHTML = `${head}<div class="photo-grid">${cards}</div>`;
  $("tabPanel").querySelectorAll("[data-photo-index]").forEach(button => button.addEventListener("click", () => openLightbox(Number(button.dataset.photoIndex), button)));
}
function toEmbedUrl(url) {
  if (!url) return "";
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.includes("youtube.com")) {
      const id = u.searchParams.get("v");
      if (id) return `https://www.youtube-nocookie.com/embed/${id}`;
      if (u.pathname.startsWith("/embed/")) return `https://www.youtube-nocookie.com${u.pathname}`;
    }
  } catch {}
  return url;
}
function renderVideos(c) {
  const videos = c.videos || [];
  if (!videos.length) { $("tabPanel").innerHTML = `<div class="photos-heading"><h2>Video archive<span style="color:var(--accent)">.</span></h2><p>0 VIDEOS</p></div><div class="video-empty"><strong>No videos yet.</strong><p>Tambahkan tautan YouTube atau path file MP4 pada array <code>videos</code> karakter ini di script.js.</p></div>`; return; }
  const cards = videos.map((v,i) => {
    const url = (v.url || "").trim();
    let player = "";
    if (url) {
      if (/\.mp4($|\?)/i.test(url)) player = `<video controls preload="metadata" src="${escapeHtml(url)}"></video>`;
      else player = `<iframe src="${escapeHtml(toEmbedUrl(url))}" title="${escapeHtml(v.title)}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
    } else {
      player = `<div class="video-placeholder" style="--video-accent:${escapeHtml(v.tone || c.accent)}"><span class="video-play">▶</span><span class="video-placeholder-caption">VIDEO ENTRY / ${String(i+1).padStart(2,"0")}</span></div>`;
    }
    return `<article class="video-card" style="animation-delay:${i*90}ms"><div class="video-frame" style="--video-accent:${escapeHtml(v.tone || c.accent)}">${player}</div><div class="video-info"><h3>${escapeHtml(v.title)}</h3><p>${escapeHtml(v.description || "Video karakter.")}</p><button class="video-expand" type="button" data-video-index="${i}">EXPAND VIDEO <span>↗</span></button></div></article>`;
  }).join("");
  $("tabPanel").innerHTML = `<div class="photos-heading"><h2>Video archive<span style="color:var(--accent)">.</span></h2><p>${String(videos.length).padStart(2,"0")} VIDEOS</p></div><div class="video-grid">${cards}</div>`;
  $("tabPanel").querySelectorAll("[data-video-index]").forEach(button => button.addEventListener("click", () => openVideoLightbox(Number(button.dataset.videoIndex))));
}
let activeVideoIndex = 0;
function openVideoLightbox(index) {
  if (!currentCharacter?.videos?.length) return;
  activeVideoIndex = index; updateVideoLightbox();
  $("videoLightbox").classList.add("open"); $("videoLightbox").setAttribute("aria-hidden","false"); document.body.classList.add("locked");
}
function updateVideoLightbox() {
  const videos=currentCharacter?.videos||[]; if(!videos.length)return;
  const v=videos[activeVideoIndex]; const url=(v.url||"").trim(); const player=$("videoLightboxPlayer");
  player.innerHTML="";
  if(url){ if(/\.mp4($|\?)/i.test(url)){ const video=document.createElement("video");video.controls=true;video.autoplay=true;video.src=url;player.append(video); }
    else { const frame=document.createElement("iframe");frame.src=toEmbedUrl(url);frame.title=v.title||"Character video";frame.allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";frame.allowFullscreen=true;player.append(frame); }
  } else { player.innerHTML=`<div class="video-modal-placeholder"><span>▶</span><p>Tambahkan URL video pada editor.</p></div>`; }
  $("videoLightboxTitle").textContent=`${currentCharacter.name.toUpperCase()} / ${(v.title||"VIDEO").toUpperCase()}`;
  $("videoLightboxCount").textContent=`${String(activeVideoIndex+1).padStart(2,"0")} / ${String(videos.length).padStart(2,"0")}`;
  $("videoLightboxPrev").style.visibility=videos.length<2?"hidden":"visible"; $("videoLightboxNext").style.visibility=videos.length<2?"hidden":"visible";
}
function closeVideoLightbox(){ const box=$("videoLightbox");if(!box.classList.contains("open"))return;box.classList.remove("open");box.setAttribute("aria-hidden","true");$("videoLightboxPlayer").innerHTML="";document.body.classList.remove("locked"); }
function stepVideoLightbox(delta){const videos=currentCharacter?.videos||[];if(!videos.length)return;activeVideoIndex=(activeVideoIndex+delta+videos.length)%videos.length;updateVideoLightbox();}

function openLightbox(index, trigger) {
  if (!currentCharacter?.photos?.length) return;
  activePhotoIndex = index; lastFocus = trigger || document.activeElement;
  updateLightbox();
  lightbox.classList.add("open"); lightbox.setAttribute("aria-hidden","false"); document.body.classList.add("locked");
  $("lightboxClose").focus({preventScroll:true});
}
function updateLightbox() {
  const photos = currentCharacter.photos;
  const photo = photos[activePhotoIndex];
  const image = $("lightboxImage");
  if (photo.src) {
    image.src = photo.src; image.style.display = "block";
    image.onerror = () => { image.style.display = "none"; $("lightboxFigure").style.background = photo.tone || currentCharacter.accent; };
  } else {
    image.removeAttribute("src"); image.style.display = "block";
    image.src = makePlaceholderSvg(currentCharacter.initial, photo.tone || currentCharacter.accent, photo.title);
    image.onerror = null;
  }
  $("lightboxCaption").textContent = `${currentCharacter.name.toUpperCase()} / ${photo.title.toUpperCase()}`;
  $("lightboxCounter").textContent = `${String(activePhotoIndex+1).padStart(2,"0")} / ${String(photos.length).padStart(2,"0")}`;
  const hideArrows = photos.length < 2;
  $("lightboxPrev").style.visibility = hideArrows ? "hidden" : "visible";
  $("lightboxNext").style.visibility = hideArrows ? "hidden" : "visible";
}
function makePlaceholderSvg(initial, tone, title) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="0 0 900 1100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${tone}"/><stop offset="1" stop-color="#17131c"/></linearGradient><radialGradient id="r"><stop stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><rect width="900" height="1100" fill="url(#g)"/><circle cx="450" cy="400" r="280" fill="url(#r)"/><circle cx="450" cy="400" r="310" fill="none" stroke="#fff" stroke-opacity=".3"/><text x="450" y="560" text-anchor="middle" font-family="Georgia,serif" font-size="330" fill="none" stroke="#fff" stroke-opacity=".75" stroke-width="2">${escapeHtml(initial)}</text><text x="450" y="990" text-anchor="middle" font-family="Arial,sans-serif" font-size="22" letter-spacing="7" fill="#fff" fill-opacity=".8">${escapeHtml(title.toUpperCase())}</text></svg>`;
  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}
function closeLightbox() {
  if (!lightbox.classList.contains("open")) return;
  lightbox.classList.remove("open"); lightbox.setAttribute("aria-hidden","true"); document.body.classList.remove("locked");
  if (lastFocus?.focus) lastFocus.focus({preventScroll:true});
}
function stepLightbox(delta) {
  if (!currentCharacter?.photos?.length) return;
  activePhotoIndex = (activePhotoIndex + delta + currentCharacter.photos.length) % currentCharacter.photos.length;
  updateLightbox();
}
function renderRoute(animate = false) {
  const route = currentRoute();
  closeDetail(); closeLightbox(); closeVideoLightbox();
  $("menuToggle").setAttribute("aria-expanded","false"); $("mobileNav").classList.remove("open");
  if (route.page === "home") {
    showOnly("home");
    window.scrollTo({top:0,behavior:"instant"});
    return;
  }
  if (route.page === "editor") {
    showOnly("editor");
    if (window.renderEditorRoute) window.renderEditorRoute(route.id, route.tab);
    window.scrollTo({top:0,behavior:"instant"});
    return;
  }
  if (route.page === "docs") {
    const c = getCharacter(route.id);
    if (!c) { showOnly("gallery"); window.scrollTo({top:0,behavior:"instant"}); return; }
    showOnly("docs"); renderDocs(c, route.tab);
    window.scrollTo({top:0,behavior:"instant"});
    return;
  }
  showOnly("gallery");
  window.scrollTo({top:0,behavior:"instant"});
  if (route.anchor) setTimeout(() => document.getElementById(route.anchor)?.scrollIntoView({behavior:"smooth"}), 40);
}
function goToDocs() {
  if (!currentCharacter) return;
  const c = currentCharacter;
  closeDetail();
  navigate(`docs/${encodeURIComponent(c.id)}/about`);
}
function backToGallery() { navigate("characters"); }

$("enterButton").addEventListener("click", () => navigate("characters"));
$("detailClose").addEventListener("click", closeDetail);
$("overlayBackdrop").addEventListener("click", closeDetail);
$("detailMore").addEventListener("click", goToDocs);
$("backGallery").addEventListener("click", backToGallery);
$("heroBack").addEventListener("click", backToGallery);
$("menuToggle").addEventListener("click", () => {
  const open = $("menuToggle").getAttribute("aria-expanded") === "true";
  $("menuToggle").setAttribute("aria-expanded", String(!open)); $("mobileNav").classList.toggle("open", !open);
});
$("mobileNav").querySelectorAll("a").forEach(a => a.addEventListener("click", () => {
  $("menuToggle").setAttribute("aria-expanded","false"); $("mobileNav").classList.remove("open");
}));
document.querySelectorAll(".docs-tab").forEach(button => button.addEventListener("click", () => {
  const tab = button.dataset.tab;
  if (currentCharacter) navigate(`docs/${encodeURIComponent(currentCharacter.id)}/${tab}`, false);
}));
$("lightboxClose").addEventListener("click", closeLightbox);
$("lightboxBackdrop").addEventListener("click", closeLightbox);
$("lightboxPrev").addEventListener("click", () => stepLightbox(-1));
$("lightboxNext").addEventListener("click", () => stepLightbox(1));
$("videoLightboxClose").addEventListener("click", closeVideoLightbox);
$("videoLightboxBackdrop").addEventListener("click", closeVideoLightbox);
$("videoLightboxPrev").addEventListener("click", () => stepVideoLightbox(-1));
$("videoLightboxNext").addEventListener("click", () => stepVideoLightbox(1));
let detailTouchStartY=null;
$("detailPanel").addEventListener("wheel",event=>{const panel=$("detailPanel"),atBottom=panel.scrollTop+panel.clientHeight>=panel.scrollHeight-3;if(atBottom&&event.deltaY>28){event.preventDefault();closeDetail();}},{passive:false});
$("detailPanel").addEventListener("touchstart",event=>{detailTouchStartY=event.touches[0]?.clientY??null;},{passive:true});
$("detailPanel").addEventListener("touchend",event=>{if(detailTouchStartY===null)return;const delta=detailTouchStartY-(event.changedTouches[0]?.clientY??detailTouchStartY);detailTouchStartY=null;const panel=$("detailPanel"),atBottom=panel.scrollTop+panel.clientHeight>=panel.scrollHeight-3;if(atBottom&&delta>55)closeDetail();},{passive:true});
document.addEventListener("keydown", event => {
  if (event.key === "Escape") { closeDetail(); closeLightbox(); closeVideoLightbox(); $("mobileNav").classList.remove("open"); $("menuToggle").setAttribute("aria-expanded","false"); }
  if (lightbox.classList.contains("open") && event.key === "ArrowLeft") stepLightbox(-1);
  if (lightbox.classList.contains("open") && event.key === "ArrowRight") stepLightbox(1);
  if ($("videoLightbox").classList.contains("open") && event.key === "ArrowLeft") stepVideoLightbox(-1);
  if ($("videoLightbox").classList.contains("open") && event.key === "ArrowRight") stepVideoLightbox(1);
  if (event.key === "Tab" && lightbox.classList.contains("open")) {
    const focusables = [$("lightboxClose"), $("lightboxPrev"), $("lightboxNext")].filter(el => el.style.visibility !== "hidden");
    if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables[focusables.length-1].focus(); }
    else if (!event.shiftKey && document.activeElement === focusables[focusables.length-1]) { event.preventDefault(); focusables[0].focus(); }
  }
  if (event.key === "Tab" && overlay.classList.contains("open")) {
    const focusables = [...$("detailPanel").querySelectorAll("button:not([disabled])")];
    if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables[focusables.length-1].focus(); }
    else if (!event.shiftKey && document.activeElement === focusables[focusables.length-1]) { event.preventDefault(); focusables[0].focus(); }
  }
});

// NOCTURNE Radio: local audio player with searchable, indexed library.
(() => {
  const $ = id => document.getElementById(id), audio = $('musicAudio');
  if (!audio) return;
  let tracks = [], index = 0, shuffle = false, repeat = false, opened = false, maximized = false, query = '', alpha = '', autoplayPending = false;
  const safeText = s => String(s || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const time = s => Number.isFinite(s) && s >= 0 ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';
  const firstKey = t => { const c = String(t.title || '').trim().charAt(0).toUpperCase(); return /[0-9]/.test(c) ? c : /[A-Z]/.test(c) ? c : '#'; };
  function panel(open) { opened = open; $('musicWidget').classList.toggle('open',open); $('musicFab').setAttribute('aria-expanded',String(open)); $('musicPanel').setAttribute('aria-hidden',String(!open)); }
  function setMaximized(value) { maximized = value; $('musicPanel').classList.toggle('maximized',value); $('musicWidget').classList.toggle('music-maximized',value); $('musicMaximize').textContent = value ? '⤡' : '⤢'; $('musicMaximize').title = value ? 'Kembalikan ukuran' : 'Perbesar'; $('musicMaximize').setAttribute('aria-label',value ? 'Kembalikan ukuran pemutar' : 'Perbesar pemutar'); }
  function filteredTracks() { return tracks.map((t,i)=>({...t,_index:i})).filter(t => { const match = !query || `${t.title||''} ${t.artist||''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()); return match && (!alpha || firstKey(t)===alpha); }); }
  function renderIndex() {
    const keys = ['#', ...'0123456789', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'];
    $('musicAlphaIndex').innerHTML = keys.map(k => { const exists = tracks.some(t=>firstKey(t)===k); return `<button type="button" class="music-alpha-key ${alpha===k?'active':''}" data-alpha="${k}" ${exists?'':'disabled'}>${k==='#'?'✳':k}</button>`; }).join('');
  }
  function renderPlaylist() {
    const list = filteredTracks();
    $('musicPlaylistCount').textContent = `${String(tracks.length).padStart(2,'0')} TRACKS`;
    $('musicSearchCount').textContent = `${list.length} lagu`;
    $('musicPlaylist').innerHTML = list.length ? list.map(t=>`<button class="music-playlist-item ${t._index===index?'active':''}" data-track-index="${t._index}"><span class="music-list-index">${t._index===index?'♫':String(t._index+1).padStart(2,'0')}</span><span class="music-list-copy"><strong>${safeText(t.title||'Untitled')}</strong><small>${safeText(t.artist||'Unknown artist')} · LOCAL AUDIO</small></span><span class="music-list-play">${t._index===index?'●':'▶'}</span></button>`).join('') : `<p class="music-empty">${tracks.length ? 'Tidak ada lagu yang cocok dengan pencarian/indeks.' : 'Playlist kosong. Tambahkan file audio lokal melalui editor.'}</p>`;
    renderIndex();
  }
  function loadTrack(i, autoplay=false) {
    if (!tracks.length) { $('musicTrackTitle').textContent='Belum ada lagu'; $('musicTrackArtist').textContent='Tambahkan audio lokal melalui editor'; renderPlaylist(); return; }
    index = (i + tracks.length) % tracks.length;
    const t = tracks[index]; audio.pause(); audio.src = t.src || ''; audio.load();
    $('musicTrackTitle').textContent=t.title||'Untitled'; $('musicTrackArtist').textContent=t.artist||'Unknown artist'; $('musicSourceNote').textContent='LOCAL AUDIO · KONTROL PENUH'; $('musicNowArt').classList.remove('playing'); $('musicPlay').textContent='▶'; $('musicCurrentTime').textContent='0:00'; $('musicDuration').textContent='0:00'; $('musicSeek').value='0';
    renderPlaylist(); if (autoplay && audio.src) audio.play().catch(()=>panel(true));
  }
  function updatePlay() { const playing=!audio.paused; $('musicPlay').textContent=playing?'Ⅱ':'▶'; $('musicPlay').setAttribute('aria-label',playing?'Jeda':'Putar'); $('musicNowArt').classList.toggle('playing',playing); }
  function next() { if(!tracks.length)return; if(shuffle&&tracks.length>1){let n=index;while(n===index)n=Math.floor(Math.random()*tracks.length);loadTrack(n,true);}else loadTrack(index+1,true); }
  document.addEventListener('pointerdown',()=>{if(autoplayPending&&$('musicAutoPlayPublic').checked&&tracks.length){if(!audio.src)loadTrack(index);audio.play().then(()=>{autoplayPending=false;$('musicSourceNote').textContent='LOCAL AUDIO · KONTROL PENUH';}).catch(()=>{});}}, {once:false});
  $('musicFab').addEventListener('click',()=>panel(!opened)); $('musicClose').addEventListener('click',()=>panel(false)); $('musicMaximize').addEventListener('click',()=>setMaximized(!maximized));
  $('musicPlay').addEventListener('click',()=>{ if(!tracks.length){panel(true);return;} if(audio.paused){if(!audio.src)loadTrack(index);audio.play().catch(()=>panel(true));}else audio.pause(); });
  $('musicPrev').addEventListener('click',()=>loadTrack(index-1,true)); $('musicNext').addEventListener('click',next);
  $('musicShuffle').addEventListener('click',()=>{shuffle=!shuffle;$('musicShuffle').classList.toggle('active',shuffle);});
  $('musicRepeat').addEventListener('click',()=>{repeat=!repeat;audio.loop=repeat;$('musicRepeat').classList.toggle('active',repeat);});
  $('musicMute').addEventListener('click',()=>{audio.muted=!audio.muted;$('musicMute').classList.toggle('active',audio.muted);$('musicMute').textContent=audio.muted?'MUTE':'VOL';});
  $('musicVolume').addEventListener('input',e=>{audio.volume=Number(e.target.value);audio.muted=false;});
  $('musicSeek').addEventListener('input',e=>{if(Number.isFinite(audio.duration))audio.currentTime=audio.duration*Number(e.target.value)/100;});
  $('musicSearch').addEventListener('input',e=>{query=e.target.value;alpha='';renderPlaylist();});
  $('musicAlphaIndex').addEventListener('click',e=>{const b=e.target.closest('[data-alpha]');if(!b||b.disabled)return;alpha=alpha===b.dataset.alpha?'':b.dataset.alpha;query='';$('musicSearch').value='';renderPlaylist();const first=$('musicPlaylist').querySelector('[data-track-index]');if(first)first.scrollIntoView({block:'nearest'});});
  audio.addEventListener('loadedmetadata',()=>{$('musicDuration').textContent=time(audio.duration);});
  audio.addEventListener('timeupdate',()=>{$('musicCurrentTime').textContent=time(audio.currentTime);$('musicDuration').textContent=time(audio.duration);$('musicSeek').value=Number.isFinite(audio.duration)&&audio.duration?String(audio.currentTime/audio.duration*100):'0';});
  audio.addEventListener('play',updatePlay); audio.addEventListener('pause',updatePlay); audio.addEventListener('ended',()=>{if(!repeat)next();}); audio.addEventListener('error',()=>{if(audio.currentSrc)$('musicSourceNote').textContent='Audio gagal dimuat · periksa file/path audio';});
  $('musicPlaylist').addEventListener('click',e=>{const b=e.target.closest('[data-track-index]');if(b)loadTrack(Number(b.dataset.trackIndex),true);});
  $('musicAutoPlayPublic').addEventListener('change',e=>{const enabled=e.target.checked;localStorage.setItem('nocturne-autoplay',String(enabled));if(enabled&&tracks.length){panel(true);if(!audio.src)loadTrack(index);audio.play().then(()=>{autoplayPending=false;}).catch(()=>{autoplayPending=true;$('musicSourceNote').textContent='Autoplay menunggu izin browser · klik halaman atau tombol Play';});}});
  fetch('music-data.json',{cache:'no-store'}).then(r=>r.ok?r.json():{tracks:[],autoPlay:false}).then(data=>{
    // This player deliberately accepts local audio files only.
    tracks=Array.isArray(data.tracks)?data.tracks.filter(t=>t&&t.src&&(!t.type||t.type==='audio'||t.type==='auto')&&!/youtube\.com|youtu\.be|spotify\.com/i.test(t.src)):[];
    const saved=localStorage.getItem('nocturne-autoplay'); $('musicAutoPlayPublic').checked=saved===null?data.autoPlay===true:saved==='true';
    audio.volume=.72;renderPlaylist();loadTrack(0,false);
    if($('musicAutoPlayPublic').checked&&tracks.length){panel(true);autoplayPending=true;audio.play().then(()=>{autoplayPending=false;}).catch(()=>{$('musicSourceNote').textContent='Autoplay tersimpan · browser menunggu interaksi pertama';});}
  }).catch(()=>renderPlaylist());
})();
window.addEventListener("hashchange", () => renderRoute(false));
$("year").textContent = new Date().getFullYear();
$("docsYear").textContent = new Date().getFullYear();
renderCards();
loadCharacterData();
if (!location.hash) history.replaceState(null, "", "#/home");
renderRoute(false);



// ============================================================
// 3D HELIX CAROUSEL ENGINE (Active Theory Inspired)
// ============================================================
(() => {
  let currentProgress = 0;
  let targetProgress = 0;
  let hoveredIndex = -1;
  let rafId = null;

  function updateHelixTrackHeight() {
    const section = $("characterHelixSection");
    if (!section) return;
    const count = Math.max(characters.length, 3);
    // Tinggi scroll proporsional dengan jumlah karakter agar putaran nyaman
    section.style.height = `${Math.max(220, count * 75)}vh`;
  }

  function computeScrollTarget() {
    const section = $("characterHelixSection");
    if (!section || gallery.classList.contains("view-hidden")) return;
    const rect = section.getBoundingClientRect();
    const scrollable = rect.height - window.innerHeight;
    if (scrollable <= 0) return;
    const scrolled = -rect.top;
    targetProgress = Math.max(0, Math.min(1, scrolled / scrollable));
  }

  function scrollToCharacterIndex(idx) {
    const section = $("characterHelixSection");
    if (!section || characters.length <= 1) return;
    const clamped = Math.max(0, Math.min(characters.length - 1, idx));
    const ratio = clamped / (characters.length - 1);
    const sectionTop = window.scrollY + section.getBoundingClientRect().top;
    const scrollable = section.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: sectionTop + ratio * scrollable,
      behavior: "smooth"
    });
  }

  function animateHelix() {
    const section = $("characterHelixSection");
    const spine = $("helixSpine");
    const indicator = $("helixActiveIndicator");
    const cards = grid ? Array.from(grid.querySelectorAll(".character-card")) : [];

    if (section && !gallery.classList.contains("view-hidden") && cards.length > 0) {
      // Smooth inertia (lerp)
      currentProgress += (targetProgress - currentProgress) * 0.085;

      const count = cards.length;
      const isMobile = window.innerWidth < 768;
      const radiusX = isMobile ? Math.min(window.innerWidth * 0.34, 175) : Math.min(window.innerWidth * 0.27, 360);
      const radiusZ = isMobile ? 210 : 370;
      const verticalSpread = isMobile ? 165 : 210;

      // Total rotasi mengelilingi bone sesuai progress scroll
      const activeFloatIndex = currentProgress * Math.max(1, count - 1);
      const baseAngleOffset = -activeFloatIndex * ((Math.PI * 2) / Math.max(count, 3.2));

      if (spine) {
        const spineRot = currentProgress * 180;
        const spineY = (currentProgress - 0.5) * -70;
        spine.style.zIndex = "5";
        spine.style.transform = `translate3d(-50%, calc(-50% + ${spineY.toFixed(1)}px), 0px) rotateY(${spineRot.toFixed(1)}deg)`;
      }

      let frontMostIdx = 0;
      let maxZ = -Infinity;

      cards.forEach((card, i) => {
        const angleStep = (Math.PI * 2) / Math.max(count, 3.2);
        const angle = i * angleStep + baseAngleOffset;

        // Posisi 3D melingkari poros tengah & naik-turun mengikuti scroll
        const x = Math.sin(angle) * radiusX;
        const z = Math.cos(angle) * radiusZ;
        const y = (i - activeFloatIndex) * verticalSpread;

        if (z > maxZ) {
          maxZ = z;
          frontMostIdx = i;
        }

        // Kedalaman relatif terhadap poros tengah (z = 0 adalah posisi poros bone)
        const depthNorm = (z + radiusZ) / (2 * radiusZ); // 0 (belakang) -> 1 (depan)
        const isHovered = hoveredCardId === card.dataset.character;

        const baseScale = 0.66 + depthNorm * 0.38;
        const scale = isHovered ? baseScale * 1.05 : baseScale;
        const opacity = Math.max(0.28, 0.32 + depthNorm * 0.68);
        const blur = !isHovered && z < -40 ? Math.min(4.5, Math.abs(z + 40) * 0.013) : 0;
        const rotateY = Math.sin(angle) * 28; // Sedikit menghadap kontur silinder 3D
        const rotateZ = Math.sin(angle) * -2.2;

        // Z-index: poros bone berada di z-index: 10.
        // Card dengan z > 0 berada di depan bone (> 10), card dengan z <= 0 di belakang bone (< 10).
        const isFront = z >= -10;
        const zIndex = isHovered ? 40 : (isFront ? Math.round(15 + depthNorm * 15) : Math.round(1 + depthNorm * 3));

        card.style.zIndex = String(zIndex);
        card.style.opacity = opacity.toFixed(3);
        card.style.filter = blur > 0.15 ? `blur(${blur.toFixed(2)}px)` : "none";
        card.style.transform = `translate3d(calc(-50% + ${x.toFixed(1)}px), calc(-50% + ${y.toFixed(1)}px), ${z.toFixed(1)}px) rotateY(${rotateY.toFixed(1)}deg) rotateZ(${rotateZ.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
      });

      if (indicator && characters[frontMostIdx]) {
        const activeChar = characters[frontMostIdx];
        indicator.textContent = `${activeChar.number} / ${activeChar.name.split(" ")[0].toUpperCase()}`;
      }
    }

    rafId = requestAnimationFrame(animateHelix);
  }

  window.addEventListener("scroll", computeScrollTarget, { passive: true });
  window.addEventListener("resize", () => {
    updateHelixTrackHeight();
    computeScrollTarget();
  }, { passive: true });

  $("helixPrevBtn")?.addEventListener("click", () => {
    const count = characters.length;
    if (!count) return;
    const currentIdx = Math.round(targetProgress * (count - 1));
    scrollToCharacterIndex((currentIdx - 1 + count) % count);
  });

  $("helixNextBtn")?.addEventListener("click", () => {
    const count = characters.length;
    if (!count) return;
    const currentIdx = Math.round(targetProgress * (count - 1));
    scrollToCharacterIndex((currentIdx + 1) % count);
  });

  // Hook ke renderCards & renderRoute agar tinggi track selalu sinkron saat data JSON selesai dimuat
  const origRenderCards = renderCards;
  renderCards = function() {
    origRenderCards.apply(this, arguments);
    updateHelixTrackHeight();
    computeScrollTarget();
  };

  const origRenderRoute = renderRoute;
  renderRoute = function() {
    origRenderRoute.apply(this, arguments);
    updateHelixTrackHeight();
    computeScrollTarget();
  };

  updateHelixTrackHeight();
  computeScrollTarget();
  if (!rafId) animateHelix();
})();
