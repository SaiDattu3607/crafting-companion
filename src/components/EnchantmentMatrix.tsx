import { useMemo } from 'react';
import { Sparkles } from 'lucide-react';
import {
    getEnchantmentInfo, toRoman, booksNeededForLevel,
} from '@/lib/enchantmentBooks';

interface Props {
    itemName: string;
    activeEnchantments: { name: string; level: number }[];
    possibleEnchantments: { name: string; level?: number; levelRequirements?: number[] }[];
    onSelect?: (name: string | null) => void;
    selectedEnchant?: string | null;
}

export default function EnchantmentMatrix({
    itemName,
    activeEnchantments,
    possibleEnchantments,
    onSelect,
    selectedEnchant,
}: Props) {
    const enchantments = useMemo(() => {
        return possibleEnchantments.map(e => {
            const info = getEnchantmentInfo(e.name);
            const activeLevel = activeEnchantments.find(a => a.name === e.name)?.level ?? null;
            return {
                name: e.name,
                displayName: info?.displayName || e.name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
                maxLevel: e.level || info?.maxLevel || 1,
                levelRequirements: e.levelRequirements || [],
                maxTableLevel: info?.maxTableLevel ?? (e.level || 1),
                activeLevel,
                isActive: activeLevel !== null,
            };
        });
    }, [possibleEnchantments, activeEnchantments]);

    const maxCol = useMemo(() => {
        if (enchantments.length === 0) return 5;
        return Math.max(...enchantments.map(e => e.maxLevel), 1);
    }, [enchantments]);

    if (enchantments.length === 0) return null;

    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-3 rounded bg-purple-500/40 border border-purple-500/50" /> Applied
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-3 rounded bg-emerald-500/25 border border-emerald-500/30" /> Table
                </span>
                <span className="flex items-center gap-1.5">
                    <span className="w-5 h-3 rounded bg-amber-500/20 border border-amber-500/30" /> Trade / Loot
                </span>
            </div>

            <div className="rounded-xl border border-white/8 overflow-hidden">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="bg-white/[0.03]">
                            <th className="text-left text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-3 py-2 border-b border-white/8 w-[40%]">
                                Enchantment
                            </th>
                            {Array.from({ length: maxCol }, (_, i) => (
                                <th key={i} className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-1 py-2 border-b border-white/8 border-l border-white/5">
                                    {toRoman(i + 1)}
                                </th>
                            ))}
                            <th className="text-center text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-2 py-2 border-b border-white/8 border-l border-white/5 w-[60px]">
                                Books
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {enchantments.map((ench, ri) => {
                            const books = ench.isActive ? booksNeededForLevel(ench.activeLevel!) : null;

                            return (
                                <tr
                                    onClick={() => onSelect?.(selectedEnchant === ench.name ? null : ench.name)}
                                    className={`transition-colors h-10 ${onSelect ? 'cursor-pointer' : ''} ${selectedEnchant === ench.name
                                            ? 'bg-purple-500/10'
                                            : ri % 2 === 0
                                                ? 'bg-transparent hover:bg-white/[0.02]'
                                                : 'bg-white/[0.015] hover:bg-white/5'
                                        }`}
                                >
                                    <td className="px-3 py-1.5 border-b border-white/5">
                                        <div className="flex items-center gap-2">
                                            <span className={`text-[11px] font-semibold ${ench.isActive ? 'text-purple-300' : 'text-foreground'}`}>
                                                {ench.displayName}
                                            </span>
                                            {ench.isActive && (
                                                <Sparkles className="w-3 h-3 text-purple-400" />
                                            )}
                                        </div>
                                    </td>

                                    {Array.from({ length: maxCol }, (_, i) => {
                                        const lvl = i + 1;
                                        const exists = lvl <= ench.maxLevel;
                                        const isTable = lvl <= ench.maxTableLevel;
                                        const isApplied = ench.isActive && ench.activeLevel! >= lvl;
                                        const xpReq = ench.levelRequirements[i];

                                        let cellClass = 'bg-white/[0.02]';
                                        if (!exists) cellClass = 'bg-transparent';
                                        else if (isApplied) cellClass = 'bg-purple-500/30 border-purple-500/40';
                                        else if (isTable) cellClass = 'bg-emerald-500/15 border-emerald-500/20';
                                        else cellClass = 'bg-amber-500/12 border-amber-500/20';

                                        return (
                                            <td key={lvl} className="px-0.5 py-1.5 border-b border-white/5 border-l border-white/5 text-center">
                                                {exists ? (
                                                    <div
                                                        className={`mx-auto w-7 h-6 rounded border flex items-center justify-center text-[9px] font-mono font-bold ${cellClass} ${isApplied ? 'text-purple-200' : isTable ? 'text-emerald-400/70' : 'text-amber-400/60'
                                                            }`}
                                                    >
                                                        {xpReq ? xpReq : isApplied ? '✓' : '·'}
                                                    </div>
                                                ) : (
                                                    <div className="w-7 h-6 mx-auto" />
                                                )}
                                            </td>
                                        );
                                    })}

                                    <td className="px-2 py-1.5 border-b border-white/5 border-l border-white/5 text-center">
                                        {books !== null ? (
                                            <span className="text-[9px] font-mono text-purple-300 font-bold">📕{books}</span>
                                        ) : (
                                            <span className="text-[9px] text-muted-foreground/40">—</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
