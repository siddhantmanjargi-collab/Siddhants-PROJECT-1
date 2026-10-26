import React, { useState } from 'react';
import { X, Download, Maximize2, Minimize2, FileText, Eye, Sparkles } from 'lucide-react';
import { DocumentAttachment } from '../types/asset';

interface DocumentViewerModalProps {
  attachment: DocumentAttachment;
  assetName: string;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({
  attachment,
  assetName,
  onClose,
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'ocr'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const handleDownload = () => {
    if (!attachment.base64Data) {
      alert('Document download data is not available.');
      return;
    }
    const link = document.createElement('a');
    link.href = attachment.base64Data.startsWith('data:')
      ? attachment.base64Data
      : `data:${attachment.mimeType};base64,${attachment.base64Data}`;
    link.download = attachment.filename || `${assetName}-document`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const isImage = attachment.mimeType.startsWith('image/');
  const isPdf = attachment.mimeType === 'application/pdf';
  const isText = attachment.mimeType === 'text/plain';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[#080F0D]/90 backdrop-blur-md animate-fade-in">
      <div
        className={`bg-[#16261F] border border-[#2A3B33] shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isFullscreen
            ? 'w-full h-full rounded-none'
            : 'w-full max-w-4xl h-[90vh] rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#1C2E26] border-b border-[#2A3B33] gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-[#C9A15D]/20 text-[#E4C98A] border border-[#C9A15D]/40 uppercase">
              {attachment.mimeType.split('/')[1] || 'DOC'}
            </span>
            <h2 className="text-[#EDEDE1] font-semibold text-sm sm:text-base truncate">
              {attachment.filename || `${assetName} Document`}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex bg-[#16261F] p-0.5 rounded-lg border border-[#2A3B33]">
              <button
                type="button"
                onClick={() => setActiveTab('preview')}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                  activeTab === 'preview'
                    ? 'bg-[#C9A15D] text-[#14211B] font-bold'
                    : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                }`}
              >
                <Eye size={13} /> Preview
              </button>
              {attachment.textData && (
                <button
                  type="button"
                  onClick={() => setActiveTab('ocr')}
                  className={`px-2.5 py-1 rounded text-xs font-mono transition-colors flex items-center gap-1.5 ${
                    activeTab === 'ocr'
                      ? 'bg-[#C9A15D] text-[#14211B] font-bold'
                      : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                  }`}
                >
                  <Sparkles size={13} /> Extracted Text
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleDownload}
              className="p-1.5 rounded-lg bg-[#16261F] text-[#EDEDE1] hover:text-[#C9A15D] border border-[#2A3B33]"
              title="Download file"
            >
              <Download size={16} />
            </button>

            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className="p-1.5 rounded-lg bg-[#16261F] text-[#EDEDE1] hover:text-[#C9A15D] border border-[#2A3B33]"
              title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-[#8FA79B] hover:text-[#EDEDE1] hover:bg-[#2A3B33]"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-auto bg-[#070D0B] p-4 flex items-center justify-center relative">
          {activeTab === 'ocr' ? (
            <div className="w-full max-w-3xl bg-[#1C2E26] border border-[#2A3B33] rounded-xl p-6 text-[#EDEDE1] font-mono text-xs leading-relaxed whitespace-pre-wrap selection:bg-[#C9A15D]">
              <div className="flex items-center gap-2 pb-3 mb-4 border-b border-[#2A3B33] text-[#C9A15D]">
                <Sparkles size={16} />
                <span className="font-bold tracking-wider uppercase">Gemini AI OCR Text Result</span>
              </div>
              {attachment.textData || 'No OCR text extracted.'}
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              {isImage && attachment.base64Data && (
                <img
                  src={
                    attachment.base64Data.startsWith('data:')
                      ? attachment.base64Data
                      : `data:${attachment.mimeType};base64,${attachment.base64Data}`
                  }
                  alt={attachment.filename}
                  className="max-w-full max-h-[75vh] object-contain rounded-lg border border-[#2A3B33] shadow-lg"
                />
              )}

              {isPdf && attachment.base64Data && (
                <iframe
                  src={
                    attachment.base64Data.startsWith('data:')
                      ? attachment.base64Data
                      : `data:application/pdf;base64,${attachment.base64Data}`
                  }
                  title="PDF Viewer"
                  className="w-full h-full min-h-[500px] border-0 rounded-lg"
                />
              )}

              {isText && (
                <div className="w-full max-w-2xl bg-[#1C2E26] border border-[#2A3B33] rounded-xl p-6 text-[#EDEDE1] font-mono text-sm leading-relaxed whitespace-pre-wrap">
                  {attachment.textData}
                </div>
              )}

              {!isImage && !isPdf && !isText && (
                <div className="bg-[#1C2E26] border border-[#2A3B33] rounded-xl p-8 max-w-md text-center">
                  <FileText size={48} className="mx-auto text-[#C9A15D] mb-4" />
                  <h3 className="font-semibold text-[#EDEDE1] text-base mb-1">
                    {attachment.filename}
                  </h3>
                  <p className="text-xs text-[#8FA79B] mb-6">
                    File format ({attachment.mimeType}) can be downloaded to view on your device.
                  </p>
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="px-4 py-2 bg-[#C9A15D] hover:bg-[#E4C98A] text-[#14211B] font-semibold text-sm rounded-lg transition-colors inline-flex items-center gap-2"
                  >
                    <Download size={16} /> Download File
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
