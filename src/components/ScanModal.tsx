import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  Upload,
  Camera,
  Sparkles,
  AlertCircle,
  FileText
} from 'lucide-react';
import { Asset, ScanResultData } from '../types/asset';
import { readDocumentFile } from '../utils/fileHelpers';
import { ExtractedAssetReviewForm } from './ExtractedAssetReviewForm';

interface ScanModalProps {
  onClose: () => void;
  onSaveAsset: (asset: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>) => void;
}

type ScanStep = 'capture' | 'scanning' | 'review';

export const ScanModal: React.FC<ScanModalProps> = ({ onClose, onSaveAsset }) => {
  const [step, setStep] = useState<ScanStep>('capture');
  const [fileSizeBytes, setFileSizeBytes] = useState<number>(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [base64Data, setBase64Data] = useState<string>('');
  const [textData, setTextData] = useState<string>('');
  const [mimeType, setMimeType] = useState<string>('');
  const [filename, setFilename] = useState<string>('');

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMsg, setScanStatusMsg] = useState('Preparing document for OCR...');
  const [scanError, setScanError] = useState<string | null>(null);
  const [inlineNotice, setInlineNotice] = useState<string | null>(null);

  // Full structured extraction result (held in memory until user confirms)
  const [extractedData, setExtractedData] = useState<ScanResultData | null>(null);

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setInlineNotice(null);
    setScanError(null);

    try {
      const payload = await readDocumentFile(selectedFile);
      setFilename(payload.filename);
      setMimeType(payload.mimeType);
      setBase64Data(payload.base64Data);
      setTextData(payload.textData);
      setPreviewUrl(payload.previewUrl);
      setFileSizeBytes(payload.sizeBytes);
    } catch (err: any) {
      setInlineNotice(err?.message || 'Unable to read selected file.');
    }
  };

  const startCamera = async () => {
    setInlineNotice(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch {
      setInlineNotice('Camera access unavailable. Please check permissions or upload a file directly.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const rawW = videoRef.current.videoWidth || 1280;
    const rawH = videoRef.current.videoHeight || 720;
    const MAX_DIM = 1600;
    const ratio = Math.min(1, MAX_DIM / rawW, MAX_DIM / rawH);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(rawW * ratio);
    canvas.height = Math.round(rawH * ratio);
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      const rawB64 = dataUrl.split(',')[1] || '';
      setPreviewUrl(dataUrl);
      setBase64Data(rawB64);
      setTextData('');
      setMimeType('image/jpeg');
      setFilename(`Camera_Scan_${new Date().toISOString().slice(0, 10)}.jpg`);
      setFileSizeBytes(Math.round((rawB64.length * 3) / 4));
    }
    stopCamera();
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const triggerScan = async () => {
    if (!base64Data && !textData) {
      setInlineNotice('Please upload a document or capture a photo first.');
      return;
    }

    setInlineNotice(null);
    setScanError(null);
    setStep('scanning');
    setScanProgress(22);
    setScanStatusMsg('Extracting document fields...');

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => (prev < 92 ? prev + 14 : prev));
    }, 300);

    try {
      const response = await fetch('/api/scan-document', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mimeType,
          base64Data,
          textData,
          filename,
        }),
      });

      clearInterval(progressTimer);
      setScanProgress(100);

      let resData: any = null;
      try {
        resData = await response.json();
      } catch {
        setScanError(`Server returned invalid response (HTTP ${response.status}).`);
        setScanStatusMsg('Scanning interrupted');
        return;
      }

      if (!response.ok || !resData?.success) {
        setScanError(resData?.error || `Document scan failed (HTTP ${response.status}).`);
        setScanStatusMsg('Scanning paused');
        return;
      }

      setExtractedData(resData.data as ScanResultData);
      setStep('review');
    } catch (err: any) {
      clearInterval(progressTimer);
      setScanError(err?.message || 'Network error while contacting the document scanner.');
      setScanStatusMsg('Connection error');
    }
  };

  const handleConfirmSave = (
    assetPayload: Omit<Asset, 'id' | 'userId' | 'createdAt' | 'updatedAt'>
  ) => {
    onSaveAsset(assetPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#080F0D]/85 backdrop-blur-md">
      <div
        className={`bg-[#16261F] border border-[#2A3B33] rounded-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden transition-all duration-200 ${
          step === 'review' ? 'max-w-5xl' : 'max-w-xl'
        }`}
      >
        {/* Header */}
        <div className="p-4 sm:p-5 bg-[#1C2E26] border-b border-[#2A3B33] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#C9A15D]/15 text-[#E4C98A] border border-[#C9A15D]/30">
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-lg font-serif font-medium text-[#EDEDE1]">
                {step === 'review' ? 'Review & Edit Extracted Details' : 'Scan Document'}
              </h2>
              <p className="text-xs text-[#8FA79B]">
                {step === 'review'
                  ? 'Inspect all extracted fields and edit anything needed before storing'
                  : 'Upload a file or snap a photo · Review & edit extracted details before storing'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="p-1.5 rounded-lg text-[#8FA79B] hover:text-[#EDEDE1] hover:bg-[#2A3B33]"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-5">
          {inlineNotice && (
            <div className="p-3 rounded-lg bg-[#C97B6B]/15 border border-[#C97B6B]/40 text-xs text-[#C97B6B] flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{inlineNotice}</span>
            </div>
          )}

          {step === 'capture' && (
            <div className="space-y-4">
              {isCameraActive ? (
                <div className="relative rounded-xl overflow-hidden bg-black border border-[#2A3B33] aspect-video flex items-center justify-center">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute bottom-4 flex gap-3">
                    <button
                      type="button"
                      onClick={capturePhoto}
                      className="px-4 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold text-xs rounded-lg shadow-lg flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Camera size={14} /> Capture Photo
                    </button>
                    <button
                      type="button"
                      onClick={stopCamera}
                      className="px-4 py-2 bg-[#1C2E26] text-[#EDEDE1] text-xs rounded-lg border border-[#2A3B33] whitespace-nowrap"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : previewUrl ? (
                <div className="relative rounded-xl overflow-hidden bg-[#070D0B] border border-[#2A3B33] max-h-56 flex items-center justify-center p-2">
                  <img
                    src={previewUrl}
                    alt="Document preview"
                    referrerPolicy="no-referrer"
                    className="max-h-48 object-contain rounded-md"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPreviewUrl(null);
                      setFilename('');
                      setBase64Data('');
                      setTextData('');
                      setFileSizeBytes(0);
                    }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-[#080F0D]/80 text-[#C97B6B] hover:bg-[#080F0D]"
                  >
                    <X size={16} />
                  </button>
                </div>
              ) : (
                <label className="border-2 border-dashed border-[#2A3B33] hover:border-[#C9A15D] rounded-xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-colors group">
                  <Upload size={32} className="text-[#8FA79B] group-hover:text-[#C9A15D] transition-colors mb-3" />
                  <span className="text-sm font-medium text-[#EDEDE1]">
                    Select a document file to extract
                  </span>
                  <span className="text-xs text-[#8FA79B] mt-1 font-mono">
                    PDF · JPG · PNG · WEBP · DOCX · TXT
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf,.pdf,.docx,.txt,text/plain"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>
              )}

              {filename && !isCameraActive && (
                <div className="p-3 bg-[#1C2E26] border border-[#2A3B33] rounded-lg flex items-center justify-between text-xs font-mono text-[#EDEDE1]">
                  <span className="flex items-center gap-2 truncate">
                    <FileText size={14} className="text-[#C9A15D] shrink-0" />
                    <span className="truncate">{filename}</span>
                  </span>
                  <span className="text-[#C9A15D] tabular-nums shrink-0 ml-2">
                    {(fileSizeBytes / 1024).toFixed(1)} KB
                  </span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={startCamera}
                  className="py-2.5 px-4 bg-[#1C2E26] hover:bg-[#2A3B33] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-xs font-semibold text-[#EDEDE1] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Camera size={16} className="text-[#C9A15D]" /> Use Camera
                </button>

                <button
                  type="button"
                  onClick={triggerScan}
                  disabled={!base64Data && !textData}
                  className="py-2.5 px-4 bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-40 disabled:cursor-not-allowed text-[#14211B] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md whitespace-nowrap"
                >
                  <Sparkles size={16} /> Scan &amp; Extract
                </button>
              </div>
            </div>
          )}

          {step === 'scanning' && (
            <div className="py-10 text-center space-y-6">
              <div className="relative w-20 h-20 mx-auto flex items-center justify-center">
                <div className="absolute inset-0 rounded-full border-2 border-[#C9A15D]/20 border-t-[#C9A15D] animate-spin" />
                <Sparkles size={28} className="text-[#E4C98A]" />
              </div>

              <div>
                <h3 className="text-base font-semibold text-[#EDEDE1] mb-1">
                  Extracting Asset Details
                </h3>
                <p className="text-xs text-[#8FA79B] font-mono">{scanStatusMsg}</p>
              </div>

              <div className="w-full bg-[#1C2E26] h-2 rounded-full overflow-hidden max-w-sm mx-auto">
                <div
                  className="bg-[#C9A15D] h-full transition-transform duration-300 origin-left"
                  style={{ transform: `scaleX(${scanProgress / 100})` }}
                />
              </div>

              {scanError && (
                <div className="p-4 bg-[#C97B6B]/15 border border-[#C97B6B]/40 rounded-xl text-xs text-[#C97B6B] text-left space-y-2">
                  <p className="font-semibold flex items-center gap-1.5">
                    <AlertCircle size={15} /> Document Scan Failed
                  </p>
                  <p className="text-[#EDEDE1]/90">{scanError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setStep('capture');
                    }}
                    className="px-3 py-1.5 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] text-[#EDEDE1] rounded-lg font-mono text-[11px]"
                  >
                    Try Another File or Photo
                  </button>
                </div>
              )}
            </div>
          )}

          {step === 'review' && extractedData && (
            <ExtractedAssetReviewForm
              extractedData={extractedData}
              fileMeta={{
                filename,
                mimeType,
                base64Data,
                textData,
                previewUrl,
                sizeBytes: fileSizeBytes,
              }}
              submitLabel="Confirm & Store Asset"
              onRescan={() => setStep('capture')}
              onCancelOrSkip={onClose}
              cancelOrSkipLabel="Discard without storing"
              onConfirmSave={handleConfirmSave}
            />
          )}
        </div>
      </div>
    </div>
  );
};
