import { FormEvent, KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, CircleHelp, Languages, MessageCircle, Mic, MicOff, Play, Send, Square, Trash2, Volume2, X } from "lucide-react";
import { useAIChat } from "@/hooks/useAIChat";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";

type ChatMessage = { id: string; role: "user" | "assistant"; content: string };
type ChatLanguage = { code: string; locale: string; native: string; label: string };

const CHAT_LANGUAGES: ChatLanguage[] = [
  { code: "en", locale: "en-IN", native: "English", label: "English" },
  { code: "hi", locale: "hi-IN", native: "हिन्दी", label: "Hindi" },
  { code: "te", locale: "te-IN", native: "తెలుగు", label: "Telugu" },
  { code: "ta", locale: "ta-IN", native: "தமிழ்", label: "Tamil" },
  { code: "bn", locale: "bn-IN", native: "বাংলা", label: "Bengali" },
  { code: "pa", locale: "pa-IN", native: "ਪੰਜਾਬੀ", label: "Punjabi" },
  { code: "gu", locale: "gu-IN", native: "ગુજરાતી", label: "Gujarati" },
  { code: "kn", locale: "kn-IN", native: "ಕನ್ನಡ", label: "Kannada" },
  { code: "ml", locale: "ml-IN", native: "മലയാളം", label: "Malayalam" },
  { code: "mr", locale: "mr-IN", native: "मराठी", label: "Marathi" },
  { code: "or", locale: "or-IN", native: "ଓଡ଼ିଆ", label: "Odia" },
  { code: "as", locale: "as-IN", native: "অসমীয়া", label: "Assamese" },
];

