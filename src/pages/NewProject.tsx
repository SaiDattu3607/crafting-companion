import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { soundManager } from '@/lib/sound';
import { createMultiItemProject, searchMinecraftItems, lookupMinecraftItem, type MinecraftItem, type TargetItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Loader2, Sparkles, X, Plus, Package } from 'lucide-react';

/* ── Single target-item form (reusable per item slot) ─────────── */
interface ItemFormProps {
  index: number;
  item: TargetItem | null;
  onAdd: (item: TargetItem) => void;
  onRemove: () => void;
  isOnly: boolean;
}

const ItemForm = ({ index, item, onAdd, onRemove, isOnly }: ItemFormProps) => {
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MinecraftItem | null>(null);
  const [searchResults, setSearchResults] = useState<MinecraftItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState(item?.quantity || 1);
  const [enchantName, setEnchantName] = useState('');
  const [enchantLevel, setEnchantLevel] = useState(1);
  const [enchantments, setEnchantments] = useState<{ name: string; level: number }[]>(item?.enchantments || []);

  useEffect(() => {
    if (selectedItem?.possibleEnchantments?.length) {
      setEnchantName(selectedItem.possibleEnchantments[0].name);
    } else {
      setEnchantName('');
    }
  }, [selectedItem]);

  // Sync back to parent whenever selection/qty/enchantments change
  useEffect(() => {
    if (selectedItem) {
      onAdd({
        itemName: selectedItem.name,
        displayName: selectedItem.displayName,
        quantity,
        enchantments: enchantments.length > 0 ? enchantments : null,
      });
    }
  }, [selectedItem, quantity, enchantments]);

  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      setSearchResults(await searchMinecraftItems(query));
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => doSearch(itemSearch), 300);
    return () => clearTimeout(t);
  }, [itemSearch, doSearch]);

  // If we already have a committed item, show compact view
  if (item && !selectedItem) {
    setSelectedItem({ name: item.itemName, displayName: item.displayName, isResource: false } as MinecraftItem);
  }

  return (
    <div className="glass rounded-2xl border border-white/5 p-5 space-y-4 relative">
      {/* Remove button */}
      {!isOnly && (
        <button
          type="button"
          onClick={() => { soundManager.playSound('button'); onRemove(); }}
          className="absolute top-3 right-3 text-muted-foreground/50 hover:text-red-400 transition-colors"
          title="Remove item"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      <div className="flex items-center gap-2 mb-1">
        <Package className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Item {index + 1}</h3>
      </div>

      {/* Item search / selected display */}
      {selectedItem ? (
        <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
          <div className="flex items-center gap-3">
            <span className="text-lg">🎯</span>
            <div>
              <p className="font-semibold text-foreground text-sm">{selectedItem.displayName}</p>
              <p className="text-xs text-muted-foreground">{selectedItem.name}</p>
            </div>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => { soundManager.playSound('button'); setSelectedItem(null); setItemSearch(''); }}
            className="rounded-xl text-muted-foreground hover:text-foreground h-7 w-7 p-0">
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={itemSearch}
            onChange={e => setItemSearch(e.target.value)}
            placeholder="Search items… e.g. beacon, diamond_sword"
            className="bg-secondary/60 border-white/8 rounded-xl h-10 pl-10 text-sm focus:border-primary/50"
          />
          {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}

          {searchResults.length > 0 && (
            <div className="absolute z-20 w-full mt-1 glass-strong rounded-xl border border-white/8 shadow-2xl overflow-hidden max-h-48 overflow-y-auto">
              {searchResults.map(sr => (
                <button
                  key={sr.name}
                  type="button"
                  className="w-full text-left px-4 py-2.5 hover:bg-primary/10 transition-colors flex items-center justify-between group border-b border-white/5 last:border-0"
                  onClick={async () => {
                    soundManager.playSound('button');
                    try {
                      const full = await lookupMinecraftItem(sr.name);
                      setSelectedItem(full || sr);
                    } catch { setSelectedItem(sr); }
                    setSearchResults([]);
                  }}
                >
                  <span className="font-medium text-sm group-hover:text-primary transition-colors">{sr.displayName}</span>
                  <span className="text-xs text-muted-foreground">{sr.isResource ? '🪨 Resource' : '⚒ Craftable'}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quantity */}
      {selectedItem && (
        <div className="flex items-center gap-4">
          <div className="w-28">
            <label className="block text-xs font-medium text-muted-foreground mb-1">Quantity</label>
            <Input
              type="number" min={1} max={999}
              value={quantity}
              onChange={e => setQuantity(parseInt(e.target.value) || 1)}
              className="bg-secondary/60 border-white/8 rounded-xl h-9 text-sm focus:border-primary/50"
            />
          </div>
        </div>
      )}

      {/* Enchantments */}
      {selectedItem && !selectedItem.isResource && selectedItem.possibleEnchantments && selectedItem.possibleEnchantments.length > 0 && (
        <div className="space-y-3 pt-2 border-t border-white/5">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3 h-3 text-purple-400" />
            <span className="text-xs font-medium text-muted-foreground">Enchantments</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={enchantName}
              onChange={e => setEnchantName(e.target.value)}
              className="bg-secondary/60 border border-white/8 rounded-xl px-2.5 py-1.5 text-xs text-foreground flex-1 min-w-0"
            >
              <option value="">Select enchantment</option>
              {selectedItem.possibleEnchantments.map(pe => (
                <option key={pe.name} value={pe.name}>{pe.name.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <select
              value={enchantLevel}
              onChange={e => setEnchantLevel(parseInt(e.target.value) || 1)}
              className="bg-secondary/60 border border-white/8 rounded-xl px-2.5 py-1.5 text-xs text-foreground w-14"
            >
              {[1, 2, 3, 4, 5].map(l => <option key={l} value={l}>{l}</option>)}
            </select>
            <Button
              type="button" size="sm"
              onClick={() => {
                soundManager.playSound('button');
                if (!enchantName) return;
                setEnchantments(es => {
                  const exists = es.find(e => e.name === enchantName);
                  if (exists) return es.map(e => e.name === enchantName ? { ...e, level: enchantLevel } : e);
                  return [...es, { name: enchantName, level: enchantLevel }];
                });
              }}
              className="bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 rounded-xl h-7 px-2.5 text-xs"
            >
              Add
            </Button>
          </div>
          {enchantments.length > 0 && (
            <div className="flex gap-1.5 flex-wrap">
              {enchantments.map(e => (
                <span key={e.name} className="inline-flex items-center gap-1.5 bg-purple-500/15 border border-purple-500/25 text-purple-300 px-2.5 py-0.5 rounded-full text-[10px] font-medium">
                  {e.name.replace(/_/g, ' ')} {e.level}
                  <button type="button" onClick={() => { soundManager.playSound('button'); setEnchantments(es => es.filter(x => x.name !== e.name)); }}
                    className="hover:text-white transition-colors">✕</button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/* ── Main page ────────────────────────────────────────────────── */
const NewProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetItems, setTargetItems] = useState<(TargetItem | null)[]>([null]); // start with 1 empty slot
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  if (!user) { navigate('/auth'); return null; }

  const validItems = targetItems.filter((t): t is TargetItem => t !== null && !!t.itemName);

  const handleItemUpdate = (index: number, item: TargetItem) => {
    setTargetItems(prev => {
      const next = [...prev];
      next[index] = item;
      return next;
    });
    // Auto-set project name from first item
    if (index === 0 && !name) {
      setName(`Craft ${item.displayName}`);
    }
  };

  const handleItemRemove = (index: number) => {
    setTargetItems(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddSlot = () => {
    soundManager.playSound('button');
    setTargetItems(prev => [...prev, null]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || validItems.length === 0) return;

    soundManager.playSound('button');
    setCreating(true);
    setError('');
    try {
      const result = await createMultiItemProject(name, validItems, description);
      navigate(`/project/${result.project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen mesh-bg text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-white/5">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => { soundManager.playSound('button'); navigate('/dashboard'); }} className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-xs">⛏</div>
            <span className="font-black text-sm gradient-text-green">CraftChain</span>
          </div>
          <span className="text-muted-foreground text-sm">/ New Project</span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight mb-1">New Project</h1>
          <p className="text-muted-foreground text-sm">Set up a crafting project and CraftChain will parse the full recipe tree for you.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Section 1: Project Info */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Project Info</h2>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Project Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Build a Beacon"
                className="bg-secondary/60 border-white/8 rounded-xl h-11 focus:border-primary/50"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="We need a beacon for the base..."
                className="bg-secondary/60 border-white/8 rounded-xl resize-none focus:border-primary/50"
                rows={3}
              />
            </div>
          </div>

          {/* Section 2: Target Items */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Target Items</h2>
              <span className="text-xs text-muted-foreground">{validItems.length} item{validItems.length !== 1 ? 's' : ''} selected</span>
            </div>

            <div className="space-y-3">
              {targetItems.map((item, i) => (
                <ItemForm
                  key={i}
                  index={i}
                  item={item}
                  onAdd={(it) => handleItemUpdate(i, it)}
                  onRemove={() => handleItemRemove(i)}
                  isOnly={targetItems.length === 1}
                />
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={handleAddSlot}
              className="w-full rounded-xl border-dashed border-white/10 hover:border-primary/40 hover:text-primary text-muted-foreground gap-2 h-10"
            >
              <Plus className="w-4 h-4" />
              Add another item
            </Button>
          </div>

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 font-semibold text-base gap-2"
            disabled={validItems.length === 0 || !name.trim() || creating}
          >
            {creating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing Recipe Tree{validItems.length > 1 ? 's' : ''}…</>
              : `🏗 Create Project (${validItems.length} item${validItems.length !== 1 ? 's' : ''})`}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
