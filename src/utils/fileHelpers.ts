export interface PreparedDocumentPayload {
  filename: string;
  mimeType: string;
  base64Data: string;
  textData: string;
  previewUrl: string | null;
  sizeBytes: number;
}

export function inferMimeType(file: File): string {
  const rawType = (file.type || '').trim().toLowerCase();
  const name = (file.name || '').toLowerCase();

  if (rawType === 'image/jpg' || name.endsWith('.jpg') || name.endsWith('.jpeg')) {
    return 'image/jpeg';
  }
  if (rawType === 'image/png' || name.endsWith('.png')) {
    return 'image/png';
  }
  if (rawType === 'image/webp' || name.endsWith('.webp')) {
    return 'image/webp';
  }
  if (rawType === 'image/heic' || name.endsWith('.heic')) {
    return 'image/heic';
  }
  if (rawType === 'image/heif' || name.endsWith('.heif')) {
    return 'image/heif';
  }
  if (rawType === 'application/pdf' || name.endsWith('.pdf')) {
    return 'application/pdf';
  }
  if (
    rawType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    name.endsWith('.docx')
  ) {
    return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  }
  if (rawType.startsWith('text/') || name.endsWith('.txt') || name.endsWith('.csv')) {
    return 'text/plain';
  }

  return rawType || 'application/pdf';
}

function optimizeImageDataUrl(
  dataUrl: string,
  originalMime: string
): Promise<{ dataUrl: string; mimeType: string; sizeBytes: number }> {
  return new Promise((resolve) => {
    // HEIC/HEIF may not render in standard HTML Image across all browsers; keep raw bytes
    if (originalMime === 'image/heic' || originalMime === 'image/heif') {
      const b64 = dataUrl.includes(',') ? dataUrl.split(',')[1] || '' : dataUrl;
      resolve({
        dataUrl,
        mimeType: originalMime,
        sizeBytes: Math.round((b64.length * 3) / 4),
      });
      return;
    }

    const img = new Image();
    img.onload = () => {
      const MAX_DIM = 2400;
      let { width, height } = img;

      // Preserve original lossless bytes when <= 2400px and <= 1.2MB for razor-sharp fine-print OCR
      const rawB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] || '' : dataUrl;
      const approxBytes = Math.round((rawB64.length * 3) / 4);

      if (width <= MAX_DIM && height <= MAX_DIM && approxBytes <= 1200 * 1024) {
        resolve({
          dataUrl,
          mimeType: originalMime,
          sizeBytes: approxBytes,
        });
        return;
      }

      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve({ dataUrl, mimeType: originalMime, sizeBytes: approxBytes });
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';

      // Fill white background in case of transparent PNG invoices
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);

      let compressedUrl = canvas.toDataURL('image/jpeg', 0.92);
      let compB64 = compressedUrl.split(',')[1] || '';
      let compBytes = Math.round((compB64.length * 3) / 4);

      // Ensure payload stays safely within serverless body limits (< 3.1MB)
      if (compBytes > 3.1 * 1024 * 1024) {
        compressedUrl = canvas.toDataURL('image/jpeg', 0.82);
        compB64 = compressedUrl.split(',')[1] || '';
        compBytes = Math.round((compB64.length * 3) / 4);
      }

      resolve({
        dataUrl: compressedUrl,
        mimeType: 'image/jpeg',
        sizeBytes: compBytes,
      });
    };

    img.onerror = () => {
      const rawB64 = dataUrl.includes(',') ? dataUrl.split(',')[1] || '' : dataUrl;
      resolve({
        dataUrl,
        mimeType: originalMime,
        sizeBytes: Math.round((rawB64.length * 3) / 4),
      });
    };

    img.src = dataUrl;
  });
}

export function readDocumentFile(file: File): Promise<PreparedDocumentPayload> {
  return new Promise((resolve, reject) => {
    const mimeType = inferMimeType(file);

    // Non-image files (e.g. PDFs) are sent as base64 JSON; cap at 3.2MB binary (~4.3MB base64) so serverless endpoints never reject with HTTP 413
    if (!mimeType.startsWith('image/') && mimeType !== 'text/plain' && file.size > 3.2 * 1024 * 1024) {
      reject(
        new Error(
          'This PDF is larger than 3.2 MB. Please upload a smaller PDF or take a clear photo/screenshot of the document page.'
        )
      );
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => {
      reject(new Error('Could not read the selected file.'));
    };

    if (mimeType === 'text/plain') {
      reader.onload = () => {
        const txt = typeof reader.result === 'string' ? reader.result : '';
        resolve({
          filename: file.name,
          mimeType,
          base64Data: '',
          textData: txt,
          previewUrl: null,
          sizeBytes: file.size,
        });
      };
      reader.readAsText(file);
    } else {
      reader.onload = async () => {
        const rawDataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (mimeType.startsWith('image/')) {
          const optimized = await optimizeImageDataUrl(rawDataUrl, mimeType);
          const base64Data = optimized.dataUrl.includes(',')
            ? optimized.dataUrl.split(',')[1] || ''
            : optimized.dataUrl;
          resolve({
            filename: file.name,
            mimeType: optimized.mimeType,
            base64Data,
            textData: '',
            previewUrl: optimized.dataUrl,
            sizeBytes: optimized.sizeBytes,
          });
        } else {
          const base64Data = rawDataUrl.includes(',')
            ? rawDataUrl.split(',')[1] || ''
            : rawDataUrl;
          resolve({
            filename: file.name,
            mimeType,
            base64Data,
            textData: '',
            previewUrl: null,
            sizeBytes: file.size,
          });
        }
      };
      reader.readAsDataURL(file);
    }
  });
}
