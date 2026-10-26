import React, { useState, useRef, useEffect } from 'react';
import {
  Eye,
  EyeOff,
  User as UserIcon,
  Lock,
  Upload,
  Camera,
  Sparkles,
  FileText,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  X
} from 'lucide-react';
import { VaultDial } from './VaultDial';
import { Asset, AssetCategory, DocumentAttachment, DocumentType, User } from '../types/asset';
import { setStoredUser } from '../utils/storage';
import {
  signUpUser,
  signInUser,
  updateUserDisplayName,
  saveUserAssetToCloud
} from '../lib/supabase';
import { readDocumentFile } from '../utils/fileHelpers';

interface AuthScreenProps {
  onLoginSuccess: (user: User) => void;
}

type OnboardingStep =
  | 'credentials'
  | 'display-name'
  | 'first-document'
  | 'scanning-doc'
  | 'review-doc';

export const AuthScreen: React.FC<AuthScreenProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<OnboardingStep>('credentials');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [pendingUser, setPendingUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState('');

  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [unlocked, setUnlocked] = useState(false);

  // First Document Onboarding Scan State
  const [filename, setFilename] = useState('');
  const [mimeType, setMimeType] = useState('');
  const [base64Data, setBase64Data] = useState('');
  const [textData, setTextData] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileSizeBytes, setFileSizeBytes] = useState(0);

  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [scanProgress, setScanProgress] = useState(0);
  const [scanStatusMsg, setScanStatusMsg] = useState('Analyzing document...');
  const [scanError, setScanError] = useState<string | null>(null);

  // Extracted First Document Fields
  const [extractedCategory, setExtractedCategory] = useState<AssetCategory>('vehicular');
  const [extractedDocType, setExtractedDocType] = useState<DocumentType>('Other Document');
  const [assetName, setAssetName] = useState('');
  const [owner, setOwner] = useState('');
  const [vendor, setVendor] = useState('');
  const [manufacturer, setManufacturer] = useState('');
  const [model, setModel] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [warrantyType, setWarrantyType] = useState('');
  const [warrantyEnds, setWarrantyEnds] = useState('');
  const [invoice, setInvoice] = useState('');
  const [notes, setNotes] = useState('');
  const [addOns, setAddOns] = useState<string[]>([]);
  const [reminders, setReminders] = useState<string[]>([]);
  const [contacts, setContacts] = useState<string[]>([]);
  const [categoryFields, setCategoryFields] = useState<Record<string, string>>({});
  const [rawText, setRawText] = useState('');

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

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const completeAuth = (user: User) => {
    stopCamera();
    setUnlocked(true);
    setStoredUser(user);
    setTimeout(() => {
      onLoginSuccess(user);
    }, 550);
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanUser = username.trim();
    if (!cleanUser) {
      setError('Please enter your username');
      return;
    }

    if (!password || password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsLoading(true);

    try {
      if (mode === 'signup') {
        const res = await signUpUser(cleanUser, password);
        setIsLoading(false);
        if (!res.success || !res.user) {
          setError(res.error || 'Failed to create account.');
          return;
        }
        // Only during new account sign-up: advance to "What should we call you?"
        setPendingUser(res.user);
        setDisplayName('');
        setStep('display-name');
      } else {
        const res = await signInUser(cleanUser, password);
        setIsLoading(false);
        if (!res.success || !res.user) {
          setError(res.error || 'Invalid username or password.');
          return;
        }
        // Returning users go directly into their vault
        completeAuth(res.user);
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error occurred.');
      setIsLoading(false);
    }
  };

  const handleDisplayNameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const cleanName = displayName.trim();
    if (!cleanName) {
      setError('Please enter what we should call you');
      return;
    }

    if (!pendingUser) return;

    setIsLoading(true);
    await updateUserDisplayName(pendingUser.id, pendingUser.email, cleanName);
    const updatedUser: User = {
      ...pendingUser,
      name: cleanName,
    };
    setPendingUser(updatedUser);
    setStoredUser(updatedUser);
    setIsLoading(false);

    // Move to First Document Upload onboarding screen
    setStep('first-document');
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setError('');
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
      setError(err?.message || 'Could not read the selected file.');
    }
  };

  const startCamera = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch {
      setError('Camera access unavailable. Please check browser permissions or upload a file.');
      setIsCameraActive(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 1280;
    canvas.height = videoRef.current.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const rawB64 = dataUrl.split(',')[1] || '';
      setPreviewUrl(dataUrl);
      setBase64Data(rawB64);
      setTextData('');
      setMimeType('image/jpeg');
      setFilename(`First_Document_${new Date().toISOString().slice(0, 10)}.jpg`);
      setFileSizeBytes(Math.round((rawB64.length * 3) / 4));
    }
    stopCamera();
  };

  const triggerOnboardingScan = async () => {
    if (!base64Data && !textData) {
      setError('Please upload a file or capture a photo first.');
      return;
    }

    setError('');
    setScanError(null);
    setStep('scanning-doc');
    setScanProgress(18);
    setScanStatusMsg('Scanning your document with Gemini Flash...');

    const progressTimer = setInterval(() => {
      setScanProgress((prev) => (prev < 90 ? prev + 10 : prev));
    }, 450);

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
        setScanError(`Server returned an unexpected response (HTTP ${response.status}).`);
        return;
      }

      if (!response.ok || !resData?.success) {
        setScanError(resData?.error || `Document scan failed (HTTP ${response.status}).`);
        return;
      }

      const d = resData.data;
      setExtractedCategory(d.category || 'vehicular');
      setExtractedDocType(d.docType || 'Other Document');
      setAssetName(d.assetName || filename.replace(/\.[^/.]+$/, '') || 'Scanned Asset');
      setOwner(d.owner || pendingUser?.name || '');
      setVendor(d.vendor || '');
      setManufacturer(d.manufacturer || '');
      setModel(d.model || '');
      setPurchasePrice(d.purchasePrice || '');
      setPurchaseDate(d.purchaseDate || '');
      setExpiryDate(d.expiryDate || '');
      setSerialNumber(d.serialNumber || d.policyNumber || d.serviceTag || '');
      setWarrantyType(d.warrantyType || '');
      setWarrantyEnds(d.warrantyEnds || '');
      setInvoice(d.invoice || '');
      setNotes(d.notes || '');
      setAddOns(Array.isArray(d.addOns) ? d.addOns : []);
      setReminders(Array.isArray(d.reminders) ? d.reminders : []);
      setContacts(Array.isArray(d.contacts) ? d.contacts : []);
      setRawText(d.rawText || '');

      const catFields: Record<string, string> = {};
      if (d.registrationNumber) catFields.registrationNumber = d.registrationNumber;
      if (d.engineNumber) catFields.engineNumber = d.engineNumber;
      if (d.chassisNumber) catFields.chassisNumber = d.chassisNumber;
      if (d.policyType) catFields.policyType = d.policyType;
      if (d.idv) catFields.idv = d.idv;
      if (d.storageOrSpecs) catFields.storageOrSpecs = d.storageOrSpecs;
      if (d.serviceTag) catFields.serviceTag = d.serviceTag;
      if (d.propertyAddress) catFields.propertyAddress = d.propertyAddress;
      if (d.institutionName) catFields.institutionName = d.institutionName;
      setCategoryFields(catFields);

      setTimeout(() => {
        setStep('review-doc');
      }, 220);
    } catch (err: any) {
      clearInterval(progressTimer);
      setScanError(err?.message || 'Unable to reach document scanner service.');
    }
  };

  const handleSaveFirstAssetAndEnter = async () => {
    if (!pendingUser) return;
    if (!assetName.trim()) {
      setError('Please enter a name for this asset.');
      return;
    }

    setIsLoading(true);

    const attachment: DocumentAttachment | undefined =
      base64Data || textData
        ? {
            id: `doc-${Date.now()}`,
            filename: filename || 'First_Document.pdf',
            mimeType: mimeType || 'application/pdf',
            base64Data,
            textData: rawText || textData,
            uploadedAt: new Date().toISOString(),
          }
        : undefined;

    const firstAsset: Asset = {
      id: `ast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: pendingUser.id,
      assetName: assetName.trim(),
      category: extractedCategory,
      docType: extractedDocType,
      owner: owner || pendingUser.name,
      vendor,
      manufacturer,
      model,
      purchasePrice,
      purchaseDate,
      expiryDate,
      serialNumber,
      warrantyType,
      warrantyEnds,
      invoice,
      notes,
      addOns,
      reminders,
      contacts,
      categoryFields,
      attachment,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await saveUserAssetToCloud(firstAsset);
    setIsLoading(false);
    completeAuth(pendingUser);
  };

  const isWideStep = step === 'review-doc';

  return (
    <div
      className={`w-full mx-auto p-4 flex flex-col items-center justify-center min-h-[88vh] transition-all duration-300 ${
        isWideStep ? 'max-w-xl' : 'max-w-md'
      }`}
    >
      <VaultDial unlocked={unlocked} size={92} />

      <div className="w-full bg-[#16261F] border border-[#2A3B33] rounded-2xl p-6 sm:p-8 shadow-2xl relative">
        {/* STEP 1: CREDENTIALS */}
        {step === 'credentials' && (
          <div>
            <p className="font-mono text-xs tracking-wider text-[#C9A15D] text-center mb-2">
              Asset Wallet
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-center font-medium text-[#EDEDE1] mb-2">
              Open your vault
            </h1>
            <p className="text-[#8FA79B] text-sm text-center mb-6">
              Sign in with your username and password to access your private asset records.
            </p>

            <div className="flex bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-1 mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'signin'
                    ? 'bg-[#C9A15D] text-[#14211B] font-semibold shadow-sm'
                    : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                }`}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                }}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors whitespace-nowrap ${
                  mode === 'signup'
                    ? 'bg-[#C9A15D] text-[#14211B] font-semibold shadow-sm'
                    : 'text-[#8FA79B] hover:text-[#EDEDE1]'
                }`}
              >
                Create account
              </button>
            </div>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-[#8FA79B] mb-1.5">
                  Username
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="e.g. siddhant"
                    autoComplete="username"
                    required
                    className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg pl-10 pr-3.5 py-3 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                  />
                  <UserIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA79B]" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#8FA79B] mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    required
                    className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg pl-10 pr-10 py-3 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                  />
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA79B]" />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8FA79B] hover:text-[#C9A15D]"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#8FA79B] mb-1.5">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      autoComplete="new-password"
                      required
                      className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg pl-10 pr-3.5 py-3 text-[#EDEDE1] font-mono text-sm focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
                    />
                    <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8FA79B]" />
                  </div>
                </div>
              )}

              {error && <p className="text-[#C97B6B] text-xs font-medium">{error}</p>}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-50 text-[#14211B] font-semibold py-3 rounded-lg transition-colors shadow-md mt-2 flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isLoading
                  ? 'Verifying credentials...'
                  : mode === 'signin'
                  ? 'Sign In & Open Vault'
                  : 'Create Account'}
              </button>
            </form>
          </div>
        )}

        {/* STEP 2 (NEW SIGN-UP ONLY): WHAT SHOULD WE CALL YOU? */}
        {step === 'display-name' && pendingUser && (
          <form onSubmit={handleDisplayNameSubmit} className="space-y-4">
            <p className="font-mono text-xs text-[#C9A15D] text-center">
              Step 1 of 2 · Welcome
            </p>
            <h1 className="font-serif text-2xl sm:text-3xl text-center font-medium text-[#EDEDE1]">
              What should we call you?
            </h1>
            <p className="text-[#8FA79B] text-sm text-center mb-4">
              Just for personalizing your vault—nothing formal needed.
            </p>

            <div>
              <label className="block text-xs font-medium text-[#8FA79B] mb-1.5">
                Your Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Siddhant"
                autoFocus
                required
                className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg px-3.5 py-3 text-[#EDEDE1] text-base focus:outline-none focus:border-[#C9A15D] focus:ring-1 focus:ring-[#C9A15D]"
              />
            </div>

            {error && <p className="text-[#C97B6B] text-xs font-medium">{error}</p>}

            <button
              type="submit"
              disabled={isLoading || !displayName.trim()}
              className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-40 text-[#14211B] font-semibold py-3 rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 whitespace-nowrap"
            >
              {isLoading ? 'Saving...' : 'Continue'} <ArrowRight size={16} />
            </button>
          </form>
        )}

        {/* STEP 3 (NEW SIGN-UP ONLY): UPLOAD YOUR FIRST DOCUMENT */}
        {step === 'first-document' && pendingUser && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-xs text-[#C9A15D]">
                Step 2 of 2 · First Document
              </span>
              <button
                type="button"
                onClick={() => completeAuth(pendingUser)}
                className="text-xs text-[#8FA79B] hover:text-[#EDEDE1] transition-colors whitespace-nowrap"
              >
                Skip for now →
              </button>
            </div>

            <div>
              <h1 className="font-serif text-2xl font-medium text-[#EDEDE1] mb-1">
                Upload your first document
              </h1>
              <p className="text-[#8FA79B] text-sm leading-relaxed">
                Hi {pendingUser.name}, upload an invoice, policy, or warranty—or snap a photo—to scan it into your vault automatically.
              </p>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[#C97B6B]/15 border border-[#C97B6B]/40 text-xs text-[#C97B6B] flex items-center gap-2">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isCameraActive ? (
              <div className="relative rounded-xl overflow-hidden bg-black border border-[#2A3B33] aspect-video flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-3 flex gap-2.5">
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
                    className="px-3.5 py-2 bg-[#1C2E26] text-[#EDEDE1] text-xs rounded-lg border border-[#2A3B33] whitespace-nowrap"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="relative rounded-xl overflow-hidden bg-[#070D0B] border border-[#2A3B33] max-h-52 flex items-center justify-center p-2">
                <img
                  src={previewUrl}
                  alt="First document preview"
                  referrerPolicy="no-referrer"
                  className="max-h-44 object-contain rounded-md"
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
              <label className="border-2 border-dashed border-[#2A3B33] hover:border-[#C9A15D] rounded-xl p-7 text-center flex flex-col items-center justify-center cursor-pointer transition-colors group">
                <Upload size={28} className="text-[#8FA79B] group-hover:text-[#C9A15D] transition-colors mb-2.5" />
                <span className="text-sm font-medium text-[#EDEDE1]">
                  Choose a document file to upload
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

            <div className="grid grid-cols-2 gap-3 pt-1">
              <button
                type="button"
                onClick={startCamera}
                className="py-2.5 px-3 bg-[#1C2E26] hover:bg-[#2A3B33] border border-[#2A3B33] hover:border-[#C9A15D] rounded-xl text-xs font-semibold text-[#EDEDE1] flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <Camera size={15} className="text-[#C9A15D]" /> Capture Photo
              </button>

              <button
                type="button"
                onClick={triggerOnboardingScan}
                disabled={!base64Data && !textData}
                className="py-2.5 px-3 bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-40 disabled:cursor-not-allowed text-[#14211B] font-semibold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors shadow-md whitespace-nowrap"
              >
                <Sparkles size={15} /> Scan with AI
              </button>
            </div>

            <button
              type="button"
              onClick={() => completeAuth(pendingUser)}
              className="w-full py-2 text-xs text-[#8FA79B] hover:text-[#EDEDE1] transition-colors text-center"
            >
              Skip for now and enter empty vault
            </button>
          </div>
        )}

        {/* STEP 4: SCANNING PROGRESS */}
        {step === 'scanning-doc' && pendingUser && (
          <div className="py-8 text-center space-y-5">
            <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[#C9A15D]/20 border-t-[#C9A15D] animate-spin" />
              <Sparkles size={24} className="text-[#E4C98A]" />
            </div>

            <div>
              <h2 className="text-lg font-serif font-medium text-[#EDEDE1] mb-1">
                Extracting Document Details
              </h2>
              <p className="text-xs text-[#8FA79B] font-mono">{scanStatusMsg}</p>
            </div>

            <div className="w-full bg-[#1C2E26] h-2 rounded-full overflow-hidden max-w-xs mx-auto">
              <div
                className="bg-[#C9A15D] h-full transition-transform duration-300 origin-left"
                style={{ transform: `scaleX(${scanProgress / 100})` }}
              />
            </div>

            {scanError && (
              <div className="p-4 bg-[#C97B6B]/15 border border-[#C97B6B]/40 rounded-xl text-xs text-[#C97B6B] text-left space-y-3">
                <p className="font-semibold flex items-center gap-1.5">
                  <AlertCircle size={15} /> Scan Error
                </p>
                <p className="text-[#EDEDE1]/90">{scanError}</p>
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setScanError(null);
                      setStep('first-document');
                    }}
                    className="px-3 py-1.5 bg-[#1C2E26] border border-[#2A3B33] hover:border-[#C9A15D] text-[#EDEDE1] rounded-lg text-xs whitespace-nowrap"
                  >
                    Try Another Document
                  </button>
                  <button
                    type="button"
                    onClick={() => completeAuth(pendingUser)}
                    className="px-3 py-1.5 text-[#8FA79B] hover:text-[#EDEDE1] text-xs whitespace-nowrap"
                  >
                    Skip to Empty Vault
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP 5: REVIEW FIRST EXTRACTED DOCUMENT */}
        {step === 'review-doc' && pendingUser && (
          <div className="space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 font-semibold text-[#6FA88C]">
                <CheckCircle size={15} /> First Document Scanned
              </span>
              <button
                type="button"
                onClick={() => setStep('first-document')}
                className="text-[#8FA79B] hover:text-[#EDEDE1] underline"
              >
                Rescan
              </button>
            </div>

            <div>
              <h2 className="font-serif text-xl font-medium text-[#EDEDE1]">
                Confirm Asset Details
              </h2>
              <p className="text-[#8FA79B] text-xs mt-0.5">
                Review the extracted details before saving to {pendingUser.name}&apos;s Vault.
              </p>
            </div>

            {error && <p className="text-[#C97B6B] text-xs font-medium">{error}</p>}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[46vh] overflow-y-auto pr-1">
              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Asset Name *
                </label>
                <input
                  type="text"
                  value={assetName}
                  onChange={(e) => setAssetName(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Category
                </label>
                <select
                  value={extractedCategory}
                  onChange={(e) => setExtractedCategory(e.target.value as AssetCategory)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                >
                  <option value="vehicular">Vehicular</option>
                  <option value="electronics">Electronics</option>
                  <option value="camera">Camera & Optics</option>
                  <option value="watch">Watches</option>
                  <option value="appliances">Appliances</option>
                  <option value="health">Health Insurance</option>
                  <option value="identity">Identity & Documents</option>
                  <option value="property">Property</option>
                  <option value="finance">Finance</option>
                  <option value="furniture">Furniture</option>
                  <option value="jewellery">Jewellery</option>
                  <option value="machinery">Machinery</option>
                  <option value="subscriptions">Subscriptions</option>
                  <option value="other">Other</option>
                </select>
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Vendor / Insurer
                </label>
                <input
                  type="text"
                  value={vendor}
                  onChange={(e) => setVendor(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Model / Specs
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Serial / Policy Number
                </label>
                <input
                  type="text"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#E4C98A] font-mono tabular-nums focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Purchase Price / Amount
                </label>
                <input
                  type="text"
                  value={purchasePrice}
                  onChange={(e) => setPurchasePrice(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] tabular-nums focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Purchase Date (DD/MM/YYYY)
                </label>
                <input
                  type="text"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums focus:border-[#C9A15D] outline-none"
                />
              </div>

              <div>
                <label className="block text-[#8FA79B] font-mono text-[11px] mb-1">
                  Expiry Date (DD/MM/YYYY)
                </label>
                <input
                  type="text"
                  value={expiryDate}
                  onChange={(e) => setExpiryDate(e.target.value)}
                  className="w-full bg-[#1C2E26] border border-[#2A3B33] rounded-lg p-2.5 text-[#EDEDE1] font-mono tabular-nums focus:border-[#C9A15D] outline-none"
                />
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                disabled={isLoading}
                onClick={handleSaveFirstAssetAndEnter}
                className="w-full bg-[#C9A15D] hover:bg-[#E4C98A] disabled:opacity-50 text-[#14211B] font-bold py-3 rounded-xl transition-colors shadow-lg text-sm flex items-center justify-center gap-2 whitespace-nowrap"
              >
                {isLoading ? 'Saving to Vault...' : 'Save Asset & Enter Vault'} <ArrowRight size={16} />
              </button>
              <button
                type="button"
                onClick={() => completeAuth(pendingUser)}
                className="w-full py-1.5 text-xs text-[#8FA79B] hover:text-[#EDEDE1] transition-colors text-center"
              >
                Skip without saving
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
