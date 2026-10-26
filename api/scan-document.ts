import path from 'path';
import zlib from 'zlib';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

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

function resolveServerGeminiKey(): string {
  const candidates = [
    process.env.ASSET_WALLET_FINAL_PROJECT,
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

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Method Not Allowed' });
  }

  try {
    const apiKey = resolveServerGeminiKey();
    if (!apiKey) {
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

    const candidateModels = ['gemini-3.8-flash', 'gemini-3.1-flash-lite', 'gemini-flash-latest'];

    let responseText = '';
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
          break;
        }
      } catch (schemaErr: any) {
        const errMsg = String(schemaErr?.message || schemaErr || '');
        lastError = schemaErr;
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
              break;
            }
          } catch (jsonErr: any) {
            lastError = jsonErr;
          }
        }
      }
    }

    if (!responseText) {
      const rawErr = lastError?.message || '';
      const userFriendlyErr =
        rawErr.includes('429') || rawErr.includes('RESOURCE_EXHAUSTED')
          ? 'Gemini API rate limit reached (429). Please wait a moment and try scanning again.'
          : `Document scan error: ${rawErr || 'Both gemini-3.8-flash and gemini-3.6-flash failed to process this document.'}`;
      return res.status(502).json({ success: false, error: userFriendlyErr });
    }

    let data: any = {};
    try {
      data = JSON.parse(stripJsonCodeFences(responseText));
    } catch {
      return res.status(502).json({
        success: false,
        error: 'Received malformed JSON from document scanner. Please try scanning a clearer image or PDF.',
      });
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
