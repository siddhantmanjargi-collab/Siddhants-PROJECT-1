import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load local .env file if present without overriding existing environment variables
function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  try {
    const content = fs.readFileSync(envPath, 'utf-8');
    for (const line of content.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx === -1) continue;
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1);
      }
      if (key && !process.env[key]) {
        process.env[key] = val;
      }
    }
  } catch (err) {
    console.warn('Could not read .env file:', err);
  }
}

loadLocalEnv();

const app = express();
const PORT = 3000;

// Body size limit (max 25MB for document scans)
app.use(express.json({ limit: '25mb' }));

// Sliding window rate-limiter
const rateLimitMap = new Map<string, { count: number; startTime: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 20;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, startTime: now };
  if (now - record.startTime > RATE_LIMIT_WINDOW_MS) {
    record.count = 1;
    record.startTime = now;
  } else {
    record.count += 1;
  }
  rateLimitMap.set(ip, record);
  return record.count <= MAX_REQUESTS_PER_WINDOW;
}

const GEMINI_INLINE_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
]);

function normalizeMimeType(rawMime?: string, filename?: string): string {
  const lowerMime = (rawMime || '').trim().toLowerCase();
  const ext = path.extname(filename || '').toLowerCase();

  if (lowerMime === 'image/jpg' || ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (lowerMime === 'image/png' || ext === '.png') return 'image/png';
  if (lowerMime === 'image/webp' || ext === '.webp') return 'image/webp';
  if (lowerMime === 'image/heic' || ext === '.heic') return 'image/heic';
  if (lowerMime === 'image/heif' || ext === '.heif') return 'image/heif';
  if (lowerMime === 'application/pdf' || ext === '.pdf') return 'application/pdf';
  if (
    lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lowerMime.startsWith('text/') || ext === '.txt' || ext === '.csv') return 'text/plain';

  return lowerMime;
}

// Extract plain text from a .docx (ZIP containing word/document.xml) using Node built-in zlib
function extractDocxText(base64Str: string): string {
  try {
    const buf = Buffer.from(base64Str, 'base64');
    let offset = 0;
    const chunks: string[] = [];

    while (offset + 30 <= buf.length) {
      const sig = buf.readUInt32LE(offset);
      if (sig !== 0x04034b50) {
        offset += 1;
        continue;
      }
      const compression = buf.readUInt16LE(offset + 8);
      const compSize = buf.readUInt32LE(offset + 18);
      const nameLen = buf.readUInt16LE(offset + 26);
      const extraLen = buf.readUInt16LE(offset + 28);
      const entryName = buf.subarray(offset + 30, offset + 30 + nameLen).toString('utf-8');
      const dataStart = offset + 30 + nameLen + extraLen;
      const dataEnd = dataStart + compSize;

      if (entryName === 'word/document.xml' && dataEnd <= buf.length && compSize > 0) {
        const rawEntry = buf.subarray(dataStart, dataEnd);
        const xmlBuf = compression === 8 ? zlib.inflateRawSync(rawEntry) : rawEntry;
        const xml = xmlBuf.toString('utf-8');
        const cleaned = xml
          .replace(/<\/w:p>/g, '\n')
          .replace(/<w:tab\/>/g, '\t')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+\n/g, '\n')
          .replace(/[ \t]{2,}/g, ' ')
          .trim();
        chunks.push(cleaned);
        break;
      }

      offset = dataEnd > offset ? dataEnd : offset + 30;
    }

    return chunks.join('\n').trim();
  } catch (err) {
    console.warn('DOCX text extraction warning:', err);
    return '';
  }
}

function parseModelJsonObject(raw: string): Record<string, any> {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  }
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = cleaned.lastIndexOf('}');
    if (lastBrace > firstBrace) {
      cleaned = cleaned.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = cleaned.lastIndexOf(']');
    if (lastBracket > firstBracket) {
      cleaned = cleaned.slice(firstBracket, lastBracket + 1);
    }
  }

  let parsed = JSON.parse(cleaned);
  if (Array.isArray(parsed)) {
    parsed = parsed.find((item) => item && typeof item === 'object') || {};
  }
  if (parsed && typeof parsed === 'object') {
    if (parsed.data && typeof parsed.data === 'object' && !Array.isArray(parsed.data)) {
      return parsed.data;
    }
    if (parsed.document && typeof parsed.document === 'object' && !Array.isArray(parsed.document)) {
      return parsed.document;
    }
    return parsed;
  }
  throw new Error('Model did not return a valid JSON object.');
}

