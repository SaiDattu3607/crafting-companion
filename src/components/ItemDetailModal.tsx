/**
 * ItemDetailModal — Shows detailed info about a Minecraft item
 * including crafting recipe grid, item image, mob drops, and acquisition sources.
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, MapPin, Sword, Pickaxe, UtensilsCrossed, Info, Anvil, Grid3X3, Shuffle, Flame, FlaskConical, Clock } from 'lucide-react';
import { fetchItemDetail, type ItemDetail, type RecipeSlot } from '@/lib/api';

// Minecraft item image — using mc.nerothe.com which is reliable for item renders
function itemImageUrl(itemName: string) {
  return `https://mc-heads.net/item/${itemName}`;
}

// Fallback pixel art style image
function fallbackImageUrl(itemName: string) {
  return `https://minecraft-api.vercel.app/images/items/${itemName}.png`;
}

interface Props {
  itemName: string | null;
  open: boolean;
  onClose: () => void;
}

export default function ItemDetailModal({ itemName, open, onClose }: Props) {
  const [detail, setDetail] = useState<ItemDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgFallbackError, setImgFallbackError] = useState(false);

  useEffect(() => {
    if (!itemName || !open) {
      setDetail(null);
      setImgError(false);
      setImgFallbackError(false);
      return;
    }
    setLoading(true);
    fetchItemDetail(itemName).then(d => {
      setDetail(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [itemName, open]);

  if (!open || !itemName) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto glass-strong border-white/10">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : !detail ? (
          <div className="text-center py-8 text-muted-foreground">Item not found</div>
        ) : (
          <>
            {/* Header with image and name */}
            <DialogHeader>
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {!imgError ? (
                    <img
                      src={itemImageUrl(detail.name)}
                      alt={detail.displayName}
                      className="w-12 h-12 object-contain pixelated"
                      onError={() => setImgError(true)}
                    />
                  ) : !imgFallbackError ? (
                    <img
                      src={fallbackImageUrl(detail.name)}
                      alt={detail.displayName}
                      className="w-12 h-12 object-contain pixelated"
                      onError={() => setImgFallbackError(true)}
                    />
                  ) : (
                    <span className="text-2xl">📦</span>
                  )}
                </div>
                <div>
                  <DialogTitle className="text-xl font-bold">{detail.displayName}</DialogTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground font-mono">{detail.name}</span>
                    <Badge variant={detail.isResource ? 'secondary' : 'default'} className="text-[10px]">
                      {detail.isResource ? 'Resource' : 'Craftable'}
                    </Badge>
                    {detail.category !== 'generic' && (
                      <Badge variant="outline" className="text-[10px] capitalize">{detail.category}</Badge>
                    )}
                    {detail.foodInfo && (
                      <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-400/30">
                        <UtensilsCrossed className="w-3 h-3 mr-1" /> Food
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </DialogHeader>

            <div className="space-y-5 mt-2">

              {/* Crafting Recipe */}
              {detail.recipe && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    {detail.recipe.type === 'smithing' ? (
                      <><Anvil className="w-4 h-4 text-orange-400" /> Smithing Table Recipe</>
                    ) : detail.recipe.type === 'shapeless' ? (
                      <><Shuffle className="w-4 h-4 text-cyan-400" /> Shapeless Recipe</>
                    ) : (
                      <><Grid3X3 className="w-4 h-4 text-blue-400" /> Crafting Recipe</>
                    )}
                    {detail.recipe.outputCount > 1 && (
                      <span className="text-xs text-muted-foreground">(makes {detail.recipe.outputCount})</span>
                    )}
                  </h3>

                  {detail.recipe.type === 'shaped' && (
                    <div className="flex items-center gap-4">
                      <RecipeGrid grid={detail.recipe.grid} />
                      <span className="text-2xl text-muted-foreground">→</span>
                      <RecipeResultSlot item={detail} count={detail.recipe.outputCount} />
                    </div>
                  )}

                  {detail.recipe.type === 'shapeless' && (
                    <div className="flex items-center gap-4 flex-wrap">
                      <div className="flex items-center gap-1 flex-wrap">
                        {detail.recipe.ingredients.map((ing, i) => (
                          <RecipeSlotBox key={`${ing.name}-${i}`} slot={ing} />
                        ))}
                      </div>
                      <span className="text-2xl text-muted-foreground">→</span>
                      <RecipeResultSlot item={detail} count={detail.recipe.outputCount} />
                    </div>
                  )}

                  {detail.recipe.type === 'smithing' && (
                    <div className="flex items-center gap-3 flex-wrap">
                      {detail.recipe.ingredients.map((ing, i) => (
                        <div key={`${ing.name}-${i}`} className="flex flex-col items-center gap-1">
                          <RecipeSlotBox slot={ing} />
                          {ing.qty > 1 && (
                            <span className="text-[10px] text-muted-foreground">×{ing.qty}</span>
                          )}
                        </div>
                      ))}
                      <span className="text-2xl text-muted-foreground">→</span>
                      <RecipeResultSlot item={detail} count={1} />
                    </div>
                  )}
                </section>
              )}

              {/* Where to Find — show locations + obtainedBy (skip obtainedBy if procedure covers it) */}
              {(detail.acquisition?.locations || (detail.acquisition?.obtainedBy && !detail.acquisition?.procedure)) && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-400" /> Where to Find
                  </h3>

                  {detail.acquisition?.locations && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">Locations:</span>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {detail.acquisition.locations.map((loc, i) => (
                          <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-1 rounded-lg">
                            {loc}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {detail.acquisition?.obtainedBy && !detail.acquisition?.procedure && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-muted-foreground">How to obtain:</span>
                      <ul className="mt-1 space-y-1">
                        {detail.acquisition.obtainedBy.map((method, i) => (
                          <li key={i} className="text-xs text-foreground/80 flex items-start gap-1.5">
                            <span className="text-emerald-400 mt-0.5">•</span>
                            {method}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {detail.acquisition?.notes && !detail.acquisition?.procedure && (
                    <p className="text-xs text-muted-foreground italic mt-1 flex items-center gap-1">
                      <Info className="w-3 h-3" /> {detail.acquisition.notes}
                    </p>
                  )}
                </section>
              )}

              {/* Procedure — standalone section */}
              {detail.acquisition?.procedure && (
                <section>
                  <div className="bg-orange-500/5 border border-orange-500/15 rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span className="text-xs font-semibold text-orange-300">Procedure</span>
                      {detail.acquisition.procedure.station && (
                        <Badge variant="outline" className="text-[10px] text-orange-400 border-orange-400/30 ml-auto">
                          {detail.acquisition.procedure.station}
                        </Badge>
                      )}
                    </div>
                    <ol className="space-y-1.5 ml-1">
                      {detail.acquisition.procedure.steps.map((step, i) => (
                        <li key={i} className="text-xs text-foreground/80 flex items-start gap-2">
                          <span className="text-orange-400 font-bold text-[10px] bg-orange-500/15 rounded-full w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {i + 1}
                          </span>
                          {step}
                        </li>
                      ))}
                    </ol>
                    {detail.acquisition.procedure.fuel && (
                      <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1">
                        <Flame className="w-3 h-3 text-orange-400/50" /> Fuel: {detail.acquisition.procedure.fuel}
                      </p>
                    )}
                  </div>
                  {/* Show notes below procedure if there's no "Where to Find" section */}
                  {!(detail.acquisition?.locations || detail.acquisition?.obtainedBy) && detail.acquisition?.notes && (
                    <p className="text-xs text-muted-foreground italic mt-2 flex items-center gap-1">
                      <Info className="w-3 h-3" /> {detail.acquisition.notes}
                    </p>
                  )}
                </section>
              )}

              {/* Block sources */}
              {detail.blockSources.length > 0 && (
                <section>
                  <span className="text-xs font-medium text-muted-foreground">Dropped by blocks:</span>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {detail.blockSources.map((bs, i) => (
                      <span key={i} className="text-xs bg-stone-500/15 text-stone-300 border border-stone-500/20 px-2 py-1 rounded-lg inline-flex items-center gap-1">
                        <Pickaxe className="w-3 h-3" /> {bs.displayName}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Mob Drops */}
              {detail.entityDrops.length > 0 && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Sword className="w-4 h-4 text-red-400" /> Dropped by Mobs
                  </h3>
                  <div className="space-y-2">
                    {detail.entityDrops.map((drop, i) => (
                      <div key={i} className="flex items-center justify-between bg-red-500/5 border border-red-500/10 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded bg-red-500/10 flex items-center justify-center">
                            <img
                              src={`https://mc-heads.net/head/${drop.entity}`}
                              alt={drop.displayName}
                              className="w-6 h-6 pixelated"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                            />
                          </div>
                          <span className="text-sm font-medium capitalize">{drop.displayName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span>
                            {drop.dropChance >= 1 ? 'Always' : `${Math.round(drop.dropChance * 100)}%`}
                          </span>
                          <span className="text-foreground/60">
                            {drop.stackSizeRange[0] === drop.stackSizeRange[1]
                              ? `${drop.stackSizeRange[0]} ${drop.stackSizeRange[0] === 1 ? 'item' : 'items'}`
                              : `${drop.stackSizeRange[0]}–${drop.stackSizeRange[1]} items`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* Potion Effects */}
              {detail.possibleVariants && detail.possibleVariants.length > 0 && detail.possibleVariants[0].effects && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-400" /> Potion Effects
                  </h3>
                  <div className="space-y-1.5">
                    {detail.possibleVariants.map(v => (
                      <div key={v.name} className="flex items-center justify-between bg-teal-500/5 border border-teal-500/10 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                          <span className="text-xs font-medium text-foreground truncate">{v.displayName}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-shrink-0 ml-2">
                          {v.duration && (
                            <span className="flex items-center gap-1 text-teal-400/70">
                              <Clock className="w-3 h-3" /> {v.duration}
                            </span>
                          )}
                          <span className="text-foreground/70 max-w-[200px] text-right">{v.effects}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* No info fallback */}
              {!detail.recipe && !detail.acquisition && detail.entityDrops.length === 0 && detail.blockSources.length === 0 && !detail.foodInfo && !(detail.possibleVariants && detail.possibleVariants.length > 0) && (
                <section className="text-center py-4">
                  <p className="text-sm text-muted-foreground">No detailed acquisition info available for this item yet.</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Try searching the Minecraft Wiki for more details.</p>
                </section>
              )}

              {/* Food Info */}
              {detail.foodInfo && (
                <section>
                  <h3 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                    <UtensilsCrossed className="w-4 h-4 text-amber-400" /> Food Stats
                  </h3>
                  <div className="flex items-center gap-6 bg-amber-500/5 border border-amber-500/10 rounded-lg px-4 py-3">
                    <div className="text-center">
                      <div className="text-lg font-bold text-amber-400">{detail.foodInfo.foodPoints}</div>
                      <div className="text-[10px] text-muted-foreground">Hunger Points</div>
                    </div>
                    <div className="text-center">
                      <div className="text-lg font-bold text-amber-400">{detail.foodInfo.saturation.toFixed(1)}</div>
                      <div className="text-[10px] text-muted-foreground">Saturation</div>
                    </div>
                  </div>
                </section>
              )}


            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ── Sub-components ─────────────────────────────────────────── */

/** 3×3 crafting grid visualization */
function RecipeGrid({ grid }: { grid: (RecipeSlot | null)[][] }) {
  return (
    <div className="grid grid-cols-3 gap-0.5 bg-stone-800/50 p-1.5 rounded-lg border border-white/10">
      {grid.map((row, ri) =>
        row.map((slot, ci) => (
          <RecipeSlotBox key={`${ri}-${ci}`} slot={slot} />
        ))
      )}
    </div>
  );
}

/** Single slot in recipe grid */
function RecipeSlotBox({ slot }: { slot: RecipeSlot | null }) {
  const [imgErr, setImgErr] = useState(false);

  if (!slot) {
    return (
      <div className="w-12 h-12 bg-stone-900/60 rounded border border-white/5" />
    );
  }

  return (
    <div
      className="w-12 h-12 bg-stone-900/60 rounded border border-white/10 flex items-center justify-center relative group cursor-default"
      title={slot.displayName}
    >
      {!imgErr ? (
        <img
          src={itemImageUrl(slot.name)}
          alt={slot.displayName}
          className="w-8 h-8 object-contain pixelated"
          onError={() => setImgErr(true)}
        />
      ) : (
        <span className="text-[10px] text-center text-foreground/60 leading-tight px-0.5">
          {slot.displayName}
        </span>
      )}
      {/* Tooltip on hover */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 bg-black/90 text-white text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
        {slot.displayName}
      </div>
    </div>
  );
}

/** Result slot showing the output item */
function RecipeResultSlot({ item, count }: { item: ItemDetail; count: number }) {
  const [imgErr, setImgErr] = useState(false);

  return (
    <div className="w-14 h-14 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center justify-center relative">
      {!imgErr ? (
        <img
          src={itemImageUrl(item.name)}
          alt={item.displayName}
          className="w-10 h-10 object-contain pixelated"
          onError={() => setImgErr(true)}
        />
      ) : (
        <span className="text-xs text-center text-foreground/60">{item.displayName}</span>
      )}
      {count > 1 && (
        <span className="absolute -bottom-1 -right-1 text-[10px] bg-amber-500 text-black font-bold rounded-full w-4 h-4 flex items-center justify-center">
          {count}
        </span>
      )}
    </div>
  );
}
