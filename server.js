const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;

function buildPrompt(thema, graad, moment, extra) {
  const momentDoel = {
    'voor de les': 'Activeer voorkennis. Stel verkennende vragen zonder goed/fout. Wek nieuwsgierigheid.',
    'tijdens de les': 'Verdiep de leerstof. Geef uitleg met voorbeelden. Verwerk nieuwe begrippen stap voor stap.',
    'na de les': 'Toets de leerstof. Stel gerichte vragen met goed/fout. Geef remediering bij foute antwoorden.'
  };

  return `Jij bent een ervaren Belgische leerkracht. Genereer lesinhoud voor een interactieve website.

Thema: ${thema}
Graad: ${graad}
Moment: ${moment} - ${momentDoel[moment] || momentDoel['tijdens de les']}
Extra: ${extra || 'geen'}

Geef je antwoord ALLEEN als geldig JSON (geen uitleg, geen backticks) in dit exacte formaat:

{
  "titel": "Titel van de les met emoji",
  "leerdoelen": ["doel 1", "doel 2", "doel 3"],
  "hoofdstukken": [
    {
      "titel": "Hoofdstuk titel met emoji",
      "uitleg": "Educatieve uitleg (max 100 woorden, passend bij de graad)",
      "eindterm": "Relevante Belgische eindterm of ZILL-doelstelling",
      "quiz": {
        "vraag": "De quizvraag",
        "antwoorden": [
          {"tekst": "Antwoord A", "correct": true, "uitleg": "Uitleg waarom dit correct is"},
          {"tekst": "Antwoord B", "correct": false, "uitleg": "Uitleg waarom dit fout is"},
          {"tekst": "Antwoord C", "correct": false, "uitleg": "Uitleg waarom dit fout is"},
          {"tekst": "Antwoord D", "correct": false, "uitleg": "Uitleg waarom dit fout is"}
        ]
      },
      "woordenschat": [
        {"woord": "begrip 1", "definitie": "uitleg begrip 1"},
        {"woord": "begrip 2", "definitie": "uitleg begrip 2"}
      ]
    }
  ]
}

Maak 3 tot 5 hoofdstukken. Zorg dat de inhoud past bij ${graad} en het moment '${moment}'.`;
}

