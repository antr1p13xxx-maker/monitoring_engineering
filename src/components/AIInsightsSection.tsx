import React, { useState } from 'react';
import { UserRole } from '../types/engineering';
import { 
  Sparkles, 
  RotateCw, 
  AlertTriangle, 
  CheckCircle2, 
  Lock, 
  Lightbulb, 
  ShieldAlert, 
  ListChecks, 
  Copy, 
  FileText,
  TrendingUp,
  Cpu
} from 'lucide-react';

interface AIInsightData {
  executiveSummary: string;
  keyFindings: string[];
  strategicRecommendations: string[];
  riskAssessment: string;
  actionPlan: string[];
}

interface AIInsightsSectionProps {
  userRole: UserRole;
  contextType: 'monitoring' | 'kpi';
  period: string;
  dataSummary: Record<string, any>;
}

export const AIInsightsSection: React.FC<AIInsightsSectionProps> = ({
  userRole,
  contextType,
  period,
  dataSummary
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [insight, setInsight] = useState<AIInsightData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  const isManager = userRole === 'Manager';
  const canAccessAI = isManager || (userRole === 'Supervisor' && contextType === 'kpi');

  const fetchAIInsights = async () => {
    if (!canAccessAI) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/ai-insights', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contextType,
          period,
          dataSummary,
          role: userRole,
        }),
      });

      const rawText = await response.text();
      let parsedBody: any = {};
      try {
        parsedBody = rawText ? JSON.parse(rawText) : {};
      } catch {
        parsedBody = {};
      }

      if (!response.ok) {
        throw new Error(parsedBody.error || `Server error (${response.status})`);
      }

      const data: AIInsightData = parsedBody;
      setInsight(data);
      const now = new Date();
      setLastGeneratedAt(now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } catch (err: any) {
      console.error('Failed to fetch AI insights:', err);
      setError(err.message || 'Gagal menghasilkan AI insight.');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyText = () => {
    if (!insight) return;
    const textToCopy = `=== AI INSIGHT & REKOMENDASI ENGINEERING (${contextType.toUpperCase()}) ===
Periode: ${period}
Waktu Analisis: ${lastGeneratedAt || '-'}

[RINGKASAN EKSEKUTIF]
${insight.executiveSummary}

[TEMUAN KUNCI]
${insight.keyFindings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

[REKOMENDASI STRATEGIS MANAGER]
${insight.strategicRecommendations.map((r, i) => `${i + 1}. ${r}`).join('\n')}

[EVALUASI RISIKO & HAMBATAN]
${insight.riskAssessment}

[ACTION PLAN (7-14 HARI)]
${insight.actionPlan.map((a, i) => `[ ] ${a}`).join('\n')}
`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  // If user is not authorized, show compact locked notification
  if (!canAccessAI) {
    return (
      <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex items-center justify-between text-slate-500 shadow-sm">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-200/80 text-slate-600 rounded-xl">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-slate-700">
              AI Insight & Rekomendasi Manajerial (Terkunci)
            </p>
            <p className="text-[11px] text-slate-500">
              Analisis cerdas, prediksi bottleneck & rekomendasi aksi strategis hanya dapat diakses oleh <strong className="text-slate-700">Engineering Manager</strong>{contextType === 'kpi' ? ' atau Supervisor' : ''}.
            </p>
          </div>
        </div>
        <span className="text-[10px] font-semibold bg-slate-200 text-slate-700 px-2.5 py-1 rounded-full">
          {contextType === 'kpi' ? 'Manager / Supervisor' : 'Khusus Manager'}
        </span>
      </div>
    );
  }

  return (
    <div
      className="text-white rounded-2xl p-4 sm:p-5 shadow-xl border border-indigo-400/30 space-y-4 relative overflow-hidden"
      style={{
        backgroundColor: '#0d1333',
        backgroundImage:
          'radial-gradient(at 0% 0%, rgba(56, 189, 248, 0.22) 0px, transparent 45%), radial-gradient(at 100% 0%, rgba(168, 85, 247, 0.24) 0px, transparent 45%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.16) 0px, transparent 50%)',
      }}
    >
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-indigo-400/20">
        <div className="flex items-start space-x-3">
          <div className="p-2.5 bg-gradient-to-tr from-cyan-500 via-indigo-500 to-fuchsia-500 rounded-xl text-white shadow-lg shadow-indigo-500/30 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm sm:text-base font-extrabold bg-gradient-to-r from-white via-cyan-100 to-indigo-200 bg-clip-text text-transparent tracking-wide">
                AI Insight & Rekomendasi Strategis Engineering
              </h3>
              <span className="bg-cyan-500/20 text-cyan-200 border border-cyan-400/30 text-[10px] font-bold px-2 py-0.5 rounded-md flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-cyan-300" />
                <span>Gemini 4 Flash</span>
              </span>
            </div>
            <p className="text-[11px] text-indigo-100/80 mt-0.5">
              Analisis cerdas real-time terhadap performa {contextType === 'monitoring' ? 'monitoring drawing' : 'capaian KPI'} pada periode <span className="text-amber-300 font-semibold">{period}</span>.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto sm:justify-end">
          {insight && (
            <button
              onClick={handleCopyText}
              className="min-h-[42px] sm:min-h-0 px-3.5 py-2 sm:py-1.5 text-xs font-semibold rounded-xl bg-white/10 hover:bg-white/15 text-slate-100 border border-white/15 flex items-center justify-center space-x-1.5 transition cursor-pointer"
              title="Salin ringkasan ke clipboard"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copied ? 'Tersalin!' : 'Salin Laporan'}</span>
            </button>
          )}

          <button
            onClick={fetchAIInsights}
            disabled={loading}
            className="min-h-[44px] sm:min-h-0 px-4 py-2 sm:py-1.5 text-xs font-bold rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 hover:from-emerald-400 hover:via-teal-400 hover:to-cyan-400 text-white shadow-md shadow-emerald-900/30 flex items-center justify-center space-x-1.5 transition disabled:opacity-60 cursor-pointer"
          >
            <RotateCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{loading ? 'Menganalisis...' : insight ? 'Perbarui Analisis' : 'Generate AI Insight'}</span>
          </button>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-3 bg-rose-950/60 border border-rose-800/80 rounded-xl text-xs text-rose-200 flex items-center space-x-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* If Insight is not generated yet */}
      {!insight && !loading && !error && (
        <div className="p-6 bg-slate-900/60 rounded-xl border border-indigo-900/40 text-center space-y-3">
          <div className="inline-flex p-3 rounded-full bg-indigo-950/70 text-indigo-400 border border-indigo-800/50 mb-1">
            <Lightbulb className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-bold text-white">Analisis Cerdas Manajerial Siap Digenerate</h4>
          <p className="text-xs text-slate-300 max-w-xl mx-auto">
            Klik tombol <strong className="text-emerald-400">"Generate AI Insight"</strong> di atas untuk memperoleh ringkasan eksekutif, temuan data kunci, evaluasi risiko keterlambatan/bottleneck, dan langkah aksi konkret untuk Engineering Manager pada periode {period}.
          </p>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && (
        <div className="p-6 bg-slate-900/60 rounded-xl border border-indigo-900/40 space-y-4 animate-pulse">
          <div className="h-4 bg-slate-800 rounded w-1/3"></div>
          <div className="h-3 bg-slate-800 rounded w-full"></div>
          <div className="h-3 bg-slate-800 rounded w-5/6"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-3">
            <div className="h-20 bg-slate-800 rounded-lg"></div>
            <div className="h-20 bg-slate-800 rounded-lg"></div>
          </div>
        </div>
      )}

      {/* Insight Content */}
      {insight && !loading && (
        <div className="space-y-4">
          {/* Executive Summary Card */}
          <div className="p-4 bg-slate-950/55 rounded-xl border border-cyan-400/30 shadow-inner">
            <div className="flex items-center space-x-2 mb-2">
              <h4 className="text-xs font-bold text-cyan-300 uppercase tracking-wider">
                Ringkasan Eksekutif (Executive Summary)
              </h4>
              {lastGeneratedAt && (
                <span className="text-[10px] text-slate-300 ml-auto font-mono tabular-nums">
                  Diperbarui pukul {lastGeneratedAt} WIB
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm text-slate-100 leading-relaxed font-sans">
              {insight.executiveSummary}
            </p>
          </div>

          {/* Grid: Key Findings & Strategic Recommendations */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Key Findings */}
            <div className="p-4 bg-indigo-950/45 rounded-xl border border-indigo-400/25 space-y-2">
              <div className="flex items-center space-x-2 text-cyan-300 font-bold text-xs pb-1.5 border-b border-indigo-400/20">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span>Temuan Kunci Berbasis Data (Key Findings)</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                {insight.keyFindings.map((finding, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="text-cyan-400 font-bold shrink-0">{idx + 1}.</span>
                    <span className="leading-relaxed">{finding}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Strategic Recommendations */}
            <div className="p-4 bg-emerald-950/40 rounded-xl border border-emerald-400/25 space-y-2">
              <div className="flex items-center space-x-2 text-emerald-300 font-bold text-xs pb-1.5 border-b border-emerald-400/20">
                <Lightbulb className="w-4 h-4 text-emerald-400" />
                <span>Rekomendasi Strategis Manager</span>
              </div>
              <ul className="space-y-2 text-xs text-slate-200">
                {insight.strategicRecommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span className="leading-relaxed">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Grid: Risk Assessment & Action Plan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Risk Assessment */}
            <div className="p-4 bg-amber-950/35 rounded-xl border border-amber-400/25 space-y-2">
              <div className="flex items-center space-x-2 text-amber-300 font-bold text-xs pb-1.5 border-b border-amber-400/20">
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Evaluasi Risiko & Potensi Hambatan</span>
              </div>
              <p className="text-xs text-slate-200 leading-relaxed">
                {insight.riskAssessment}
              </p>
            </div>

            {/* Action Plan */}
            <div className="p-4 bg-fuchsia-950/35 rounded-xl border border-fuchsia-400/25 space-y-2">
              <div className="flex items-center space-x-2 text-fuchsia-300 font-bold text-xs pb-1.5 border-b border-fuchsia-400/20">
                <ListChecks className="w-4 h-4 text-fuchsia-400" />
                <span>Action Plan Cepat (Target 7 - 14 Hari)</span>
              </div>
              <ul className="space-y-1.5 text-xs text-slate-200">
                {insight.actionPlan.map((act, idx) => (
                  <li key={idx} className="flex items-start space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-fuchsia-400 mt-1.5 shrink-0"></span>
                    <span className="leading-relaxed">{act}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
