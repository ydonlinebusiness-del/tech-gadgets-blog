/**
 * F1 Kicktipp Predictions
 *
 * 1. Verwendet Claude API (mit web_search) um F1-Kalender zu prüfen und Prognosen zu erstellen
 * 2. Verwendet Playwright um die Prognosen auf kicktipp.de einzutragen
 */

import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Schritt 1: F1-Recherche & Prognosen via Claude
// ─────────────────────────────────────────────

async function getF1Predictions() {
  console.log('[F1] Recherchiere F1-Kalender und aktuelle Daten...');

  const prompt = `
Du bist ein F1-Tipp-Assistent. Heute ist der ${new Date().toLocaleDateString('de-DE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.

Prüfe den aktuellen F1-Kalender 2025/2026:
1. Findet in den nächsten 4 Tagen ein F1-Rennwochenende statt?
2. Falls JA: Recherchiere aktuelle Daten (WM-Stand, letzte 3 Rennen, Strecke, Wetter, Grid-Strafen)
3. Erstelle Prognosen für das Wochenende

Antworte NUR mit einem validen JSON-Objekt (kein Markdown, keine Erklärung davor/danach):

Falls KEIN Rennen in den nächsten 4 Tagen:
{"raceNeeded": false, "reason": "kurze Begründung"}

Falls Rennen ansteht:
{
  "raceNeeded": true,
  "raceName": "Name des Grand Prix",
  "circuit": "Streckenname",
  "raceDate": "YYYY-MM-DD",
  "weekendType": "sprint" oder "normal",
  "qualifying": ["Nachname1", "Nachname2", "Nachname3", "Nachname4"],
  "race": ["Nachname1", "Nachname2", "Nachname3", "Nachname4", "Nachname5", "Nachname6", "Nachname7", "Nachname8"],
  "reasoning": "Kurze Begründung der Tipp-Strategie"
}

Verwende nur Nachnamen der Fahrer (z.B. "Verstappen", "Hamilton", "Leclerc").
`;

  const messages = [{ role: 'user', content: prompt }];
  let response;

  // Agentic loop für tool use
  while (true) {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
      // Tool-Ergebnisse sammeln und Konversation fortführen
      messages.push({ role: 'assistant', content: response.content });
      const toolResults = response.content
        .filter(b => b.type === 'tool_use')
        .map(b => ({ type: 'tool_result', tool_use_id: b.id, content: '' }));
      messages.push({ role: 'user', content: toolResults });
    } else {
      break;
    }
  }

  const textBlock = response.content.find(b => b.type === 'text');
  if (!textBlock) throw new Error('Keine Textantwort von Claude erhalten');

  // JSON aus der Antwort extrahieren
  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Kein JSON in Antwort: ${textBlock.text}`);

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────
// Schritt 2: Prognosen auf kicktipp.de eintragen
// ─────────────────────────────────────────────

async function enterPredictions(predictions) {
  console.log(`[F1] Trage Prognosen ein für: ${predictions.raceName}`);
  console.log(`[F1] Qualifying: ${predictions.qualifying.join(', ')}`);
  console.log(`[F1] Rennen: ${predictions.race.join(', ')}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('[F1] Logge ein bei kicktipp.de...');
    await page.goto('https://www.kicktipp.de/info/profil/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="loginname"]', process.env.KICKTIPP_USERNAME);
    await page.fill('input[name="passwort"]', process.env.KICKTIPP_PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForLoadState('networkidle');

    // Prüfe ob Login erfolgreich
    if (page.url().includes('login')) {
      throw new Error('Login fehlgeschlagen - bitte Credentials prüfen');
    }
    console.log('[F1] Login erfolgreich');

    // Navigiere zur Tippabgabe
    await page.goto('https://www.kicktipp.de/die-audi-gaudi/tippabgabe', { waitUntil: 'networkidle' });

    // Finde alle Select-Dropdowns
    const selects = await page.$$('select');
    console.log(`[F1] ${selects.length} Dropdowns gefunden`);

    if (selects.length < 12) {
      console.log('[F1] Warnung: Weniger als 12 Dropdowns - Deadline evtl. abgelaufen');
      return;
    }

    // Fahrernamen aus Dropdowns lesen
    const getDriverOptions = async (select) => {
      return await select.evaluate(el =>
        Array.from(el.options).map(o => ({ value: o.value, label: o.text.trim() }))
      );
    };

    // Fahrer-Matching: findet den korrekten Dropdown-Wert für einen Fahrernamen
    function findDriverValue(options, driverLastName) {
      const name = driverLastName.toLowerCase();
      // Exakter Match im Label (Format: "Nachname, Vorname")
      const match = options.find(o =>
        o.label.toLowerCase().startsWith(name) ||
        o.label.toLowerCase().includes(name)
      );
      if (!match) {
        console.log(`[F1] Warnung: Fahrer '${driverLastName}' nicht in Dropdown gefunden`);
        console.log(`[F1] Verfügbare Optionen: ${options.map(o => o.label).join(', ')}`);
      }
      return match?.value;
    }

    // Qualifying/Sprint (erste 4 Dropdowns) befüllen
    console.log('[F1] Trage Qualifying/Sprint-Tipps ein...');
    for (let i = 0; i < 4; i++) {
      const options = await getDriverOptions(selects[i]);
      const driverValue = findDriverValue(options, predictions.qualifying[i]);
      if (driverValue) {
        await selects[i].selectOption(driverValue);
        console.log(`[F1] Qualifying P${i + 1}: ${predictions.qualifying[i]}`);
      }
    }

    // Rennen (nächste 8 Dropdowns) befüllen
    console.log('[F1] Trage Rennen-Tipps ein...');
    for (let i = 0; i < 8; i++) {
      const options = await getDriverOptions(selects[i + 4]);
      const driverValue = findDriverValue(options, predictions.race[i]);
      if (driverValue) {
        await selects[i + 4].selectOption(driverValue);
        console.log(`[F1] Rennen P${i + 1}: ${predictions.race[i]}`);
      }
    }

    // Speichern
    const saveButton = await page.$('button:has-text("Tipps speichern"), input[value*="speichern"]');
    if (saveButton) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      console.log('[F1] ✅ Tipps erfolgreich gespeichert!');
    } else {
      console.log('[F1] Warnung: "Tipps speichern" Button nicht gefunden');
    }

    // Screenshot
    await page.screenshot({ path: '/tmp/f1-predictions-confirmation.png' });
    console.log('[F1] Screenshot gespeichert: /tmp/f1-predictions-confirmation.png');

  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  try {
    const predictions = await getF1Predictions();

    if (!predictions.raceNeeded) {
      console.log(`[F1] Kein Rennen in den nächsten 4 Tagen. ${predictions.reason ?? ''}`);
      process.exit(0);
    }

    console.log(`[F1] Rennen gefunden: ${predictions.raceName} (${predictions.weekendType})`);
    console.log(`[F1] Strategie: ${predictions.reasoning}`);

    await enterPredictions(predictions);

    console.log('\n[F1] ✅ Fertig!');
    console.log(`Qualifying: ${predictions.qualifying.join(' → ')}`);
    console.log(`Rennen: ${predictions.race.join(' → ')}`);

  } catch (err) {
    console.error('[F1] Fehler:', err.message);
    process.exit(1);
  }
}

main();
