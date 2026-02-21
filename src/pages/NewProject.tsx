import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createProject, searchMinecraftItems, type MinecraftItem } from '@/lib/api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ArrowLeft, Search, Loader2 } from 'lucide-react';

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

  if (!user) { navigate('/auth'); return null; }

  // Debounced item search
  const doSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchMinecraftItems(query);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => doSearch(itemSearch), 300);
    return () => clearTimeout(timer);
  }, [itemSearch, doSearch]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedItem) return;
    
    setCreating(true);
    setError('');
    
    try {
      const result = await createProject(name, selectedItem.name, description, quantity);
      navigate(`/project/${result.project.id}`);
    } catch (err) {
      setError((err as Error).message);
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen">
      <header className="pixel-border border-x-0 border-t-0 bg-card p-4 flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <h1 className="text-sm text-primary">New Crafting Project</h1>
      </header>

      <main className="max-w-3xl mx-auto p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="pixel-border bg-card p-6 space-y-4">
            <div>
              <label className="text-xs font-pixel text-muted-foreground block mb-2">Project Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Build a Beacon"
                className="bg-secondary border-border text-lg"
                required
              />
            </div>
            <div>
              <label className="text-xs font-pixel text-muted-foreground block mb-2">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="We need a beacon for the base..."
                className="bg-secondary border-border text-lg resize-none"
                rows={3}
              />
            </div>
          </div>

          {/* Minecraft Item Selector */}
          <div className="pixel-border bg-card p-6 space-y-4">
            <label className="text-xs font-pixel text-muted-foreground block">Target Minecraft Item</label>
            
            {selectedItem ? (
              <div className="flex items-center justify-between p-4 bg-primary/10 rounded border border-primary/20">
                <div>
                  <span className="text-lg font-bold text-primary">{selectedItem.displayName}</span>
                  <span className="text-sm text-muted-foreground ml-2">({selectedItem.name})</span>
                  {selectedItem.isResource && (
                    <span className="ml-2 text-xs bg-yellow-500/20 text-yellow-600 px-2 py-0.5 rounded">Raw Resource</span>
                  )}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => { setSelectedItem(null); setItemSearch(''); }}>
                  Change
                </Button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={itemSearch}
                    onChange={e => setItemSearch(e.target.value)}
                    placeholder="Search items... (e.g. beacon, diamond_pickaxe)"
                    className="bg-secondary border-border text-lg pl-10"
                  />
                  {searching && <Loader2 className="absolute right-3 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                </div>
                
                {searchResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-card border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                    {searchResults.map(item => (
                      <button
                        key={item.name}
                        type="button"
                        className="w-full text-left px-4 py-2 hover:bg-secondary transition-colors flex items-center justify-between"
                        onClick={() => {
                          setSelectedItem(item);
                          setSearchResults([]);
                          if (!name) setName(`Craft ${item.displayName}`);
                        }}
                      >
                        <span className="text-lg">{item.displayName}</span>
                        <span className="text-sm text-muted-foreground">
                          {item.isResource ? '🪨 Resource' : '⚒ Craftable'}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="w-32">
              <label className="text-xs font-pixel text-muted-foreground block mb-2">Quantity</label>
              <Input
                type="number"
                min={1}
                max={999}
                value={quantity}
                onChange={e => setQuantity(parseInt(e.target.value) || 1)}
                className="bg-secondary border-border text-lg"
              />
            </div>
          </div>

          {error && (
            <div className="p-4 pixel-border bg-destructive/10 text-destructive">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full text-lg pixel-border-accent"
            disabled={!selectedItem || !name.trim() || creating}
          >
            {creating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Parsing Recipe Tree...
              </>
            ) : (
              '🏗 Create Project'
            )}
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
