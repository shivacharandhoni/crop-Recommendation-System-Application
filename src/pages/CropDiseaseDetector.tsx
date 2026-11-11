import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { UI_LANGUAGES, t } from "@/lib/farmerLocale";
import { useFarmerSettings } from "@/hooks/useFarmerSettings";
import { ArrowLeft, Camera, Upload, Loader2, Leaf, AlertTriangle, ShieldCheck, Bug, Sparkles } from "lucide-react";

export default function CropDiseaseDetector() {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const navigate = useNavigate();
  const settings = useFarmerSettings();
  const tr = (key: string) => t(settings.language, key);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ variant: "destructive", title: tr("invalidFile"), description: tr("invalidFile") });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({ variant: "destructive", title: tr("largeFile"), description: tr("largeFile") });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setImagePreview(event.target?.result as string);
      setAnalysis(null);
    };
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imagePreview) return;

    setIsAnalyzing(true);
    setAnalysis(null);

    try {
      const { data, error } = await supabase.functions.invoke("crop-disease-detect", {
        body: { imageBase64: imagePreview, language: settings.language, message: tr("diseasePrompt") },
      });

      if (error) throw error;

      if (data?.analysis) {
        setAnalysis(data.analysis);
      } else if (data?.error) {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Analysis error:", error);
      toast({
        variant: "destructive",
        title: "Analysis failed",
        description: error instanceof Error ? error.message : "Could not analyze the image. Please try again.",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    setImagePreview(null);
    setAnalysis(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (cameraInputRef.current) cameraInputRef.current.value = "";
  };

  return (
    <div className="min-h-screen sky-gradient">
      {/* Header */}
      <header className="bg-card/95 backdrop-blur-md border-b border-border px-4 py-3 shadow-card sticky top-0 z-40">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" aria-label={tr("back")} onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl hero-gradient flex items-center justify-center shadow-elevated">
            <Bug className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-bold text-foreground text-lg tracking-tight">{tr("diseaseTitle")}</h1>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> {tr("aiPowered")}
            </p>
          </div>
          <label className="sr-only" htmlFor="disease-language">{tr("language")}</label>
          <select id="disease-language" aria-label={tr("language")} className="ml-auto min-h-11 max-w-32 rounded-xl border border-border bg-background px-2 text-sm text-foreground" value={settings.language} onChange={(event) => settings.setLanguage(event.target.value as typeof settings.language)}>
            {UI_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.native}</option>)}
          </select>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Upload Card */}
        <Card className="border-border shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Leaf className="w-5 h-5 text-primary" />
              {tr("uploadCrop")}
            </CardTitle>
            <CardDescription>
              {tr("uploadHelp")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!imagePreview ? (
              <div className="space-y-3">
                {/* Camera Button */}
                <Button
                  variant="outline"
                  className="w-full h-32 border-dashed border-2 border-primary/30 hover:border-primary/50 hover:bg-primary/5 flex flex-col gap-2"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <Camera className="w-8 h-8 text-primary" />
                  <span className="text-sm font-medium">{tr("takePhoto")}</span>
                  <span className="text-xs text-muted-foreground">{tr("camera")}</span>
                </Button>

                {/* Upload Button */}
                <Button
                  variant="outline"
                  className="w-full h-20 border-dashed border-2 border-border hover:border-primary/30 hover:bg-primary/5 flex flex-col gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-6 h-6 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">{tr("gallery")}</span>
                </Button>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>
            ) : (
              <div className="space-y-4">
                <div className="relative rounded-xl overflow-hidden border border-border shadow-soft">
                  <img src={imagePreview} alt="Crop" className="w-full max-h-80 object-cover" />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={handleAnalyze}
                    disabled={isAnalyzing}
                    className="flex-1 hero-gradient text-primary-foreground hover:opacity-90"
                  >
                    {isAnalyzing ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {tr("analyzing")}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4" />
                        {tr("analyze")}
                      </>
                    )}
                  </Button>
                  <Button variant="outline" onClick={handleReset}>
                    {tr("newImage")}
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Analysis Result */}
        {isAnalyzing && (
          <Card className="border-primary/20 shadow-card animate-fade-in">
            <CardContent className="py-8 flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-sm text-muted-foreground font-medium">{tr("analysisProgress")}</p>
              <p className="text-xs text-muted-foreground">{tr("waitMessage")}</p>
            </CardContent>
          </Card>
        )}

        {analysis && (
          <Card className="border-primary/20 shadow-card animate-slide-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-primary" />
                {tr("analysisResult")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none text-foreground whitespace-pre-wrap leading-relaxed">
                {analysis}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Safety Notice */}
        <Card className="border-warning/30 bg-warning/5 shadow-soft">
          <CardContent className="py-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-semibold text-foreground mb-1">{tr("safetyNotice")}</p>
              <p>{tr("diseaseSafety")}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