function buildHTML(data, moment) {
  const hoofdstukkenNav = data.hoofdstukken.map((h, i) =>
    `<button class="nav-btn ${i === 0 ? 'actief' : ''}" onclick="toonHoofdstuk(${i})">${h.titel}</button>`
  ).join('\n');

  const hoofdstukkenHTML = data.hoofdstukken.map((h, i) => {
    const woordenschatHTML = h.woordenschat.map((w) => `
      <div class="flip-card" onclick="var b=this.querySelector('.flip-back'); b.style.display=b.style.display==='block'?'none':'block'">
        <div class="flip-front">📖 ${w.woord}</div>
        <div class="flip-back" style="display:none">${w.definitie}</div>
      </div>`).join('\n');

    const antwoordenHTML = h.quiz.antwoorden.map((a, ai) => `
      <button class="antwoord-btn" onclick="checkAntwoord(this, ${a.correct}, 'fb-${i}-${ai}', '${a.uitleg.replace(/'/g, "\\'").replace(/"/g, '\\"')}', ${i})">${a.tekst}</button>
      <div id="fb-${i}-${ai}" class="feedback" style="display:none"></div>`).join('\n');

    return `
    <div class="hoofdstuk ${i === 0 ? 'actief' : ''}" id="hfst-${i}">
      <h2>${h.titel}</h2>
      <div class="uitleg-box">${h.uitleg}</div>

      <div class="woordenschat-sectie">
        <h3>📚 Woordenschat — klik op een kaart om de uitleg te zien</h3>
        <div class="flip-grid">${woordenschatHTML}</div>
      </div>

      <div class="quiz-sectie">
        <h3>${moment === 'voor de les' ? '🤔 Wat denk jij?' : '❓ Quiz'}</h3>
        <p class="quiz-vraag">${h.quiz.vraag}</p>
        <div class="antwoorden-grid">${antwoordenHTML}</div>
      </div>

      <div class="eindterm-box">📌 Eindterm: ${h.eindterm}</div>

      <div class="navigatie-knoppen">
        ${i > 0 ? `<button class="nav-actie" onclick="toonHoofdstuk(${i - 1})">← Vorige</button>` : ''}
        ${i < data.hoofdstukken.length - 1
          ? `<button class="nav-actie" onclick="toonHoofdstuk(${i + 1})">Volgende →</button>`
          : `<button class="nav-actie groen" onclick="toonResultaat()">✅ Bekijk resultaat</button>`}
      </div>
    </div>`;
  }).join('\n');

  return `<!DOCTYPE html>
<html lang="nl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${data.titel}</title>
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Segoe UI', sans-serif; background: #f0f4ff; color: #222; }
.container { max-width: 860px; margin: 0 auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 30px rgba(0,0,0,0.12); }
.header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: white; padding: 2rem; text-align: center; }
.header h1 { font-size: 2rem; margin-bottom: 1rem; }
.leerdoelen { background: rgba(255,255,255,0.15); border-radius: 10px; padding: 1rem; text-align: left; }
.leerdoelen h3 { margin-bottom: 0.5rem; }
.leerdoelen li { margin: 0.3rem 0 0 1.2rem; }
.voortgang-sectie { padding: 1rem 2rem; background: #f8f9ff; border-bottom: 1px solid #e0e0ff; }
.voortgang-balk { height: 12px; background: #ddd; border-radius: 10px; overflow: hidden; margin-top: 0.4rem; }
.voortgang-fill { height: 100%; background: linear-gradient(90deg, #4f46e5, #7c3aed); width: 0%; transition: width 0.4s; border-radius: 10px; }
.nav-tabs { display: flex; flex-wrap: wrap; gap: 0.5rem; padding: 1rem; background: #f0f0ff; border-bottom: 2px solid #4f46e5; }
.nav-btn { padding: 0.5rem 1rem; border: 2px solid #4f46e5; background: white; color: #4f46e5; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: all 0.2s; }
.nav-btn:hover, .nav-btn.actief { background: #4f46e5; color: white; }
.hoofdstuk { display: none; padding: 2rem; }
.hoofdstuk.actief { display: block; }
.hoofdstuk h2 { color: #4f46e5; font-size: 1.6rem; margin-bottom: 1rem; }
.uitleg-box { background: #f0f4ff; border-left: 5px solid #4f46e5; padding: 1rem; border-radius: 6px; line-height: 1.7; margin-bottom: 1.5rem; }
.woordenschat-sectie { margin-bottom: 1.5rem; }
.woordenschat-sectie h3 { margin-bottom: 0.8rem; color: #444; }
.flip-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 1rem; }
.flip-card { border-radius: 10px; cursor: pointer; overflow: hidden; border: 2px solid #4f46e5; }
.flip-front { background: #4f46e5; color: white; padding: 1rem; text-align: center; font-weight: bold; min-height: 60px; display: flex; align-items: center; justify-content: center; }
.flip-back { background: #fff9e6; padding: 1rem; font-size: 0.9rem; line-height: 1.5; border-top: 2px solid #4f46e5; }
.quiz-sectie { margin-bottom: 1.5rem; }
.quiz-sectie h3 { margin-bottom: 0.8rem; color: #444; }
.quiz-vraag { font-weight: bold; margin-bottom: 1rem; font-size: 1.05rem; }
.antwoorden-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem; }
.antwoord-btn { padding: 0.8rem; border: 2px solid #4f46e5; background: white; color: #4f46e5; border-radius: 8px; cursor: pointer; font-size: 0.95rem; transition: all 0.2s; text-align: left; }
.antwoord-btn:hover { background: #4f46e5; color: white; }
.antwoord-btn.correct { background: #16a34a; color: white; border-color: #16a34a; }
.antwoord-btn.fout { background: #dc2626; color: white; border-color: #dc2626; }
.antwoord-btn:disabled { cursor: not-allowed; opacity: 0.8; }
.feedback { padding: 0.8rem; border-radius: 6px; margin-top: 0.3rem; font-size: 0.9rem; }
.feedback.correct { background: #dcfce7; color: #166534; border-left: 4px solid #16a34a; }
.feedback.fout { background: #fee2e2; color: #991b1b; border-left: 4px solid #dc2626; }
.eindterm-box { background: #eff6ff; border-left: 5px solid #3b82f6; padding: 0.8rem; border-radius: 6px; color: #1e40af; font-size: 0.9rem; margin-bottom: 1.5rem; }
.navigatie-knoppen { display: flex; gap: 1rem; justify-content: flex-end; }
.nav-actie { padding: 0.7rem 1.5rem; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; transition: background 0.2s; }
.nav-actie:hover { background: #3730a3; }
.nav-actie.groen { background: #16a34a; }
.nav-actie.groen:hover { background: #15803d; }
#resultaat { display: none; padding: 2rem; text-align: center; }
#resultaat h2 { color: #4f46e5; font-size: 1.8rem; margin-bottom: 1rem; }
.score-groot { font-size: 3rem; font-weight: bold; color: #4f46e5; margin: 1rem 0; }
.beoordeling { padding: 1rem; border-radius: 10px; font-size: 1.1rem; margin: 1rem 0; }
.beoordeling.uitstekend { background: #dcfce7; color: #166534; }
.beoordeling.goed { background: #dbeafe; color: #1e40af; }
.beoordeling.oefenen { background: #fee2e2; color: #991b1b; }
.resultaat-knoppen { display: flex; gap: 1rem; justify-content: center; flex-wrap: wrap; margin-top: 1.5rem; }
.print-btn { padding: 0.7rem 1.5rem; background: #16a34a; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
.opnieuw-btn { padding: 0.7rem 1.5rem; background: #4f46e5; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 1rem; }
@media (max-width: 600px) {
  .antwoorden-grid { grid-template-columns: 1fr; }
  .nav-tabs { flex-direction: column; }
  .header h1 { font-size: 1.5rem; }
}
@media print {
  .nav-tabs, .navigatie-knoppen, .resultaat-knoppen { display: none !important; }
  .hoofdstuk { display: block !important; page-break-after: always; }
  .flip-back { display: block !important; }
}
</style>
</head>
<body>
<div class="container">
  <div class="header">
    <h1>${data.titel}</h1>
    <div class="leerdoelen">
      <h3>🎯 Na deze les kan ik...</h3>
      <ul>${data.leerdoelen.map(d => `<li>${d}</li>`).join('')}</ul>
    </div>
  </div>
  <div class="voortgang-sectie">
    <div>Voortgang: <span id="voortgang-tekst">Hoofdstuk 1 van ${data.hoofdstukken.length}</span></div>
    <div class="voortgang-balk"><div class="voortgang-fill" id="voortgang-fill"></div></div>
  </div>
  <div class="nav-tabs">${hoofdstukkenNav}</div>
  ${hoofdstukkenHTML}
  <div id="resultaat">
    <h2>🎉 Resultaat</h2>
    <div class="score-groot" id="score-display">0 / ${data.hoofdstukken.length}</div>
    <div class="beoordeling" id="beoordeling-tekst"></div>
    <div class="resultaat-knoppen">
      <button class="print-btn" onclick="window.print()">🖨️ Afdrukken</button>
      <button class="opnieuw-btn" onclick="location.reload()">🔄 Opnieuw</button>
    </div>
  </div>
</div>
<script>
var scores = {};
var totaalHoofdstukken = ${data.hoofdstukken.length};

function toonHoofdstuk(index) {
  document.querySelectorAll('.hoofdstuk').forEach(function(h) { h.classList.remove('actief'); });
  document.querySelectorAll('.nav-btn').forEach(function(b) { b.classList.remove('actief'); });
  document.getElementById('hfst-' + index).classList.add('actief');
  document.querySelectorAll('.nav-btn')[index].classList.add('actief');
  var pct = Math.round((index + 1) / totaalHoofdstukken * 100);
  document.getElementById('voortgang-fill').style.width = pct + '%';
  document.getElementById('voortgang-tekst').textContent = 'Hoofdstuk ' + (index + 1) + ' van ' + totaalHoofdstukken;
  window.scrollTo(0, 0);
}

function checkAntwoord(knop, correct, feedbackId, uitleg, hoofdstukIndex) {
  var parent = knop.closest('.antwoorden-grid');
  var alleKnoppen = parent.querySelectorAll('.antwoord-btn');
  alleKnoppen.forEach(function(k) { k.disabled = true; });
  var fb = document.getElementById(feedbackId);
  if (correct) {
    knop.classList.add('correct');
    fb.className = 'feedback correct';
    fb.innerHTML = '✅ Correct! ' + uitleg;
    if (!scores[hoofdstukIndex]) { scores[hoofdstukIndex] = true; }
  } else {
    knop.classList.add('fout');
    fb.className = 'feedback fout';
    fb.innerHTML = '❌ Niet juist. ' + uitleg;
  }
  fb.style.display = 'block';
}

function toonResultaat() {
  document.querySelectorAll('.hoofdstuk').forEach(function(h) { h.classList.remove('actief'); });
  document.getElementById('voortgang-fill').style.width = '100%';
  var aantalCorrect = Object.keys(scores).length;
  var pct = Math.round(aantalCorrect / totaalHoofdstukken * 100);
  document.getElementById('score-display').textContent = aantalCorrect + ' / ' + totaalHoofdstukken;
  var b = document.getElementById('beoordeling-tekst');
  if (pct >= 80) { b.className = 'beoordeling uitstekend'; b.textContent = 'Uitstekend! Je beheerst de leerstof goed.'; }
  else if (pct >= 60) { b.className = 'beoordeling goed'; b.textContent = 'Goed bezig! Herlees de moeilijke hoofdstukken nog eens.'; }
  else { b.className = 'beoordeling oefenen'; b.textContent = 'Oefen nog wat. Ga de leerstof opnieuw door.'; }
  document.getElementById('resultaat').style.display = 'block';
  window.scrollTo(0, 0);
}

toonHoofdstuk(0);
</script>
</body>
</html>`;
}

function callClaude(prompt) {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }]
    });
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(body)
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.error) return reject(new Error(parsed.error.message));
          let text = parsed.content[0].text.trim();
          text = text.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
          resolve(JSON.parse(text));
        } catch (e) {
          reject(new Error('JSON fout: ' + e.message));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
  res.setHeader('Access-Control-Max-Age', '86400');
  if (req.method === 'OPTIONS') { res.writeHead(200); res.end(); return; }

  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { thema, graad, moment, extra } = JSON.parse(body);
        const lesData = await callClaude(buildPrompt(thema, graad, moment, extra));
        const html = buildHTML(lesData, moment);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ html }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

server.listen(PORT, () => { console.log('Server draait op poort ' + PORT); });
