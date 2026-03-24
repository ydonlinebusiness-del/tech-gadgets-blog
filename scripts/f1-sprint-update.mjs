/**
 * F1 Sprint Qualifying Update
 *
 * Prüft bei Sprint-Wochenenden ob die Qualifying-Ergebnisse
 * eine Anpassung der Renntipps erfordern und aktualisiert diese.
 */

import Anthropic from '@anthropic-ai/sdk';
import { chromium } from 'playwright';

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ─────────────────────────────────────────────
// Schritt 1: Sprint-Qualifying prüfen & Update-Entscheidung
// ─────────────────────────────────────────────

async function getSprintUpdate(currentRacePredictions) {
  console.log('[F1] Prüfe Sprint-Wochenende und Qualifying-Ergebnisse...');

  const today = new Date().toLocaleDateString('de-DE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  const prompt = `
Du bist ein F1-Tipp-Assistent. Heute ist ${today}.

Prüfe:
1. Ist heute ein SAMSTAG eines F1 Sprint-Wochenendes?
2. Hat das Qualifying heute bereits stattgefunden?

Falls NEIN zu einer der Fragen:
{"updateNeeded": false, "reason": "kurze Begründung"}

Falls JA:
- Recherchiere die aktuellen Qualifying-Ergebnisse (P1-P10, Grid-Strafen, Auffälligkeiten)
- Aktuelle Renntipps in kicktipp.de (werden separat übergeben): ${JSON.stringify(currentRacePredictions)}
- Entscheide ob Anpassungen nötig sind

Antworte NUR mit JSON (kein Markdown):

{
  "updateNeeded": true,
  "raceName": "Name des Grand Prix",
  "qualifyingResults": ["Nachname_P1", "Nachname_P2", ..., "Nachname_P8"],
  "updatedRace": ["Nachname_P1", ..., "Nachname_P8"],
  "changes": [{"position": 1, "old": "alter Fahrer", "new": "neuer Fahrer"}],
  "reasoning": "Begründung der Änderungen"
}

Falls keine Änderungen nötig: "changes": [] und "updatedRace" identisch mit aktuellen Tipps.
Verwende nur Nachnamen.
`;

  const messages = [{ role: 'user', content: prompt }];
  let response;

  while (true) {
    response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages,
    });

    if (response.stop_reason === 'end_turn') break;

    if (response.stop_reason === 'tool_use') {
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
  if (!textBlock) throw new Error('Keine Textantwort von Claude');

  const jsonMatch = textBlock.text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Kein JSON in Antwort: ${textBlock.text}`);

  return JSON.parse(jsonMatch[0]);
}

// ─────────────────────────────────────────────
// Schritt 2: Aktuelle Renntipps auslesen + ggf. aktualisieren
// ─────────────────────────────────────────────

async function readAndUpdatePredictions() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Login
    console.log('[F1] Login bei kicktipp.de...');
    await page.goto('https://www.kicktipp.de/info/profil/login', { waitUntil: 'networkidle' });
    await page.fill('input[name="loginname"]', process.env.KICKTIPP_USERNAME);
    await page.fill('input[name="passwort"]', process.env.KICKTIPP_PASSWORD);
    await page.click('input[type="submit"], button[type="submit"]');
    await page.waitForLoadState('networkidle');

    if (page.url().includes('login')) throw new Error('Login fehlgeschlagen');
    console.log('[F1] Login erfolgreich');

    // Zur Tippabgabe
    await page.goto('https://www.kicktipp.de/die-audi-gaudi/tippabgabe', { waitUntil: 'networkidle' });

    const selects = await page.$$('select');
    if (selects.length < 12) {
      console.log('[F1] Deadline abgelaufen oder keine Dropdowns verfügbar');
      return;
    }

    // Aktuelle Renntipps auslesen (Dropdowns 4-11 = Rennen P1-P8)
    const currentRacePredictions = [];
    for (let i = 4; i < 12; i++) {
      const selectedText = await selects[i].evaluate(el =>
        el.options[el.selectedIndex]?.text?.trim() ?? ''
      );
      // Nur Nachname extrahieren (Format: "Nachname, Vorname")
      const lastName = selectedText.split(',')[0].trim();
      currentRacePredictions.push(lastName);
    }
    console.log(`[F1] Aktuelle Renntipps: ${currentRacePredictions.join(', ')}`);

    // Claude entscheiden lassen ob Update nötig
    const update = await getSprintUpdate(currentRacePredictions);

    if (!update.updateNeeded) {
      console.log(`[F1] Kein Update nötig: ${update.reason ?? 'Kein Sprint-Wochenende heute'}`);
      return;
    }

    if (!update.changes || update.changes.length === 0) {
      console.log('[F1] Qualifying bestätigt aktuelle Tipps — keine Änderungen nötig');
      console.log(`[F1] Qualifying: ${update.qualifyingResults?.join(', ')}`);
      return;
    }

    // Update-Änderungen anzeigen
    console.log(`[F1] ${update.changes.length} Änderungen werden vorgenommen:`);
    update.changes.forEach(c => console.log(`  P${c.position}: ${c.old} → ${c.new}`));

    // Fahrer-Matching Hilfsfunktion
    function findDriverValue(options, driverLastName) {
      const name = driverLastName.toLowerCase();
      const match = options.find(o =>
        o.label.toLowerCase().startsWith(name) ||
        o.label.toLowerCase().includes(name)
      );
      return match?.value;
    }

    // Renntipps aktualisieren (Dropdowns 4-11)
    for (let i = 0; i < 8; i++) {
      const options = await selects[i + 4].evaluate(el =>
        Array.from(el.options).map(o => ({ value: o.value, label: o.text.trim() }))
      );
      const driverValue = findDriverValue(options, update.updatedRace[i]);
      if (driverValue) {
        await selects[i + 4].selectOption(driverValue);
      }
    }

    // Speichern
    const saveButton = await page.$('button:has-text("Tipps speichern"), input[value*="speichern"]');
    if (saveButton) {
      await saveButton.click();
      await page.waitForLoadState('networkidle');
      console.log('[F1] ✅ Tipps erfolgreich aktualisiert!');
    }

    await page.screenshot({ path: '/tmp/f1-sprint-update-confirmation.png' });

    console.log(`\n[F1] Qualifying: ${update.qualifyingResults?.join(' → ')}`);
    console.log(`[F1] Begründung: ${update.reasoning}`);

  } finally {
    await browser.close();
  }
}

// ─────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────

async function main() {
  try {
    await readAndUpdatePredictions();
  } catch (err) {
    console.error('[F1] Fehler:', err.message);
    process.exit(1);
  }
}

main();
