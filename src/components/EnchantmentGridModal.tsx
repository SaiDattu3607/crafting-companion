/**
 * EnchantmentGridModal — Shows all applicable enchantments for an item
 * as a 5-column matrix (levels I–V), with color-coded cells.
 * For potions, shows the variant/effects grid instead.
 */

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Sparkles, BookOpen, Loader2, FlaskConical, Clock, ArrowLeft,
  ChevronDown, ChevronUp,
} from 'lucide-react';
import {
  getEnchantmentInfo, toRoman, booksNeededForLevel,
  getAnvilSteps, getBestStrategy,
} from '@/lib/enchantmentBooks';
import { fetchItemDetail, lookupMinecraftItem, type MinecraftItem, type ItemDetail } from '@/lib/api';
import { getMinecraftAssetUrl } from '@/lib/minecraftAssets';
import EnchantmentMatrix from './EnchantmentMatrix';

function itemImageUrl(name: string) {
  return getMinecraftAssetUrl(name);
}

// ── Props ────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  itemName: string | null;
  activeEnchantments?: { name: string; level: number }[];
}

export default function EnchantmentGridModal({
  open, onClose, itemName, activeEnchantments = [],
}: Props) {
  const [item, setItem] = useState<MinecraftItem | null>(null);
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedEnchant, setSelectedEnchant] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!itemName || !open) {
      setItem(null);
      setDetail(null);
      setSelectedEnchant(null);
      setImgError(false);
      return;
    }
    setLoading(true);
    Promise.all([
      lookupMinecraftItem(itemName).catch(() => null),
      fetchItemDetail(itemName).catch(() => null),
    ]).then(([itemData, detailData]) => {
      setItem(itemData);
      setDetail(detailData);
      setLoading(false);
    });
  }, [itemName, open]);

  const enchantments = useMemo(() => {
    const possible = item?.possibleEnchantments || detail?.possibleEnchantments || [];
    return possible.map(e => {
      const info = getEnchantmentInfo(e.name);
      const activeLevel = activeEnchantments.find(a => a.name === e.name)?.level ?? null;
      return {
        name: e.name,
        displayName: info?.displayName || e.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
        maxLevel: e.level || info?.maxLevel || 1,
        levelRequirements: e.levelRequirements || [],
        sources: info?.sources || [],
        maxTableLevel: info?.maxTableLevel ?? (e.level || 1),
        activeLevel,
        isActive: activeLevel !== null,
      };
    });
  }, [item, detail, activeEnchantments]);

  const variants = useMemo(() => {
    return item?.possibleVariants || detail?.possibleVariants || [];
  }, [item, detail]);

  // Determine the max level across all enchantments for column count (capped at 5)
  const maxCol = useMemo(() => {
    if (enchantments.length === 0) return 5;
    return Math.max(...enchantments.map(e => e.maxLevel), 1);
  }, [enchantments]);

  const isPotion = variants.length > 0 && enchantments.length === 0;
  const hasEnchantments = enchantments.length > 0;

  // Selected enchantment detail
  const selectedInfo = useMemo(() => {
    if (!selectedEnchant) return null;
    return enchantments.find(e => e.name === selectedEnchant) || null;
  }, [selectedEnchant, enchantments]);

  if (!open || !itemName) return null;

  const displayName = detail?.displayName || item?.displayName || itemName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] overflow-y-auto border-white/10 bg-background/95 backdrop-blur-xl p-0">
        {/* Header */}
        <DialogHeader className="p-6 pb-4">
          <div className="flex items-center gap-4">
            {!imgError ? (
              <img
                src={itemImageUrl(itemName)}
                alt={displayName}
                className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 p-1 object-contain"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-12 h-12 rounded-xl border border-white/10 bg-white/5 flex items-center justify-center text-xl">
                {isPotion ? '🧪' : '⚔️'}
              </div>
            )}
            <div>
              <DialogTitle className="text-xl font-bold">{displayName}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPotion
                  ? `${variants.length} potion variants`
                  : hasEnchantments
                    ? `${enchantments.length} applicable enchantments`
                    : 'No enchantments available'}
                {activeEnchantments.length > 0 && (
                  <span className="text-purple-400"> · {activeEnchantments.length} applied</span>
                )}
              </p>
            </div>
          </div>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* ── Enchantment Matrix ────────────────────────────── */}
        {!loading && hasEnchantments && (
          <div className="px-6 pb-6 pt-2">
            <EnchantmentMatrix
              itemName={itemName}
              activeEnchantments={activeEnchantments}
              possibleEnchantments={item?.possibleEnchantments || detail?.possibleEnchantments || []}
              onSelect={setSelectedEnchant}
              selectedEnchant={selectedEnchant}
            />
            {/* Tip under table */}
            <p className="text-[10px] text-muted-foreground/60 mt-4 text-center">
              Numbers show the XP level required at the enchanting table · Click a row for strategy
            </p>
          </div>
        )}

        {/* ── Selected Enchantment Detail ───────────────────── */}
        {!loading && selectedInfo && (
          <div className="px-6 pb-6 pt-2">
            <div className="rounded-xl border border-white/8 bg-white/[0.02] p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  {selectedInfo.isActive && <Sparkles className="w-3.5 h-3.5 text-purple-400" />}
                  {selectedInfo.displayName}
                  {selectedInfo.isActive && (
                    <span className="text-[10px] bg-purple-500/15 text-purple-300 border border-purple-500/20 px-1.5 py-0.5 rounded-full">
                      {toRoman(selectedInfo.activeLevel!)} applied
                    </span>
                  )}
                </h3>
                <button onClick={() => setSelectedEnchant(null)} className="text-muted-foreground hover:text-foreground">
                  <ChevronUp className="w-4 h-4" />
                </button>
              </div>

              {/* Strategy */}
              <div className="p-2.5 rounded-lg bg-amber-400/5 border border-amber-400/15 flex gap-2.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400 flex-shrink-0 mt-0.5" />
                <p className="text-[11px] text-amber-200/80 leading-relaxed">
                  {getBestStrategy(selectedInfo.name, selectedInfo.activeLevel || selectedInfo.maxLevel)}
                </p>
              </div>

              {/* Anvil steps (if applied & level > 1) */}
              {selectedInfo.isActive && selectedInfo.activeLevel! > 1 && (() => {
                const steps = getAnvilSteps(selectedInfo.activeLevel!);
                const books = booksNeededForLevel(selectedInfo.activeLevel!);
                return steps.length > 0 ? (
                  <div>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">
                      Anvil Combining · {books} books needed
                    </p>
                    <div className="space-y-1">
                      {steps.map(step => (
                        <div key={step.step} className="flex items-center gap-3 text-[11px] px-3 py-1.5 rounded-lg bg-white/5">
                          <span className="text-muted-foreground font-mono text-[9px] w-4">#{step.step}</span>
                          <span className="flex-1">{step.count}× [{toRoman(step.inputLevel)} + {toRoman(step.inputLevel)}]</span>
                          <ArrowLeft className="w-3 h-3 text-muted-foreground rotate-180" />
                          <span className="text-purple-400 font-bold">{step.count}× {toRoman(step.outputLevel)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}

              {/* Sources */}
              {selectedInfo.sources.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Where to Find</p>
                  <div className="grid sm:grid-cols-2 gap-1.5">
                    {selectedInfo.sources.map((src, i) => (
                      <div key={i} className="flex items-start gap-2 p-2 rounded-lg bg-secondary/30 border border-white/5">
                        <span className="text-sm">{src.icon}</span>
                        <div>
                          <p className="text-[10px] font-bold text-foreground">{src.method}</p>
                          <p className="text-[9px] text-muted-foreground leading-tight">{src.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── Potion Variants Grid ─────────────────────────── */}
        {!loading && isPotion && (
          <div className="p-6 pt-2 space-y-2">
            <div className="grid grid-cols-1 gap-1.5">
              {variants.map(v => (
                <div
                  key={v.name}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-teal-500/10 flex items-center justify-center flex-shrink-0">
                    <FlaskConical className="w-4 h-4 text-teal-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm">{v.displayName}</span>
                    {v.effects && (
                      <p className="text-[10px] text-muted-foreground mt-0.5">{v.effects}</p>
                    )}
                  </div>
                  {v.duration && (
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground flex-shrink-0">
                      <Clock className="w-3 h-3" /> {v.duration}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {!loading && !hasEnchantments && !isPotion && (
          <div className="flex flex-col items-center justify-center p-12 text-muted-foreground">
            <BookOpen className="w-8 h-8 mb-3 opacity-40" />
            <p className="text-sm">No enchantments or variants for this item.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
