
import React, { useState, useRef } from 'react';
import { DocxHandler } from './services/docxHandler';
import { AppState, LLMConfig } from './types';
import { Button } from './components/Button';
import { Upload, FileText, CheckCircle, AlertCircle, Download, Globe, ShieldCheck, Settings, ChevronDown, ChevronUp } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [progress, setProgress] = useState({ completed: 0, total: 0, status: '' });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [translatedBlob, setTranslatedBlob] = useState<Blob | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  
  const [config, setConfig] = useState<LLMConfig>({
    provider: 'gemini',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gemini-3-flash-preview',
    apiKey: ''
  });

  const docxHandler = useRef<DocxHandler>(new DocxHandler());

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (!selectedFile.name.endsWith('.docx')) {
        setErrorMsg('Please upload a valid .docx file.');
        return;
      }
      setFile(selectedFile);
      setErrorMsg('');
      setAppState(AppState.IDLE);
      setTranslatedBlob(null);
    }
  };

  const startTranslation = async () => {
    if (!file) return;
    try {
      setAppState(AppState.PARSING);
      setProgress({ completed: 0, total: 0, status: 'Parsing DOCX structure...' });
      await docxHandler.current.load(file);
      
      setAppState(AppState.TRANSLATING);
      const blob = await docxHandler.current.processAndTranslate(config, (completed, total, status) => {
        setProgress({ completed, total, status });
      });
      
      setTranslatedBlob(blob);
      setAppState(AppState.COMPLETED);
    } catch (err: any) {
      setAppState(AppState.ERROR);
      setErrorMsg(err.message || "An unexpected error occurred during processing.");
    }
  };

  const downloadFile = () => {
    if (translatedBlob && file) {
      const url = window.URL.createObjectURL(translatedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Translated_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 text-slate-900">
      <div className="max-w-3xl w-full space-y-8">
        <header className="text-center">
          <div className="mx-auto h-16 w-16 bg-indigo-100 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
            <Globe className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">DocxTranslator Pro</h1>
          <p className="mt-2 text-slate-500 font-medium">Enterprise-grade document translation with layout preservation.</p>
        </header>

        <main className="bg-white shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-200 overflow-hidden">
          {/* Settings Section */}
          <section className="border-b border-slate-100 bg-slate-50/50">
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="w-full flex items-center justify-between px-6 py-4 text-sm font-semibold text-slate-700 hover:bg-slate-100/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings className="h-4 w-4 text-slate-400" />
                API Configuration ({config.provider === 'gemini' ? 'Gemini AI' : 'OpenAI Compatible'})
              </div>
              {showSettings ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            
            {showSettings && (
              <div className="px-6 py-6 border-t border-slate-100 space-y-5 animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex p-1 bg-slate-100 rounded-lg">
                  <button 
                    onClick={() => setConfig({...config, provider: 'gemini', model: 'gemini-3-flash-preview'})}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${config.provider === 'gemini' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    Google Gemini
                  </button>
                  <button 
                    onClick={() => setConfig({...config, provider: 'openai', model: 'gpt-4o'})}
                    className={`flex-1 py-1.5 px-3 text-xs font-bold rounded-md transition-all ${config.provider === 'openai' ? 'bg-white shadow text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    OpenAI Compatible
                  </button>
                </div>

                {config.provider === 'openai' && (
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Endpoint URL</label>
                    <input 
                      type="text" 
                      value={config.baseUrl}
                      onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                      placeholder="https://api.openai.com/v1"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">Model Identifier</label>
                    <input 
                      type="text" 
                      value={config.model}
                      onChange={(e) => setConfig({...config, model: e.target.value})}
                      placeholder={config.provider === 'gemini' ? "gemini-3-flash-preview" : "gpt-4o"}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-400">API Key (Optional)</label>
                    <input 
                      type="password" 
                      value={config.apiKey}
                      onChange={(e) => setConfig({...config, apiKey: e.target.value})}
                      placeholder="Use system default"
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-shadow"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="p-6 sm:p-10 space-y-6">
            <div className={`border-2 border-dashed rounded-2xl p-10 flex flex-col items-center justify-center transition-all ${file ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-300 hover:bg-slate-50'}`}>
              <input type="file" id="file-upload" accept=".docx" onChange={handleFileChange} className="hidden" disabled={appState === AppState.TRANSLATING || appState === AppState.PARSING} />
              {!file ? (
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center group">
                  <div className="h-14 w-14 bg-slate-100 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Upload className="h-7 w-7 text-slate-400" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">Drop your .docx file here</span>
                  <span className="text-xs text-slate-500 mt-1">Maximum 50MB recommended</span>
                </label>
              ) : (
                <div className="flex flex-col items-center">
                  <div className="h-14 w-14 bg-indigo-100 rounded-full flex items-center justify-center mb-4">
                    <FileText className="h-7 w-7 text-indigo-600" />
                  </div>
                  <span className="text-sm font-bold text-slate-900">{file.name}</span>
                  <span className="text-xs text-slate-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  {appState === AppState.IDLE && (
                    <label htmlFor="file-upload" className="mt-4 text-xs font-bold text-indigo-600 hover:text-indigo-700 cursor-pointer">
                      Choose a different file
                    </label>
                  )}
                </div>
              )}
            </div>

            {appState === AppState.ERROR && (
              <div className="p-4 bg-rose-50 rounded-xl border border-rose-100 flex items-start text-rose-800 text-sm">
                <AlertCircle className="h-5 w-5 mr-3 mt-0.5 text-rose-500" /> 
                <div>
                  <p className="font-bold">Translation Interrupted</p>
                  <p className="opacity-90">{errorMsg}</p>
                </div>
              </div>
            )}

            <div className="flex justify-center">
              {appState === AppState.IDLE && file && (
                <Button onClick={startTranslation} className="w-full py-4 text-base shadow-lg shadow-indigo-200">
                  Begin Translation Process
                </Button>
              )}
              
              {(appState === AppState.PARSING || appState === AppState.TRANSLATING) && (
                 <div className="w-full space-y-4">
                   <div className="flex justify-between items-end">
                     <div className="space-y-1">
                       <span className="block text-xs font-bold text-slate-400 uppercase tracking-widest">Processing</span>
                       <span className="block text-sm font-bold text-slate-700">{progress.status}</span>
                     </div>
                     <span className="text-2xl font-black text-indigo-600">
                       {progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0}%
                     </span>
                   </div>
                   <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                     <div 
                       className="bg-indigo-600 h-full rounded-full transition-all duration-700 ease-out shadow-[0_0_10px_rgba(79,70,229,0.3)]" 
                       style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                     ></div>
                   </div>
                 </div>
              )}

              {appState === AppState.COMPLETED && (
                <div className="w-full space-y-4 animate-in zoom-in-95 duration-300">
                  <div className="flex items-center justify-center p-4 bg-emerald-50 rounded-xl text-emerald-700 font-bold border border-emerald-100">
                     <CheckCircle className="h-6 w-6 mr-3 text-emerald-500" /> Translation Complete!
                  </div>
                  <div className="flex gap-4">
                    <Button onClick={downloadFile} className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-700 shadow-lg shadow-indigo-200">
                      <Download className="h-5 w-5 mr-2" /> Download Translated DOCX
                    </Button>
                    <Button 
                      variant="outline" 
                      className="py-4 px-6 border-slate-200 text-slate-600 hover:bg-slate-50"
                      onClick={() => { setFile(null); setAppState(AppState.IDLE); setTranslatedBlob(null); }}
                    >
                      Reset
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </section>
        </main>

        <footer className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center transition-transform hover:-translate-y-1">
            <ShieldCheck className="h-6 w-6 text-indigo-500 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-slate-800">Layout Safe</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Preserves all images, headers, and complex styles.</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center transition-transform hover:-translate-y-1">
            <FileText className="h-6 w-6 text-indigo-500 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-slate-800">Large Files</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Smart chapter-based chunking for huge documents.</p>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200 text-center transition-transform hover:-translate-y-1">
            <Globe className="h-6 w-6 text-indigo-500 mx-auto mb-3" />
            <h3 className="font-bold text-sm text-slate-800">Universal API</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">Connect to Gemini, DeepSeek, or any compatible LLM.</p>
          </div>
        </footer>
      </div>
    </div>
  );
};

export default App;
