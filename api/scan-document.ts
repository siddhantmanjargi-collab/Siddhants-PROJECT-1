import path from 'path';
import zlib from 'zlib';
import { GoogleGenAI, MediaResolution, ThinkingLevel } from '@google/genai';

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

function extractDocxText(base64Str: string): string {
  try {
    const buf = Buffer.from(base64Str, 'base64');
    let offset = 0;
    const headerChunks: string[] = [];
    const bodyChunks: string[] = [];
    const footerChunks: string[] = [];

    const cleanWordXml = (xml: string) =>
      xml
        .replace(/<\/w:tr>/g, '\n')
        .replace(/<\/w:tc>/g, ' | ')
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:tab\/>/g, '\t')
        .replace(/<w:br[^>]*\/>/g, '\n')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/\s+\n/g, '\n')
        .replace(/[ \t]{2,}/g, ' ')
        .trim();

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

      const isWordXml =
        entryName === 'word/document.xml' ||
        /^word\/header\d*\.xml$/i.test(entryName) ||
        /^word\/footer\d*\.xml$/i.test(entryName);

      if (isWordXml && dataEnd <= buf.length && compSize > 0) {
        try {
          const rawSlice = buf.subarray(dataStart, dataEnd);
          const xmlBuf =
            compression === 8
              ? zlib.inflateRawSync(rawSlice)
              : compression === 0
              ? rawSlice
              : null;
          if (xmlBuf) {
            const text = cleanWordXml(xmlBuf.toString('utf-8'));
            if (text) {
              if (entryName.includes('header')) headerChunks.push(text);
              else if (entryName.includes('footer')) footerChunks.push(text);
              else bodyChunks.push(text);
            }
          }
        } catch {
          // Ignore corrupt zip entry
        }
      }
      offset = dataEnd > offset ? dataEnd : offset + 1;
    }
    return [...headerChunks, ...bodyChunks, ...footerChunks].join('\n\n').trim();
  } catch {
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

function cleanCode(str: any): string {
  if (str === null || str === undefined) return '';
  const raw = typeof str === 'number' ? String(str) : typeof str === 'string' ? str : '';
  if (!raw) return '';
  const trimmed = raw.trim();
  const upper = trimmed.toUpperCase();
  const invalidWords = [
    'NUMBER', 'NO', 'NO.', 'NUM', 'NA', 'N/A', 'NONE', 'NULL', 'UNDEFINED', 'NIL',
    'NOT AVAILABLE', 'NOT PROVIDED', 'UNKNOWN', 'TBD', 'PENDING', 'NOT APPLICABLE',
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

const OCR_SYSTEM_INSTRUCTION = `You are a forensic-grade optical character recognition (OCR) and structured document intelligence engine for an Asset & Document Vault.
Your mandate is 100% exhaustive reading accuracy:
1. Inspect EVERY region of every page: top headers, company letterheads, logos, customer/billing/shipping blocks, multi-column tables, line items, tax breakdowns (GST/CGST/SGST/IGST/VAT), serial/IMEI/chassis/engine/policy/folio/invoice/order codes, stamps, seals, footnotes, helpline contacts, and fine print.
2. Read alphanumeric identifiers character-by-character with zero transposition (carefully distinguish 0 vs O, 1 vs I vs l, 5 vs S, 8 vs B, 2 vs Z).
3. Never fabricate, guess, or invent dates, numbers, coverage details, or contacts that are not present in the document.
4. Capture EVERY visible fact: map standard fields to their exact schema keys, place itemized rows in "lineItems", and place any remaining document-specific key-value pairs in "additionalDetails" so zero information on the document is ever lost.`;

const EXTRACTION_PROMPT = (filename?: string) =>
  `Perform exhaustive, high-precision OCR and complete structured extraction on "${filename || 'document'}".
Return ONLY a single flat JSON object (never an array, never markdown fences).

REQUIRED CORE KEYS:
- "category": strictly one of "vehicular" | "electronics" | "camera" | "watch" | "appliances" | "health" | "identity" | "property" | "finance" | "furniture" | "jewellery" | "machinery" | "subscriptions" | "other"
- "docType": strictly one of "Vehicle Insurance" | "Vehicle Registration Certificate (RC)" | "Invoice" | "Receipt" | "Warranty Certificate" | "Extended Warranty" | "Service Record" | "User Manual" | "Property Document" | "Health Insurance" | "Bank / Investment Statement" | "Subscription / Membership" | "Other Document"
- "assetName": full specific asset or policy title (e.g., "Apple MacBook Pro 14-inch (M3 Pro)" or "Maruti Suzuki Baleno Alpha - Comprehensive Motor Policy", never generic words like "Invoice")
- "pagesProcessed": integer count of pages read
- "rawText": complete, faithful verbatim OCR transcription of ALL readable text on the document from top to bottom (headers, addresses, all table rows, codes, totals, terms, stamps, footers — up to 15000 characters, newline-separated).

STRUCTURED ASSET FIELDS (include EVERY field that appears anywhere on the document; omit only if genuinely absent):
- Identity & Parties:
  "owner" (buyer / insured / policyholder / registered owner / account holder full name),
  "customerAddress" (full billing/shipping/registered address of owner/customer),
  "vendor" (seller / dealer / store / insurer / issuing authority name),
  "vendorAddress" (seller / branch / issuer address),
  "vendorTaxId" (seller GSTIN / VAT / Tax ID / CIN / IRDAI Reg No.),
  "customerTaxId" (buyer GSTIN / PAN / Tax ID if printed),
  "manufacturer" (brand / make, e.g., Apple, Dell, Maruti Suzuki, Samsung, Tanishq),
  "model" (exact model / variant / part number / SKU).
- Financials & Dates (format ALL dates strictly as DD/MM/YYYY):
  "purchasePrice" (grand total / total premium / net amount paid WITH currency symbol, e.g., "₹ 1,64,900.00" or "$1,299.00"),
  "subtotalAmount" (taxable value / base amount / own-damage + TP base premium before tax, with currency),
  "taxAmount" (total GST / CGST+SGST / IGST / VAT / tax amount with currency and rate if shown),
  "discountAmount" (discount / trade-in / NCB discount amount if shown),
  "paymentMethod" (e.g., UPI, Credit Card, Net Banking, EMI, Cash, Cheque, Transaction Ref),
  "paymentStatus" (e.g., Paid, Active, Financed, Due),
  "purchaseDate" (invoice date / policy issue or start date / registration date in DD/MM/YYYY),
  "expiryDate" (policy expiry date / validity end date / RC fitness expiry / subscription end date in DD/MM/YYYY),
  "renewalDate" (explicit renewal due date / next premium due date in DD/MM/YYYY — ONLY if stated),
  "warrantyStartDate" (warranty start date in DD/MM/YYYY),
  "warrantyEnds" (warranty expiration date in DD/MM/YYYY — calculate ONLY if document explicitly states purchase/start date + exact warranty duration like "1 Year Warranty" or prints the end date),
  "warrantyType" (exact warranty tier/entitlement, e.g., "1 Year Apple Limited Warranty", "3 Years Onsite ProSupport").
- Primary Identifiers (DO NOT copy a serial number into policyNumber or vice versa — put each code in its true field):
  "serialNumber" (device/product serial number),
  "policyNumber" (insurance policy number / certificate number),
  "invoice" (invoice / bill / receipt number),
  "orderNumber" (order ID / booking ID / reference number / challan number),
  "assetId" (asset tag / system ID / passport No / Aadhaar / PAN / DL / UID / membership ID),
  "serviceTag" (service tag / PSN),
  "expressServiceCode" (express service code),
  "imeiOrMac" (IMEI 1 / IMEI 2 / MAC address / EID),
  "verificationUrl" (any portal URL / QR verification URL / claim or warranty lookup website).
- Domain-Specific Fields (include whenever visible):
  Vehicular: "registrationNumber", "engineNumber", "chassisNumber" (full VIN/chassis), "vehicleType", "fuelType", "cubicCapacity", "registrationYear", "vehicleColor", "seatingCapacity", "rtoLocation", "hypothecation" (financier/bank name), "pucExpiryDate" (DD/MM/YYYY), "odometerReading", "policyType" (Comprehensive / Standalone OD / Third Party), "coverageType", "idv" (Insured Declared Value with currency), "ncbPercentage" (No Claim Bonus %), "deductibleAmount", "nomineeName", "tpaName".
  Electronics / Camera / Watch / Appliances / Furniture / Machinery: "storageOrSpecs" (CPU, RAM, SSD, display, color, configuration), "coverageDetails", "lensDetails", "watchMovement", "applianceType", "capacity", "energyRating", "material".
  Property / Finance / Jewellery / Subscriptions: "propertyAddress", "deedNumber", "builtUpArea", "institutionName", "accountOrFolioNumber", "ifscOrBranch", "jewelleryType", "metalPurity" (e.g., 22K / 18K / 916 / 999), "grossWeightGrams" (include net/stone weight details if shown), "subscriptionPlan", "billingCycle".
- Rich Arrays & Detailed Summary:
  "lineItems": array of {"description": string, "quantity"?: string, "unitPrice"?: string, "amount"?: string} for every product, part, service charge, or premium component row in any table on the document.
  "additionalDetails": array of {"label": string, "value": string} capturing EVERY OTHER visible field, number, code, HSN/SAC, tax rate, place of supply, salesperson, delivery date, member covered, hospital network, waiting period, hallmark HUID, making charges, or metadata printed on the document that is not already in the fields above.
  "addOns": string[] of all add-on covers, riders, included accessories, bundled services, or benefits (e.g., "Zero Depreciation", "Engine & Gearbox Protect", "24x7 Roadside Assistance", "Free Installation").
  "contacts": string[] of ALL phone numbers, toll-free helplines, customer care emails, claim emails, and support websites printed on the document (format clearly like "Customer Care: 1800-123-4567", "Claims Email: care@insurer.com"). Also populate "supportPhone" and "supportEmail" with the primary phone and email.
  "reminders": string[] of actionable date-bound reminders derived strictly from dates/intervals printed on the document (e.g., "Policy expires on 14/08/2026 — renew before midnight", "Next service due at 10,000 km").
  "notes": thorough, comprehensive summary (3–6 sentences) of key terms, conditions, exclusions, warranty rules, tax/payment summary, and important highlights written on the document.`;

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
        systemInstruction: OCR_SYSTEM_INSTRUCTION,
        mediaResolution: MediaResolution.MEDIA_RESOLUTION_HIGH,
        thinkingConfig: { thinkingLevel },
        responseMimeType: 'application/json',
        maxOutputTokens: 8192,
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
      backupDeadlineTimer = setTimeout(() => backupController.abort(), 38000);
      invokeModel('gemini-3.1-flash-lite', ThinkingLevel.LOW, backupController.signal)
        .then(finishSuccess)
        .catch((err) => handleFailure(err, false));
    };

    // Primary model: Gemini 3.8 Flash with High Media Resolution
    primaryDeadlineTimer = setTimeout(() => primaryController.abort(), 36000);
    invokeModel('gemini-3.8-flash', ThinkingLevel.LOW, primaryController.signal)
      .then(finishSuccess)
      .catch((err) => handleFailure(err, true));

    // Hedged fast-failover if upstream gemini-3.8-flash queues (> 3.2s)
    hedgeTimer = setTimeout(() => {
      startBackup();
    }, 3200);
  });
}

