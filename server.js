const https = require('https');
const http = require('http');

const PORT = process.env.PORT || 3000;

const momentInstructies = {
  'voor de les': `
DOEL: Voorkennis activeren en nieuwsgierigheid wekken.
- Stel open vragen zoals "Wat weet jij al over...?" zonder goed/fout
- Gebruik poll-achtige vragen waar leerlingen een mening geven
- Prikkel met een verrassend weetje
- Geen toetsing, wel nadenken
- Toon aan het einde: "Benieuwd wat je na de les anders denkt?"
- Quiz-vragen zijn exploratief: geen rood/groen maar "Interessant! Na de les weet je meer."`,
  'tijdens de les': `
DOEL: Verdieping, verwerking en actief leren.
- Geef duidelijke uitleg per hoofdstuk met voorbeelden uit de leefwereld van de leerlingen
- Verwerk nieuwe begrippen stap voor stap
- Wisselende activiteiten: quiz, flip cards, invuloefeningen
- Bij fout antwoord: uitgebreide remediëring met extra uitleg
- Voortgangsbalk actief zodat leerlingen weten waar ze zijn`,
  'na de les': `
DOEL: Toetsing van wat geleerd is.
- Gerichte vragen over de leerstof
- Duidelijk goed/fout met score bijhouden
- Bij fout antwoord: remediëring met verwijzing naar het juiste hoofdstuk
- Eindscore met beoordeling:
  * 80-100%: "Uitstekend! Je beheerst de leerstof."
  * 60-79%: "Goed bezig! Herlees de leerstof."
  * onder 60%: "Oefen nog wat. Herlees de leerstof."
- Overzicht tonen van alle antwoorden na afloop`
};

function buildPrompt(thema, graad, moment, extra) {
  const momentTekst = momentInstructies[moment] || momentInstructies['tijdens de les'];

  return `Jij bent een ervaren Belgische leerkracht en webdesigner. Maak een volledige interactieve HTML-pagina (alles inline, één bestand) voor leerlingen.

GEGEVENS:
- Thema: ${thema}
- Graad: ${graad}
- Moment: ${moment}
- Extra wensen: ${extra || 'geen'}

${momentTekst}

VERPLICHTE STRUCTUUR:
1. HEADER
   - Titel van het thema met emoji
   - Leerdoelen: "Na deze les kan ik..." (3 concrete doelen, passend bij de graad)
   - Voortgangsbalk (JavaScript, updatet bij elk hoofdstuk)

2. HOOFDSTUKKEN (verplicht 3 tot 5)
   - Elk hoofdstuk heeft een duidelijke titel
   - Educatieve inhoud afgestemd op de graad (max 100 woorden per hoofdstuk)
   - Minstens één interactieve activiteit per hoofdstuk
   - Onderaan elk hoofdstuk: "📌 Eindterm: [relevante Belgische eindterm of ZILL-doelstelling]"

3. INTERACTIVITEIT - TECHNISCH VERPLICHT:
   - Gebruik GEEN addEventListener, gebruik alleen onclick="functionNaam(this)" direct op de knop
   - Alle functies definiëren als window.functionNaam = function() {} zodat ze globaal beschikbaar zijn
   - Quiz voorbeeld:
     <button onclick="checkAntwoord(this, true, 'feedback-1')">Antwoord A</button>
     <button onclick="checkAntwoord(this, false, 'feedback-1')">Antwoord B</button>
     <div id="feedback-1" style="display:none"></div>
   - Navigatie: gebruik anchor links href="#hoofdstuk1" voor navigatie tussen hoofdstukken
   - Flip cards: <div class="card" onclick="this.classList.toggle('flipped')">...</div>
   - Voortgangsbalk: update via window.updateProgress = function(stap, totaal) {}
   - Bij fout antwoord: rode feedback + remediëringstekst
   - Eindscore: tel correct bij elke checkAntwoord aanroep

4. FOOTER
   - Eindscore (x van y correct)
   - Beoordeling op basis van score
   - Printknop via onclick="window.print()"

OPMAAK:
- Navigatiebalk bovenaan met alle hoofdstuktitels als anchor links
- Kleurrijk, overzichtelijk, gebruik emoji's
- Responsive (werkt op tablet en computer)
- @media print: verberg knoppen, toon alle inhoud
- Alles in het Nederlands
- Woordenschat en zinsbouw passend bij: ${graad}

Geef ALLEEN de volledige HTML-code terug, geen uitleg, geen backticks.`;
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
          text = text.replace(/^```html\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
          resolve(text);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'POST' && req.url === '/generate') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const { thema, graad, moment, extra } = JSON.parse(body);
        const prompt = buildPrompt(thema, graad, moment, extra);
        const html = await callClaude(prompt);

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

server.listen(PORT, () => {
  console.log(`Server draait op poort ${PORT}`);
});
