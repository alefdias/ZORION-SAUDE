import React, { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Camera, Upload, Trash2, RefreshCw, Check, X, AlertTriangle, User } from "lucide-react";
import { toast } from "sonner";

/**
 * Redimensiona e comprime uma imagem para base64 JPEG de até maxDim x maxDim
 */
function compressImage(img, maxDim = 400, quality = 0.85) {
  const canvas = document.createElement("canvas");
  let width = img.width || img.videoWidth || 400;
  let height = img.height || img.videoHeight || 400;

  // Recorte quadrado centralizado (1:1)
  const minDim = Math.min(width, height);
  const startX = (width - minDim) / 2;
  const startY = (height - minDim) / 2;

  canvas.width = Math.min(minDim, maxDim);
  canvas.height = Math.min(minDim, maxDim);

  const ctx = canvas.getContext("2d");
  ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", quality);
}

export function PhotoCaptureField({
  value,
  onChange,
  disabled = false,
  label = "Foto",
  helperText = "Tire uma foto pela webcam ou carregue do computador",
  className = ""
}) {
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [videoDevices, setVideoDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [cameraError, setCameraError] = useState("");
  const [capturedTemp, setCapturedTemp] = useState(null);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);

  // Fecha o stream da câmera
  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  };

  // Inicia a câmera ao abrir o modal
  useEffect(() => {
    if (!isCameraOpen) {
      stopStream();
      setCapturedTemp(null);
      setCameraError("");
      return;
    }

    let isMounted = true;

    async function startCamera() {
      setCameraError("");
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error("Seu navegador ou sistema não tem suporte a captura de câmera.");
        }

        // Listar dispositivos de vídeo
        try {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videoInputs = devices.filter((d) => d.kind === "videoinput");
          if (isMounted) {
            setVideoDevices(videoInputs);
            if (videoInputs.length > 0 && !selectedDeviceId) {
              setSelectedDeviceId(videoInputs[0].deviceId);
            }
          }
        } catch (e) {
          console.warn("Aviso ao enumerar dispositivos:", e);
        }

        const constraints = {
          video: selectedDeviceId
            ? { deviceId: { exact: selectedDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
            : { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        };

        stopStream();
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        if (isMounted) {
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch(() => {});
          }
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (err) {
        console.error("Erro ao acessar câmera:", err);
        if (isMounted) {
          setCameraError(
            err.name === "NotAllowedError" || err.name === "PermissionDeniedError"
              ? "Permissão de acesso à webcam negada pelo usuário ou sistema."
              : "Nenhuma webcam detectada ou a câmera está em uso por outro aplicativo."
          );
        }
      }
    }

    startCamera();

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [isCameraOpen, selectedDeviceId]);

  // Capturar foto do vídeo
  const handleSnap = () => {
    if (!videoRef.current) return;
    try {
      const dataUrl = compressImage(videoRef.current, 400, 0.85);
      setCapturedTemp(dataUrl);
    } catch (e) {
      toast.error("Erro ao capturar foto da câmera: " + e.message);
    }
  };

  // Confirmar foto da webcam
  const handleConfirmCaptured = () => {
    if (capturedTemp) {
      onChange(capturedTemp);
      setIsCameraOpen(false);
      toast.success("Foto registrada com sucesso!");
    }
  };

  // Upload de arquivo
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor, selecione um arquivo de imagem válido (JPG, PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const compressed = compressImage(img, 400, 0.85);
        onChange(compressed);
        toast.success("Foto carregada com sucesso!");
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);

    // Reset input
    e.target.value = "";
  };

  const handleRemove = () => {
    onChange("");
    toast.info("Foto removida.");
  };

  return (
    <div className={`space-y-2 ${className}`}>
      {label && <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</Label>}

      <div className="flex items-center gap-3.5 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/50">
        {/* Avatar / Preview da Foto */}
        <div className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 shadow-sm shrink-0 flex items-center justify-center">
          {value ? (
            <img
              src={value}
              alt="Foto"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-400">
              <User className="w-8 h-8 opacity-50" />
              <span className="text-[9px] font-semibold mt-0.5">Sem Foto</span>
            </div>
          )}
        </div>

        {/* Controles de Ação */}
        <div className="flex-1 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => setIsCameraOpen(true)}
              className="h-8 text-xs font-semibold gap-1.5 border-sky-300 text-sky-700 bg-sky-50/70 hover:bg-sky-100 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-800"
            >
              <Camera className="w-3.5 h-3.5 text-sky-600" />
              Tirar Foto (Webcam)
            </Button>

            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled}
              onClick={() => fileInputRef.current?.click()}
              className="h-8 text-xs font-semibold gap-1.5 border-slate-300 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-200"
            >
              <Upload className="w-3.5 h-3.5 text-slate-500" />
              Upload de Arquivo
            </Button>

            {value && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled}
                onClick={handleRemove}
                className="h-8 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 gap-1 px-2"
                title="Remover foto"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Remover
              </Button>
            )}

            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
              disabled={disabled}
            />
          </div>

          <p className="text-[11px] text-slate-400 leading-tight">
            {helperText}
          </p>
        </div>
      </div>

      {/* Modal da Câmera (Webcam) */}
      <Dialog open={isCameraOpen} onOpenChange={(open) => !open && setIsCameraOpen(false)}>
        <DialogContent className="max-w-md p-0 overflow-hidden shadow-2xl rounded-2xl">
          <DialogHeader className="p-4 pb-3 border-b border-slate-100 dark:border-slate-800">
            <DialogTitle className="flex items-center justify-between text-base font-bold">
              <span className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-sky-600" />
                Capturar Foto via Webcam
              </span>
              {videoDevices.length > 1 && (
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  className="text-xs bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-1"
                >
                  {videoDevices.map((d, i) => (
                    <option key={d.deviceId || i} value={d.deviceId}>
                      {d.label || `Câmera ${i + 1}`}
                    </option>
                  ))}
                </select>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="p-4 flex flex-col items-center justify-center bg-slate-950 text-white min-h-[300px] relative">
            {cameraError ? (
              <div className="text-center p-6 space-y-3">
                <AlertTriangle className="w-10 h-10 text-amber-400 mx-auto" />
                <p className="text-xs text-amber-200 max-w-xs">{cameraError}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs"
                  onClick={() => {
                    setCameraError("");
                    setIsCameraOpen(false);
                    setTimeout(() => setIsCameraOpen(true), 200);
                  }}
                >
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                  Tentar Novamente
                </Button>
              </div>
            ) : capturedTemp ? (
              <div className="relative w-full max-w-[320px] aspect-square rounded-xl overflow-hidden border-2 border-emerald-500 shadow-xl">
                <img
                  src={capturedTemp}
                  alt="Capturada"
                  className="w-full h-full object-cover"
                />
                <Badge className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-bold shadow-md">
                  ✓ Foto Pronta
                </Badge>
              </div>
            ) : (
              <div className="relative w-full max-w-[320px] aspect-square rounded-xl overflow-hidden bg-black border border-slate-800 shadow-inner flex items-center justify-center">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover transform -scale-x-100"
                />
                {/* Linhas guia de enquadramento de rosto */}
                <div className="absolute inset-4 rounded-full border border-dashed border-white/30 pointer-events-none" />
              </div>
            )}
          </div>

          <DialogFooter className="p-4 bg-slate-50 dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsCameraOpen(false)}
            >
              Cancelar
            </Button>

            <div className="flex items-center gap-2">
              {capturedTemp ? (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCapturedTemp(null)}
                    className="gap-1.5"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Tirar Outra
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleConfirmCaptured}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
                  >
                    <Check className="w-4 h-4" />
                    Usar Esta Foto
                  </Button>
                </>
              ) : (
                <Button
                  type="button"
                  size="sm"
                  disabled={Boolean(cameraError)}
                  onClick={handleSnap}
                  className="bg-sky-600 hover:bg-sky-700 text-white font-bold gap-1.5 shadow-md px-5"
                >
                  <Camera className="w-4 h-4" />
                  Capturar Foto
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
