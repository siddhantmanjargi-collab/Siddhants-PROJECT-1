import path from 'path';
import zlib from 'zlib';
import { GoogleGenAI, ThinkingLevel } from '@google/genai';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb',
    },
  },
};

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
  if (rawMime && lowerMime === 'application/pdf') return 'application/pdf';
  if (ext === '.pdf') return 'application/pdf';
  if (
    lowerMime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (lowerMime.startsWith('text/') || ext === '.txt' || ext === '.csv') return 'text/plain';

  return lowerMime;
}

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

      if (entryName === 'word/document.xml' && dataEnd <= buf.length) {
        const rawSlice = buf.subarray(dataStart, dataEnd);
        let xmlStr = '';
        if (compression === 0) {
          xmlStr = rawSlice.toString('utf-8');
        } else if (compression === 8) {
          xmlStr = zlib.inflateRawSync(rawSlice).toString('utf-8');
        }
        if (xmlStr) {
          const text = xmlStr
            .replace(/<\/w:p>/g, '\n')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          chunks.push(text);
        }
        break;
      }
      offset = dataEnd > offset ? dataEnd : offset + 1;
    }
    return chunks.join('\n').trim();
  } catch {
    return '';
  }
}

function stripJsonCodeFences(raw: string): string {
  return raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
}