function cleanCode(val: any): string {
  if (val === null || val === undefined) return '';
  const raw = typeof val === 'number' ? String(val) : typeof val === 'string' ? val : '';
  if (!raw) return '';
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  const invalidWords = [
    'NUMBER', 'NO', 'NUM', 'N/A', 'NA', 'NULL', 'UNDEFINED', 'NONE',
    'REGISTRATION NUMBER', 'ENGINE NUMBER', 'CHASSIS NUMBER', 'POLICY NUMBER',
    'SERIAL NUMBER', 'VIN NUMBER', 'INVOICE NUMBER', 'TRANSACTION ID', 'REF NUMBER'
  ];
  if (invalidWords.includes(upper)) return '';
  if (/^(REGISTRATION|ENGINE|CHASSIS|POLICY|SERIAL|VIN|NUMBER)\s*(NUMBER|NO|NUM)?$/i.test(upper)) return '';
  return trimmed;
}

function resolveServerGeminiKeys(): string[] {
  const rawCandidates = [
    process.env.ASSET_WALLET_FINAL_PROJECT,
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_ASSET_WALLET,
    process.env.GEMINI_API_KEY_ASSET_WALLET_2,
    process.env.API_KEY,
  ];
  for (const envName of Object.keys(process.env)) {
    const upper = envName.toUpperCase();
    if (upper.includes('GEMINI') && upper.includes('KEY')) {
      rawCandidates.push(process.env[envName]);
    }
  }
  const unique: string[] = [];
  for (const c of rawCandidates) {
    const trimmed = c?.trim();
    if (trimmed && !unique.includes(trimmed)) {
      unique.push(trimmed);
    }
  }
  return unique;
}

const EXTRACTION_PROMPT = (filename?: string) =>
  `Perform accurate OCR and structured asset extraction on "${filename || 'document'}". Return ONLY a flat JSON object (never an array).
Rules:
- ALWAYS include: "category", "docType", "assetName", "rawText".
- "rawText": clean verbatim OCR transcription of the key visible text, dates, numbers, line items, and identifiers on the document (up to 2500 characters, newline-separated).
- OMIT any optional field that is not visible in the document (do NOT output empty strings or fabricate values).
- Format all dates strictly as DD/MM/YYYY. Distinguish "expiryDate", "warrantyEnds", and "renewalDate" accurately from the text.
- "category": one of "vehicular","electronics","camera","watch","appliances","health","identity","property","finance","furniture","jewellery","machinery","subscriptions","other"
- "docType": one of "Vehicle Insurance","Vehicle Registration Certificate (RC)","Invoice","Receipt","Warranty Certificate","Extended Warranty","Service Record","User Manual","Property Document","Health Insurance","Bank / Investment Statement","Subscription / Membership","Other Document"
- Optional fields (include ONLY when visible): owner, vendor, manufacturer, model, purchasePrice (include currency symbol), purchaseDate, expiryDate, renewalDate, warrantyType, warrantyStartDate, warrantyEnds, serialNumber, policyNumber, assetId, expressServiceCode, serviceTag, supportPhone, supportEmail, coverageDetails, invoice, verificationUrl, notes (concise 1-2 sentence summary), addOns (string[]), reminders (string[]), contacts (string[]), registrationNumber, engineNumber, chassisNumber, vehicleType, fuelType, cubicCapacity, registrationYear, policyType, coverageType, idv, ncbPercentage, storageOrSpecs, imeiOrMac, lensDetails, watchMovement, propertyAddress, deedNumber, builtUpArea, institutionName, accountOrFolioNumber, applianceType, capacity, energyRating, material, jewelleryType, metalPurity, grossWeightGrams, subscriptionPlan, billingCycle.`;

