import React, { useState, useRef, useEffect } from 'react';
import { DocxHandler } from './services/docxHandler';
import { AppState } from './types';
import { Button } from './components/Button';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, Download, Globe } from 'lucide-react';

const App: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [progress, setProgress] = useState({ completed: 0, total: 0, status: '' });
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [translatedBlob, setTranslatedBlob] = useState<Blob | null>(null);
  
  // Use a ref for the handler to persist across renders
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
      setProgress({ completed: 0, total: 0, status: 'Analyzing document structure...' });
      
      await docxHandler.current.load(file);
      const total = docxHandler.current.getTotalParagraphs();
      
      setAppState(AppState.TRANSLATING);
      
      const blob = await docxHandler.current.processAndTranslate((completed, total, status) => {
        setProgress({ completed, total, status });
      });

      setTranslatedBlob(blob);
      setAppState(AppState.COMPLETED);
    } catch (err: any) {
      console.error(err);
      setAppState(AppState.ERROR);
      setErrorMsg(err.message || "An unexpected error occurred during processing.");
    }
  };

  const downloadFile = () => {
    if (translatedBlob && file) {
      // Native download handling to avoid module dependency issues
      const url = window.URL.createObjectURL(translatedBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `translated_${file.name}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl w-full space-y-8">
        
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto h-16 w-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
            <Globe className="h-8 w-8 text-blue-600" />
          </div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">
            DocxTranslator AI
          </h2>
          <p className="mt-2 text-lg text-gray-600">
            Intelligent chapter-based translation for large documents. Converts Chinese to English while preserving original English content and layout.
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 border border-gray-100">
          
          {/* File Upload Section */}
          <div className={`border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center transition-colors ${file ? 'border-blue-300 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}>
            <input
              type="file"
              id="file-upload"
              accept=".docx"
              onChange={handleFileChange}
              className="hidden"
              disabled={appState === AppState.TRANSLATING || appState === AppState.PARSING}
            />
            
            {!file ? (
              <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                <Upload className="h-12 w-12 text-gray-400 mb-3" />
                <span className="text-sm font-medium text-gray-900">Upload a .docx file</span>
                <span className="text-xs text-gray-500 mt-1">Drag and drop or click to browse</span>
              </label>
            ) : (
              <div className="flex flex-col items-center">
                <FileText className="h-12 w-12 text-blue-500 mb-3" />
                <span className="text-sm font-medium text-gray-900">{file.name}</span>
                <span className="text-xs text-gray-500 mt-1">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                {appState === AppState.IDLE && (
                   <label htmlFor="file-upload" className="mt-2 text-xs text-blue-600 hover:text-blue-500 cursor-pointer">
                     Change file
                   </label>
                )}
              </div>
            )}
          </div>

          {/* Error Message */}
          {appState === AppState.ERROR && (
            <div className="mt-4 p-4 bg-red-50 rounded-md flex items-start">
              <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
              <p className="text-sm text-red-700">{errorMsg}</p>
            </div>
          )}

          {/* Actions Area */}
          <div className="mt-6 flex justify-center">
            {appState === AppState.IDLE && file && (
              <Button onClick={startTranslation} className="w-full sm:w-auto min-w-[200px]">
                Start Translation
              </Button>
            )}

            {(appState === AppState.PARSING || appState === AppState.TRANSLATING) && (
               <div className="w-full">
                 <div className="flex justify-between items-center mb-2">
                   <span className="text-sm font-medium text-gray-700">{progress.status}</span>
                   <span className="text-sm text-gray-500">
                     {progress.total > 0 ? `${Math.round((progress.completed / progress.total) * 100)}%` : '0%'}
                   </span>
                 </div>
                 <div className="w-full bg-gray-200 rounded-full h-2.5">
                   <div 
                     className="bg-blue-600 h-2.5 rounded-full transition-all duration-500" 
                     style={{ width: `${progress.total > 0 ? (progress.completed / progress.total) * 100 : 0}%` }}
                   ></div>
                 </div>
                 <p className="text-xs text-gray-400 mt-2 text-center">This may take a few minutes depending on file size.</p>
               </div>
            )}

            {appState === AppState.COMPLETED && (
              <div className="text-center w-full">
                <div className="mb-4 flex flex-col items-center text-green-600">
                   <CheckCircle className="h-10 w-10 mb-2" />
                   <span className="font-medium">Translation Complete!</span>
                </div>
                <div className="flex gap-4 justify-center">
                  <Button onClick={downloadFile} className="flex items-center gap-2">
                    <Download className="h-4 w-4" /> Download Translated File
                  </Button>
                  <Button variant="outline" onClick={() => { setFile(null); setAppState(AppState.IDLE); }}>
                    Translate Another
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="text-blue-500 mb-2 flex justify-center"><FileText className="h-6 w-6" /></div>
            <h3 className="font-semibold text-gray-900 text-sm">Structure Preserved</h3>
            <p className="text-xs text-gray-500 mt-1">Keeps headers, bullets, and tables intact.</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="text-blue-500 mb-2 flex justify-center"><RefreshCw className="h-6 w-6" /></div>
            <h3 className="font-semibold text-gray-900 text-sm">Smart Sectioning</h3>
            <p className="text-xs text-gray-500 mt-1">Splits by chapters and headings for better context.</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 text-center">
            <div className="text-blue-500 mb-2 flex justify-center"><CheckCircle className="h-6 w-6" /></div>
            <h3 className="font-semibold text-gray-900 text-sm">Gemini Powered</h3>
            <p className="text-xs text-gray-500 mt-1">High-quality context-aware translation.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default App;