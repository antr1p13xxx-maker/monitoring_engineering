import React, { useState } from 'react';
import { CODE_GS_CONTENT, INDEX_HTML_CONTENT, DEPLOYMENT_STEPS } from '../data/appsScriptTemplates';
import { 
  FileCode2, 
  Copy, 
  Check, 
  Download, 
  ExternalLink, 
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  ChevronRight,
  Code2,
  Terminal,
  FolderArchive
} from 'lucide-react';

export const AppsScriptCodeView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'codegs' | 'indexhtml' | 'guide'>('codegs');
  const [copiedGs, setCopiedGs] = useState(false);
  const [copiedHtml, setCopiedHtml] = useState(false);

  const handleCopyGs = () => {
    navigator.clipboard.writeText(CODE_GS_CONTENT);
    setCopiedGs(true);
    setTimeout(() => setCopiedGs(false), 2000);
  };

  const handleCopyHtml = () => {
    navigator.clipboard.writeText(INDEX_HTML_CONTENT);
    setCopiedHtml(true);
    setTimeout(() => setCopiedHtml(false), 2000);
  };

  const downloadFile = (filename: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadGs = () => {
    downloadFile('Code.gs', CODE_GS_CONTENT, 'application/javascript');
  };

  const handleDownloadHtml = () => {
    downloadFile('Index.html', INDEX_HTML_CONTENT, 'text/html');
  };

  const handleDownloadAll = () => {
    handleDownloadGs();
    setTimeout(handleDownloadHtml, 300);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-6 rounded-2xl shadow-md border border-indigo-800/40 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-400 text-slate-950 uppercase tracking-wider">
              Google Apps Script Ready
            </span>
            <span className="text-xs text-indigo-300 font-medium">Versi Lengkap Standalone WebApp</span>
          </div>
          <h2 className="text-xl font-extrabold text-white mt-1">
            Source Code Code.gs & Index.html
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl mt-1">
            File Google Apps Script backend (<code className="text-amber-300 font-mono">Code.gs</code>) dan frontend UI (<code className="text-cyan-300 font-mono">Index.html</code>) yang dapat langsung di-deploy di Spreadsheet perusahaan Anda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleDownloadAll}
            className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/30 flex items-center space-x-2 transition"
          >
            <FolderArchive className="w-4 h-4" />
            <span>Download Semua File (Code.gs & Index.html)</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="flex border-b border-slate-200 bg-slate-50/80 px-4 pt-3 gap-2">
          <button
            onClick={() => setActiveTab('codegs')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 border-t border-l border-r transition ${
              activeTab === 'codegs'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <Code2 className="w-4 h-4 text-amber-500" />
            <span>Code.gs (Apps Script Backend)</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">.gs</span>
          </button>

          <button
            onClick={() => setActiveTab('indexhtml')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 border-t border-l border-r transition ${
              activeTab === 'indexhtml'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <FileCode2 className="w-4 h-4 text-cyan-500" />
            <span>Index.html (Frontend UI)</span>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded">.html</span>
          </button>

          <button
            onClick={() => setActiveTab('guide')}
            className={`px-4 py-2.5 rounded-t-xl text-xs font-bold flex items-center space-x-2 border-t border-l border-r transition ${
              activeTab === 'guide'
                ? 'bg-white text-indigo-700 border-slate-200 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 border-transparent hover:bg-slate-100'
            }`}
          >
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Panduan Deploy Spreadsheet</span>
          </button>
        </div>

        {/* Tab 1: Code.gs Content */}
        {activeTab === 'codegs' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Google Apps Script Server Code (Code.gs)
                </h3>
                <p className="text-xs text-slate-500">
                  Mengatur CRUD database Spreadsheet, kalkulasi KPI otomatis, upload file CAD ke Google Drive, dan pengiriman email MailApp.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyGs}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow transition"
                >
                  {copiedGs ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedGs ? 'Tersalin ke Clipboard!' : 'Salin Code.gs'}</span>
                </button>
                <button
                  onClick={handleDownloadGs}
                  className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Code.gs</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 text-slate-200 p-5 rounded-xl font-mono text-xs overflow-x-auto max-h-[550px] leading-relaxed border border-slate-800 select-all scrollbar-thin">
                <code>{CODE_GS_CONTENT}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 2: Index.html Content */}
        {activeTab === 'indexhtml' && (
          <div className="p-5 space-y-4">
            <div className="flex flex-wrap justify-between items-center gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-800">
                  Google Apps Script Client Template (Index.html)
                </h3>
                <p className="text-xs text-slate-500">
                  File HTML lengkap dengan Tailwind CSS, Chart.js, SweetAlert2, 3D Three.js CAD viewer, dan matriks resmi KPI CDR.
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleCopyHtml}
                  className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow transition"
                >
                  {copiedHtml ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedHtml ? 'Tersalin ke Clipboard!' : 'Salin Index.html'}</span>
                </button>
                <button
                  onClick={handleDownloadHtml}
                  className="px-3.5 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl text-xs flex items-center space-x-1.5 shadow transition"
                >
                  <Download className="w-4 h-4" />
                  <span>Download Index.html</span>
                </button>
              </div>
            </div>

            <div className="relative">
              <pre className="bg-slate-950 text-slate-200 p-5 rounded-xl font-mono text-xs overflow-x-auto max-h-[550px] leading-relaxed border border-slate-800 select-all scrollbar-thin">
                <code>{INDEX_HTML_CONTENT}</code>
              </pre>
            </div>
          </div>
        )}

        {/* Tab 3: Step-by-Step Deployment Guide */}
        {activeTab === 'guide' && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Langkah Cepat Deploy ke Google Sheets & Google Apps Script
              </h3>
              <p className="text-xs text-slate-500">
                Ikuti 6 langkah mudah berikut untuk menjalankan sistem ini pada akun Google Workspace perusahaan Anda:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {DEPLOYMENT_STEPS.map((s) => (
                <div key={s.step} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2 flex items-start space-x-3">
                  <div className="w-7 h-7 rounded-xl bg-indigo-600 text-white font-bold text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                    {s.step}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-800">{s.title}</h4>
                    <p className="text-[11px] text-slate-600 leading-relaxed mt-1">{s.description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start space-x-3 text-emerald-900 text-xs">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
              <div>
                <h5 className="font-bold">Keamanan & Hak Akses (Role PINs)</h5>
                <p className="text-[11px] text-emerald-800 mt-1">
                  Sistem ini telah dilengkapi PIN otentikasi role bawaan:
                  Master: <strong className="font-mono">ENG2026</strong> • 
                  Manager: <strong className="font-mono">Eng159</strong> • 
                  Supervisor: <strong className="font-mono">Eng567</strong> • 
                  Lead Engineer: <strong className="font-mono">Eng123</strong> • 
                  Drafter: <strong className="font-mono">Eng345</strong>.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