function cleanCode(str: any): string {
  if (!str || typeof str !== 'string') return '';
  const trimmed = str.trim();
  const upper = trimmed.toUpperCase();
  const invalidWords = [
    'NUMBER', 'NO', 'NO.', 'NUM', 'NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED', 'NIL',
    'NOT AVAILABLE', 'UNKNOWN', 'TBD', 'PENDING', 'NOT APPLICABLE',
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
  `Extract visible asset & document fields from "${filename || 'document'}" as a flat JSON object.
Rules:
- ALWAYS include: "category", "docType", "assetName".
- OMIT any optional field that is not visible in the document (do NOT output empty strings or guess values).
- Format all dates strictly as DD/MM/YYYY.
- "category": one of "vehicular","electronics","camera","watch","appliances","health","identity","property","finance","furniture","jewellery","machinery","subscriptions","other"
- "docType": one of "Vehicle Insurance","Vehicle Registration Certificate (RC)","Invoice","Receipt","Warranty Certificate","Extended Warranty","Service Record","User Manual","Property Document","Health Insurance","Bank / Investment Statement","Subscription / Membership","Other Document"
- Optional fields (include ONLY when present): owner, vendor, manufacturer, model, purchasePrice (with currency symbol), purchaseDate, expiryDate, renewalDate, warrantyType, warrantyStartDate, warrantyEnds, serialNumber, policyNumber, assetId, expressServiceCode, serviceTag, supportPhone, supportEmail, coverageDetails, invoice, verificationUrl, notes (brief 1-2 sentence summary), addOns (string[]), reminders (string[]), contacts (string[]), registrationNumber, engineNumber, chassisNumber, vehicleType, fuelType, cubicCapacity, registrationYear, policyType, coverageType, idv, ncbPercentage, storageOrSpecs, imeiOrMac, lensDetails, watchMovement, propertyAddress, deedNumber, builtUpArea, institutionName, accountOrFolioNumber, applianceType, capacity, energyRating, material, jewelleryType, metalPurity, grossWeightGrams, subscriptionPlan, billingCycle.`;

async function extractWithGeminiKey(
  apiKey: string,
  parts: any[]
): Promise<{ parsed: any; modelUsed: string }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 15000,
      retryOptions: {
        attempts: 1,
      },
    },
  });

  const primaryController = new AbortController();
  const backupController = new AbortController();
  let hedgeTimer: ReturnType<typeof setTimeout> | null = null;
  let settled = false;

  const invokeModel = async (
    modelName: string,
    thinkingLevel: ThinkingLevel,
    signal: AbortSignal
  ): Promise<{ parsed: any; modelUsed: string }> => {
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
      throw new Error(`Empty response from ${modelName}`);
    }
    const parsed = JSON.parse(stripJsonCodeFences(raw));
    return { parsed, modelUsed: modelName };
  };

  return new Promise<{ parsed: any; modelUsed: string }>((resolve, reject) => {
    const errors: any[] = [];
    let backupStarted = false;
    let pendingCount = 1;

    const finishSuccess = (result: { parsed: any; modelUsed: string }) => {
      if (settled) return;
      settled = true;
      if (hedgeTimer) clearTimeout(hedgeTimer);
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
        if (hedgeTimer) clearTimeout(hedgeTimer);
        reject(errors[0] || new Error('Gemini 3.8 document extraction failed.'));
      }
    };

    const startBackup = () => {
      if (settled || backupStarted) return;
      backupStarted = true;
      pendingCount += 1;
      invokeModel('gemini-3.1-flash-lite', ThinkingLevel.MINIMAL, backupController.signal)
        .then(finishSuccess)
        .catch((err) => handleFailure(err, false));
    };

    // Primary model: Gemini 3.8 Flash
    invokeModel('gemini-3.8-flash', ThinkingLevel.LOW, primaryController.signal)
      .then(finishSuccess)
      .catch((err) => handleFailure(err, true));

    // Hedged fast-failover if upstream gemini-3.8-flash experiences queuing (> 2.5s)
    hedgeTimer = setTimeout(() => {
      startBackup();
    }, 2500);
  });
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const apiKeys = resolveServerGeminiKeys();
    if (apiKeys.length === 0) {
      return res.status(500).json({
        success: false,
        error: 'Gemini API key (ASSET_WALLET_FINAL_PROJECT) is not configured in Vercel Environment Variables.',
      });
    }

    const { mimeType, base64Data, textData, filename } = req.body || {};

    if (!base64Data && !textData) {
      return res.status(400).json({ success: false, error: 'No document data provided.' });
    }

    const cleanBase64 =
      typeof base64Data === 'string' && base64Data.includes(',')
        ? base64Data.split(',')[1]
        : typeof base64Data === 'string'
        ? base64Data
        : '';

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
    let lastError: any = null;

    for (const key of apiKeys) {
      try {
        const result = await extractWithGeminiKey(key, parts);
        data = result.parsed;
        break;
      } catch (err: any) {
        lastError = err;
      }
    }

    if (!data) {
      const rawErr = String(lastError?.message || lastError || '');
      const userFriendlyErr =
        rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED')
          ? 'Gemini API rate limit reached (429). Please wait a moment and try scanning again.'
          : `Document scan error: ${rawErr || 'Gemini 3.8 failed to process this document.'}`;
      return res.status(502).json({ success: false, error: userFriendlyErr });
    }

    function cleanVal(v: any): string {
      if (!v || typeof v !== 'string') return '';
      const s = v.trim();
      if (['null', 'undefined', 'n/a', 'none'].includes(s.toLowerCase())) return '';
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
      category: mappedCategory,
      docType: mappedDocType,
      assetName: cleanVal(data.assetName) || cleanVal(data.model) || filename?.replace(/\.[^/.]+$/, '') || 'Scanned Asset',
      owner: cleanVal(data.owner),
      vendor: cleanVal(data.vendor),
      manufacturer: cleanVal(data.manufacturer),
      model: cleanVal(data.model),
      purchasePrice: cleanVal(data.purchasePrice),
      purchaseDate: cleanVal(data.purchaseDate) || cleanVal(data.warrantyStartDate),
      expiryDate: cleanVal(data.expiryDate) || cleanVal(data.warrantyEnds),
      renewalDate: cleanVal(data.renewalDate),
      warrantyEnds: cleanVal(data.warrantyEnds || data.expiryDate),
      warrantyType: cleanVal(data.warrantyType),
      warrantyStartDate: cleanVal(data.warrantyStartDate),
      serialNumber: cleanCode(data.serialNumber || data.serviceTag || data.assetId),
      policyNumber: cleanCode(data.serialNumber),
      invoice: cleanCode(data.invoice),
      verificationUrl: cleanVal(data.verificationUrl),
      notes: cleanVal(data.notes),
      addOns: Array.isArray(data.addOns) ? data.addOns.map(cleanVal).filter(Boolean) : [],
      reminders: Array.isArray(data.reminders) ? data.reminders.map(cleanVal).filter(Boolean) : [],
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

    return res.status(200).json({ success: true, data: sanitizedData });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Document scanning service encountered an unexpected error.',
    });
  }
}
