/**
 * EnchantedBookModal — Modal that shows detailed enchantment info
 * when clicking an enchanted book name in the crafting tree or Book Guide.
 *
 * Displays: enchantment name + level, books needed, best strategy tip,
 * anvil combining steps, and "where to hunt" sources grid.
 * Fetches data from the server endpoint (minecraft-data powered).
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles, BookOpen, Loader2, ArrowRight, Info,
} from 'lucide-react';
import { fetchEnchantmentData, type EnchantmentDetail } from '@/lib/api';
import { toRoman, booksNeededForLevel, getAnvilSteps, getBestStrategy, getEnchantmentInfo } from '@/lib/enchantmentBooks';

// ── Props ────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  /** Enchantment key name, e.g. "sharpness" */
  enchantmentName: string | null;
  /** Target level the user needs */
  targetLevel: number;
  /** Display name of the item this book is for, e.g. "Diamond Sword" */
  forItemName?: string;
}

export default function EnchantedBookModal({
  open, onClose, enchantmentName, targetLevel, forItemName,
}: Props) {
  const [data, setData] = useState<EnchantmentDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enchantmentName || !open) {
      setData(null);
      return;
    }
    setLoading(true);
    fetchEnchantmentData(enchantmentName).then(d => {
      setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [enchantmentName, open]);

  if (!open || !enchantmentName) return null;

  // Use server data when available, fall back to client-side helpers
  const displayName = data?.displayName
    || enchantmentName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const booksNeeded = booksNeededForLevel(targetLevel);

  // Get anvil steps for this specific target level from server data, or fall back to client
  const serverAnvilEntry = data?.anvilSteps?.find(a => a.targetLevel === targetLevel);
  const anvilSteps = serverAnvilEntry
    ? serverAnvilEntry.steps
    : getAnvilSteps(targetLevel);

  const strategy = data?.bestStrategy || getBestStrategy(enchantmentName, targetLevel);

  // Sources: prefer server data, fall back to client-side enchantment data which has rich descriptions
  const clientInfo = getEnchantmentInfo(enchantmentName);
  const sources = data?.sources?.length
    ? data.sources
    : (clientInfo?.sources || []).map(s => ({ method: s.method, description: s.description, icon: s.icon, maxLevel: s.maxLevel }));

  const maxLevel = data?.maxLevel ?? targetLevel;
  const isTreasure = data?.treasureOnly ?? false;
  const isCurse = data?.curse ?? false;
  const category = data?.category ?? '';
  const excludes = data?.exclude ?? [];

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto glass-strong border-white/10 p-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
          </div>
        ) : (
          <>
            {/* ── Header ──────────────────────────────────── */}
            <DialogHeader className="p-6 pb-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-2xl flex-shrink-0">
                  📕
                </div>
                <div className="min-w-0">
                  <DialogTitle className="text-xl font-bold flex items-center gap-2 flex-wrap">
                    Enchanted Book ({displayName} {toRoman(targetLevel)})
                    {isTreasure && (
                      <span className="text-[10px] bg-yellow-500/15 text-yellow-400 border border-yellow-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        Treasure
                      </span>
                    )}
                    {isCurse && (
                      <span className="text-[10px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-medium">
                        Curse
                      </span>
                    )}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    {booksNeeded} level-1 book{booksNeeded !== 1 ? 's' : ''} needed
                    {forItemName && <span className="text-purple-400"> · for {forItemName}</span>}
                  </p>
                  {category && (
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5 capitalize">
                      Category: {category.replace(/_/g, ' ')} · Max level {toRoman(maxLevel)}
                    </p>
                  )}
                </div>
              </div>
            </DialogHeader>

            {/* ── Best Strategy Tip ───────────────────────── */}
            <div className="px-6 pb-2">
              <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 flex gap-3">
                <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-amber-200/80 leading-relaxed font-medium">{strategy}</p>
              </div>
            </div>

            {/* ── Enchantment Levels Table ─────────────────── */}
            {data?.levels && data.levels.length > 1 && (
              <div className="px-6 pb-2 pt-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Level Requirements
                </p>
                <div className="grid grid-cols-5 gap-1.5">
                  {data.levels.map(lv => (
                    <div
                      key={lv.level}
                      className={`text-center py-2 px-1 rounded-lg border text-xs ${
                        lv.level === targetLevel
                          ? 'bg-purple-500/15 border-purple-500/30 text-purple-300 font-bold'
                          : 'bg-white/[0.02] border-white/5 text-muted-foreground'
                      }`}
                    >
                      <p className="font-bold">{toRoman(lv.level)}</p>
                      <p className="text-[9px] mt-0.5">{lv.booksNeeded} book{lv.booksNeeded !== 1 ? 's' : ''}</p>
                      <p className="text-[8px] text-muted-foreground/60 mt-0.5">
                        XP {lv.minXp}+
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Anvil Combining Progress ────────────────── */}
            {anvilSteps.length > 0 && targetLevel > 1 && (
              <div className="px-6 pb-2 pt-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Anvil Combining Progress · {booksNeeded} books → 1 final
                </p>
                <div className="space-y-1.5">
                  {anvilSteps.map((step) => (
                    <div key={step.step} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-white/5">
                      <span className="text-muted-foreground font-mono text-[10px] w-5 flex-shrink-0">
                        #{step.step}
                      </span>
                      <span className="flex-1 font-medium text-xs">
                        {step.count}× [{toRoman(step.inputLevel)} + {toRoman(step.inputLevel)}]
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      <span className="text-purple-400 font-bold text-xs">
                        {step.count}× {toRoman(step.outputLevel)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Where to Hunt (Sources) ─────────────────── */}
            {sources.length > 0 && (
              <div className="px-6 pb-4 pt-2">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">
                  Where to Hunt
                </p>
                <div className="grid sm:grid-cols-2 gap-2">
                  {sources.map((src, i) => (
                    <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-white/5">
                      <span className="text-lg flex-shrink-0">{src.icon}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">{src.method}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{src.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Conflicts / Excludes ────────────────────── */}
            {excludes.length > 0 && (
              <div className="px-6 pb-6 pt-2">
                <div className="p-3 rounded-xl bg-red-400/5 border border-red-400/15 flex gap-3">
                  <Info className="w-3.5 h-3.5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-bold text-red-300 uppercase tracking-wider mb-1">Conflicts With</p>
                    <p className="text-[11px] text-red-200/70 leading-relaxed">
                      {excludes.map(e => e.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())).join(', ')}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Bottom padding when no excludes */}
            {excludes.length === 0 && <div className="pb-4" />}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