async function extractWithGeminiKey(
  apiKey: string,
  parts: any[]
): Promise<{ parsed: Record<string, any>; modelUsed: string }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      retryOptions: {
        attempts: 1,
      },
    },
  });

  const primaryController = new AbortController();
  const backupController = new AbortController();
  let hedgeTimer: ReturnType<typeof setTimeout> | null = null;
  let primaryDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let backupDeadlineTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const clearTimers = () => {
    if (hedgeTimer) clearTimeout(hedgeTimer);
    if (primaryDeadlineTimer) clearTimeout(primaryDeadlineTimer);
    if (backupDeadlineTimer) clearTimeout(backupDeadlineTimer);
  };

  const invokeModel = async (
    modelName: string,
    thinkingLevel: ThinkingLevel,
    signal: AbortSignal
  ): Promise<{ parsed: Record<string, any>; modelUsed: string }> => {
    const resObj = await ai.models.generateContent({
      model: modelName,
      contents: { parts },
      config: {
        abortSignal: signal,
        thinkingConfig: { thinkingLevel },
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });
    const raw = resObj?.text?.trim() || '';
    if (!raw) {
      throw new Error(`Empty OCR response from ${modelName}`);
    }
    const parsed = parseModelJsonObject(raw);
    return { parsed, modelUsed: modelName };
  };

  return new Promise<{ parsed: Record<string, any>; modelUsed: string }>((resolve, reject) => {
    const errors: any[] = [];
    let backupStarted = false;
    let pendingCount = 1;

    const finishSuccess = (result: { parsed: Record<string, any>; modelUsed: string }) => {
      if (settled) return;
      settled = true;
      clearTimers();
      primaryController.abort();
      backupController.abort();
      resolve(result);
    };

    const handleFailure = (err: any, isPrimary: boolean) => {
      if (settled) return;
      errors.push(err);
      pendingCount -= 1;

      if (isPrimary && !backupStarted) {
        if (hedgeTimer) clearTimeout(hedgeTimer);
        startBackup();
        return;
      }

      if (pendingCount <= 0 && backupStarted) {
        settled = true;
        clearTimers();
        reject(errors[errors.length - 1] || errors[0] || new Error('Document OCR extraction failed.'));
      }
    };

    const startBackup = () => {
      if (settled || backupStarted) return;
      backupStarted = true;
      pendingCount += 1;
      backupDeadlineTimer = setTimeout(() => backupController.abort(), 32000);
      invokeModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, backupController.signal)
        .then(finishSuccess)
        .catch((err) => handleFailure(err, false));
    };

    // Primary model: Gemini 3.8 Flash
    primaryDeadlineTimer = setTimeout(() => primaryController.abort(), 28000);
    invokeModel('gemini-3.8-flash', ThinkingLevel.LOW, primaryController.signal)
      .then(finishSuccess)
      .catch((err) => handleFailure(err, true));

    // Hedged fast-failover if upstream gemini-3.8-flash queues (> 1.8s)
    hedgeTimer = setTimeout(() => {
      startBackup();
    }, 1800);
  });
}