const CHAT_COPY: Record<string, Record<string, string>> = {
  en: { assistant: "Crop Assistant", ask: "Ask about crops, soil, disease, weather, or farming schemes.", placeholder: "Type or speak your farming question…", send: "Send", open: "Open farmer assistant", close: "Close assistant", mic: "Start speaking", stopMic: "Stop listening", play: "Listen to this reply", stop: "Stop speaking", auto: "Speak replies automatically", unsupportedMic: "Voice input is unavailable in this browser. You can type your question.", micError: "Microphone or speech recognition is unavailable. Check browser permission and try typing.", noVoice: "No installed speech voice matches this language. The reply is still available as text.", needInternet: "The AI assistant needs an internet connection. Saved chat history is still available on this device.", configError: "The assistant is not connected. Configure its Supabase URL, publishable key, and deployed chat function.", online: "Assistant online", offline: "Offline · saved chat only", clear: "Clear saved chat", clearConfirm: "Clear chat history saved on this device?", language: "Chat and speech language", listening: "Listening… speak now", saved: "Recent chat is saved on this device." },
  hi: { assistant: "फसल सहायक", ask: "फसल, मिट्टी, रोग, मौसम या कृषि योजनाओं के बारे में पूछें।", placeholder: "अपना सवाल लिखें या बोलें…", send: "भेजें", open: "किसान सहायक खोलें", close: "सहायक बंद करें", mic: "बोलना शुरू करें", stopMic: "सुनना रोकें", play: "यह जवाब सुनें", stop: "बोलना रोकें", auto: "जवाब अपने आप सुनें", unsupportedMic: "इस ब्राउज़र में आवाज़ से सवाल उपलब्ध नहीं है। आप लिख सकते हैं।", micError: "माइक या वॉइस पहचान उपलब्ध नहीं। अनुमति जाँचें या सवाल लिखें।", noVoice: "इस भाषा की आवाज़ डिवाइस पर नहीं है। जवाब पाठ में उपलब्ध है।", needInternet: "AI सहायक के लिए इंटरनेट चाहिए। पुरानी चैट इस डिवाइस पर उपलब्ध है।", online: "सहायक ऑनलाइन", offline: "ऑफ़लाइन · केवल सहेजी चैट", clear: "सहेजी चैट मिटाएँ", clearConfirm: "इस डिवाइस की चैट मिटाएँ?", language: "चैट और आवाज़ की भाषा", listening: "सुन रहा है… अब बोलें", saved: "हाल की चैट इसी डिवाइस पर सहेजी जाती है।" },
  te: { assistant: "పంట సహాయకుడు", ask: "పంటలు, నేల, వ్యాధులు, వాతావరణం లేదా పథకాల గురించి అడగండి.", placeholder: "మీ వ్యవసాయ ప్రశ్న టైప్ చేయండి లేదా మాట్లాడండి…", send: "పంపండి", open: "రైతు సహాయకుడిని తెరవండి", close: "సహాయకుడిని మూసివేయండి", mic: "మాట్లాడటం ప్రారంభించండి", stopMic: "వినడం ఆపండి", play: "ఈ సమాధానం వినండి", stop: "మాట్లాడటం ఆపండి", auto: "సమాధానాలను ఆటోమేటిక్‌గా వినండి", unsupportedMic: "ఈ బ్రౌజర్‌లో వాయిస్ ఇన్‌పుట్ లేదు. ప్రశ్న టైప్ చేయండి.", micError: "మైక్ లేదా వాయిస్ గుర్తింపు అందుబాటులో లేదు. అనుమతి చూడండి లేదా టైప్ చేయండి.", noVoice: "ఈ భాషకు ఇన్‌స్టాల్ చేసిన వాయిస్ లేదు. సమాధానం టెక్స్ట్‌లో ఉంది.", needInternet: "AI సహాయకుడికి ఇంటర్నెట్ అవసరం. పాత చాట్ ఈ పరికరంలో ఉంటుంది.", online: "సహాయకుడు ఆన్‌లైన్", offline: "ఆఫ్‌లైన్ · సేవ్ చేసిన చాట్ మాత్రమే", clear: "సేవ్ చేసిన చాట్ తొలగించండి", clearConfirm: "ఈ పరికరంలో సేవ్ చేసిన చాట్ తొలగించాలా?", language: "చాట్ మరియు వాయిస్ భాష", listening: "వింటోంది… మాట్లాడండి", saved: "ఇటీవలి చాట్ ఈ పరికరంలో సేవ్ అవుతుంది." },
  ta: { assistant: "பயிர் உதவியாளர்", ask: "பயிர், மண், நோய், வானிலை அல்லது விவசாயத் திட்டங்கள் பற்றி கேளுங்கள்.", placeholder: "கேள்வியைத் தட்டச்சு செய்யவும் அல்லது பேசவும்…", send: "அனுப்பு", open: "விவசாய உதவியாளரைத் திற", close: "உதவியாளரை மூடு", mic: "பேசத் தொடங்கு", stopMic: "கேட்பதை நிறுத்து", play: "பதிலைக் கேள்", stop: "பேச்சை நிறுத்து", auto: "பதில்களைத் தானாகப் பேசு", unsupportedMic: "இந்த உலாவியில் குரல் உள்ளீடு இல்லை. கேள்வியைத் தட்டச்சு செய்யலாம்.", micError: "ஒலிவாங்கி அல்லது குரல் அறிதல் கிடைக்கவில்லை. அனுமதியைச் சரிபார்க்கவும்.", noVoice: "இந்த மொழிக்கான குரல் சாதனத்தில் இல்லை. பதில் உரையாகக் கிடைக்கும்.", needInternet: "AI உதவியாளருக்கு இணையம் தேவை. பழைய உரையாடல் இந்தச் சாதனத்தில் இருக்கும்.", online: "உதவியாளர் இணையத்தில்", offline: "இணையமில்லை · சேமித்த உரையாடல் மட்டும்", clear: "சேமித்த உரையாடலை அழி", clearConfirm: "இந்தச் சாதனத்தில் சேமித்த உரையாடலை அழிக்கவா?", language: "உரையாடல் மற்றும் குரல் மொழி", listening: "கேட்கிறது… பேசுங்கள்", saved: "சமீபத்திய உரையாடல் இந்தச் சாதனத்தில் சேமிக்கப்படும்." },
  bn: { assistant: "ফসল সহায়ক", ask: "ফসল, মাটি, রোগ, আবহাওয়া বা কৃষি প্রকল্প নিয়ে জিজ্ঞাসা করুন।", placeholder: "প্রশ্ন লিখুন বা বলুন…", send: "পাঠান", open: "কৃষি সহায়ক খুলুন", close: "সহায়ক বন্ধ করুন", mic: "কথা বলা শুরু করুন", stopMic: "শোনা বন্ধ করুন", play: "উত্তর শুনুন", stop: "কথা বন্ধ করুন", auto: "উত্তর স্বয়ংক্রিয়ভাবে শুনুন", unsupportedMic: "এই ব্রাউজারে ভয়েস ইনপুট নেই। প্রশ্ন লিখতে পারেন।", micError: "মাইক্রোফোন বা ভয়েস শনাক্তকরণ নেই। অনুমতি পরীক্ষা করুন।", noVoice: "এই ভাষার কণ্ঠস্বর ডিভাইসে নেই। উত্তর লেখা হিসেবে থাকবে।", needInternet: "AI সহায়কের জন্য ইন্টারনেট দরকার। পুরোনো চ্যাট এই ডিভাইসে থাকবে।", online: "সহায়ক অনলাইন", offline: "অফলাইন · শুধু সংরক্ষিত চ্যাট", clear: "সংরক্ষিত চ্যাট মুছুন", clearConfirm: "এই ডিভাইসের চ্যাট মুছবেন?", language: "চ্যাট ও কথার ভাষা", listening: "শুনছি… বলুন", saved: "সাম্প্রতিক চ্যাট এই ডিভাইসে সংরক্ষিত।" },
  pa: { assistant: "ਫ਼ਸਲ ਸਹਾਇਕ", ask: "ਫ਼ਸਲ, ਮਿੱਟੀ, ਬਿਮਾਰੀ, ਮੌਸਮ ਜਾਂ ਖੇਤੀ ਯੋਜਨਾਵਾਂ ਬਾਰੇ ਪੁੱਛੋ।", placeholder: "ਆਪਣਾ ਸਵਾਲ ਲਿਖੋ ਜਾਂ ਬੋਲੋ…", send: "ਭੇਜੋ", open: "ਕਿਸਾਨ ਸਹਾਇਕ ਖੋਲ੍ਹੋ", close: "ਸਹਾਇਕ ਬੰਦ ਕਰੋ", mic: "ਬੋਲਣਾ ਸ਼ੁਰੂ ਕਰੋ", stopMic: "ਸੁਣਨਾ ਰੋਕੋ", play: "ਜਵਾਬ ਸੁਣੋ", stop: "ਬੋਲਣਾ ਰੋਕੋ", auto: "ਜਵਾਬ ਆਪਣੇ ਆਪ ਸੁਣੋ", unsupportedMic: "ਇਸ ਬ੍ਰਾਊਜ਼ਰ ਵਿੱਚ ਆਵਾਜ਼ ਰਾਹੀਂ ਇਨਪੁੱਟ ਨਹੀਂ ਹੈ। ਸਵਾਲ ਲਿਖੋ।", micError: "ਮਾਈਕ ਜਾਂ ਬੋਲੀ ਪਛਾਣ ਉਪਲਬਧ ਨਹੀਂ। ਇਜਾਜ਼ਤ ਜਾਂਚੋ।", noVoice: "ਇਸ ਭਾਸ਼ਾ ਦੀ ਆਵਾਜ਼ ਡਿਵਾਈਸ ਵਿੱਚ ਨਹੀਂ ਹੈ। ਜਵਾਬ ਲਿਖਤ ਵਜੋਂ ਮਿਲੇਗਾ।", needInternet: "AI ਸਹਾਇਕ ਲਈ ਇੰਟਰਨੈੱਟ ਚਾਹੀਦਾ ਹੈ। ਪੁਰਾਣੀ ਗੱਲਬਾਤ ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਰਹੇਗੀ।", online: "ਸਹਾਇਕ ਆਨਲਾਈਨ", offline: "ਆਫਲਾਈਨ · ਸਿਰਫ਼ ਸੁਰੱਖਿਅਤ ਚੈਟ", clear: "ਸੁਰੱਖਿਅਤ ਚੈਟ ਮਿਟਾਓ", clearConfirm: "ਇਸ ਡਿਵਾਈਸ ਦੀ ਚੈਟ ਮਿਟਾਉਣੀ ਹੈ?", language: "ਚੈਟ ਅਤੇ ਬੋਲੀ ਦੀ ਭਾਸ਼ਾ", listening: "ਸੁਣ ਰਿਹਾ ਹੈ… ਬੋਲੋ", saved: "ਹਾਲੀਆ ਚੈਟ ਇਸ ਡਿਵਾਈਸ 'ਤੇ ਸੁਰੱਖਿਅਤ ਹੈ।" },
  gu: { assistant: "પાક સહાયક", ask: "પાક, જમીન, રોગ, હવામાન અથવા ખેતી યોજનાઓ વિશે પૂછો.", placeholder: "તમારો પ્રશ્ન લખો અથવા બોલો…", send: "મોકલો", open: "ખેડૂત સહાયક ખોલો", close: "સહાયક બંધ કરો", mic: "બોલવાનું શરૂ કરો", stopMic: "સાંભળવાનું બંધ કરો", play: "જવાબ સાંભળો", stop: "બોલવાનું બંધ કરો", auto: "જવાબો આપમેળે સાંભળો", unsupportedMic: "આ બ્રાઉઝરમાં વૉઇસ ઇનપુટ ઉપલબ્ધ નથી. પ્રશ્ન લખો.", micError: "માઇક્રોફોન અથવા વૉઇસ ઓળખ ઉપલબ્ધ નથી. પરવાનગી તપાસો.", noVoice: "આ ભાષાનો અવાજ ઉપકરણમાં નથી. જવાબ લખાણમાં ઉપલબ્ધ છે.", needInternet: "AI સહાયક માટે ઇન્ટરનેટ જરૂરી છે. જૂની વાતચીત આ ઉપકરણ પર રહેશે.", online: "સહાયક ઑનલાઇન", offline: "ઑફલાઇન · માત્ર સાચવેલી ચેટ", clear: "સાચવેલી ચેટ સાફ કરો", clearConfirm: "આ ઉપકરણની ચેટ સાફ કરવી છે?", language: "ચેટ અને અવાજની ભાષા", listening: "સાંભળી રહ્યો છે… બોલો", saved: "તાજેતરની ચેટ આ ઉપકરણ પર સાચવાય છે." },
  kn: { assistant: "ಬೆಳೆ ಸಹಾಯಕ", ask: "ಬೆಳೆ, ಮಣ್ಣು, ರೋಗ, ಹವಾಮಾನ ಅಥವಾ ಕೃಷಿ ಯೋಜನೆಗಳ ಬಗ್ಗೆ ಕೇಳಿ.", placeholder: "ಪ್ರಶ್ನೆಯನ್ನು ಟೈಪ್ ಮಾಡಿ ಅಥವಾ ಮಾತನಾಡಿ…", send: "ಕಳುಹಿಸಿ", open: "ರೈತ ಸಹಾಯಕ ತೆರೆಯಿರಿ", close: "ಸಹಾಯಕ ಮುಚ್ಚಿ", mic: "ಮಾತನಾಡಲು ಪ್ರಾರಂಭಿಸಿ", stopMic: "ಕೇಳುವುದನ್ನು ನಿಲ್ಲಿಸಿ", play: "ಉತ್ತರ ಕೇಳಿ", stop: "ಮಾತು ನಿಲ್ಲಿಸಿ", auto: "ಉತ್ತರಗಳನ್ನು ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಕೇಳಿ", unsupportedMic: "ಈ ಬ್ರೌಸರ್‌ನಲ್ಲಿ ಧ್ವನಿ ಇನ್‌ಪುಟ್ ಇಲ್ಲ. ಪ್ರಶ್ನೆ ಟೈಪ್ ಮಾಡಿ.", micError: "ಮೈಕ್ರೊಫೋನ್ ಅಥವಾ ಧ್ವನಿ ಗುರುತಿಸುವಿಕೆ ಲಭ್ಯವಿಲ್ಲ. ಅನುಮತಿ ಪರಿಶೀಲಿಸಿ.", noVoice: "ಈ ಭಾಷೆಯ ಧ್ವನಿ ಸಾಧನದಲ್ಲಿ ಇಲ್ಲ. ಉತ್ತರ ಪಠ್ಯವಾಗಿ ಲಭ್ಯ.", needInternet: "AI ಸಹಾಯಕಕ್ಕೆ ಇಂಟರ್ನೆಟ್ ಬೇಕು. ಹಿಂದಿನ ಚಾಟ್ ಈ ಸಾಧನದಲ್ಲಿ ಇರುತ್ತದೆ.", online: "ಸಹಾಯಕ ಆನ್‌ಲೈನ್", offline: "ಆಫ್‌ಲೈನ್ · ಉಳಿಸಿದ ಚಾಟ್ ಮಾತ್ರ", clear: "ಉಳಿಸಿದ ಚಾಟ್ ತೆರವುಗೊಳಿಸಿ", clearConfirm: "ಈ ಸಾಧನದ ಚಾಟ್ ತೆರವುಗೊಳಿಸಬೇಕೆ?", language: "ಚಾಟ್ ಮತ್ತು ಧ್ವನಿ ಭಾಷೆ", listening: "ಕೇಳುತ್ತಿದೆ… ಮಾತನಾಡಿ", saved: "ಇತ್ತೀಚಿನ ಚಾಟ್ ಈ ಸಾಧನದಲ್ಲಿ ಉಳಿಸಲಾಗಿದೆ." },
  ml: { assistant: "വിള സഹായക", ask: "വിള, മണ്ണ്, രോഗം, കാലാവസ്ഥ, കൃഷി പദ്ധതികൾ എന്നിവ ചോദിക്കൂ.", placeholder: "ചോദ്യം ടൈപ്പ് ചെയ്യുക അല്ലെങ്കിൽ പറയുക…", send: "അയയ്ക്കുക", open: "കർഷക സഹായം തുറക്കുക", close: "സഹായം അടയ്ക്കുക", mic: "സംസാരം തുടങ്ങുക", stopMic: "കേൾക്കുന്നത് നിർത്തുക", play: "മറുപടി കേൾക്കുക", stop: "സംസാരം നിർത്തുക", auto: "മറുപടികൾ സ്വയം കേൾക്കുക", unsupportedMic: "ഈ ബ്രൗസറിൽ ശബ്ദ ഇൻപുട്ട് ലഭ്യമല്ല. ചോദ്യം ടൈപ്പ് ചെയ്യാം.", micError: "മൈക്രോഫോൺ അല്ലെങ്കിൽ ശബ്ദ തിരിച്ചറിയൽ ലഭ്യമല്ല. അനുമതി പരിശോധിക്കുക.", noVoice: "ഈ ഭാഷയുടെ ശബ്ദം ഉപകരണത്തിൽ ഇല്ല. മറുപടി എഴുത്തായി ലഭിക്കും.", needInternet: "AI സഹായത്തിന് ഇന്റർനെറ്റ് വേണം. പഴയ ചാറ്റ് ഈ ഉപകരണത്തിൽ ലഭ്യമാണ്.", online: "സഹായകൻ ഓൺലൈൻ", offline: "ഓഫ്‌ലൈൻ · സംരക്ഷിച്ച ചാറ്റ് മാത്രം", clear: "സംരക്ഷിച്ച ചാറ്റ് മായ്ക്കുക", clearConfirm: "ഈ ഉപകരണത്തിലെ ചാറ്റ് മായ്ക്കണോ?", language: "ചാറ്റ്, ശബ്ദ ഭാഷ", listening: "കേൾക്കുന്നു… പറയൂ", saved: "സമീപകാല ചാറ്റ് ഈ ഉപകരണത്തിൽ സൂക്ഷിക്കുന്നു." },
  mr: { assistant: "पीक सहाय्यक", ask: "पीक, माती, रोग, हवामान किंवा कृषी योजनांबद्दल विचारा.", placeholder: "प्रश्न लिहा किंवा बोला…", send: "पाठवा", open: "शेतकरी सहाय्यक उघडा", close: "सहाय्यक बंद करा", mic: "बोलायला सुरू करा", stopMic: "ऐकणे थांबवा", play: "उत्तर ऐका", stop: "बोलणे थांबवा", auto: "उत्तरे आपोआप ऐका", unsupportedMic: "या ब्राउझरमध्ये आवाज इनपुट उपलब्ध नाही. प्रश्न टाइप करा.", micError: "मायक्रोफोन किंवा आवाज ओळख उपलब्ध नाही. परवानगी तपासा.", noVoice: "या भाषेचा आवाज डिव्हाइसवर उपलब्ध नाही. उत्तर मजकूरात दिसेल.", needInternet: "AI सहाय्यकासाठी इंटरनेट आवश्यक आहे. जुनी चॅट या डिव्हाइसवर राहते.", online: "सहाय्यक ऑनलाइन", offline: "ऑफलाइन · फक्त जतन केलेली चॅट", clear: "जतन केलेली चॅट पुसा", clearConfirm: "या डिव्हाइसवरील चॅट पुसायची?", language: "चॅट आणि आवाजाची भाषा", listening: "ऐकत आहे… बोला", saved: "अलीकडील चॅट या डिव्हाइसवर जतन होते." },
  or: { assistant: "ଫସଲ ସହାୟକ", ask: "ଫସଲ, ମାଟି, ରୋଗ, ପାଣିପାଗ କିମ୍ବା କୃଷି ଯୋଜନା ବିଷୟରେ ପଚାରନ୍ତୁ।", placeholder: "ପ୍ରଶ୍ନ ଲେଖନ୍ତୁ କିମ୍ବା କୁହନ୍ତୁ…", send: "ପଠାନ୍ତୁ", open: "କୃଷକ ସହାୟକ ଖୋଲନ୍ତୁ", close: "ସହାୟକ ବନ୍ଦ କରନ୍ତୁ", mic: "କହିବା ଆରମ୍ଭ କରନ୍ତୁ", stopMic: "ଶୁଣିବା ବନ୍ଦ କରନ୍ତୁ", play: "ଉତ୍ତର ଶୁଣନ୍ତୁ", stop: "କହିବା ବନ୍ଦ କରନ୍ତୁ", auto: "ଉତ୍ତର ସ୍ୱୟଂଚାଳିତ ଭାବେ ଶୁଣନ୍ତୁ", unsupportedMic: "ଏହି ବ୍ରାଉଜରରେ କଣ୍ଠ ଇନପୁଟ ନାହିଁ। ପ୍ରଶ୍ନ ଟାଇପ କରନ୍ତୁ।", micError: "ମାଇକ୍ କିମ୍ବା କଣ୍ଠ ଚିହ୍ନଟ ନାହିଁ। ଅନୁମତି ଯାଞ୍ଚ କରନ୍ତୁ।", noVoice: "ଏହି ଭାଷାର ସ୍ୱର ଡିଭାଇସରେ ନାହିଁ। ଉତ୍ତର ଲେଖା ଭାବେ ମିଳିବ।", needInternet: "AI ସହାୟକ ପାଇଁ ଇଣ୍ଟରନେଟ ଆବଶ୍ୟକ। ପୁରୁଣା ଚାଟ ଏହି ଡିଭାଇସରେ ରହିବ।", online: "ସହାୟକ ଅନଲାଇନ", offline: "ଅଫଲାଇନ୍ · ସଞ୍ଚିତ ଚାଟ ମାତ୍ର", clear: "ସଞ୍ଚିତ ଚାଟ ହଟାନ୍ତୁ", clearConfirm: "ଏହି ଡିଭାଇସର ଚାଟ ହଟାଇବେ?", language: "ଚାଟ ଏବଂ କଥାର ଭାଷା", listening: "ଶୁଣୁଛି… କୁହନ୍ତୁ", saved: "ସମ୍ପ୍ରତି ଚାଟ ଏହି ଡିଭାଇସରେ ସଞ୍ଚିତ ହୁଏ." },
  as: { assistant: "শস্য সহায়ক", ask: "শস্য, মাটি, ৰোগ, বতৰ বা কৃষি আঁচনিৰ বিষয়ে সোধক।", placeholder: "প্ৰশ্ন লিখক বা কওক…", send: "পঠিয়াওক", open: "কৃষক সহায়ক খোলক", close: "সহায়ক বন্ধ কৰক", mic: "কথা ক'বলৈ আৰম্ভ কৰক", stopMic: "শুনা বন্ধ কৰক", play: "উত্তৰ শুনক", stop: "কথা বন্ধ কৰক", auto: "উত্তৰ স্বয়ংক্ৰিয়ভাৱে শুনক", unsupportedMic: "এই ব্ৰাউজাৰত কণ্ঠ ইনপুট উপলব্ধ নহয়। প্ৰশ্ন লিখিব পাৰে।", micError: "মাইক্ৰ'ফোন বা কণ্ঠ চিনাক্তকৰণ উপলব্ধ নহয়। অনুমতি পৰীক্ষা কৰক।", noVoice: "এই ভাষাৰ কণ্ঠ ডিভাইচত নাই। উত্তৰ লিখিত ৰূপত থাকিব।", needInternet: "AI সহায়কৰ বাবে ইণ্টাৰনেট লাগে। পুৰণি কথোপকথন এই ডিভাইচত থাকিব।", online: "সহায়ক অনলাইন", offline: "অফলাইন · সংৰক্ষিত চাটহে", clear: "সংৰক্ষিত চাট মচক", clearConfirm: "এই ডিভাইচৰ চাট মচিবনে?", language: "চাট আৰু কথাৰ ভাষা", listening: "শুনি আছোঁ… কওক", saved: "শেহতীয়া চাট এই ডিভাইচত সংৰক্ষিত।" },
};