async function readParsedBody(req: any): Promise<any> {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  if (typeof req.body === 'string' && req.body.trim()) {
    return JSON.parse(req.body);
  }
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString('utf-8'));
  }
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const rawStr = Buffer.concat(chunks).toString('utf-8').trim();
  return rawStr ? JSON.parse(rawStr) : {};
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

    const body = await readParsedBody(req);
    const { mimeType, base64Data, textData, filename } = body || {};

    if (!base64Data && !textData) {
      return res.status(400).json({ success: false, error: 'No document data provided.' });
    }

    const cleanBase64 =
      typeof base64Data === 'string' && base64Data.includes(',')
        ? base64Data.split(',').pop()!.trim()
        : typeof base64Data === 'string'
        ? base64Data.trim()
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
      textContent += `\n\n--- EXTRACTED DOCUMENT TEXT ---\n${extractedText.slice(0, 30000)}`;
    }
    parts.push({ text: textContent });

    let data: Record<string, any> | null = null;
    let usedModel = '';
    let lastError: any = null;

    for (const key of apiKeys) {
      try {
        const result = await extractWithGeminiKey(key, parts);
        data = result.parsed;
        usedModel = result.modelUsed;
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
          : `Document scan error: ${rawErr || 'OCR service failed to process this document.'}`;
      return res.status(502).json({ success: false, error: userFriendlyErr });
    }

    function cleanVal(v: any): string {
      if (v === null || v === undefined) return '';
      if (typeof v === 'number' || typeof v === 'boolean') return String(v);
      if (typeof v !== 'string') return '';
      const s = v.trim();
      if (['null', 'undefined', 'n/a', 'none', 'not provided', 'not available'].includes(s.toLowerCase())) return '';
      return s;
    }

    function mapToAppCategory(cat: string): string {
      if (!cat || typeof cat !== 'string') return 'other';
      const c = cat.trim().toLowerCase();
      if (c.includes('vehicle') || c.includes('car') || c.includes('bike') || c.includes('auto') || c.includes('vehicular') || c.includes('motor')) return 'vehicular';
      if (c.includes('camera') || c.includes('optic') || c.includes('lens')) return 'camera';
      if (c.includes('watch') || c.includes('timepiece') || c.includes('wearable')) return 'watch';
      if (c.includes('laptop') || c.includes('phone') || c.includes('electronic') || c.includes('gadget') || c.includes('computer') || c.includes('tablet') || c.includes('audio')) return 'electronics';
      if (c.includes('appliance') || c.includes('home appliance') || c.includes('refrigerator') || c.includes('washing') || c.includes('air conditioner')) return 'appliances';
      if (c.includes('health') || c.includes('medical') || c.includes('hospital') || c.includes('doctor') || c.includes('mediclaim')) return 'health';
      if (c.includes('identity') || c.includes('passport') || c.includes('aadhaar') || c.includes('pan') || c.includes('id card') || c.includes('license') || c.includes('licence')) return 'identity';
      if (c.includes('property') || c.includes('real estate') || c.includes('house') || c.includes('land') || c.includes('apartment')) return 'property';
      if (c.includes('financial') || c.includes('finance') || c.includes('bank') || c.includes('investment') || c.includes('mutual fund') || c.includes('deposit')) return 'finance';
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
      if (d.includes('health insurance') || d.includes('medical') || d.includes('mediclaim')) return 'Health Insurance';
      if (d.includes('extended warranty') || d.includes('applecare') || d.includes('care+')) return 'Extended Warranty';
      if (d.includes('warranty') || d.includes('guarantee')) return 'Warranty Certificate';
      if (d.includes('invoice') || d.includes('tax bill') || d.includes('bill of supply')) return 'Invoice';
      if (d.includes('receipt') || d.includes('payment confirmation')) return 'Receipt';
      if (d.includes('service') || d.includes('maintenance') || d.includes('job card')) return 'Service Record';
      if (d.includes('manual') || d.includes('guide')) return 'User Manual';
      if (d.includes('property') || d.includes('deed') || d.includes('sale agreement')) return 'Property Document';
      if (d.includes('subscription') || d.includes('membership')) return 'Subscription / Membership';
      if (d.includes('bank') || d.includes('statement') || d.includes('folio') || d.includes('deposit')) return 'Bank / Investment Statement';
      return 'Other Document';
    }

    const mappedCategory = mapToAppCategory(data.category);
    const mappedDocType = mapToAppDocType(data.docType);

    const contactsArr = Array.isArray(data.contacts)
      ? data.contacts.map(cleanVal).filter(Boolean)
      : data.contacts
      ? [cleanVal(data.contacts)].filter(Boolean)
      : [];
    const phoneVal = cleanVal(data.supportPhone);
    if (phoneVal && !contactsArr.some((c: string) => c.includes(phoneVal))) {
      contactsArr.push(`Support Phone: ${phoneVal}`);
    }
    const emailVal = cleanVal(data.supportEmail);
    if (emailVal && !contactsArr.some((c: string) => c.includes(emailVal))) {
      contactsArr.push(`Support Email: ${emailVal}`);
    }

    const rawLineItems = Array.isArray(data.lineItems)
      ? data.lineItems
          .map((item: any) => {
            if (!item || typeof item !== 'object') return null;
            const description = cleanVal(item.description || item.name || item.item);
            const quantity = cleanVal(item.quantity || item.qty);
            const unitPrice = cleanVal(item.unitPrice || item.rate || item.price);
            const amount = cleanVal(item.amount || item.total);
            if (!description && !amount) return null;
            return {
              description: description || 'Item',
              ...(quantity ? { quantity } : {}),
              ...(unitPrice ? { unitPrice } : {}),
              ...(amount ? { amount } : {}),
            };
          })
          .filter(Boolean)
      : [];

    const knownKeys = new Set([
      'category', 'docType', 'assetName', 'owner', 'vendor', 'manufacturer', 'model',
      'purchasePrice', 'purchaseDate', 'expiryDate', 'renewalDate', 'warrantyEnds',
      'warrantyType', 'warrantyStartDate', 'serialNumber', 'policyNumber', 'invoice',
      'orderNumber', 'verificationUrl', 'notes', 'addOns', 'reminders', 'contacts',
      'lineItems', 'additionalDetails', 'customerAddress', 'vendorAddress', 'vendorTaxId',
      'customerTaxId', 'paymentMethod', 'paymentStatus', 'subtotalAmount', 'taxAmount',
      'discountAmount', 'nomineeName', 'tpaName', 'deductibleAmount', 'hypothecation',
      'pucExpiryDate', 'odometerReading', 'vehicleColor', 'seatingCapacity', 'rtoLocation',
      'ifscOrBranch', 'registrationNumber', 'engineNumber', 'chassisNumber', 'vehicleType',
      'fuelType', 'cubicCapacity', 'registrationYear', 'policyType', 'coverageType',
      'idv', 'ncbPercentage', 'serviceTag', 'expressServiceCode', 'assetId', 'supportPhone',
      'supportEmail', 'coverageDetails', 'storageOrSpecs', 'imeiOrMac', 'lensDetails',
      'watchMovement', 'propertyAddress', 'deedNumber', 'builtUpArea', 'institutionName',
      'accountOrFolioNumber', 'applianceType', 'capacity', 'energyRating', 'material',
      'jewelleryType', 'metalPurity', 'grossWeightGrams', 'subscriptionPlan', 'billingCycle',
      'rawText', 'pagesProcessed', 'documentClassification', 'assetCategory'
    ]);

    const additionalDetailsArr: { label: string; value: string }[] = [];
    const seenLabels = new Set<string>();

    const pushAdditional = (rawLabel: string, rawValue: any) => {
      const label = cleanVal(rawLabel);
      const value = cleanVal(rawValue);
      if (!label || !value) return;
      const norm = label.toLowerCase();
      if (seenLabels.has(norm)) return;
      seenLabels.add(norm);
      additionalDetailsArr.push({ label, value });
    };

    if (Array.isArray(data.additionalDetails)) {
      for (const entry of data.additionalDetails) {
        if (entry && typeof entry === 'object') {
          pushAdditional(entry.label || entry.key || entry.name, entry.value || entry.val);
        }
      }
    } else if (data.additionalDetails && typeof data.additionalDetails === 'object') {
      for (const [k, v] of Object.entries(data.additionalDetails)) {
        pushAdditional(k, v);
      }
    }

    for (const [k, v] of Object.entries(data)) {
      if (knownKeys.has(k)) continue;
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        const prettyLabel = k
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/\s+/g, ' ')
          .trim()
          .replace(/^./, (c) => c.toUpperCase());
        pushAdditional(prettyLabel, v);
      }
    }

    const pureSerial = cleanCode(data.serialNumber);
    const purePolicy = cleanCode(data.policyNumber);
    const pureServiceTag = cleanCode(data.serviceTag);
    const pureAssetId = cleanCode(data.assetId);
    const pureFolio = cleanCode(data.accountOrFolioNumber);
    const primaryIdentifier =
      pureSerial || purePolicy || pureServiceTag || pureAssetId || pureFolio || cleanCode(data.registrationNumber);

    const sanitizedData = {
      modelUsed: usedModel,
      category: mappedCategory,
      docType: mappedDocType,
      assetName:
        cleanVal(data.assetName) ||
        [cleanVal(data.manufacturer), cleanVal(data.model)].filter(Boolean).join(' ') ||
        filename?.replace(/\.[^/.]+$/, '') ||
        'Scanned Asset',
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
      serialNumber: primaryIdentifier,
      policyNumber: purePolicy,
      invoice: cleanCode(data.invoice),
      orderNumber: cleanCode(data.orderNumber),
      verificationUrl: cleanVal(data.verificationUrl),
      notes: cleanVal(data.notes),
      addOns: Array.isArray(data.addOns) ? data.addOns.map(cleanVal).filter(Boolean) : data.addOns ? [cleanVal(data.addOns)].filter(Boolean) : [],
      reminders: Array.isArray(data.reminders) ? data.reminders.map(cleanVal).filter(Boolean) : data.reminders ? [cleanVal(data.reminders)].filter(Boolean) : [],
      contacts: contactsArr,
      lineItems: rawLineItems,
      additionalDetails: additionalDetailsArr,
      customerAddress: cleanVal(data.customerAddress),
      vendorAddress: cleanVal(data.vendorAddress),
      vendorTaxId: cleanCode(data.vendorTaxId),
      customerTaxId: cleanCode(data.customerTaxId),
      paymentMethod: cleanVal(data.paymentMethod),
      paymentStatus: cleanVal(data.paymentStatus),
      subtotalAmount: cleanVal(data.subtotalAmount),
      taxAmount: cleanVal(data.taxAmount),
      discountAmount: cleanVal(data.discountAmount),
      nomineeName: cleanVal(data.nomineeName),
      tpaName: cleanVal(data.tpaName),
      deductibleAmount: cleanVal(data.deductibleAmount),
      hypothecation: cleanVal(data.hypothecation),
      pucExpiryDate: cleanVal(data.pucExpiryDate),
      odometerReading: cleanVal(data.odometerReading),
      vehicleColor: cleanVal(data.vehicleColor),
      seatingCapacity: cleanVal(data.seatingCapacity),
      rtoLocation: cleanVal(data.rtoLocation),
      ifscOrBranch: cleanVal(data.ifscOrBranch),
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
      serviceTag: pureServiceTag,
      expressServiceCode: cleanCode(data.expressServiceCode),
      assetId: pureAssetId,
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
      accountOrFolioNumber: pureFolio,
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
      pagesProcessed: Number(data.pagesProcessed) > 0 ? Number(data.pagesProcessed) : 1,
    };

    return res.status(200).json({ success: true, data: sanitizedData });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: err?.message || 'Document scanning service encountered an unexpected error.',
    });
  }
}
