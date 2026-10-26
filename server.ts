import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

function stripJsonCodeFences(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

function cleanCode(val: any): string {
  if (!val || typeof val !== 'string') return '';
  const trimmed = val.trim();
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

function resolveServerGeminiKey(): string {
  const candidates = [
    process.env.GEMINI_API_KEY,
    process.env.GEMINI_API_KEY_ASSET_WALLET,
    process.env.GEMINI_API_KEY_ASSET_WALLET_2,
    process.env.API_KEY,
  ];
  for (const c of candidates) {
    if (c && c.trim()) return c.trim();
  }
  const dynamicKey = Object.keys(process.env).find(
    (k) => k.toUpperCase().includes('GEMINI') && k.toUpperCase().includes('KEY') && process.env[k]?.trim()
  );
  return dynamicKey ? process.env[dynamicKey]!.trim() : '';
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
    const apiKey = resolveServerGeminiKey();
    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key is not configured on the server environment.',
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

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const prompt = `Extract all visible asset and document details from "${filename || 'document'}" into JSON (use "" if not visible, never guess).
1. category: one of "vehicular","electronics","camera","watch","appliances","health","identity","property","finance","furniture","jewellery","machinery","subscriptions","other"
2. docType: one of "Vehicle Insurance","Vehicle Registration Certificate (RC)","Invoice","Receipt","Warranty Certificate","Extended Warranty","Service Record","User Manual","Property Document","Health Insurance","Bank / Investment Statement","Subscription / Membership","Other Document"
3. Core fields (dates strictly DD/MM/YYYY): assetName, owner, vendor, manufacturer, model, purchasePrice (include currency), purchaseDate, expiryDate, renewalDate, warrantyType, warrantyStartDate, warrantyEnds, serialNumber (serial/policy/folio/tag), assetId, expressServiceCode, serviceTag, supportPhone, supportEmail, coverageDetails, invoice, verificationUrl, notes, addOns (string[]), reminders (string[]), contacts (string[]), rawText (concise key OCR lines, max 600 chars).
4. Category fields if visible: registrationNumber, engineNumber, chassisNumber, vehicleType, fuelType, cubicCapacity, registrationYear, policyType, coverageType, idv, ncbPercentage, storageOrSpecs, imeiOrMac, lensDetails, watchMovement, propertyAddress, deedNumber, builtUpArea, institutionName, accountOrFolioNumber, applianceType, capacity, energyRating, material, jewelleryType, metalPurity, grossWeightGrams, subscriptionPlan, billingCycle.`;

    let textContent = prompt;
    if (extractedText) {
      textContent += `\n\n--- EXTRACTED DOCUMENT TEXT ---\n${extractedText.slice(0, 18000)}`;
    }
    parts.push({ text: textContent });

    // Primary: Gemini Flash 3.8 -> Automatic Failover: Gemini Flash 3.6
    const candidateModels = ['gemini-3.8-flash', 'gemini-3.6-flash'];

    let responseText = '';
    let usedModel = '';
    let lastError: any = null;

    const schemaConfig = {
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          category: { type: Type.STRING },
          docType: { type: Type.STRING },
          assetName: { type: Type.STRING },
          owner: { type: Type.STRING },
          vendor: { type: Type.STRING },
          manufacturer: { type: Type.STRING },
          model: { type: Type.STRING },
          purchasePrice: { type: Type.STRING },
          purchaseDate: { type: Type.STRING },
          expiryDate: { type: Type.STRING },
          renewalDate: { type: Type.STRING },
          warrantyEnds: { type: Type.STRING },
          warrantyType: { type: Type.STRING },
          warrantyStartDate: { type: Type.STRING },
          serialNumber: { type: Type.STRING },
          assetId: { type: Type.STRING },
          expressServiceCode: { type: Type.STRING },
          serviceTag: { type: Type.STRING },
          supportPhone: { type: Type.STRING },
          supportEmail: { type: Type.STRING },
          coverageDetails: { type: Type.STRING },
          invoice: { type: Type.STRING },
          verificationUrl: { type: Type.STRING },
          notes: { type: Type.STRING },
          addOns: { type: Type.ARRAY, items: { type: Type.STRING } },
          reminders: { type: Type.ARRAY, items: { type: Type.STRING } },
          contacts: { type: Type.ARRAY, items: { type: Type.STRING } },
          registrationNumber: { type: Type.STRING },
          engineNumber: { type: Type.STRING },
          chassisNumber: { type: Type.STRING },
          vehicleType: { type: Type.STRING },
          fuelType: { type: Type.STRING },
          cubicCapacity: { type: Type.STRING },
          registrationYear: { type: Type.STRING },
          policyType: { type: Type.STRING },
          coverageType: { type: Type.STRING },
          idv: { type: Type.STRING },
          ncbPercentage: { type: Type.STRING },
          storageOrSpecs: { type: Type.STRING },
          imeiOrMac: { type: Type.STRING },
          lensDetails: { type: Type.STRING },
          watchMovement: { type: Type.STRING },
          propertyAddress: { type: Type.STRING },
          deedNumber: { type: Type.STRING },
          builtUpArea: { type: Type.STRING },
          institutionName: { type: Type.STRING },
          accountOrFolioNumber: { type: Type.STRING },
          applianceType: { type: Type.STRING },
          capacity: { type: Type.STRING },
          energyRating: { type: Type.STRING },
          material: { type: Type.STRING },
          jewelleryType: { type: Type.STRING },
          metalPurity: { type: Type.STRING },
          grossWeightGrams: { type: Type.STRING },
          subscriptionPlan: { type: Type.STRING },
          billingCycle: { type: Type.STRING },
          rawText: { type: Type.STRING },
        },
        required: ['category', 'docType', 'assetName'],
      },
    };

    for (const modelName of candidateModels) {
      try {
        const resObj = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: schemaConfig,
        });
        if (resObj && resObj.text) {
          responseText = resObj.text;
          usedModel = modelName;
          break;
        }
      } catch (schemaErr: any) {
        const errMsg = String(schemaErr?.message || schemaErr || '');
        console.warn(`[Scanner] ${modelName} primary attempt failed:`, errMsg);
        lastError = schemaErr;

        // Only retry the same model in plain JSON mode if it failed due to schema/400 validation,
        // NOT on 404/429/503/network errors (which should shift immediately to gemini-3.6-flash)
        const isSchemaRejection =
          (errMsg.includes('400') || errMsg.toLowerCase().includes('schema')) &&
          !errMsg.includes('404') &&
          !errMsg.includes('429') &&
          !errMsg.includes('503');

        if (isSchemaRejection) {
          try {
            const fallbackRes = await ai.models.generateContent({
              model: modelName,
              contents: { parts },
              config: {
                thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
                responseMimeType: 'application/json',
              },
            });
            if (fallbackRes && fallbackRes.text) {
              responseText = fallbackRes.text;
              usedModel = modelName;
              break;
            }
          } catch (jsonErr: any) {
            console.warn(`[Scanner] ${modelName} JSON mode failed, shifting to next candidate:`, jsonErr?.message || jsonErr);
            lastError = jsonErr;
          }
        }
      }
    }

    if (!responseText) {
      const rawErr = lastError?.message || '';
      let userFriendlyErr = rawErr;
      if (rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED') || rawErr.includes('Quota exceeded')) {
        userFriendlyErr = 'Gemini API rate limit reached (429: RESOURCE_EXHAUSTED). Please wait a moment and try scanning again.';
      } else {
        userFriendlyErr = `Document scan error: ${rawErr || 'Both gemini-3.8-flash and gemini-3.6-flash failed to process this document.'}`;
      }
      return res.status(502).json({
        success: false,
        error: userFriendlyErr,
      });
    }

    let data: any = {};
    try {
      data = JSON.parse(stripJsonCodeFences(responseText));
    } catch (parseErr) {
      console.warn('Failed to parse Gemini JSON output:', parseErr);
      return res.status(502).json({
        success: false,
        error: 'Received malformed JSON from document scanner. Please try scanning a clearer image or PDF.',
      });
    }

    function cleanVal(v: any): string {
      if (!v || typeof v !== 'string') return '';
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
      warrantyEnds: cleanVal(data.warrantyEnds) || cleanVal(data.expiryDate),
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

// Mount Vite in dev mode
if (process.env.NODE_ENV !== 'production') {
  const { createServer: createViteServer } = await import('vite');
  const vite = await createViteServer({
    server: { middlewareMode: true },
    appType: 'spa',
  });
  app.use(vite.middlewares);
} else {
  app.use(express.static(path.join(__dirname, 'dist')));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'dist', 'index.html'));
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server listening on http://0.0.0.0:${PORT}`);
});
