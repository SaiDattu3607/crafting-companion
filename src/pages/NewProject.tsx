import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { createProject, updateProject, type Requirement } from '@/lib/storage';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, ArrowLeft } from 'lucide-react';

interface ReqInput {
  name: string;
  quantity: number;
  dependencyIdx: number | null; // index of another requirement this depends on
}

const NewProject = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [requirements, setRequirements] = useState<ReqInput[]>([
    { name: '', quantity: 1, dependencyIdx: null },
  ]);

  if (!user) { navigate('/auth'); return null; }

  const addReq = () => setRequirements([...requirements, { name: '', quantity: 1, dependencyIdx: null }]);
  
  const removeReq = (i: number) => {
    const updated = requirements.filter((_, idx) => idx !== i)
      .map(r => ({
        ...r,
        dependencyIdx: r.dependencyIdx === i ? null : 
          r.dependencyIdx !== null && r.dependencyIdx > i ? r.dependencyIdx - 1 : r.dependencyIdx
      }));
    setRequirements(updated);
  };

  const updateReq = (i: number, field: keyof ReqInput, value: string | number | null) => {
    const updated = [...requirements];
    (updated[i] as any)[field] = value;
    setRequirements(updated);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    
    // Build requirements with temporary IDs to resolve dependencies
    const tempIds = requirements.map(() => Math.random().toString(36).slice(2, 10));
    const reqs: Omit<Requirement, 'id' | 'status'>[] = requirements
      .filter(r => r.name.trim())
      .map((r, i) => ({
        name: r.name.trim(),
        quantity: r.quantity,
        dependencies: r.dependencyIdx !== null && r.dependencyIdx >= 0 ? [tempIds[r.dependencyIdx]] : [],
      }));

    // We pass deps as empty and let the storage assign IDs, then fix deps
    const project = createProject(name, description, user.id, 
      requirements.filter(r => r.name.trim()).map(r => ({ name: r.name, quantity: r.quantity, dependencies: [] }))
    );

    // Now fix dependencies using the assigned IDs
    if (project.requirements.length > 0) {
      const validReqs = requirements.filter(r => r.name.trim());
      validReqs.forEach((r, i) => {
        if (r.dependencyIdx !== null && r.dependencyIdx >= 0 && r.dependencyIdx < project.requirements.length) {
          project.requirements[i].dependencies = [project.requirements[r.dependencyIdx].id];
        }
      });
      updateProject(project);
    }

    navigate(`/project/${project.id}`);
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
              <label className="text-xs font-pixel text-muted-foreground block mb-2">Final Item Name</label>
              <Input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Diamond Pickaxe"
                className="bg-secondary border-border text-lg"
                required
              />
            </div>
            <div>
              <label className="text-xs font-pixel text-muted-foreground block mb-2">Description</label>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="A mighty pickaxe for mining..."
                className="bg-secondary border-border text-lg resize-none"
                rows={3}
              />
            </div>
          </div>

          <div className="pixel-border bg-card p-6">
            <div className="flex items-center justify-between mb-4">
              <label className="text-xs font-pixel text-muted-foreground">Required Items</label>
              <Button type="button" variant="outline" size="sm" onClick={addReq} className="text-lg">
                <Plus className="w-3 h-3 mr-1" /> Add Item
              </Button>
            </div>

            <div className="space-y-3">
              {requirements.map((req, i) => (
                <div key={i} className="flex gap-2 items-start p-3 bg-secondary rounded">
                  <div className="flex-1 space-y-2">
                    <Input
                      value={req.name}
                      onChange={e => updateReq(i, 'name', e.target.value)}
                      placeholder="e.g. Iron Ingot"
                      className="bg-muted border-border text-lg"
                    />
                    <div className="flex gap-2">
                      <div className="w-24">
                        <label className="text-sm text-muted-foreground">Qty</label>
                        <Input
                          type="number"
                          min={1}
                          value={req.quantity}
                          onChange={e => updateReq(i, 'quantity', parseInt(e.target.value) || 1)}
                          className="bg-muted border-border text-lg"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="text-sm text-muted-foreground">Depends on</label>
                        <select
                          value={req.dependencyIdx ?? ''}
                          onChange={e => updateReq(i, 'dependencyIdx', e.target.value === '' ? null : parseInt(e.target.value))}
                          className="w-full h-10 rounded-md bg-muted border border-border px-3 text-lg text-foreground"
                        >
                          <option value="">None</option>
                          {requirements.map((other, j) => 
                            j !== i && other.name.trim() ? (
                              <option key={j} value={j}>{other.name}</option>
                            ) : null
                          )}
                        </select>
                      </div>
                    </div>
                  </div>
                  {requirements.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeReq(i)} className="text-destructive mt-1">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <Button type="submit" className="w-full text-lg pixel-border-accent">
            🏗 Create Project
          </Button>
        </form>
      </main>
    </div>
  );
};

export default NewProject;
