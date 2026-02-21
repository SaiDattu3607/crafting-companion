import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { soundManager } from '@/lib/sound';
import { createProject, searchMinecraftItems, lookupMinecraftItem, type MinecraftItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Loader2, Sparkles, X } from 'lucide-react';

const NewProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItem, setSelectedItem] = useState<MinecraftItem | null>(null);
  const [searchResults, setSearchResults] = useState<MinecraftItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [enchantName, setEnchantName] = useState('');
  const [enchantLevel, setEnchantLevel] = useState(1);
  const [enchantments, setEnchantments] = useState<{ name: string; level: number }[]>([]);

  useEffect(() => {
    if (selectedItem?.possibleEnchantments?.length) {
      setEnchantName(selectedItem.possibleEnchantments[0].name);
    } else {
      setEnchantName('');
    }
  }, [selectedItem]);

  if (!user) { navigate('/auth'); return null; }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedItem) return;

<<<<<<< HEAD
=======
    soundManager.playSound('button');
>>>>>>> 1aa224ae2bb03f9b6a9f54cc44589e999d964403
    setCreating(true);
    setError('');
    try {
      const result = await createProject(name, selectedItem.name, description, quantity, enchantments.length > 0 ? enchantments : null);
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

          {/* Section 2: Item */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest">Target Item</h2>

            {selectedItem ? (
              <div className="flex items-center justify-between p-4 rounded-xl bg-primary/10 border border-primary/20">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">🎯</span>
                  <div>
                    <p className="font-semibold text-foreground">{selectedItem.displayName}</p>
                    <p className="text-xs text-muted-foreground">{selectedItem.name}</p>
                  </div>
                  {selectedItem.isResource && (
                    <span className="text-xs badge-pending px-2 py-0.5 rounded-full">Resource</span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { soundManager.playSound('button'); setSelectedItem(null); setItemSearch(''); }}
                  className="rounded-xl text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={itemSearch}
                  onChange={e => setItemSearch(e.target.value)}
                  placeholder="Search items… e.g. beacon, diamond_sword"
                  className="bg-secondary/60 border-white/8 rounded-xl h-11 pl-10 focus:border-primary/50"
                />
                {searching && <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />}

                {searchResults.length > 0 && (
                  <div className="absolute z-20 w-full mt-2 glass-strong rounded-xl border border-white/8 shadow-2xl overflow-hidden max-h-56 overflow-y-auto">
                    {searchResults.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        className="w-full text-left px-4 py-3 hover:bg-primary/10 transition-colors flex items-center justify-between group border-b border-white/5 last:border-0"
                        onClick={async () => {
                          soundManager.playSound('button');
                          try {
                            const full = await lookupMinecraftItem(item.name);
                            setSelectedItem(full || item);
                          } catch { setSelectedItem(item); }
                          setSearchResults([]);
                          if (!name) setName(`Craft ${item.displayName}`);
                        }}
                      >
                        <span className="font-medium group-hover:text-primary transition-colors">{item.displayName}</span>
                        <span className="text-xs text-muted-foreground">{item.isResource ? '🪨 Resource' : '⚒ Craftable'}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="w-32">
              <label className="block text-sm font-medium text-foreground mb-1.5">Quantity</label>
              <Input
                type="number" min={1} max={999}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="bg-secondary/60 border-white/8 rounded-xl h-11 focus:border-primary/50"
              />
            </div>
          </div>

          {/* Section 3: Enchantments */}
          {!selectedItem?.isResource && (
            <div className="glass-strong rounded-2xl border border-white/5 p-6 space-y-4">
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                Enchantments <span className="font-normal normal-case">(optional)</span>
              </h2>
              <div className="flex items-center gap-2 flex-wrap">
                <select
                  value={enchantName}
                  onChange={e => setEnchantName(e.target.value)}
                  className="bg-secondary/60 border border-white/8 rounded-xl px-3 py-2 text-sm text-foreground flex-1 min-w-0"
                >
                  <option value="">Select enchantment</option>
                  {selectedItem?.possibleEnchantments?.map(pe => (
                    <option key={pe.name} value={pe.name}>{pe.name.replace(/_/g, ' ')}</option>
                  ))}
                </select>
                <select
                  value={enchantLevel}
                  onChange={e => setEnchantLevel(parseInt(e.target.value) || 1)}
                  className="bg-secondary/60 border border-white/8 rounded-xl px-3 py-2 text-sm text-foreground w-16"
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
                  className="bg-purple-500/20 border border-purple-500/30 text-purple-300 hover:bg-purple-500/30 rounded-xl"
                >
                  Add
                </Button>
              </div>

              {enchantments.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  {enchantments.map(e => (
                    <span key={e.name} className="inline-flex items-center gap-2 bg-purple-500/15 border border-purple-500/25 text-purple-300 px-3 py-1 rounded-full text-xs font-medium">
                      {e.name.replace(/_/g, ' ')} {e.level}
                      <button type="button" onClick={() => { soundManager.playSound('button'); setEnchantments(es => es.filter(x => x.name !== e.name)); }}
                        className="hover:text-white transition-colors">✕</button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            type="submit"
            className="w-full btn-glow bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl py-6 font-semibold text-base gap-2"
            disabled={!selectedItem || !name.trim() || creating}
          >
            {creating
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Parsing Recipe Tree…</>
              : '🏗 Create Project'}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