const HISTORY_KEY = "crop-assistant-local-history-v1";
const LANGUAGE_KEY = "crop-assistant-language-v1";
const AUTO_SPEAK_KEY = "crop-assistant-auto-speak-v1";

function savedMessages(): ChatMessage[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => item && (item.role === "assistant" || item.role === "user") && typeof item.content === "string").slice(-60) : [];
  } catch { return []; }
}

export default function FarmerChatWidget() {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(savedMessages);
  const [error, setError] = useState<string | null>(null);
  const [voiceStatus, setVoiceStatus] = useState("");
  const [online, setOnline] = useState(navigator.onLine);
  const [language, setLanguage] = useState(() => {
    const stored = localStorage.getItem(LANGUAGE_KEY);
    if (CHAT_LANGUAGES.some((item) => item.code === stored)) return stored!;
    const uiLanguage = localStorage.getItem("crop-recommendation-ui-language");
    return CHAT_LANGUAGES.some((item) => item.code === uiLanguage) ? uiLanguage! : "en";
  });
  const [autoSpeak, setAutoSpeak] = useState(localStorage.getItem(AUTO_SPEAK_KEY) === "true");
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const replyTextRef = useRef("");
  const { sendMessage, isLoading } = useAIChat();
  const { startListening, stopListening, transcript, interimTranscript, isListening, isSupported, error: speechError, setLanguage: setRecognitionLanguage } = useSpeechRecognition();
  const activeLanguage = CHAT_LANGUAGES.find((item) => item.code === language) ?? CHAT_LANGUAGES[0];
  const copy = CHAT_COPY[language] ?? CHAT_COPY.en;
  const matchingVoices = useMemo(() => voices.filter((voice) => voice.lang.toLowerCase().startsWith(`${language}-`) || voice.lang.toLowerCase() === language), [voices, language]);

  useEffect(() => {
    const selected = CHAT_LANGUAGES.find((item) => item.code === language) ?? CHAT_LANGUAGES[0];
    setRecognitionLanguage(selected.locale);
    localStorage.setItem(LANGUAGE_KEY, selected.code);
  }, [language, setRecognitionLanguage]);
  useEffect(() => { localStorage.setItem(HISTORY_KEY, JSON.stringify(messages.slice(-60))); }, [messages]);
  useEffect(() => { localStorage.setItem(AUTO_SPEAK_KEY, String(autoSpeak)); }, [autoSpeak]);
  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    window.addEventListener("online", sync); window.addEventListener("offline", sync);
    return () => { window.removeEventListener("online", sync); window.removeEventListener("offline", sync); };
  }, []);
  useEffect(() => {
    if (!("speechSynthesis" in window)) return;
    const update = () => setVoices(window.speechSynthesis.getVoices());
    update(); window.speechSynthesis.addEventListener("voiceschanged", update);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", update);
  }, []);
  useEffect(() => {
    if (transcript) setDraft((current) => current === transcript ? current : transcript);
  }, [transcript]);
  useEffect(() => {
    if (speechError) setVoiceStatus(`${copy.micError} (${speechError})`);
  }, [speechError, language]);

  const speak = useCallback((text: string, messageId: string) => {
    if (!("speechSynthesis" in window)) { setVoiceStatus(copy.noVoice); return; }
    const matching = window.speechSynthesis.getVoices().filter((voice) => voice.lang.toLowerCase().startsWith(`${language}-`) || voice.lang.toLowerCase() === language);
    if (!matching.length) { setVoiceStatus(copy.noVoice); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = activeLanguage.locale;
    utterance.voice = matching.find((voice) => voice.default) ?? matching[0];
    utterance.rate = 0.92;
    utterance.onstart = () => { setSpeakingId(messageId); setVoiceStatus(""); };
    utterance.onend = () => setSpeakingId(null);
    utterance.onerror = () => { setSpeakingId(null); setVoiceStatus(copy.noVoice); };
    window.speechSynthesis.speak(utterance);
  }, [activeLanguage.locale, copy.noVoice, language]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || isLoading) return;
    if (!navigator.onLine) { setError(copy.needInternet); return; }

    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const assistantId = crypto.randomUUID();
    const history = [...messages, userMessage];
    setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
    setDraft(""); setError(null); setVoiceStatus(""); replyTextRef.current = "";

    try {
      await sendMessage({
        messages: history.map(({ role, content: message }) => ({ role, content: message })),
        onDelta: (chunk) => {
          replyTextRef.current += chunk;
          setMessages((current) => current.map((item) => item.id === assistantId ? { ...item, content: item.content + chunk } : item));
          requestAnimationFrame(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight; });
        },
        onDone: () => { if (autoSpeak && replyTextRef.current.trim()) speak(replyTextRef.current, assistantId); },
      });
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== assistantId || item.content));
      setDraft(content);
      const reason = caught instanceof Error ? caught.message : "";
      setError(reason === "offline" || /failed to fetch|network/i.test(reason) ? copy.needInternet : reason === "not-configured" ? (copy.configError ?? CHAT_COPY.en.configError) : (reason || copy.needInternet));
    }
  };

  const toggleListening = () => {
    if (!isSupported) { setVoiceStatus(copy.unsupportedMic); return; }
    setError(null); setVoiceStatus("");
    if (isListening) stopListening(); else startListening();
  };
  const handleInputKey = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); }
  };
  const clearHistory = () => {
    if (!window.confirm(copy.clearConfirm)) return;
    setMessages([]); setError(null); setVoiceStatus(""); localStorage.removeItem(HISTORY_KEY);
  };
  const toggleSpeech = (message: ChatMessage) => {
    if (speakingId === message.id) { window.speechSynthesis.cancel(); setSpeakingId(null); }
    else speak(message.content, message.id);
  };

  return (
    <div className="fixed bottom-5 right-4 z-50 font-sans sm:right-5">
      {open && (
        <section aria-label={copy.assistant} className="mb-3 flex h-[min(620px,calc(100dvh-105px))] w-[min(420px,calc(100vw-32px))] flex-col overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-2xl">
          <header className="flex items-center justify-between gap-2 bg-emerald-800 px-3 py-3 text-white sm:px-4">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/15"><Bot className="h-5 w-5" /></span>
              <div className="min-w-0"><p className="truncate font-semibold">{copy.assistant}</p><p className="truncate text-xs text-emerald-100">{copy.ask}</p></div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" aria-label={copy.clear} title={copy.clear} onClick={clearHistory} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15"><Trash2 className="h-4 w-4" /></button>
              <button type="button" aria-label={copy.close} onClick={() => setOpen(false)} className="flex h-10 w-10 items-center justify-center rounded-full hover:bg-white/15"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2">
            <Languages className="h-4 w-4 shrink-0 text-emerald-800" />
            <label className="sr-only" htmlFor="chat-language">{copy.language}</label>
            <select id="chat-language" aria-label={copy.language} value={language} onChange={(event) => setLanguage(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-2 text-sm text-slate-800">
              {CHAT_LANGUAGES.map((item) => <option key={item.code} value={item.code}>{item.native} · {item.label}</option>)}
            </select>
            <label className="flex min-h-11 max-w-[125px] items-center gap-2 text-xs leading-4 text-slate-700"><input type="checkbox" checked={autoSpeak} onChange={(event) => setAutoSpeak(event.target.checked)} />{copy.auto}</label>
          </div>
          <div className={`flex items-center gap-2 px-3 py-2 text-xs ${online ? "bg-emerald-50 text-emerald-900" : "bg-amber-50 text-amber-950"}`} role="status">
            <span className={`h-2 w-2 shrink-0 rounded-full ${online ? "bg-emerald-600" : "bg-amber-600"}`} />{online ? copy.online : copy.offline} · {copy.saved}
          </div>

          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-[#f7faf6] p-3 sm:p-4" aria-live="polite">
            {messages.length === 0 && <div className="rounded-2xl rounded-tl-md bg-white p-3 text-sm leading-6 text-slate-700 shadow-sm">{copy.ask}</div>}
            {messages.map((message) => (
              <div key={message.id} className={`max-w-[92%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm leading-6 ${message.role === "user" ? "ml-auto rounded-tr-md bg-emerald-700 text-white" : "rounded-tl-md bg-white text-slate-700 shadow-sm"}`}>
                {message.content || (isLoading && message.role === "assistant" ? "…" : "")}
                {message.role === "assistant" && message.content && <div className="mt-1 flex items-center gap-2 border-t border-slate-100 pt-1"><button type="button" onClick={() => toggleSpeech(message)} className="inline-flex min-h-10 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-emerald-900 hover:bg-emerald-50" aria-label={speakingId === message.id ? copy.stop : copy.play}>{speakingId === message.id ? <Square className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}{speakingId === message.id ? copy.stop : copy.play}</button><Volume2 className="h-4 w-4 text-slate-400" /></div>}
              </div>
            ))}
            {isListening && <p className="rounded-xl bg-white p-2 text-sm text-emerald-900" role="status">{copy.listening}{interimTranscript ? ` ${interimTranscript}` : ""}</p>}
            {error && <p role="alert" className="rounded-xl bg-red-50 p-2 text-sm text-red-800">{error}</p>}
            {voiceStatus && <p role="status" className="rounded-xl bg-amber-50 p-2 text-sm text-amber-950">{voiceStatus}</p>}
          </div>

          <form onSubmit={submit} className="border-t border-slate-200 bg-white p-2 sm:p-3">
            <div className="flex items-end gap-2">
              <textarea rows={2} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={handleInputKey} placeholder={copy.placeholder} aria-label={copy.placeholder} className="min-h-11 min-w-0 flex-1 resize-none rounded-2xl bg-slate-100 px-3 py-3 text-base leading-5 text-slate-900 outline-none ring-emerald-600 placeholder:text-slate-500 focus:ring-2" />
              <button type="button" onClick={toggleListening} aria-pressed={isListening} aria-label={isListening ? copy.stopMic : copy.mic} title={isListening ? copy.stopMic : copy.mic} className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border transition ${isListening ? "border-red-300 bg-red-100 text-red-800" : "border-emerald-200 bg-emerald-50 text-emerald-900 hover:bg-emerald-100"}`}>
                {isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
              </button>
              <button type="submit" disabled={!draft.trim() || isLoading || !online} aria-label={copy.send} title={copy.send} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-700 text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"><Send className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 flex items-center gap-1 px-1 text-[11px] text-slate-500"><CircleHelp className="h-3 w-3 shrink-0" />{isSupported ? copy.saved : copy.unsupportedMic}</p>
          </form>
        </section>
      )}
      <button type="button" onClick={() => setOpen((value) => !value)} aria-label={open ? copy.close : copy.open} className="ml-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-700 text-white shadow-xl transition hover:scale-105 hover:bg-emerald-800">
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </div>
  );
}