app.post('/api/scan-document', async (req: Request, res: Response) => {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';

  if (!checkRateLimit(clientIp)) {
    return res.status(429).json({
      success: false,
      error: 'Too many document scan requests. Please wait a minute before scanning again.',
    });
  }

  try {
    const apiKeys = resolveServerGeminiKeys();
    if (apiKeys.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key (ASSET_WALLET_FINAL_PROJECT) is not configured on the server environment.',
      });
    }

    const { mimeType, base64Data, textData, filename } = req.body || {};

    if (!base64Data && !textData) {
      return res.status(400).json({ success: false, error: 'No document data provided.' });
    }

    const cleanBase64 =
      typeof base64Data === 'string' && base64Data.includes(',')
        ? base64Data.split(',').pop()!.trim()
        : typeof base64Data === 'string'
        ? base64Data.trim()
        : '';

    if (cleanBase64 && cleanBase64.length > 28 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: 'File payload is too large. Maximum supported size is 15MB.',
      });
    }

    const normMime = normalizeMimeType(mimeType, filename);
    let extractedText = typeof textData === 'string' ? textData.trim() : '';

    const parts: any[] = [];

    if (normMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
      if (!extractedText && cleanBase64) {
        extractedText = extractDocxText(cleanBase64);
      }
      if (!extractedText) {
        return res.status(400).json({
          success: false,
          error: 'Could not extract readable text from Word (.docx) file. Please upload a PDF or image instead.',
        });
      }
    } else if (normMime === 'text/plain') {
      if (!extractedText && cleanBase64) {
        extractedText = Buffer.from(cleanBase64, 'base64').toString('utf-8');
      }
    } else if (GEMINI_INLINE_MIME_TYPES.has(normMime)) {
      if (cleanBase64) {
        parts.push({
          inlineData: {
            mimeType: normMime,
            data: cleanBase64,
          },
        });
      }
    } else if (!extractedText) {
      return res.status(400).json({
        success: false,
        error: `Unsupported file type (${normMime || 'unknown'}). Please upload a PDF, JPG, PNG, WEBP, DOCX, or TXT document.`,
      });
    }

    let textContent = EXTRACTION_PROMPT(filename);
    if (extractedText) {
      textContent += `\n\n--- EXTRACTED DOCUMENT TEXT ---\n${extractedText.slice(0, 15000)}`;
    }
    parts.push({ text: textContent });

    let data: any = null;
    let usedModel = '';
    let lastError: any = null;

    for (const key of apiKeys) {
      try {
        const result = await extractWithGeminiKey(key, parts);
        data = result.parsed;
        usedModel = result.modelUsed;
        break;
      } catch (err: any) {
        console.warn('[Scanner] Extraction key attempt failed:', err?.message || err);
        lastError = err;
      }
    }

    if (!data) {
      const rawErr = String(lastError?.message || lastError || '');
      let userFriendlyErr = rawErr;
      if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.includes('Quota exceeded')) {
        userFriendlyErr = 'Gemini API rate limit reached (429: RESOURCE_EXHAUSTED). Please wait a moment and try scanning again.';
      } else {
        userFriendlyErr = `Document scan error: ${rawErr || 'Gemini 3.8 failed to process this document.'}`;
      }
      return res.status(502).json({
        success: false,
        error: userFriendlyErr,
      });
    }

    function cleanVal(v: any): string {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v !== 'string') return '';
      const s = v.trim();
      if (
        s.toLowerCase() === 'null' ||
        s.toLowerCase() === 'undefined' ||
        s.toLowerCase() === 'n/a' ||
        s.toLowerCase() === 'none'
      ) {
        return '';
      }
      return s;
    }

    function mapToAppCategory(cat: string): string {
      if (!cat || typeof cat !== 'string') return 'other';
      const c = cat.trim().toLowerCase();
      if (c.includes('vehicle') || c.includes('car') || c.includes('bike') || c.includes('auto') || c.includes('vehicular') || c.includes('motor')) return 'vehicular';
      if (c.includes('camera') || c.includes('optic') || c.includes('lens')) return 'camera';
      if (c.includes('watch') || c.includes('timepiece') || c.includes('wearable')) return 'watch';
      if (c.includes('laptop') || c.includes('phone') || c.includes('electronic') || c.includes('gadget') || c.includes('computer')) return 'electronics';
      if (c.includes('appliance') || c.includes('home appliance')) return 'appliances';
      if (c.includes('health') || c.includes('medical') || c.includes('hospital') || c.includes('doctor') || c.includes('mediclaim')) return 'health';
      if (c.includes('identity') || c.includes('passport') || c.includes('aadhaar') || c.includes('pan') || c.includes('id card') || c.includes('license') || c.includes('licence')) return 'identity';
      if (c.includes('property') || c.includes('real estate') || c.includes('house') || c.includes('land')) return 'property';
      if (c.includes('financial') || c.includes('finance') || c.includes('bank') || c.includes('investment')) return 'finance';
      if (c.includes('furniture')) return 'furniture';
      if (c.includes('jewel') || c.includes('gold') || c.includes('silver') || c.includes('diamond')) return 'jewellery';
      if (c.includes('machinery') || c.includes('equipment')) return 'machinery';
      if (c.includes('subscrip') || c.includes('membership')) return 'subscriptions';
      return 'other';
    }

    function mapToAppDocType(dt: string): string {
      if (!dt || typeof dt !== 'string') return 'Other Document';
      const d = dt.trim().toLowerCase();
      if (d.includes('rc') || d.includes('registration certificate')) return 'Vehicle Registration Certificate (RC)';
      if (d.includes('vehicle insurance') || (d.includes('motor') && d.includes('insurance'))) return 'Vehicle Insurance';
      if (d.includes('health insurance') || d.includes('medical')) return 'Health Insurance';
      if (d.includes('extended warranty')) return 'Extended Warranty';
      if (d.includes('warranty')) return 'Warranty Certificate';
      if (d.includes('invoice')) return 'Invoice';
      if (d.includes('receipt')) return 'Receipt';
      if (d.includes('service') || d.includes('maintenance')) return 'Service Record';
      if (d.includes('manual')) return 'User Manual';
      if (d.includes('property') || d.includes('deed')) return 'Property Document';
      if (d.includes('subscription') || d.includes('membership')) return 'Subscription / Membership';
      if (d.includes('bank') || d.includes('statement')) return 'Bank / Investment Statement';
      return 'Other Document';
    }

    const mappedCategory = mapToAppCategory(data.category);
    const mappedDocType = mapToAppDocType(data.docType);

    const contactsArr = Array.isArray(data.contacts)
      ? data.contacts.map(cleanVal).filter(Boolean)
      : data.contacts
      ? [cleanVal(data.contacts)]
      : [];
    const phoneVal = cleanVal(data.supportPhone);
    if (phoneVal && !contactsArr.some((c: string) => c.includes(phoneVal))) {
      contactsArr.push(`Support Phone: ${phoneVal}`);
    }
    const emailVal = cleanVal(data.supportEmail);
    if (emailVal && !contactsArr.some((c: string) => c.includes(emailVal))) {
      contactsArr.push(`Support Email: ${emailVal}`);
    }

    const sanitizedData = {
      success: true,
      modelUsed: usedModel,
      category: mappedCategory,
      docType: mappedDocType,
      assetName: cleanVal(data.assetName) || (filename ? filename.replace(/\.[^/.]+$/, '') : 'Scanned Asset'),
      owner: cleanVal(data.owner),
      vendor: cleanVal(data.vendor),
      manufacturer: cleanVal(data.manufacturer),
      model: cleanVal(data.model),
      purchasePrice: cleanVal(data.purchasePrice),
      purchaseDate: cleanVal(data.purchaseDate),
      expiryDate: cleanVal(data.expiryDate),
      renewalDate: cleanVal(data.renewalDate),
      warrantyEnds: cleanVal(data.warrantyEnds),
      warrantyType: cleanVal(data.warrantyType),
      warrantyStartDate: cleanVal(data.warrantyStartDate || data.purchaseDate),
      serialNumber: cleanCode(data.serialNumber || data.serviceTag || data.assetId || data.policyNumber || data.accountOrFolioNumber),
      policyNumber: cleanCode(data.policyNumber || data.serialNumber),
      invoice: cleanCode(data.invoice),
      verificationUrl: cleanVal(data.verificationUrl),
      notes: cleanVal(data.notes),
      addOns: Array.isArray(data.addOns) ? data.addOns.map(cleanVal).filter(Boolean) : data.addOns ? [cleanVal(data.addOns)] : [],
      reminders: Array.isArray(data.reminders) ? data.reminders.map(cleanVal).filter(Boolean) : data.reminders ? [cleanVal(data.reminders)] : [],
      contacts: contactsArr,

      registrationNumber: cleanCode(data.registrationNumber),
      engineNumber: cleanCode(data.engineNumber),
      chassisNumber: cleanCode(data.chassisNumber),
      vehicleType: cleanVal(data.vehicleType),
      fuelType: cleanVal(data.fuelType),
      cubicCapacity: cleanVal(data.cubicCapacity),
      registrationYear: cleanVal(data.registrationYear),
      policyType: cleanVal(data.policyType),
      coverageType: cleanVal(data.coverageType),
      idv: cleanVal(data.idv),
      ncbPercentage: cleanVal(data.ncbPercentage),

      serviceTag: cleanCode(data.serviceTag || data.serialNumber),
      expressServiceCode: cleanCode(data.expressServiceCode),
      assetId: cleanCode(data.assetId),
      supportPhone: phoneVal,
      supportEmail: emailVal,
      coverageDetails: cleanVal(data.coverageDetails || data.coverageType),
      storageOrSpecs: cleanVal(data.storageOrSpecs),
      imeiOrMac: cleanCode(data.imeiOrMac),
      lensDetails: cleanVal(data.lensDetails),
      watchMovement: cleanVal(data.watchMovement),

      propertyAddress: cleanVal(data.propertyAddress),
      deedNumber: cleanCode(data.deedNumber),
      builtUpArea: cleanVal(data.builtUpArea),

      institutionName: cleanVal(data.institutionName),
      accountOrFolioNumber: cleanCode(data.accountOrFolioNumber),

      applianceType: cleanVal(data.applianceType),
      capacity: cleanVal(data.capacity),
      energyRating: cleanVal(data.energyRating),

      material: cleanVal(data.material),

      jewelleryType: cleanVal(data.jewelleryType),
      metalPurity: cleanVal(data.metalPurity),
      grossWeightGrams: cleanVal(data.grossWeightGrams),

      subscriptionPlan: cleanVal(data.subscriptionPlan),
      billingCycle: cleanVal(data.billingCycle),

      rawText: cleanVal(data.rawText) || extractedText || '',

      documentClassification: { docType: mappedDocType, confidence: 0.98 },
      assetCategory: { category: mappedCategory, confidence: 0.98 },
      pagesProcessed: 1,
    };

    return res.status(200).json({
      success: true,
      data: sanitizedData,
    });
  } catch (err: any) {
    console.error('Scan API handler exception:', err);
    return res.status(500).json({
      success: false,
      error: err?.message || 'Document scanning service encountered an unexpected error.',
    });
  }
});

// Mount Vite in dev mode (local / AI Studio runtime)
if (!process.env.VERCEL && process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

if (!process.env.VERCEL) {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server listening on http://0.0.0.0:${PORT}`);
  });
}

export default app;
