import React from 'react';
import {
  ThemeConfig,
  THEME_PRESETS,
  DEFAULT_THEME_CONFIG,
  normalizeHex
} from '../utils/themeSettings';
import { Palette, Check, RotateCcw, X } from 'lucide-react';

interface ThemeSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  theme: ThemeConfig;
  onChangeTheme: (nextTheme: ThemeConfig) => void;
  onResetTheme: () => void;
}

const QUICK_SWATCHES = [
  '#4f46e5',
  '#d946ef',
  '#06b6d4',
  '#2563eb',
  '#059669',
  '#0d9488',
  '#ea580c',
  '#e11d48',
  '#7c3aed',
  '#334155'
];

export const ThemeSettingsModal: React.FC<ThemeSettingsModalProps> = ({
  isOpen,
  onClose,
  theme,
  onChangeTheme,
  onResetTheme
}) => {
  if (!isOpen) return null;

  const handleSelectPreset = (presetId: ThemeConfig['presetId']) => {
    const found = THEME_PRESETS.find((p) => p.id === presetId);
    if (!found) return;
    onChangeTheme({
      presetId: found.id,
      primary: found.primary,
      secondary: found.secondary,
      highlight: found.highlight
    });
  };

  const handleColorField = (field: 'primary' | 'secondary' | 'highlight', value: string) => {
    onChangeTheme({
      ...theme,
      presetId: 'custom',
      [field]: value
    });
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 z-[170] flex items-end sm:items-center justify-center p-0 sm:p-4 backdrop-blur-sm">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden max-h-[92dvh] flex flex-col pb-safe">
        <div className="h-1.5 w-full theme-accent-line shrink-0" />

        {/* Modal Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl theme-btn-primary shadow-sm">
              <Palette className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900">
                Pengaturan Tema & Warna Utama
              </h3>
              <p className="text-xs text-slate-500">
                Sesuaikan warna utama & gradasi aplikasi (tersimpan otomatis)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup pengaturan tema"
            className="min-w-[40px] min-h-[40px] rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Live Preview Banner */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="h-1 w-full theme-accent-line" />
            <div className="theme-header-bg px-4 py-3 text-white flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/75 block">
                  Pratinjau Langsung
                </span>
                <span className="text-xs font-bold">Monitoring Engineering & KPI</span>
              </div>
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold theme-btn-primary shadow-sm">
                Tombol Utama
              </span>
            </div>
          </div>

          {/* Curated Presets */}
          <div className="space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Pilih Palet Tema Siap Pakai
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {THEME_PRESETS.map((preset) => {
                const isSelected = theme.presetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleSelectPreset(preset.id)}
                    className={`min-h-[56px] p-3 rounded-xl border text-left transition flex items-center justify-between gap-2.5 ${
                      isSelected
                        ? 'border-slate-900 bg-slate-50 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-8 h-8 rounded-lg shrink-0 border border-black/10 shadow-sm"
                        style={{
                          background: `linear-gradient(135deg, ${preset.primary}, ${preset.secondary})`
                        }}
                      />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-slate-900 block truncate">
                          {preset.name}
                        </span>
                        <span className="text-[10px] text-slate-500 block truncate">
                          {preset.description}
                        </span>
                      </div>
                    </div>
                    {isSelected && <Check className="w-4 h-4 text-slate-900 shrink-0" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Color Pickers */}
          <div className="space-y-3 pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                Kustomisasi Warna Spesifik
              </label>
              {theme.presetId === 'custom' && (
                <span className="text-[11px] font-semibold text-slate-600">Mode Kustom Aktif</span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Primary Color */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Warna Utama
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pilih warna utama"
                    value={normalizeHex(theme.primary, DEFAULT_THEME_CONFIG.primary)}
                    onChange={(e) => handleColorField('primary', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={theme.primary}
                    onChange={(e) => handleColorField('primary', e.target.value)}
                    onBlur={(e) =>
                      handleColorField('primary', normalizeHex(e.target.value, DEFAULT_THEME_CONFIG.primary))
                    }
                    className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-base sm:text-xs font-mono text-slate-900 uppercase"
                  />
                </div>
              </div>

              {/* Secondary Gradient Color */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Warna Gradasi
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pilih warna gradasi"
                    value={normalizeHex(theme.secondary, DEFAULT_THEME_CONFIG.secondary)}
                    onChange={(e) => handleColorField('secondary', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={theme.secondary}
                    onChange={(e) => handleColorField('secondary', e.target.value)}
                    onBlur={(e) =>
                      handleColorField('secondary', normalizeHex(e.target.value, DEFAULT_THEME_CONFIG.secondary))
                    }
                    className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-base sm:text-xs font-mono text-slate-900 uppercase"
                  />
                </div>
              </div>

              {/* Highlight Color */}
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <label className="block text-[11px] font-semibold text-slate-700">
                  Warna Sorotan
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    aria-label="Pilih warna sorotan"
                    value={normalizeHex(theme.highlight, DEFAULT_THEME_CONFIG.highlight)}
                    onChange={(e) => handleColorField('highlight', e.target.value)}
                    className="w-10 h-10 rounded-lg border border-slate-300 cursor-pointer bg-white p-0.5 shrink-0"
                  />
                  <input
                    type="text"
                    value={theme.highlight}
                    onChange={(e) => handleColorField('highlight', e.target.value)}
                    onBlur={(e) =>
                      handleColorField('highlight', normalizeHex(e.target.value, DEFAULT_THEME_CONFIG.highlight))
                    }
                    className="w-full min-h-[40px] px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-base sm:text-xs font-mono text-slate-900 uppercase"
                  />
                </div>
              </div>
            </div>

            {/* Quick Swatches for Primary */}
            <div className="space-y-1.5">
              <span className="text-[11px] font-medium text-slate-500 block">
                Pilih Cepat Warna Utama:
              </span>
              <div className="flex flex-wrap gap-2">
                {QUICK_SWATCHES.map((hex) => (
                  <button
                    key={hex}
                    type="button"
                    aria-label={`Set warna utama ${hex}`}
                    onClick={() => handleColorField('primary', hex)}
                    className={`w-8 h-8 rounded-lg border transition active:scale-95 ${
                      normalizeHex(theme.primary) === hex
                        ? 'ring-2 ring-offset-2 ring-slate-900 border-white'
                        : 'border-black/15 hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-100 bg-slate-50 flex flex-col-reverse sm:flex-row justify-between items-stretch sm:items-center gap-2">
          <button
            type="button"
            onClick={onResetTheme}
            className="min-h-[44px] sm:min-h-[38px] px-4 py-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Default</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] sm:min-h-[38px] px-5 py-2 rounded-xl theme-btn-primary text-xs font-bold shadow-sm flex items-center justify-center gap-1.5 transition"
          >
            <Check className="w-4 h-4" />
            <span>Simpan & Terapkan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
