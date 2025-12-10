import React, { useState } from 'react';
import { GoogleGenAI } from "@google/genai";
import { Wand2, Loader2 } from 'lucide-react';
import { translations, Language } from '../utils/translations';

interface GeminiTitleProps {
  onTitleGenerated: (title: string, desc: string) => void;
  lang: Language;
}

export const GeminiTitle: React.FC<GeminiTitleProps> = ({ onTitleGenerated, lang }) => {
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const t = translations[lang];

  const generateTitle = async () => {
    if (!prompt.trim()) return;
    if (!process.env.API_KEY) {
       setError(t.apiError);
       return;
    }

    setLoading(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const userPrompt = `${t.geminiUserPromptPrefix}"${prompt}"${t.geminiUserPromptSuffix}`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
            responseMimeType: "application/json"
        }
      });
      
      const text = response.text;
      if (text) {
          const json = JSON.parse(text);
          onTitleGenerated(json.title, json.description);
      }
    } catch (e: any) {
      console.error("Gemini Error:", e);
      setError(t.genFail);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 p-4 bg-slate-800/50 rounded-xl border border-slate-700/50">
      <div className="flex flex-col gap-3">
        <label className="text-sm text-slate-400 font-medium flex items-center gap-2">
           <Wand2 size={14} className="text-indigo-400" />
           {t.aiAssist}
        </label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.aiPlaceholder}
            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button 
            onClick={generateTitle}
            disabled={loading || !prompt}
            className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shrink-0"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : t.magicBtn}
          </button>
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    </div>
  );
};