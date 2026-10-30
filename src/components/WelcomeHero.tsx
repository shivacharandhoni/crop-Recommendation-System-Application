import { Leaf, Mic, MessageSquare, Sun, CloudRain, Wheat, Languages, Volume2, Landmark, IndianRupee, FileText, BadgeCheck, Bug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

interface WelcomeHeroProps {
  onQuickQuestion?: (question: string) => void;
}

export function WelcomeHero({ onQuickQuestion }: WelcomeHeroProps) {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center py-8 px-4 animate-slide-up">
      {/* Hero Icon */}
      <div className="relative mb-8">
        <div className="w-24 h-24 rounded-2xl hero-gradient flex items-center justify-center shadow-elevated animate-bounce-gentle transform rotate-3">
          <Leaf className="w-12 h-12 text-primary-foreground" />
        </div>
        <div className="absolute -top-2 -right-2 w-8 h-8 bg-sun rounded-full flex items-center justify-center shadow-soft animate-pulse">
          <Sun className="w-5 h-5 text-foreground" />
        </div>
        <div className="absolute -bottom-2 -left-2 w-7 h-7 bg-sky rounded-full flex items-center justify-center shadow-soft">
          <CloudRain className="w-4 h-4 text-foreground" />
        </div>
      </div>

      {/* Title */}
      <h1 className="text-3xl md:text-4xl font-extrabold text-foreground text-center mb-2 tracking-tight">
        Crop Recommendation System
      </h1>
      <p className="text-muted-foreground text-center mb-4 max-w-md text-base">
        Your trusted AI agricultural advisor
      </p>
      
      {/* Language Support Badge */}
      <div className="flex flex-wrap justify-center gap-2 mb-8">
        <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary border-0 shadow-soft">
          <Languages className="w-4 h-4 mr-1.5" />
          हिंदी
        </Badge>
        <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary border-0 shadow-soft">
          తెలుగు
        </Badge>
        <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-primary/10 text-primary border-0 shadow-soft">
          English
        </Badge>
        <Badge variant="secondary" className="px-3 py-1.5 text-sm font-medium bg-secondary/20 text-secondary-foreground border-0 shadow-soft">
          +6 more
        </Badge>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 w-full max-w-lg mb-6">
        <FeatureCard icon={Mic} label="Voice Input" description="Speak naturally" color="primary" />
        <FeatureCard icon={MessageSquare} label="Smart Chat" description="Get answers" color="secondary" />
        <FeatureCard icon={Volume2} label="Voice Reply" description="Listen back" color="accent" />
        <div onClick={() => navigate("/crop-disease")} className="cursor-pointer">
          <FeatureCard icon={Bug} label="Disease Scan" description="Upload photo" color="accent" />
        </div>
      </div>

      {/* Quick Questions */}
      <div className="w-full max-w-md mb-6">
        <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wider">
          Tap to ask
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <QuickQuestion icon={Wheat} label="Best crop for this season?" onClick={onQuickQuestion} />
          <QuickQuestion icon={CloudRain} label="How to save water in irrigation?" onClick={onQuickQuestion} />
          <QuickQuestion icon={Leaf} label="मेरी फसल में कीड़े लग रहे हैं, क्या करूँ?" onClick={onQuickQuestion} />
          <QuickQuestion icon={Sun} label="వేసవిలో ఏ పంట వేయాలి?" onClick={onQuickQuestion} />
          <QuickQuestion icon={Wheat} label="மண் வளத்தை எப்படி அதிகரிப்பது?" onClick={onQuickQuestion} />
          <QuickQuestion icon={CloudRain} label="ধানের রোগ প্রতিকার কী?" onClick={onQuickQuestion} />
        </div>
      </div>

      {/* Government Schemes */}
      <div className="w-full max-w-md">
        <p className="text-xs text-muted-foreground text-center mb-3 font-medium uppercase tracking-wider">
          🏛️ Government Schemes
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <QuickQuestion icon={BadgeCheck} label="Am I eligible for PM-Kisan?" onClick={onQuickQuestion} />
          <QuickQuestion icon={IndianRupee} label="What subsidies are available for farmers?" onClick={onQuickQuestion} />
          <QuickQuestion icon={Landmark} label="Best loan schemes for small farmers?" onClick={onQuickQuestion} />
          <QuickQuestion icon={FileText} label="How to apply for PM Fasal Bima Yojana?" onClick={onQuickQuestion} />
          <QuickQuestion icon={IndianRupee} label="किसान क्रेडिट कार्ड कैसे बनवाएं?" onClick={onQuickQuestion} />
          <QuickQuestion icon={Landmark} label="రైతు బంధు పథకం ఎలా పొందాలి?" onClick={onQuickQuestion} />
          <QuickQuestion icon={BadgeCheck} label="PM-KUSUM solar pump scheme details?" onClick={onQuickQuestion} />
          <QuickQuestion icon={FileText} label="Soil Health Card कैसे प्राप्त करें?" onClick={onQuickQuestion} />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ 
  icon: Icon, 
  label, 
  description,
  color 
}: { 
  icon: typeof Mic; 
  label: string;
  description: string;
  color: "primary" | "secondary" | "accent";
}) {
  const colorClasses = {
    primary: "bg-primary/10 text-primary",
    secondary: "bg-secondary/20 text-secondary-foreground",
    accent: "bg-accent/10 text-accent",
  };

  return (
    <div className="flex flex-col items-center gap-2 p-4 bg-card rounded-2xl border border-border shadow-card hover:shadow-elevated transition-shadow group">
      <div className={`w-12 h-12 rounded-xl ${colorClasses[color]} flex items-center justify-center group-hover:scale-110 transition-transform`}>
        <Icon className="w-6 h-6" />
      </div>
      <span className="text-sm font-semibold text-foreground">{label}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </div>
  );
}

function QuickQuestion({ icon: Icon, label, onClick }: { icon: typeof Wheat; label: string; onClick?: (q: string) => void }) {
  return (
    <button
      onClick={() => onClick?.(label)}
      className="flex items-center gap-2 px-4 py-2.5 bg-card rounded-full border border-border shadow-soft hover:shadow-card hover:border-primary/30 transition-all cursor-pointer group text-left"
    >
      <Icon className="w-4 h-4 text-primary group-hover:scale-110 transition-transform flex-shrink-0" />
      <span className="text-sm font-medium text-foreground">{label}</span>
    </button>
  );
}
