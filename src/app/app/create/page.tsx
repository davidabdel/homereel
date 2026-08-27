"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { getUserCredits } from "@/lib/subscription-service";
import { saveProject } from "@/lib/projects-service";
import { InsufficientCreditsDialog } from "@/components/InsufficientCreditsDialog";

const steps = [
  { id: 1, title: "Ad Type" },
  { id: 2, title: "Product" },
  { id: 3, title: "Persona" },
  { id: 4, title: "Generate Image" },
  { id: 5, title: "Dialogue" },
  { id: 6, title: "Video" },
];

export default function CreateWizardPage() {
  const [step, setStep] = useState(1);
  const router = useRouter();
  const { user } = useAuth();
  const [credits, setCredits] = useState<number | null>(null);
  const [isLoadingCredits, setIsLoadingCredits] = useState(false);

  // Insufficient credits dialog state
  const [insufficientOpen, setInsufficientOpen] = useState(false);
  const [requiredCredits, setRequiredCredits] = useState<number>(0);

  // Form state (mocked, UI only)
  const [adType, setAdType] = useState<"product" | "talking" | "ugc_product" | null>(null);
  const [productFileName, setProductFileName] = useState<string>("");
  const [personaMode, setPersonaMode] = useState<"upload" | "generate" | null>(null);
  const [personaSummary, setPersonaSummary] = useState<string>("");
  const [dialogue, setDialogue] = useState<string>("");
  const [voiceAccent, setVoiceAccent] = useState<string>("American");
  const [voiceGender, setVoiceGender] = useState<"Male" | "Female">("Female");
  const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
  const [imagePrompt, setImagePrompt] = useState<string>("");
  const [imagePromptTouched, setImagePromptTouched] = useState(false);
  const [genStatus, setGenStatus] = useState<string>("");
  const [dialogueLoading, setDialogueLoading] = useState<boolean>(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  // Video generation state
  const [videoGenerating, setVideoGenerating] = useState(false);
  const [videoStatus, setVideoStatus] = useState<string>("");
  const [videoTaskId, setVideoTaskId] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [videoPrompt, setVideoPrompt] = useState<string>("Pan camera gently across the scene and showcase the product clearly.");
  const [videoStage, setVideoStage] = useState<string | null>(null);
  const [videoPct, setVideoPct] = useState<number | null>(null);
  // Synthetic progress controller
  const videoStartRef = useRef<number | null>(null);
  const syntheticTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const realPctRef = useRef<number | null>(null);
  const latestStageRef = useRef<string | null>(null);
  

  // Product image upload state
  const [productFile, setProductFile] = useState<File | null>(null);
  const [productPreview, setProductPreview] = useState<string | null>(null);
  const [productError, setProductError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Persona upload state
  const [personaFile, setPersonaFile] = useState<File | null>(null);
  const [personaPreview, setPersonaPreview] = useState<string | null>(null);
  const [personaError, setPersonaError] = useState<string | null>(null);
  const personaInputRef = useRef<HTMLInputElement>(null);
  const [isPersonaDragging, setIsPersonaDragging] = useState(false);
  const [selectedAccessories, setSelectedAccessories] = useState<string[]>([]);
  const [personaSummaryTouched, setPersonaSummaryTouched] = useState(false);

  // Persona generate form state (basic wiring)
  const [personaFields, setPersonaFields] = useState<Record<string, string>>({});

  // Image generation (mock) state
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [showVideoModal, setShowVideoModal] = useState(false);

  const words = useMemo(() => (dialogue.trim() ? dialogue.trim().split(/\s+/).length : 0), [dialogue]);
  const chars = dialogue.length;
  const dialogueOk = words <= 22 && chars <= 150 && words > 0;

  // Load current user's credits once on mount/login
  useEffect(() => {
    const load = async () => {
      if (!user) {
        setCredits(null);
        return;
      }
      setIsLoadingCredits(true);
      try {
        const res = await getUserCredits(user.id);
        setCredits(res.success && res.credits ? res.credits.balance : 0);
      } catch {
        setCredits(0);
      } finally {
        setIsLoadingCredits(false);
      }
    };
    load();
  }, [user]);

  const canContinue = useMemo(() => {
    switch (step) {
      case 1:
        return adType !== null;
      case 2:
        // If Product Showcase, require a valid uploaded file; if Talking Head, skip
        return adType === "talking" || !!productFile;
      case 3:
        // Require persona for both Talking Head and UGC with Product
        if (adType !== "talking" && adType !== "ugc_product") return true;
        return personaMode === "upload" || (personaMode === "generate" && !!personaSummary);
      case 4:
        // Only continue after an image exists and generation isn't running
        return !!generatedImageUrl && !isGenerating;
      case 5:
        // For product-only flow, skip dialogue requirements
        // Both Talking Head and UGC with Product require dialogue
        if (adType === "product") return true;
        return dialogueOk;
      case 6:
        return true;
      default:
        return false;
    }
  }, [step, adType, productFileName, personaMode, personaSummary, dialogueOk, generatedImageUrl, isGenerating]);

  const onNext = () => {
    setStep((s) => {
      // From step 2, only skip persona step for Product showcase
      // Both Talking Head and UGC with Product need the persona step
      if (s === 2 && adType === "product") return 4;
      // From step 4, go directly to Video (step 6) only for product showcase
      // For UGC with Product and Talking Head, go to dialogue step (step 5)
      if (s === 4) {
        if (adType === "product") return 6;
        return 5; // Go to dialogue step for UGC with Product and Talking Head
      }
      // If on final step, navigate to Home (/app)
      if (s === 6) {
        router.push("/app");
        return 6;
      }
      return Math.min(6, s + 1);
    });
  };

  // When entering Step 4 from Persona Generate, prefill the prompt with the persona summary (if user hasn't typed a custom prompt)
  useEffect(() => {
    if (step === 4 && personaMode === 'generate' && personaSummary && !imagePromptTouched) {
      setImagePrompt(personaSummary);
    }
  }, [step, personaMode, personaSummary, imagePromptTouched]);

  const downloadVideo = async () => {
    if (!videoUrl) return;
    try {
      setVideoStatus("Preparing download…");
      const res = await fetch(videoUrl, { mode: "cors" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      a.download = `ugc-video-${ts}.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setVideoStatus("Download started.");
    } catch (e) {
      console.warn("download failed", e);
      setVideoStatus("Could not start download. Try 'Open in new tab'.");
    }
  };

  // Download generated image (Step 4)
  const downloadImage = async () => {
    if (!generatedImageUrl) return;
    try {
      setGenStatus("Preparing image download…");
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      // Case 1: data URL → download directly without fetch
      if (/^data:/i.test(generatedImageUrl)) {
        const a = document.createElement("a");
        a.href = generatedImageUrl;
        a.download = `ugc-image-${ts}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setGenStatus("Image download started.");
        
        // (Already saved to Projects when the image was generated.)
        return;
      }
      // Case 2: try direct fetch (may fail due to CORS)
      const tryDirect = async () => {
        const res = await fetch(generatedImageUrl, { mode: "cors" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "png";
        a.download = `ugc-image-${ts}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
      };
      try {
        await tryDirect();
        setGenStatus("Image download started.");
        
        // (Already saved to Projects when the image was generated.)
      } catch {
        // Case 3: fall back to server proxy to bypass CORS
        const proxied = await fetch(`/api/download-image?url=${encodeURIComponent(generatedImageUrl)}`);
        if (!proxied.ok) throw new Error(`Proxy HTTP ${proxied.status}`);
        const blob = await proxied.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const ext = blob.type.includes("png") ? "png" : blob.type.includes("jpeg") ? "jpg" : "png";
        a.download = `ugc-image-${ts}.${ext}`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 2000);
        setGenStatus("Image download started.");
        
        // (Already saved to Projects when the image was generated.)
      }
    } catch (e) {
      console.warn("image download failed", e);
      setGenStatus("Could not download image. Try right-click > Save image as…");
    }
  };

  // Generate video using Veo 3 Fast via our API
  const generateVideo = async () => {
    // Minimal guard: require 70+ credits before generating video
    if (!user) {
      alert("Please log in to generate videos.");
      router.push("/login");
      return;
    }
    if (!isLoadingCredits && (credits ?? 0) < 70) {
      setRequiredCredits(70);
      setInsufficientOpen(true);
      return;
    }
    setVideoGenerating(true);
    setVideoStatus("Starting render…");
    setVideoStage("Starting");
    setVideoPct(0);
    setVideoUrl(null);
    // Initialize synthetic progress ticker (aim to reach 99% at 4 minutes)
    videoStartRef.current = Date.now();
    realPctRef.current = 0;
    latestStageRef.current = "Starting";
    if (syntheticTimerRef.current) {
      clearInterval(syntheticTimerRef.current);
      syntheticTimerRef.current = null;
    }
    const fourMinutes = 4 * 60 * 1000;
    const tick = () => {
      const started = videoStartRef.current;
      if (!started) return;
      const elapsed = Date.now() - started;
      const synthetic = Math.min(99, Math.floor((elapsed / fourMinutes) * 99));
      const real = typeof realPctRef.current === 'number' ? realPctRef.current : null;
      const display = Math.max(synthetic, real ?? 0);
      const stage = latestStageRef.current || "Rendering";
      setVideoPct(display);
      setVideoStage(stage);
      setVideoStatus(`${stage ? stage + "… " : "Rendering… "}${display}%`);
    };
    syntheticTimerRef.current = setInterval(tick, 800);
    try {
      if (!step6Image) {
        setVideoStatus("No generated image to create a video.");
        return;
      }
      // Ensure image is publicly reachable by KIE. If it's a local path, upload it first.
      let imageForVeo = step6Image;
      if (!/^https?:\/\//i.test(imageForVeo)) {
        try {
          setVideoStage("Uploading");
          setVideoStatus("Uploading image…");
          const upRes = await fetch("/api/kie/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ url: imageForVeo, fileName: "buzz.png" }),
          });
          const upJson = await upRes.json().catch(() => ({}));
          if (upRes.ok && upJson?.ok && typeof upJson.uploadedUrl === "string") {
            imageForVeo = upJson.uploadedUrl;
          } else {
            console.warn("/api/kie/upload failed", upRes.status, upJson);
          }
        } catch (e) {
          console.warn("upload error", e);
        }
      }

      // Prepare an optimized prompt via OpenAI before creating the KIE task
      let optimizedPrompt = "";
      try {
        setVideoStage("Preparing");
        setVideoStatus("Preparing prompt…");
        const prepRes = await fetch("/api/generate-video/prepare-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoPrompt, dialogue }),
        });
        const prepJson = await prepRes.json().catch(() => ({}));
        if (prepRes.ok && prepJson?.ok && typeof prepJson.prompt === "string") {
          optimizedPrompt = prepJson.prompt;
        } else {
          console.warn("prepare-prompt failed", prepRes.status, prepJson);
        }
      } catch (e) {
        console.warn("prepare-prompt error", e);
      }

      const fd = new FormData();
      fd.append("imageUrl", imageForVeo);
      fd.append("dialogue", dialogue || "");
      fd.append("aspectRatio", aspectRatio);
      fd.append("videoPrompt", videoPrompt || "Short UGC-style product ad video");
      if (optimizedPrompt) fd.append("optimizedPrompt", optimizedPrompt);
      fd.append("voiceGender", voiceGender);
      fd.append("voiceAccent", voiceAccent);
      const res = await fetch("/api/generate-video/create", { method: "POST", body: fd });
      if (!res.ok) {
        const t = await res.text();
        if (res.status === 402) {
          setRequiredCredits(70);
          setInsufficientOpen(true);
          setVideoStatus("Not enough credits.");
          return;
        }
        setVideoStatus(`Create video failed (${res.status}).`);
        console.warn("/api/generate-video/create error", res.status, t);
        return;
      }
      const data = await res.json().catch(() => ({}));
      const taskId: string | undefined = data?.taskId;
      if (!taskId) {
        setVideoStatus("No taskId returned.");
        return;
      }
      setVideoTaskId(taskId);
      // Poll status with gentle backoff as per KIE guidance
      setVideoStatus("Rendering… 0%");
      let delay = 5000; // start ~5s
      const maxDelay = 15000; // cap ~15s
      const deadline = Date.now() + 10 * 60e3; // 10 min safety
      let finished = false;
      while (!finished) {
        if (Date.now() > deadline) {
          setVideoStatus("Timed out waiting for video.");
          // Stop synthetic ticker
          if (syntheticTimerRef.current) { clearInterval(syntheticTimerRef.current); syntheticTimerRef.current = null; }
          break;
        }
        const sres = await fetch(`/api/generate-video/status?taskId=${encodeURIComponent(taskId)}`);
        if (!sres.ok) {
          try { console.warn("video status error", sres.status, await sres.text()); } catch {}
        } else {
          const sdata = await sres.json().catch(() => ({}));
          const flagRaw = sdata?.normalized?.flag ?? sdata?.data?.successFlag ?? sdata?.status;
          const flag = flagRaw === 3 ? 2 : flagRaw; // normalize 3->failed
          const stage: string | undefined = sdata?.normalized?.stage || sdata?.data?.stage || sdata?.message || sdata?.data?.message;
          const progRaw = sdata?.normalized?.progress
            ?? (typeof sdata?.data?.progress !== 'undefined' ? Number(sdata.data.progress) : undefined)
            ?? (typeof sdata?.progress !== 'undefined' ? Number(sdata.progress) : undefined)
            ?? (typeof sdata?.percentage !== 'undefined' ? Number(sdata.percentage) : undefined);
          if (typeof progRaw === "number" && !Number.isNaN(progRaw)) {
            const pct = progRaw <= 1 ? Math.round(progRaw * 100) : Math.round(progRaw);
            realPctRef.current = pct;
          }
          if (stage) {
            latestStageRef.current = stage;
          }
          if (flag === 1) {
            let urls: string[] | undefined = sdata?.normalized?.urls || sdata?.data?.response?.result_urls || sdata?.data?.response?.resultUrls || sdata?.data?.response?.videos || sdata?.data?.response?.urls;
            const extras = [sdata?.data?.videoUrl, sdata?.data?.downloadUrl, sdata?.videoUrl, sdata?.url];
            if (!urls) urls = [];
            for (const u of extras) if (typeof u === 'string') urls.push(u);
            const url: string | undefined = Array.isArray(urls) && urls.length ? urls[0] : undefined;
            if (url) {
              setVideoUrl(url);
              // Jump to 100% immediately on completion
              setVideoStatus("Video ready.");
              setVideoStage("Complete");
              setVideoPct(100);
              // Credits were charged server-side when the task was created; sync the display
              try {
                if (user) {
                  setCredits((c) => (typeof c === 'number' ? Math.max(0, c - 70) : c));
                }
              } catch {}
              // Save to Projects (database row + durable storage copy)
              try {
                if (user) {
                  void saveProject({ userId: user.id, type: "video", title: `Video ${new Date().toLocaleString()}`, sourceUrl: url });
                }
              } catch {}
              // Stop synthetic ticker
              if (syntheticTimerRef.current) { clearInterval(syntheticTimerRef.current); syntheticTimerRef.current = null; }
            } else {
              setVideoStatus("No video URL returned.");
            }
            finished = true;
            break;
          }
          if (flag === 2) {
            setVideoStatus(sdata?.data?.errorMessage || "Video generation failed.");
            setVideoStage("Failed");
            // Stop synthetic ticker
            if (syntheticTimerRef.current) { clearInterval(syntheticTimerRef.current); syntheticTimerRef.current = null; }
            finished = true;
            break;
          }
        }
        await new Promise((r) => setTimeout(r, delay + Math.random() * 1000));
        delay = Math.min(Math.round(delay * 1.4), maxDelay);
      }
    } catch (e) {
      console.error(e);
      setVideoStatus("Unexpected error during video render.");
    } finally {
      // Ensure synthetic ticker is cleared if still running
      if (syntheticTimerRef.current) {
        clearInterval(syntheticTimerRef.current);
        syntheticTimerRef.current = null;
      }
      setVideoGenerating(false);
    }
  };

  // Dialogue helpers via OpenAI API proxy
  const runDialogueTool = async (mode: "assist" | "shorten" | "cleanup") => {
    try {
      setDialogueLoading(true);
      setDialogueError(null);
      const res = await fetch("/api/dialogue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          text: dialogue,
          accent: voiceAccent,
          gender: voiceGender,
          context: adType,
        }),
      });
      if (!res.ok) {
        let reason = "Dialogue helper failed.";
        try {
          const jt = await res.json();
          if (jt?.error) reason = String(jt.error);
        } catch {
          const t = await res.text();
          if (t) reason = t;
        }
        setDialogueError(reason);
        console.warn("/api/dialogue error", res.status, reason);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.ok && typeof data.text === "string") {
        setDialogue(data.text);
        setDialogueError(null);
      }
    } catch (e) {
      console.error(e);
      setDialogueError("Unexpected error calling AI assistant.");
    } finally {
      setDialogueLoading(false);
    }
  };
  const onBack = () => {
    setStep((s) => {
      // From step 4, if not talking head, jump back to step 2
      if (s === 4 && adType !== "talking") return 2;
      // From step 6, go back to appropriate step based on ad type
      if (s === 6) {
        if (adType === "product") return 4; // Product showcase goes back to image step
        return 5; // UGC with Product and Talking Head go back to dialogue step
      }
      return Math.max(1, s - 1);
    });
  };

  // Cleanup preview URL when file changes
  useEffect(() => {
    if (!productFile) {
      setProductPreview(null);
      return;
    }
    const url = URL.createObjectURL(productFile);
    setProductPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [productFile]);

  // Persona preview lifecycle
  useEffect(() => {
    if (!personaFile) {
      setPersonaPreview(null);
      return;
    }
    const url = URL.createObjectURL(personaFile);
    setPersonaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [personaFile]);

  // Build an automatic persona summary from selections
  const buildPersonaSummary = useMemo(() => {
    const parts: string[] = [];
    const f = personaFields;
    if (f.gender) parts.push(f.gender);
    if (f.age) parts.push(f.age);
    if (f.skin) parts.push(`${f.skin} skin`);
    if (f.body) parts.push(`${f.body} body`);
    if (f.hair) parts.push(`${f.hair} hair`);
    if (f.style) parts.push(`${f.style} style`);
    if (f.env) parts.push(f.env);
    if (f.angle) parts.push(f.angle);
    if (f.light) parts.push(f.light);
    if (f.mood) parts.push(f.mood);
    if (selectedAccessories.length && !selectedAccessories.includes('none')) {
      parts.push(`accessories: ${selectedAccessories.join(', ')}`);
    }
    return parts.join(', ');
  }, [personaFields, selectedAccessories]);

  // Auto-fill summary unless the user has manually edited it
  useEffect(() => {
    if (personaMode === 'generate' && !personaSummaryTouched) {
      setPersonaSummary(buildPersonaSummary);
    }
  }, [personaMode, personaSummaryTouched, buildPersonaSummary]);

  // Removed dev query param skipping; users must start from step 1

  const step6Image = useMemo(() => {
    return generatedImageUrl;
  }, [generatedImageUrl]);

  // Product file validation: type and basic dimensions check (no size requirement)
  const onChooseProductFile = async (file: File) => {
    setProductError(null);
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/heic-sequence",
    ]; // accept png/jpg/jpeg/webp/heic/heif
    const byMime = validTypes.includes(file.type);
    const byExt = /\.(png|jpg|jpeg|webp|heic|heif)$/i.test(file.name || "");
    if (!(byMime || byExt)) {
      setProductError("Please upload a PNG, JPG, WebP, HEIC, or HEIF image.");
      setProductFile(null);
      return;
    }
    // capture size for display only
    const sizeMB = file.size / (1024 * 1024);
    // Accept any dimensions; preview is created elsewhere via effect
    setProductFile(file);
    setProductFileName(`${file.name} (${sizeMB.toFixed(1)}MB)`);
  };

  // Persona file validation: mirrors product validation
  const onChoosePersonaFile = async (file: File) => {
    setPersonaError(null);
    const validTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
      "image/heic",
      "image/heif",
      "image/heic-sequence",
    ];
    const byMime = validTypes.includes(file.type);
    const byExt = /\.(png|jpg|jpeg|webp|heic|heif)$/i.test(file.name || "");
    if (!(byMime || byExt)) {
      setPersonaError("Please upload a PNG, JPG, WebP, HEIC, or HEIF image.");
      setPersonaFile(null);
      return;
    }
    setPersonaFile(file);
  };

  const handlePersonaField = (id: string, value: string) => {
    setPersonaFields((prev) => ({ ...prev, [id]: value }));
    // If user hasn't manually edited summary, keep auto-filling as fields change
    if (!personaSummaryTouched) {
      // Trigger effect below to rebuild summary
    }
  };

  const createImage = async () => {
    // Minimal guard: require 30+ credits before generating
    if (!user) {
      alert("Please log in to generate images.");
      router.push("/login");
      return;
    }
    if (!isLoadingCredits && (credits ?? 0) < 30) {
      setRequiredCredits(30);
      setInsufficientOpen(true);
      return;
    }
    setIsGenerating(true);
    setGenStatus("Starting generation…");
    try {
      // Use the user's prompt directly so edit instructions like "Remove the background" are respected.
      // Provide a sensible default when empty.
      const finalPrompt = imagePrompt?.trim()
        ? imagePrompt.trim()
        : `Place the uploaded product in a suitable context. Aspect ratio: ${aspectRatio}.`;

      // Handle different file upload scenarios based on ad type and persona mode
      let primaryFile = null;
      let secondaryFile = null;
      
      if (adType === "talking") {
        // For talking head, we only need the persona file
        if (personaMode === "generate") {
          // No file needed for generate mode
          primaryFile = null;
        } else if (personaMode === "upload") {
          // Use persona file for upload mode
          primaryFile = personaFile;
        }
      } else if (adType === "ugc_product") {
        // For UGC with Product, we need both product and persona
        primaryFile = productFile; // Always use product as primary file
        
        if (personaMode === "upload") {
          // For upload mode, we also need the persona file
          secondaryFile = personaFile;
        }
        // For generate mode, no secondary file needed
      } else {
        // For product showcase, just use the product file
        primaryFile = productFile;
      }
      
      {
        const fd = new FormData();
        if (primaryFile) fd.append("file", primaryFile);
        if (secondaryFile) fd.append("secondaryFile", secondaryFile);
        fd.append("prompt", finalPrompt);
        fd.append("aspectRatio", aspectRatio);
        fd.append("personaSummary", personaSummary || "");
        if (personaMode) fd.append("personaMode", personaMode);
        fd.append("adType", adType || ""); // Send ad type to API

        // Choose API endpoint based on flow
        let endpoint = "/api/generate-image/create";
        
        if (adType === "talking") {
          // Talking head uses persona endpoints
          endpoint = personaMode === "upload"
            ? "/api/generate-image/persona-upload"
            : personaMode === "generate"
              ? "/api/generate-image/persona-generate"
              : "/api/generate-image/create";
        } else if (adType === "ugc_product") {
          // UGC with Product uses dedicated endpoint that handles both images
          endpoint = "/api/generate-image/ugc-product";
        }

        const res = await fetch(endpoint, { method: "POST", body: fd });
        if (!res.ok) {
          const text = await res.text();
          console.warn(`${endpoint} error`, res.status, text);
          if (res.status === 402) {
            setRequiredCredits(30);
            setInsufficientOpen(true);
            setGenStatus("Not enough credits.");
            return;
          }
          try {
            const j = JSON.parse(text);
            const msg = j?.error || `Create task failed (${res.status}).`;
            const modelInfo = j?.modelUsed ? ` Model: ${j.modelUsed}.` : "";
            setGenStatus(`${msg}${modelInfo}`);
          } catch {
            setGenStatus(`Create task failed (${res.status}).`);
          }
          setGeneratedImageUrl(productPreview);
          return;
        }
        const data = await res.json().catch(() => ({}));
        console.log("/api/generate-image/create", data);
        if (data?.modelUsed) {
          setGenStatus(`Queued on ${data.modelUsed}… 0%`);
        }
        const inputUrl: string | undefined = data?.uploadedUrl;
        // Mock path: server may return imageUrl when API key missing
        if (data?.imageUrl) {
          const imageUrl = data.imageUrl as string;
          setGeneratedImageUrl(imageUrl);
          setGenStatus("Image ready.");
          // Credits were charged server-side when the task was created; sync the display
          try {
            if (user) {
              setCredits((c) => (typeof c === 'number' ? Math.max(0, c - 30) : c));
            }
          } catch {}
          
          // Save to Projects (database row + durable storage copy)
          try {
            if (user) {
              void saveProject({ userId: user.id, type: "image", title: `Image ${new Date().toLocaleString()}`, sourceUrl: imageUrl });
            }
          } catch {}
          return;
        }
        const taskId: string | undefined = data?.taskId;
        if (!taskId) {
          setGenStatus("No taskId returned. Showing original preview.");
          setGeneratedImageUrl(productPreview);
          return;
        }

        // Poll status with live progress
        setGenStatus("Generating… 0%");
        let done = false;
        const start = Date.now();
        while (!done && Date.now() - start < 90000) { // 90s client cap
          const sres = await fetch(`/api/generate-image/status?taskId=${encodeURIComponent(taskId)}`);
          if (!sres.ok) {
            const t = await sres.text();
            console.warn("status error", sres.status, t);
            await new Promise((r) => setTimeout(r, 1000));
            continue;
          }
          const sdata = await sres.json().catch(() => ({}));
          const nFlag = sdata?.normalized?.flag;
          const flag = nFlag !== undefined ? nFlag : sdata?.data?.successFlag;
          const nProg = sdata?.normalized?.progress;
          const prog = typeof nProg === "number" ? nProg : (sdata?.data?.progress ? Number(sdata.data.progress) : undefined);
          if (typeof prog === "number" && !Number.isNaN(prog)) {
            const pct = prog <= 1 ? Math.round(prog * 100) : Math.round(prog);
            setGenStatus(`Generating… ${pct}%`);
          }
          if (flag === 1) {
            const resp = sdata?.data?.response || sdata?.response || {};
            // Prefer result URLs explicitly returned by the provider
            let urls: string[] | undefined = sdata?.normalized?.urls || resp?.result_urls || resp?.resultUrls || resp?.images || resp?.urls;
            // Some providers may echo input/origin URLs; filter them out using the uploadedUrl from create
            if (Array.isArray(urls) && inputUrl) {
              const before = urls.slice();
              urls = urls.filter((u) => typeof u === "string" && u !== inputUrl);
              if (before.length !== urls.length) {
                console.debug("Filtered out inputUrl from result URLs", { before, after: urls, inputUrl });
              }
            }
            let url: string | undefined = urls && urls.length ? urls[0] : undefined;
            url = url || resp?.image_url || resp?.imageUrl;
            url = url || sdata?.data?.image_url || sdata?.data?.imageUrl;
            // Guard against accidental fallback to the uploaded input image
            if (url && inputUrl && url === inputUrl) {
              url = undefined;
            }
            console.debug("Status payload and URL selection", {
              sdata,
              response: resp,
              inputUrl,
              candidateUrls: urls,
              selected: url,
            });
            if (url) {
              setGeneratedImageUrl(url);
              setGenStatus("Image ready.");
              // Credits were charged server-side when the task was created; sync the display
              try {
                if (user) {
                  setCredits((c) => (typeof c === 'number' ? Math.max(0, c - 30) : c));
                }
              } catch {}
              
              // Save to Projects (database row + durable storage copy)
              try {
                if (user) {
                  void saveProject({ userId: user.id, type: "image", title: `Image ${new Date().toLocaleString()}`, sourceUrl: url });
                }
              } catch {}
            } else {
              setGeneratedImageUrl(productPreview);
              setGenStatus("No image returned; showing original preview.");
            }
            done = true;
            break;
          }
          if (flag === 2) {
            setGenStatus(sdata?.data?.errorMessage || "Generation failed");
            setGeneratedImageUrl(productPreview);
            done = true;
            break;
          }
          await new Promise((r) => setTimeout(r, 1000));
        }
        if (!done) {
          setGenStatus("Timed out waiting for image.");
          setGeneratedImageUrl(productPreview);
        }
      }    } catch (e) {
      console.error(e);
      setGeneratedImageUrl(productPreview);
      setGenStatus("Unexpected error; showing original preview.");
    } finally {
      setIsGenerating(false);
    }
  };

  // Testing helpers removed

  return (
    <div className="min-h-[80vh]">
      {/* Testing Panel removed */}
      
      <div className="grid gap-6 md:grid-cols-[260px_1fr]">
        {/* Progress sidebar */}
        <aside className="hidden md:block">
          <div className="glass-card sticky top-[96px] !p-4">
            <ol className="space-y-2 text-sm">
              {steps.map((st, i) => {
                const active = st.id === step;
                const complete = st.id < step;
                return (
                  <li key={st.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${active ? "bg-[#131118]/10" : ""}`} aria-current={active ? "step" : undefined}>
                    <div className="flex items-center gap-3">
                      <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[11px] border ${complete ? "bg-[color:var(--brand-2)] border-transparent" : "border-[#131118]/25"}`}>
                        {complete ? "✓" : st.id}
                      </span>
                      <span className={active ? "font-semibold" : "text-[#131118]/80"}>{st.title}</span>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </aside>

        {/* Step content */}
        <section className="space-y-6">
          {step === 1 && (
            <div className="glass-card !p-8">
              <h1 className="text-xl font-bold">What kind of ad?</h1>
              <p className="mt-1 text-sm text-[#131118]/70">You can switch later; we’ll keep your inputs.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <button
                  className={`rounded-2xl border p-6 text-left transition ${adType === "product" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                  onClick={() => setAdType("product")}
                >
                  <div className="text-sm text-[#131118]/70">Product Showcase</div>
                  <div className="mt-1 font-semibold">Show your product in context.</div>
                  <div className="mt-3 h-28 rounded-xl overflow-hidden border border-[#131118]/15 bg-[#131118]/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Images/buzz.png" alt="Product example" className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-2 text-xs text-[#131118]/60">Requires product image</div>
                </button>
                <button
                  className={`rounded-2xl border p-6 text-left transition ${adType === "talking" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                  onClick={() => setAdType("talking")}
                >
                  <div className="text-sm text-[#131118]/70">Talking Head (UGC)</div>
                  <div className="mt-1 font-semibold">A real person speaking to camera.</div>
                  <div className="mt-3 h-28 rounded-xl overflow-hidden border border-[#131118]/15 bg-[#131118]/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Images/ai-gen.png" alt="Talking head example" className="h-full w-full object-cover" />
                  </div>
                </button>
                <button
                  className={`rounded-2xl border p-6 text-left transition ${adType === "ugc_product" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                  onClick={() => setAdType("ugc_product")}
                >
                  <div className="text-sm text-[#131118]/70">UGC with Product</div>
                  <div className="mt-1 font-semibold">A creator showcasing your product.</div>
                  <div className="mt-3 h-28 rounded-xl overflow-hidden border border-[#131118]/15 bg-[#131118]/5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/Images/ugc-image-2025-09-30T04-09-49-174Z.png" alt="UGC with product example" className="h-full w-full object-cover" />
                  </div>
                  <div className="mt-2 text-xs text-[#131118]/60">Requires product image and persona image</div>
                </button>
              </div>

              {/* Aspect ratio selection */}
              <div className="mt-6">
                <label className="text-sm text-[#131118]/80">Video aspect ratio</label>
                <div className="mt-2 flex gap-3">
                  <button
                    type="button"
                    className={`rounded-xl border px-4 py-2 text-sm transition ${aspectRatio === "16:9" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                    onClick={() => setAspectRatio("16:9")}
                  >
                    16:9 (Landscape)
                  </button>
                  <button
                    type="button"
                    className={`rounded-xl border px-4 py-2 text-sm transition ${aspectRatio === "9:16" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                    onClick={() => setAspectRatio("9:16")}
                  >
                    9:16 (Vertical)
                  </button>
                </div>
                <div className="mt-2 text-xs text-[#131118]/60">Current: {aspectRatio}</div>
              </div>
            </div>
          )}

          {step === 2 && (adType === "product" || adType === "ugc_product") && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">Product image</h2>
              <p className="mt-1 text-sm text-[#131118]/70">PNG/JPG/WebP/HEIC/HEIF. Higher-quality images yield better results.</p>

              <div
                className={`mt-6 rounded-2xl border border-dashed p-8 text-center transition-colors ${isDragging ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/25 bg-[#131118]/5"}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setIsDragging(true); }}
                onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); }}
                onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDragging(false);
                  const f = e.dataTransfer?.files?.[0];
                  if (f) onChooseProductFile(f);
                }}
                role="button"
                aria-label="Upload product image by clicking or dragging a file here"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) onChooseProductFile(f);
                  }}
                />
                <div className="text-sm text-[#131118]/70">Drag & drop or click to upload</div>
                <div className="mt-3">
                  {productFile ? (
                    <span className="text-sm">{productFileName}</span>
                  ) : (
                    <span className="text-xs text-[#131118]/60">No file selected</span>
                  )}
                </div>
                {productPreview && (
                  <div className="mx-auto mt-4 w-full max-w-md overflow-hidden rounded-xl border border-[#131118]/15 bg-black/20">
                    {/* Preview (note: many browsers cannot render HEIC/HEIF). */}
                    {(/\.(heic|heif)$/i.test(productFile?.name || "") || /heic|heif/i.test(productFile?.type || "")) ? (
                      <div className="p-4 text-xs text-[#131118]/70">Selected HEIC/HEIF image. Preview may not display in this browser, but the file will be used for generation.</div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={productPreview} alt="Product preview" className="block max-h-72 w-full object-contain" />
                    )}
                  </div>
                )}
                {productError && (
                  <div className="mt-3 text-xs text-red-400">{productError}</div>
                )}
                <div className="mt-4 flex justify-center gap-3">
                  <button className="btn-primary" onClick={() => fileInputRef.current?.click()}>Choose file</button>
                  {productFile && (
                    <>
                      <button className="btn-ghost" onClick={() => { setProductFile(null); setProductFileName(""); setProductError(null); }}>Remove</button>
                      <button className="btn-ghost" onClick={() => fileInputRef.current?.click()}>Replace</button>
                    </>
                  )}
                </div>
                <div className="mt-4 text-xs text-[#131118]/60">Server will normalize EXIF and format.</div>
              </div>
            </div>
          )}

          {step === 2 && adType === "talking" && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">No product image required</h2>
              <p className="mt-1 text-sm text-[#131118]/70">You chose Talking Head. Continue to persona.</p>
            </div>
          )}

          {step === 3 && (adType === "talking" || adType === "ugc_product") && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">Persona</h2>
              <p className="mt-1 text-sm text-[#131118]/70">Upload a face you want to match, or generate a fresh persona.</p>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <button
                  className={`rounded-xl border p-4 text-left ${personaMode === "upload" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                  onClick={() => setPersonaMode("upload")}
                >
                  Upload reference
                </button>
                <button
                  className={`rounded-xl border p-4 text-left ${personaMode === "generate" ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/15 hover:bg-[#131118]/5"}`}
                  onClick={() => setPersonaMode("generate")}
                >
                  Generate persona
                </button>
              </div>

              {personaMode === "upload" && (
                <div
                  className={`mt-6 rounded-2xl border border-dashed p-8 text-center transition-colors ${isPersonaDragging ? "border-[#131118] bg-[#D8FF3E]" : "border-[#131118]/25 bg-[#131118]/5"}`}
                  onClick={() => personaInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = "copy"; setIsPersonaDragging(true); }}
                  onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsPersonaDragging(true); }}
                  onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsPersonaDragging(false); }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsPersonaDragging(false);
                    const f = e.dataTransfer?.files?.[0];
                    if (f) onChoosePersonaFile(f);
                  }}
                  role="button"
                  aria-label="Upload persona image by clicking or dragging a file here"
                >
                  <input
                    ref={personaInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/heic,image/heif,.heic,.heif"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) onChoosePersonaFile(f);
                    }}
                  />
                  <div className="text-sm text-[#131118]/70">Drag & drop or click to upload</div>
                  <div className="mt-3">
                    {personaFile ? (
                      <span className="text-sm">{personaFile.name}</span>
                    ) : (
                      <span className="text-xs text-[#131118]/60">No file selected</span>
                    )}
                  </div>
                  {personaPreview && (
                    <div className="mx-auto mt-4 w-full max-w-md overflow-hidden rounded-xl border border-[#131118]/15 bg-black/20">
                      {/* Preview (HEIC/HEIF may not render in browser) */}
                      {(/\.(heic|heif)$/i.test(personaFile?.name || "") || /heic|heif/i.test(personaFile?.type || "")) ? (
                        <div className="p-4 text-xs text-[#131118]/70">Selected HEIC/HEIF image. Preview may not display in this browser.</div>
                      ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={personaPreview} alt="Persona preview" className="block max-h-72 w-full object-contain" />
                      )}
                    </div>
                  )}
                  {personaError && (
                    <div className="mt-3 text-xs text-red-400">{personaError}</div>
                  )}
                </div>
              )}

              {personaMode === "generate" && (
                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  {[
                    { id: "gender", label: "Gender", options: ["Male", "Female"] },
                    { id: "age", label: "Age band", options: ["Teen", "20s", "30s", "40s", "50s+"] },
                    { id: "skin", label: "Skin tone", options: ["very fair", "fair", "light", "medium", "tan", "deep", "very deep"] },
                    { id: "body", label: "Body type", options: ["slim", "average", "athletic", "curvy"] },
                    { id: "hair", label: "Hair", options: ["short", "medium", "long"] },
                    { id: "style", label: "Clothing style", options: ["casual", "smart", "professional", "sporty", "cozy"] },
                    { id: "env", label: "Environment", options: ["car", "kitchen", "lounge", "bedroom", "office", "outdoor", "store aisle"] },
                    { id: "angle", label: "Camera angle", options: ["eye level", "slight high", "slight low", "close crop", "medium"] },
                    { id: "light", label: "Lighting", options: ["natural window", "softbox", "golden hour", "neon", "overhead soft"] },
                    { id: "mood", label: "Mood", options: ["friendly", "confident", "energetic", "sincere"] },
                  ].map((f) => (
                    <div key={f.id} className="space-y-2">
                      <label className="text-sm text-[#131118]/80" htmlFor={f.id}>{f.label}</label>
                      <select
                        id={f.id}
                        className="w-full rounded-xl bg-white border border-[#131118]/15 px-4 py-3 outline-none focus:border-[color:var(--brand)]"
                        value={personaFields[f.id] ?? ""}
                        onChange={(e) => handlePersonaField(f.id, e.target.value)}
                      >
                        <option value="" disabled>Select…</option>
                        {f.options.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    </div>
                  ))}

                  {/* Accessories / brand color */}
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-[#131118]/80">Accessories (optional)</label>
                    <div className="flex flex-wrap gap-2">
                      {['earrings','glasses','hat','watch','none'].map((x)=> {
                        const selected = selectedAccessories.includes(x);
                        return (
                          <button
                            type="button"
                            key={x}
                            onClick={() => {
                              setPersonaSummaryTouched(false); // keep auto-fill in sync when toggling
                              setSelectedAccessories((prev) => {
                                if (x === 'none') return ['none'];
                                const withoutNone = prev.filter((p) => p !== 'none');
                                return selected ? withoutNone.filter((p) => p !== x) : [...withoutNone, x];
                              });
                            }}
                            className={`rounded-full border px-3 py-1 text-xs ${selected ? 'border-[#131118]/25 bg-[#131118]/15' : 'border-[#131118]/20 hover:bg-[#131118]/10'}`}
                          >
                            {x}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm text-[#131118]/80" htmlFor="brand">Brand accent color (optional)</label>
                    <input id="brand" type="color" className="h-10 w-full rounded-xl bg-white border border-[#131118]/15 p-1" />
                  </div>
                </div>
              )}

              {personaMode && (
                <div className="mt-6 rounded-xl border border-[#131118]/15 bg-[#131118]/5 p-4 text-sm">
                  <div className="text-[#131118]/70">Persona summary</div>
                  <input
                    value={personaSummary}
                    onChange={(e) => setPersonaSummary(e.target.value)}
                    placeholder="Female, 30s, friendly, kitchen, eye level"
                    className="mt-2 w-full rounded-lg bg-white border border-[#131118]/15 px-3 py-2 outline-none"
                  />
                </div>
              )}
            </div>
          )}

          {step === 4 && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">Generate image</h2>
              <p className="mt-1 text-sm text-[#131118]/70">Don’t love it? Recreate with a new variation.</p>

              <div className="mt-6 grid gap-6 md:grid-cols-[1fr_280px]">
                <div>
                  <div className="relative aspect-[4/5] w-full max-w-2xl overflow-hidden rounded-xl border border-[#131118]/15 bg-[#131118]/5">
                    {generatedImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={generatedImageUrl} alt="Generated result" className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-[#131118]/60 text-sm">No image yet</div>
                    )}
                    {isGenerating && (
                      <div className="absolute inset-0 grid place-items-center bg-black/40 text-sm">Generating…</div>
                    )}
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="text-xs text-[#131118]/60">Variant: P+U / P+G / NP+U / NP+G</div>
                  <div className="space-y-2">
                    <label htmlFor="image-prompt" className="text-sm text-[#131118]/80">Prompt</label>
                    <textarea
                      id="image-prompt"
                      className="min-h-[84px] w-full rounded-xl bg-white border border-[#131118]/15 p-3 outline-none"
                      placeholder="place the product in a kitchen that looks super modern and clean"
                      value={imagePrompt}
                      onChange={(e) => { setImagePromptTouched(true); setImagePrompt(e.target.value); }}
                    />
                    <div className="text-xs text-[#131118]/60">Tip: The more specific the prompt, the better the result.</div>
                  </div>
                  <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="btn-primary"
                        onClick={createImage}
                        disabled={isGenerating || ((adType === "product" || adType === "ugc_product") && !productFile)}
                      >
                        {isGenerating ? "Generating…" : "Create Image"}
                      </button>
                      <button className="btn-ghost" onClick={createImage} disabled={isGenerating}>Recreate</button>
                    </div>
                    {genStatus && <div className="text-xs text-[#131118]/60">{genStatus}</div>}
                  </div>
                  <details className="rounded-xl border border-[#131118]/15 bg-[#131118]/5 p-4">
                    <summary className="cursor-pointer">Advanced</summary>
                    <div className="mt-3 space-y-3 text-sm">
                      <div>
                        <label className="text-[#131118]/80">Seed</label>
                        <input readOnly value="123456" className="mt-1 w-full rounded-lg bg-white border border-[#131118]/15 px-3 py-2" />
                        <div className="mt-1 text-xs text-[#131118]/60">Toggle "Lock seed" to edit</div>
                      </div>
                      <div>
                        <label className="text-[#131118]/80">Style strength</label>
                        <input type="range" min={0} max={100} defaultValue={50} className="mt-1 w-full" />
                      </div>
                      <label className="inline-flex items-center gap-2">
                        <input type="checkbox" /> Remove background
                      </label>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">Your 8-second dialogue</h2>
              <p className="mt-1 text-sm text-[#131118]/70">
                {adType === "product"
                  ? "Optional for product ads. You can continue without dialogue."
                  : "Required for UGC / Talking Head. Max 22 words or 150 characters."}
              </p>

              <div className="mt-6 space-y-2">
                <textarea
                  id="dialogue"
                  className="min-h-[140px] w-full rounded-xl bg-white border border-[#131118]/15 p-4 outline-none"
                  maxLength={150}
                  value={dialogue}
                  onChange={(e) => setDialogue(e.target.value)}
                  placeholder="E.g., ‘Meet GlowSerum—clearer skin in days…’"
                />
                <div className="flex items-center justify-between text-xs text-[#131118]/70">
                  <span>{adType === "product" ? "Optional." : "Max 22 words or 150 characters."}</span>
                  <span>{words}/22 • {chars}/150</span>
                </div>
              </div>

              {/* Voice controls: accent and gender */}
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <label htmlFor="voice-accent" className="text-sm text-[#131118]/80">Accent</label>
                  <select
                    id="voice-accent"
                    className="w-full rounded-xl bg-white border border-[#131118]/15 px-4 py-3 outline-none focus:border-[color:var(--brand)]"
                    value={voiceAccent}
                    onChange={(e) => setVoiceAccent(e.target.value)}
                  >
                    {[
                      "American",
                      "British",
                      "Australian",
                      "Indian",
                      "Irish",
                      "Scottish",
                      "Canadian",
                      "South African",
                      "New Zealand",
                      "Other",
                    ].map((a) => (
                      <option key={a} value={a}>{a}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label htmlFor="voice-gender" className="text-sm text-[#131118]/80">Voice</label>
                  <select
                    id="voice-gender"
                    className="w-full rounded-xl bg-white border border-[#131118]/15 px-4 py-3 outline-none focus:border-[color:var(--brand)]"
                    value={voiceGender}
                    onChange={(e) => setVoiceGender(e.target.value as "Male" | "Female")}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                  </select>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <div className="relative">
                  <button className="btn-ghost" onClick={() => runDialogueTool("assist")} disabled={dialogueLoading}>
                    {dialogueLoading ? "Working…" : "AI Assist"}
                  </button>
                </div>
                <button className="btn-ghost" onClick={() => runDialogueTool("shorten")} disabled={dialogueLoading}>Shorten to 8s</button>
                <button className="btn-ghost" onClick={() => runDialogueTool("cleanup")} disabled={dialogueLoading}>Clean up</button>
              </div>
              {dialogueError && (
                <div className="mt-2 text-xs text-red-400">{dialogueError}</div>
              )}
            </div>
          )}

          {step === 6 && (
            <div className="glass-card !p-8">
              <h2 className="text-lg font-semibold">Create your video</h2>
              <div className="mt-2 text-sm text-[#131118]/70">Preset: 1080×1350 (IG 4:5)</div>

              <div className="mt-4 grid gap-6 md:grid-cols-[1fr_1fr]">
                {/* Left: Generated image preview */}
                <div className="space-y-4">
                  <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-[#131118]/15 bg-[#131118]/5">
                    {step6Image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={step6Image} alt="Generated" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center text-sm text-[#131118]/60">No image</div>
                    )}
                  </div>
                  <div className="rounded-xl border border-[#131118]/15 bg-[#131118]/5 p-4">
                    <div className="text-sm">Progress</div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded bg-[#131118]/10">
                      <div
                        className="h-2 bg-gradient-to-r from-violet-500 to-pink-500 transition-all"
                        style={{ width: `${Math.max(0, Math.min(100, videoPct ?? 0))}%` }}
                      />
                    </div>
                    <div className="mt-2 text-xs text-[#131118]/70">{videoStatus || "Idle"}</div>
                    {/* Stage label timeline removed per request */}
                  </div>
                </div>

                {/* Right: Dialogue box and actions */}
                <div className="space-y-4">
                  {/* Placeholder toggle and source label removed */}
                  <div>
                    <label className="text-sm text-[#131118]/80">Video prompt (camera moves, pacing, emphasis)</label>
                    <textarea
                      value={videoPrompt}
                      onChange={(e) => setVideoPrompt(e.target.value)}
                      className="mt-2 min-h-[120px] w-full rounded-xl bg-white border border-[#131118]/15 p-3 text-sm"
                      placeholder="E.g., Pan left to right, then zoom in 100% onto the label. End with a gentle pull-back."
                    />
                  </div>
                  <div>
                    <label className="text-sm text-[#131118]/80">Dialogue from previous step</label>
                    <textarea
                      readOnly
                      value={dialogue}
                      className="mt-2 min-h-[160px] w-full rounded-xl bg-white border border-[#131118]/15 p-3 text-sm"
                    />
                  </div>
                  <button className="btn-primary w-full" onClick={generateVideo} disabled={videoGenerating || !step6Image}>
                    {videoGenerating ? "Rendering…" : "Generate Video"}
                  </button>
                  <div className="rounded-xl border border-[#131118]/15 bg-[#131118]/5 p-4 text-sm">
                    <div className="font-semibold">Result</div>
                    <div className="mt-2 aspect-[4/5] w-full overflow-hidden rounded-lg bg-black/30">
                      {videoUrl ? (
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        <video src={videoUrl} controls className="h-full w-full object-cover" />
                      ) : (
                        <div className="grid h-full place-items-center text-xs text-[#131118]/60">No video yet</div>
                      )}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-3">
                      <button className={`btn-primary ${!videoUrl ? "pointer-events-none opacity-60" : ""}`} onClick={downloadVideo} disabled={!videoUrl}>
                        Download MP4
                      </button>
                      <button className={`btn-ghost ${!videoUrl ? "pointer-events-none opacity-60" : ""}`} onClick={() => setShowVideoModal(true)} disabled={!videoUrl}>
                        Play here
                      </button>
                      <a className={`btn-ghost ${!videoUrl ? "pointer-events-none opacity-60" : ""}`} href={videoUrl ?? "#"} target="_blank" rel="noopener noreferrer">
                        Open in new tab
                      </a>
                      <button className="btn-ghost" onClick={() => { setVideoUrl(null); setVideoStatus(""); }}>Create another</button>
                    </div>
                    <div className="mt-2 text-xs text-[#131118]/60">Powered by Veo 3 Fast</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </section>
        {/* Video viewer modal */}
        {showVideoModal && (
          <div className="fixed inset-0 z-50">
            <div className="absolute inset-0 bg-black/70" onClick={() => setShowVideoModal(false)} />
            <div className="absolute inset-0 grid place-items-center p-4">
              <div className="w-full max-w-5xl overflow-hidden rounded-2xl border border-[#131118]/15 bg-[#0B0D12]">
                <div className="flex items-center justify-between border-b border-[#131118]/15 p-3">
                  <div className="text-sm text-[#131118]/70">Video preview</div>
                  <div className="flex gap-2">
                    <a className={`btn-ghost ${!videoUrl ? "pointer-events-none opacity-60" : ""}`} href={videoUrl ?? "#"} target="_blank" rel="noopener noreferrer">Open in new tab</a>
                    <button className="btn-ghost" onClick={() => setShowVideoModal(false)}>Close</button>
                  </div>
                </div>
                <div className="aspect-video w-full bg-black">
                  {videoUrl ? (
                    // eslint-disable-next-line jsx-a11y/media-has-caption
                    <video src={videoUrl} controls autoPlay className="h-full w-full object-contain" />
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <div className="sticky bottom-0 z-10 mt-6 border-t-[3px] border-[#131118] bg-[#F1EEE3]">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
          <button className="btn-ghost" onClick={onBack} disabled={step === 1}>Back</button>
          <div className="flex items-center gap-3 text-xs">
            <span className={`rounded-full px-2 py-0.5 ${dialogueOk ? "bg-[color:var(--success)]/15 text-[color:var(--success)]" : "bg-[#131118]/10 text-[#131118]/70"}`}>Step {step} of 6</span>
          </div>
          <div className="flex items-center gap-3">
            {step === 4 && generatedImageUrl ? (
              <button className="btn-ghost" onClick={downloadImage}>Download Image</button>
            ) : null}
            <button className="btn-primary disabled:opacity-50" onClick={onNext} disabled={!canContinue}>
              {step === 4 ? "Turn into Video" : step === 6 ? "Finish" : "Continue"}
            </button>
          </div>
        </div>
      </div>

      {/* Insufficient Credits Dialog */}
      <InsufficientCreditsDialog
        open={insufficientOpen}
        onOpenChange={setInsufficientOpen}
        required={requiredCredits}
        current={credits}
      />
    </div>
  );
}
