// =========== AYARLAR ===========
// NewsAPI anahtarını buraya koy
const NEWSAPI_KEY = "YOUR_NEWSAPI_KEY";

// FIRMS: NASA FIRMS JSON/CSV endpoint'leri CORS/format farkı gösterebilir.
// Eğer CORS sorun çıkarsa FIRMS verisini kendi repo/public dizinine koyup fetch et.
// Örnek USGS endpoint:
const USGS_ENDPOINT = (minMag=3,limit=50) =>
  `https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&minmagnitude=${minMag}&limit=${limit}&orderby=time`;

// =========== HARİTA OLUŞTURMA ===========
const map = L.map('map', {preferCanvas: true}).setView([39, 35], 5);

// Temel katman (tile)
// Uydu katmanı istersen Google Maps Satellite veya Mapbox kullanabilirsin (API anahtarı gerekir).
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

// Katman grupları
const layerQuakes = L.layerGroup().addTo(map);
const layerFires = L.layerGroup().addTo(map);

// İkonlar
const quakeIcon = L.icon({iconUrl:'assets/earthquake.png',iconSize:[36,36],iconAnchor:[18,36]});
const fireIcon  = L.icon({iconUrl:'assets/fire.png',iconSize:[28,28],iconAnchor:[14,28]});

// Helper: deprem popup içeriği
function quakePopupHTML(props){
  const t = props.time ? new Date(props.time).toLocaleString() : "";
  return `<b>${props.place || 'Yer bilinmiyor'}</b><br>Şiddet: ${props.mag || '-'}<br>Derinlik: ${props.depth || '-'} km<br>${t}<br><a href="${props.url}" target="_blank">USGS detay</a>`;
}

// =========== DEPREMLERİ YÜKLEME ===========
async function loadQuakes(minMag=3,limit=50){
  layerQuakes.clearLayers();
  document.getElementById('quake-list').innerHTML = "Yükleniyor...";
  try{
    const res = await fetch(USGS_ENDPOINT(minMag,limit));
    const data = await res.json();
    const features = data.features || [];
    // Listele
    const qlist = document.getElementById('quake-list');
    qlist.innerHTML = "";
    features.forEach(f=>{
      const c = f.geometry.coordinates; // [lng,lat,depth]
      const props = f.properties;
      const lat = c[1], lng = c[0], depth = c[2];
      const mag = props.mag;
      const place = props.place;
      const time = props.time;

      // Marker
      const marker = L.marker([lat,lng], {icon: quakeIcon})
        .addTo(layerQuakes)
        .bindPopup(quakePopupHTML({place, mag, depth, time, url: props.url}));

      // Etki alanı (basit model: mag * factor)
      const radius = Math.max(5000, (mag||3) * 10000); // metre
      L.circle([lat,lng], {radius, color:'red', fillOpacity:0.08}).addTo(layerQuakes);

      // Listeye ekle
      const div = document.createElement('div'); div.className='quake-item';
      div.innerHTML = `<b>${place}</b><small> • ${mag} Mw</small><br><small>${new Date(time).toLocaleString()}</small>`;
      div.onclick = ()=>{ map.setView([lat,lng], 7); marker.openPopup(); };
      qlist.appendChild(div);
    });

    if(features.length) map.fitBounds(layerQuakes.getBounds().pad(0.2));
    else qlist.innerHTML = "Deprem bulunamadı.";
  }catch(e){
    console.error(e);
    document.getElementById('quake-list').innerHTML = "Deprem verisi yüklenemedi.";
  }
}

// =========== YANGIN (FIRMS) ÖRNEK ÇEKME ===========
// Not: NASA FIRMS çoğunlukla CSV veya özel endpoint verir. CORS sorununa dikkat.
// Burada demo için VIIRS NRT GeoJSON (veya kendi tutacağın geojson) kullanmanı önereceğim.
async function loadFires(){
  layerFires.clearLayers();
  try{
    // Eğer kendi statik geojson yüklediysen: e.g. 'data/firms_viirs_24h.geojson'
    // const res = await fetch('/data/firms_viirs_24h.geojson');
    // const data = await res.json();

    // Demo: küçük test dataset veya 3. parti hizmet (kısıtlı)
    // Eğer gerçek FIRMS entegrasyonu istersen, veri formatına göre parse et ve addTo map.
    // Örnek placeholder: (hiç veri yoksa sessizce döner)
    return;
  }catch(e){ console.warn('FIRMS yüklenemedi', e); }
}

// =========== HABERLER (NewsAPI) ===========
async function loadNews(){
  const list = document.getElementById('news-list');
  list.innerHTML = "Yükleniyor...";
  try{
    if(!NEWSAPI_KEY || NEWSAPI_KEY === "YOUR_NEWSAPI_KEY"){ list.innerHTML = "NewsAPI anahtarı girilmemiş."; return; }
    const q = encodeURIComponent("earthquake OR fire OR flood OR disaster");
    const url = `https://newsapi.org/v2/everything?q=${q}&language=tr&pageSize=20&apiKey=${NEWSAPI_KEY}`;
    const res = await fetch(url);
    const data = await res.json();
    if(!data.articles){ list.innerHTML = "Haber çekilemedi."; return; }
    list.innerHTML = "";
    data.articles.forEach(a=>{
      const el = document.createElement('div'); el.className='news-item';
      el.innerHTML = `<b>${a.title}</b><br><small>${new Date(a.publishedAt).toLocaleString()}</small><br><a href="${a.url}" target="_blank">Habere git</a>`;
      list.appendChild(el);
    });
  }catch(e){
    console.error(e);
    list.innerHTML = "Haberler yüklenemedi.";
  }
}

// =========== FİLTRELER VE OLAYLAR ===========
document.getElementById('applyFilters').addEventListener('click', ()=>{
  const minMag = parseFloat(document.getElementById('minMag').value) || 3;
  const maxCount = parseInt(document.getElementById('maxCount').value) || 50;
  loadQuakes(minMag, maxCount);
});

// Butonlar (view toggle)
document.getElementById('btn-depremler').addEventListener('click', ()=>{
  document.getElementById('btn-depremler').classList.add('active');
  document.getElementById('btn-yangin').classList.remove('active');
});
document.getElementById('btn-yangin').addEventListener('click', ()=>{
  document.getElementById('btn-yangin').classList.add('active');
  document.getElementById('btn-depremler').classList.remove('active');
});

// Başlangıç yükleme
loadQuakes(3,50);
loadFires();
loadNews();

// Otomatik yenileme (ör: 10 dk)
setInterval(()=>{ loadQuakes(parseFloat(document.getElementById('minMag').value||3), parseInt(document.getElementById('maxCount').value||50)); loadNews(); }, 10*60*1000);
