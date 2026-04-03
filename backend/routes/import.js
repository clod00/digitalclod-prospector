const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const supabase = require('../lib/supabase');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

// Column name mapping (flexible header detection)
const COLUMN_MAP = {
  ragione_sociale: ['ragione sociale', 'ragionesociale', 'azienda', 'nome azienda', 'denominazione', 'company'],
  piva: ['p.iva', 'piva', 'partita iva', 'partitaiva', 'vat', 'cf'],
  citta: ['città', 'citta', 'comune', 'city'],
  settore: ['settore', 'categoria', 'sector', 'industry', 'attività'],
  telefono: ['telefono', 'tel', 'phone', 'cellulare', 'mobile'],
  sito_web: ['sito web', 'sito', 'website', 'url', 'web'],
  email_trovata: ['email', 'e-mail', 'mail'],
};

function normalizeHeaders(row) {
  const normalized = {};
  for (const [key, val] of Object.entries(row)) {
    const lowerKey = key.toLowerCase().trim();
    for (const [field, aliases] of Object.entries(COLUMN_MAP)) {
      if (aliases.some(a => lowerKey.includes(a))) {
        normalized[field] = val;
        break;
      }
    }
  }
  return normalized;
}

// POST /api/import/preview — parse file, return preview rows
router.post('/preview', upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const preview = rows.slice(0, 5).map(normalizeHeaders);
    const total = rows.length;

    // Detect which columns were found
    const sampleRow = normalizeHeaders(rows[0] || {});
    const detectedColumns = Object.keys(sampleRow);

    res.json({ preview, total, detectedColumns });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/import/confirm — import all rows with deduplication
router.post('/confirm', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

    const parsed = rows.map(normalizeHeaders).filter(r => r.ragione_sociale);

    // Get existing PIVAs for deduplication
    const pivas = parsed.map(r => r.piva).filter(Boolean);
    const { data: existing } = await supabase
      .from('prospect_leads')
      .select('piva')
      .in('piva', pivas);

    const existingPivas = new Set((existing || []).map(r => r.piva));

    const toInsert = parsed.filter(r => !r.piva || !existingPivas.has(r.piva)).map(r => ({
      ragione_sociale: String(r.ragione_sociale || '').trim(),
      piva: r.piva ? String(r.piva).trim() : null,
      citta: r.citta ? String(r.citta).trim() : null,
      settore: r.settore ? String(r.settore).trim() : null,
      telefono: r.telefono ? String(r.telefono).trim() : null,
      sito_web: r.sito_web ? String(r.sito_web).trim() : null,
      email_trovata: r.email_trovata ? String(r.email_trovata).trim() : null,
      stato: 'da_contattare',
    }));

    if (toInsert.length === 0) {
      return res.json({ inserted: 0, skipped: parsed.length, message: 'Tutti i lead sono già presenti (deduplicazione P.IVA)' });
    }

    const { data, error } = await supabase
      .from('prospect_leads')
      .insert(toInsert)
      .select();

    if (error) throw error;

    res.json({
      inserted: data.length,
      skipped: parsed.length - data.length,
      message: `${data.length} lead importati, ${parsed.length - data.length} duplicati saltati`,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
