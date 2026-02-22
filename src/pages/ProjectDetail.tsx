import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { soundManager } from '@/lib/sound';
import {
  fetchProject, contributeToNode, sendProjectInvite,
  fetchContributions, fetchBottleneck, fetchProgress,
  updateNodeEnchantments, updateMemberRole,
  fetchTaskSuggestions, savePlanSnapshot, fetchPlanSnapshots, restorePlanSnapshot,
  addTargetItem, searchMinecraftItems, lookupMinecraftItem,
  updateProfile,
  type Project, type CraftingNode, type Contribution,
  type BottleneckItem, type ProjectProgress, type ProjectMember,
  type MemberRole, type SuggestedTask, type PlanSnapshot,
  type MinecraftItem,
} from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import {
  ArrowLeft, AlertTriangle, CheckCircle, Clock, Ban,
  UserPlus, RefreshCw, Loader2, Layers, Activity,
  Sparkles, Pencil, Check, X, BookOpen, ChevronDown, ChevronUp, Trophy,
  ClipboardList, Save, History, HardHat, Hammer, BrainCircuit, Users,
  Plus, Search, Package, Shield
} from 'lucide-react';
import { getBookRequirements, toRoman, getBestStrategy } from '@/lib/enchantmentBooks';
import { getMinecraftAssetUrl } from '@/lib/minecraftAssets';
import ItemDetailModal from '@/components/ItemDetailModal';
import { ItemIconWithFallback } from '@/components/ItemIconWithFallback';
import EnchantmentGridModal from '@/components/EnchantmentGridModal';
import { toast } from '@/hooks/use-toast';

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [project, setProject] = useState<Project | null>(null);
  const [nodes, setNodes] = useState<CraftingNode[]>([]);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [bottlenecks, setBottlenecks] = useState<BottleneckItem[]>([]);
  const [progress, setProgress] = useState<ProjectProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [collabEmail, setCollabEmail] = useState('');
  const [collabRole, setCollabRole] = useState<MemberRole>('member');
  const [collabMessage, setCollabMessage] = useState('');
  const [collabError, setCollabError] = useState('');
  const [collabSuccess, setCollabSuccess] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [contributing, setContributing] = useState<string | null>(null);

  // Role-based tasks
  const [myRole, setMyRole] = useState<MemberRole>('member');
  const [suggestedTasks, setSuggestedTasks] = useState<SuggestedTask[]>([]);

  // Plan versioning
  const [snapshots, setSnapshots] = useState<PlanSnapshot[]>([]);
  const [savingSnapshot, setSavingSnapshot] = useState(false);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const [snapshotLabel, setSnapshotLabel] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  // Add-item state
  const [showAddItem, setShowAddItem] = useState(false);
  const [addItemSearch, setAddItemSearch] = useState('');
  const [addItemResults, setAddItemResults] = useState<MinecraftItem[]>([]);
  const [addItemSearching, setAddItemSearching] = useState(false);
  const [addItemSelected, setAddItemSelected] = useState<MinecraftItem | null>(null);
  const [addItemQty, setAddItemQty] = useState(1);
  const [addItemEnchantName, setAddItemEnchantName] = useState('');
  const [addItemEnchantLevel, setAddItemEnchantLevel] = useState(1);
  const [addItemEnchantments, setAddItemEnchantments] = useState<{ name: string; level: number }[]>([]);
  const [addItemVariant, setAddItemVariant] = useState<string>('');
  const [addingItem, setAddingItem] = useState(false);

  // Enchantment editing state
  const [editingEnchantments, setEditingEnchantments] = useState<string | null>(null);
  const [editEnchantmentLevels, setEditEnchantmentLevels] = useState<{ name: string; level: number }[]>([]);
  const [savingEnchantments, setSavingEnchantments] = useState(false);
  const [expandedBook, setExpandedBook] = useState<string | null>(null);

  // Enchantment level requirement cache: enchantment_name -> level[] (index 0 = level 1 req)
  const [enchLevelReqs, setEnchLevelReqs] = useState<Record<string, number[]>>({});

  // Item detail modal
  const [detailItemName, setDetailItemName] = useState<string | null>(null);
  const [showItemDetail, setShowItemDetail] = useState(false);

  // Enchantment grid modal
  const [enchantGridItem, setEnchantGridItem] = useState<string | null>(null);
  const [enchantGridEnchants, setEnchantGridEnchants] = useState<{ name: string; level: number }[]>([]);
  const [showEnchantGrid, setShowEnchantGrid] = useState(false);

  /** Get the minimum XP level required for an enchantment at a given tier */
  const getMinXpLevel = (enchName: string, enchLevel: number): number | null => {
    const reqs = enchLevelReqs[enchName];
    if (reqs && enchLevel >= 1 && enchLevel <= reqs.length) {
      return reqs[enchLevel - 1]; // 0-indexed: index 0 = level 1 requirement
    }
    return null;
  };

  /** Get the member with the highest minecraft_level who can do a given enchantment */
  const getBestMemberForEnchantment = (enchName: string, enchLevel: number) => {
    const minLevel = getMinXpLevel(enchName, enchLevel);
    if (minLevel === null) return null;
    const capable = members.filter(m => {
      const mLevel = (m.profiles as any)?.minecraft_level ?? 0;
      return mLevel >= minLevel;
    });
    if (capable.length === 0) return null;
    // Return the member with the highest level
    return capable.sort((a, b) => ((b.profiles as any)?.minecraft_level ?? 0) - ((a.profiles as any)?.minecraft_level ?? 0))[0];
  };

  const loadProject = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [projectData, contribs, bottleneckData, progressData] = await Promise.all([
        fetchProject(id),
        fetchContributions(id).catch(() => []),
        fetchBottleneck(id).catch(() => []),
        fetchProgress(id).catch(() => null),
      ]);

      const parsedNodes = projectData.nodes.map((node: any) => {
        if (node.enchantments && typeof node.enchantments === 'string') {
          try { node.enchantments = JSON.parse(node.enchantments); }
          catch { node.enchantments = null; }
        }
        return node;
      });

      setProject(projectData.project);
      setNodes(parsedNodes);
      setMembers(projectData.members);
      setContributions(contribs);
      setBottlenecks(bottleneckData);
      setProgress(progressData);
      setError('');

      // Load tasks & snapshots in parallel
      const [taskData, snapshotData] = await Promise.all([
        fetchTaskSuggestions(id).catch(() => ({ role: 'member' as MemberRole, tasks: [] })),
        fetchPlanSnapshots(id).catch(() => []),
      ]);
      setMyRole(taskData.role);
      setSuggestedTasks(taskData.tasks);
      setSnapshots(snapshotData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadProject(); }, [loadProject]);

  // ── Fetch enchantment level requirements for items in the project ──
  useEffect(() => {
    if (nodes.length === 0) return;
    // Find unique item names that have enchantments
    const enchantedItems = new Set<string>();
    for (const node of nodes) {
      if (Array.isArray(node.enchantments) && node.enchantments.length > 0 && node.item_name !== 'enchanted_book') {
        enchantedItems.add(node.item_name);
      }
    }
    if (enchantedItems.size === 0) return;

    // Fetch item details to get levelRequirements
    const fetchReqs = async () => {
      const reqs: Record<string, number[]> = { ...enchLevelReqs };
      for (const itemName of enchantedItems) {
        try {
          const detail = await lookupMinecraftItem(itemName);
          if (detail?.possibleEnchantments) {
            for (const pe of detail.possibleEnchantments) {
              if (pe.levelRequirements && !reqs[pe.name]) {
                reqs[pe.name] = pe.levelRequirements;
              }
            }
          }
        } catch { /* ignore */ }
      }
      setEnchLevelReqs(reqs);
    };
    fetchReqs();
  }, [nodes.length]); // Only re-run when node count changes

  // ── Add Item search debounce (must be before early returns – Rules of Hooks) ──
  useEffect(() => {
    if (addItemSearch.length < 2) { setAddItemResults([]); return; }
    const t = setTimeout(async () => {
      setAddItemSearching(true);
      try {
        setAddItemResults(await searchMinecraftItems(addItemSearch));
      } catch { setAddItemResults([]); }
      finally { setAddItemSearching(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [addItemSearch]);

  if (!user) { navigate('/auth'); return null; }

  if (loading) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen mesh-bg flex items-center justify-center text-center">
        <div>
          <p className="text-muted-foreground text-xl mb-4">{error || 'Project not found'}</p>
          <Button variant="outline" onClick={() => navigate('/dashboard')} className="rounded-xl">Go Home</Button>
        </div>
      </div>
    );
  }

  const progressPct = progress?.progress_pct || 0;
  const topBottleneck = bottlenecks[0] ?? null;

  const canContribute = (node: CraftingNode): boolean => {
    if (node.collected_qty >= node.required_qty) return false;
    if (node.is_resource) return true;
    return nodes.filter(n => n.parent_id === node.id).every(c => c.collected_qty >= c.required_qty);
  };

  const getNodeStatus = (node: CraftingNode): 'complete' | 'ready' | 'blocked' => {
    if (node.collected_qty >= node.required_qty) return 'complete';
    if (canContribute(node)) return 'ready';
    return 'blocked';
  };

  const handleContribute = async (nodeId: string, action: 'collected' | 'crafted') => {
    setContributing(nodeId);
    try {
      const result = await contributeToNode(id!, nodeId, 1, action);
      if (!result.success) {
        setError(result.error || 'Contribution failed');
      } else {
        soundManager.playFileSound(action === 'crafted' ? 'craft' : 'collect');
      }
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setContributing(null);
    }
  };

  const handleSendInvite = async () => {
    setCollabError('');
    setCollabSuccess('');
    if (!collabEmail.trim()) return;
    setInviteSending(true);
    try {
      await sendProjectInvite(id!, collabEmail.trim(), collabRole, collabMessage.trim());
      setCollabEmail('');
      setCollabRole('member');
      setCollabMessage('');
      setShowInviteForm(false);
      setCollabSuccess('Invite sent!');
      soundManager.playSound('craft');
      setTimeout(() => setCollabSuccess(''), 3000);
    } catch (err) {
      setCollabError((err as Error).message);
    } finally {
      setInviteSending(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: MemberRole) => {
    try {
      await updateMemberRole(id!, userId, newRole);
      soundManager.playSound('button');
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleSaveSnapshot = async () => {
    setSavingSnapshot(true);
    try {
      await savePlanSnapshot(id!, snapshotLabel || undefined);
      soundManager.playSound('craft');
      setSnapshotLabel('');
      // Reload snapshots
      const snapshotData = await fetchPlanSnapshots(id!);
      setSnapshots(snapshotData);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSavingSnapshot(false);
    }
  };

  const handleRestoreSnapshot = async (version: number) => {
    setRestoringVersion(version);
    try {
      await restorePlanSnapshot(id!, version);
      soundManager.playSound('craft');
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setRestoringVersion(null);
    }
  };

  const handleStartEditEnchantments = (node: CraftingNode) => {
    setEditingEnchantments(node.id);
    setEditEnchantmentLevels(
      (node.enchantments || []).map(e => ({ name: e.name, level: e.level }))
    );
  };

  const handleSaveEnchantments = async (nodeId: string) => {
    setSavingEnchantments(true);
    try {
      await updateNodeEnchantments(id!, nodeId, editEnchantmentLevels);
      setEditingEnchantments(null);
      await loadProject();
    } catch (err) {
      const msg = (err as Error).message;
      toast({
        title: 'Enchantment Error',
        description: msg,
        variant: 'destructive',
      });
    } finally {
      setSavingEnchantments(false);
    }
  };

  const handleCancelEditEnchantments = () => {
    setEditingEnchantments(null);
    setEditEnchantmentLevels([]);
  };

  // ── Add Item handlers ──────────────────────────────────────────
  const handleAddItemSelect = async (item: MinecraftItem) => {
    // Fetch full item data (with possibleEnchantments & possibleVariants)
    let fullItem = item;
    try {
      const looked = await lookupMinecraftItem(item.name);
      if (looked) fullItem = looked;
    } catch { /* use search result as fallback */ }
    setAddItemSelected(fullItem);
    setAddItemSearch('');
    setAddItemResults([]);
    setAddItemQty(1);
    setAddItemEnchantments([]);
    setAddItemVariant('');
    if (fullItem.possibleEnchantments?.length) {
      setAddItemEnchantName(fullItem.possibleEnchantments[0].name);
    } else {
      setAddItemEnchantName('');
    }
  };

  const handleAddItemSubmit = async () => {
    if (!addItemSelected || !id) return;
    setAddingItem(true);
    try {
      await addTargetItem(
        id,
        addItemSelected.name,
        addItemQty,
        addItemEnchantments.length > 0 ? addItemEnchantments : null,
        addItemVariant || null,
      );
      soundManager.playSound('craft');
      // Reset state
      setAddItemSelected(null);
      setAddItemSearch('');
      setAddItemQty(1);
      setAddItemEnchantments([]);
      setAddItemVariant('');
      setShowAddItem(false);
      // Reload the project to show new nodes
      await loadProject();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setAddingItem(false);
    }
  };

  const handleAddItemCancel = () => {
    setShowAddItem(false);
    setAddItemSelected(null);
    setAddItemSearch('');
    setAddItemResults([]);
    setAddItemQty(1);
    setAddItemEnchantments([]);
    setAddItemVariant('');
  };

  const handleGoHome = () => {
    soundManager.playSound('back');
    navigate('/dashboard');
  };

  const handleRefresh = () => {
    soundManager.playSound('button');
    loadProject();
  };

  const rootNodes = nodes.filter(n => n.parent_id === null);
  const getChildren = (parentId: string) => nodes.filter(n => n.parent_id === parentId);

  // Per-root helpers (for multi-item projects)
  const getRootItemChildren = (root: CraftingNode) => getChildren(root.id).filter(c => c.item_name !== 'enchanted_book');
  const getRootBookChildren = (root: CraftingNode) => getChildren(root.id).filter(c => c.item_name === 'enchanted_book');
  const enchantedRoots = rootNodes.filter(r => Array.isArray(r.enchantments) && r.enchantments.length > 0);

  const ItemIcon = ({ node }: { node: CraftingNode }) => {
    const status = getNodeStatus(node);

    return (
      <div className="relative w-6 h-6 flex-shrink-0 flex items-center justify-center">
        <ItemIconWithFallback
          itemName={node.item_name}
          displayName={node.display_name}
          isBlock={node.is_block}
        />

        {/* Small status indicator overlay */}
        <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-black/50 ${status === 'complete' ? 'bg-emerald-500' :
          status === 'blocked' ? 'bg-red-500' : 'bg-yellow-500'
          }`} />
      </div>
    );
  };

  const nodeClass = (node: CraftingNode) => {
    const s = getNodeStatus(node);
    if (s === 'complete') return 'node-complete';
    if (s === 'blocked') return 'node-blocked';
    return 'node-pending';
  };

  const renderNodeTree = (
    node: CraftingNode,
    depth: number = 0,
    isLast: boolean = true,
    prefix: string = '',
    childrenOverride?: CraftingNode[] | null
  ): React.ReactNode => {
    const children = childrenOverride !== undefined && childrenOverride !== null
      ? childrenOverride : getChildren(node.id);
    const isComplete = node.collected_qty >= node.required_qty;
    const isContributing = contributing === node.id;
    const connector = depth === 0 ? '' : isLast ? '└── ' : '├── ';
    const childPrefix = depth === 0 ? '' : prefix + (isLast ? '    ' : '│   ');

    return (
      <div key={node.id}>
        <div className="flex items-center gap-1">
          {depth > 0 && (
            <span className="text-muted-foreground/40 font-mono text-xs whitespace-pre select-none flex-shrink-0">
              {prefix}{connector}
            </span>
          )}
          <div className={`flex-1 flex items-center justify-between px-3 py-2 rounded-xl mb-0.5 ${nodeClass(node)}`}>
            <div className="flex items-center gap-2 min-w-0">
              <ItemIcon node={node} />
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span
                  className={`font-semibold truncate cursor-pointer hover:text-primary hover:underline underline-offset-2 transition-colors ${depth === 0 ? 'text-base' : 'text-sm'}`}
                  onClick={(e) => { e.stopPropagation(); setDetailItemName(node.item_name); setShowItemDetail(true); }}
                  title="Click for item details"
                >
                  {depth === 0 && node.enchantments?.length
                    ? `${node.display_name} (${node.enchantments.map(e => `${e.name.replace(/_/g, ' ')} ${e.level}`).join(', ')})`
                    : node.display_name}
                </span>
                <span className="text-muted-foreground text-xs">
                  {node.collected_qty}/{node.required_qty}
                </span>

                {/* Enchantment Display/Edit in Tree */}
                {Array.isArray(node.enchantments) && node.enchantments.length > 0 && editingEnchantments !== node.id && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Sparkles className="w-3 h-3 text-purple-400" />
                    {node.enchantments.map((en: any, i: number) => {
                      const minXp = getMinXpLevel(en.name, en.level);
                      const myLevel = user?.minecraft_level ?? 0;
                      const canDo = minXp !== null ? myLevel >= minXp : true;
                      const bestMember = !canDo ? getBestMemberForEnchantment(en.name, en.level) : null;
                      const bestName = bestMember ? ((bestMember.profiles as any)?.full_name || (bestMember.profiles as any)?.email || 'User') : null;

                      return (
                        <button
                          key={`${en.name}-${i}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setEnchantGridItem(node.item_name);
                            setEnchantGridEnchants((node.enchantments || []).map((e: any) => ({ name: e.name, level: e.level })));
                            setShowEnchantGrid(true);
                            soundManager.playSound('button');
                          }}
                          className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium inline-flex items-center gap-1 cursor-pointer transition-all hover:scale-105 ${canDo
                            ? 'bg-purple-500/15 text-purple-400 border border-purple-500/20 hover:bg-purple-500/25'
                            : 'bg-amber-500/15 text-amber-400 border border-amber-500/20 hover:bg-amber-500/25'
                            }`}
                          title={minXp !== null
                            ? canDo
                              ? `${en.name.replace(/_/g, ' ')} ${en.level} — Requires Lv ${minXp} (you: Lv ${myLevel}) ✓ · Click for details`
                              : `${en.name.replace(/_/g, ' ')} ${en.level} — Requires Lv ${minXp} (you: Lv ${myLevel}) ✗${bestName ? ` — ${bestName} can do it` : ''} · Click for details`
                            : `${en.name.replace(/_/g, ' ')} ${en.level} · Click for details`
                          }
                        >
                          {en.name.replace(/_/g, ' ')} {en.level}
                          {minXp !== null && (
                            <span className={`text-[9px] opacity-70 ${canDo ? '' : 'font-bold'}`}>
                              Lv{minXp}
                            </span>
                          )}
                          {!canDo && bestName && (
                            <span className="text-[9px] text-emerald-400/80">
                              → {bestName.split(' ')[0]}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    <button
                      onClick={() => handleStartEditEnchantments(node)}
                      className="text-purple-400/60 hover:text-purple-400 transition-colors ml-1"
                      title="Update levels"
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {/* Variant badge (potion type) */}
                {node.variant && (
                  <span className="text-[10px] bg-teal-500/15 text-teal-400 border border-teal-500/20 px-1.5 py-0.5 rounded-full font-medium">
                    🧪 {node.variant.replace(/_/g, ' ')}
                  </span>
                )}

                {/* Inline Editing */}
                {editingEnchantments === node.id && (
                  <div className="flex items-center gap-1.5 bg-purple-500/10 px-2 py-1 rounded-lg border border-purple-500/20">
                    {editEnchantmentLevels.map((en, i) => (
                      <span key={`${en.name}-${i}`} className="inline-flex items-center gap-1 text-[10px] text-purple-300 font-medium">
                        {en.name.replace(/_/g, ' ')}
                        <input
                          type="number" min={1} max={10}
                          value={en.level || ''}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const newLevels = [...editEnchantmentLevels];
                            newLevels[i] = { ...newLevels[i], level: raw === '' ? 0 : Math.min(10, parseInt(raw) || 0) };
                            setEditEnchantmentLevels(newLevels);
                          }}
                          onBlur={() => {
                            const newLevels = [...editEnchantmentLevels];
                            if (newLevels[i].level < 1) newLevels[i] = { ...newLevels[i], level: 1 };
                            setEditEnchantmentLevels(newLevels);
                          }}
                          className="w-7 h-4 text-center bg-purple-500/20 border border-purple-400/30 rounded text-purple-200"
                        />
                      </span>
                    ))}
                    <button onClick={() => handleSaveEnchantments(node.id)} disabled={savingEnchantments} className="text-emerald-400 hover:text-emerald-300">
                      {savingEnchantments ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                    </button>
                    <button onClick={handleCancelEditEnchantments} className="text-red-400 hover:text-red-300">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                )}

                {node.is_resource && (
                  <span className="text-xs badge-pending px-1.5 py-0.5 rounded-full">resource</span>
                )}
                {!node.is_resource && getChildren(node.id).length > 0 && (
                  <span className="text-xs bg-blue-500/15 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded-full">
                    {node.depth === 0 ? 'goal' : 'craftable'}
                  </span>
                )}
              </div>
            </div>
            <div className="flex-shrink-0 ml-2 flex items-center gap-1">
              {isComplete ? (
                <span className="text-xs text-emerald-400 font-semibold">✓ Done</span>
              ) : (
                <Button
                  size="sm" variant="outline"
                  disabled={!canContribute(node) || !!isContributing}
                  onClick={() => handleContribute(node.id, node.is_resource ? 'collected' : 'crafted')}
                  className="h-7 px-2.5 text-xs rounded-lg border-white/10 hover:border-primary/40 hover:text-primary"
                >
                  {isContributing
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : node.is_resource ? '📦 Collect' : '⚒ Craft'}
                </Button>
              )}
            </div>
          </div>
        </div>
        {children.map((c, i) => renderNodeTree(c, depth + 1, i === children.length - 1, childPrefix))}
      </div>
    );
  };

  return (
    <div className="min-h-screen mesh-bg text-foreground">

      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={handleGoHome} className="rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-primary/15 border border-primary/25 flex items-center justify-center text-xs">⛏</div>
              <h1 className="font-black text-base gradient-text-green">CraftChain</h1>
            </div>
            <span className="text-muted-foreground text-sm hidden sm:block">/ {project.name}</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleRefresh} className="text-muted-foreground hover:text-foreground rounded-xl gap-1.5">
            <RefreshCw className="w-4 h-4" /> <span className="hidden sm:inline text-sm">Refresh</span>
          </Button>
        </div>
      </header>

      {/* Project Info Banner */}
      <div className="max-w-7xl mx-auto px-6 mt-6">
        <div className="glass-strong rounded-2xl border border-white/5 p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-black text-foreground leading-tight">{project.name}</h2>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{project.description}</p>
              )}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
                  {rootNodes.length} target{rootNodes.length !== 1 ? 's' : ''}
                </span>
                <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
                  {nodes.length} nodes
                </span>
                <span className="text-xs text-muted-foreground bg-white/5 px-2.5 py-1 rounded-full">
                  {members.length} member{members.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
            <div className="flex-shrink-0 w-28">
              <div className="text-right">
                <span className={`text-2xl font-black ${progressPct >= 100 ? 'text-emerald-400' : 'text-primary'}`}>
                  {Math.round(progressPct)}%
                </span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">complete</p>
              </div>
              <Progress value={progressPct} className="h-1.5 mt-2 rounded-full" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottleneck banner */}
      {
        topBottleneck && (
          <div className="mx-6 mt-4 flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
            <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />
            <span className="text-sm">
              <strong className="text-red-400">{topBottleneck.display_name}</strong>
              {' '}is blocking {topBottleneck.blocked_ancestors} item{topBottleneck.blocked_ancestors > 1 ? 's' : ''} — needs {topBottleneck.remaining_qty} more
            </span>
          </div>
        )
      }

      {/* Enchantment Summary Panel (all enchanted roots) */}
      {enchantedRoots.map(eRoot => (
        <div key={eRoot.id} className="mx-6 mt-4 p-5 glass-strong border border-purple-500/20 rounded-2xl">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <Sparkles className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">✨ Enchantment Plan</h2>
                <p className="text-xs text-muted-foreground">Requirements for your {eRoot.display_name}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEnchantGridItem(eRoot.item_name);
                setEnchantGridEnchants((eRoot.enchantments || []).map((e: any) => ({ name: e.name, level: e.level })));
                setShowEnchantGrid(true);
                soundManager.playSound('button');
              }}
              className="rounded-xl border-purple-500/20 hover:border-purple-500/40 text-purple-400 hover:text-purple-300 gap-1.5 h-8 px-3 text-xs"
            >
              <BookOpen className="w-3.5 h-3.5" /> View All Enchantments
            </Button>
          </div>
          <div className="flex flex-wrap gap-3">
            {(eRoot.enchantments || []).map((en: any, i: number) => (
              <button
                key={i}
                onClick={() => {
                  setEnchantGridItem(eRoot.item_name);
                  setEnchantGridEnchants((eRoot.enchantments || []).map((e: any) => ({ name: e.name, level: e.level })));
                  setShowEnchantGrid(true);
                  soundManager.playSound('button');
                }}
                className="bg-purple-500/5 border border-purple-500/10 px-4 py-3 rounded-xl flex items-center gap-3 hover:bg-purple-500/10 hover:border-purple-500/20 transition-all cursor-pointer"
              >
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-300 font-mono text-sm">
                  {toRoman(en.level)}
                </div>
                <span className="text-sm font-semibold text-purple-200">{en.name.replace(/_/g, ' ')}</span>
              </button>
            ))}
          </div>
        </div>
      ))}

      {
        error && (
          <div className="mx-6 mt-4 flex items-center justify-between p-4 rounded-xl bg-destructive/10 border border-destructive/20">
            <span className="text-destructive text-sm">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => setError('')} className="rounded-lg text-destructive hover:bg-destructive/10">✕</Button>
          </div>
        )
      }

      <main className="max-w-7xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Crafting Tree ───────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <Layers className="w-4 h-4 text-primary" />
                <h2 className="font-bold text-lg text-foreground">Crafting Dependencies</h2>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground bg-white/5 px-3 py-1 rounded-full">{nodes.length} nodes total</span>
                {!showAddItem && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { setShowAddItem(true); soundManager.playSound('button'); }}
                    className="rounded-xl border-white/10 hover:border-primary/40 hover:text-primary gap-1.5 h-7 px-3 text-xs"
                  >
                    <Plus className="w-3 h-3" /> Add Item
                  </Button>
                )}
              </div>
            </div>

            {/* ── Inline Add Item form ─────────────────────── */}
            {showAddItem && (
              <div className="mb-6 p-4 rounded-xl bg-primary/5 border border-primary/15 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Add Target Item</span>
                  </div>
                  <button onClick={handleAddItemCancel} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {!addItemSelected ? (
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50" />
                    <Input
                      value={addItemSearch}
                      onChange={e => setAddItemSearch(e.target.value)}
                      placeholder="Search for a Minecraft item…"
                      className="pl-9 bg-secondary/60 border-white/8 rounded-xl h-9 focus:border-primary/50"
                      autoFocus
                    />
                    {addItemSearching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-primary" />}

                    {addItemResults.length > 0 && (
                      <div className="absolute z-20 mt-1 w-full bg-[#141418] border border-white/10 rounded-xl shadow-xl max-h-48 overflow-y-auto">
                        {addItemResults.map(item => (
                          <button
                            key={item.name}
                            onClick={() => handleAddItemSelect(item)}
                            className="w-full text-left px-4 py-2.5 hover:bg-primary/10 transition-colors flex items-center gap-3 border-b border-white/5 last:border-0"
                          >
                            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                              <img
                                src={getMinecraftAssetUrl(item.name)}
                                alt={item.displayName}
                                className="w-6 h-6 object-contain pixelated"
                                onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '🎯'; }}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">{item.displayName}</p>
                              <p className="text-[10px] text-muted-foreground">{item.name}</p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {/* Selected item */}
                    <div className="flex items-center justify-between p-3 rounded-xl bg-primary/10 border border-primary/20">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0">
                          <img
                            src={getMinecraftAssetUrl(addItemSelected.name)}
                            alt={addItemSelected.displayName}
                            className="w-8 h-8 object-contain pixelated"
                            onError={(e) => { (e.target as HTMLImageElement).parentElement!.innerHTML = '🎯'; }}
                          />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">{addItemSelected.displayName}</p>
                          <p className="text-[10px] text-muted-foreground">{addItemSelected.name}</p>
                        </div>
                      </div>
                      <button onClick={() => setAddItemSelected(null)} className="text-muted-foreground/50 hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    {/* Quantity */}
                    <div className="flex items-center gap-3">
                      <label className="text-xs text-muted-foreground font-medium w-16">Qty</label>
                      <Input
                        type="number"
                        min={1}
                        max={9999}
                        value={addItemQty}
                        onChange={e => setAddItemQty(Math.max(1, Number(e.target.value)))}
                        className="bg-secondary/60 border-white/8 rounded-xl h-8 w-24 text-sm"
                      />
                    </div>

                    {/* Variant selection (potions, splash potions, etc.) */}
                    {addItemSelected.possibleVariants && addItemSelected.possibleVariants.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          🧪 Potion Type
                        </p>
                        <select
                          value={addItemVariant}
                          onChange={e => setAddItemVariant(e.target.value)}
                          className="w-full bg-secondary/60 border border-white/8 rounded-lg px-2 py-1.5 text-xs text-foreground"
                        >
                          <option value="">Select a type…</option>
                          <optgroup label="Base Potions">
                            {addItemSelected.possibleVariants.filter(v => !v.name.endsWith('_2')).map(v => (
                              <option key={v.name} value={v.name}>{v.displayName}</option>
                            ))}
                          </optgroup>
                          <optgroup label="Level II (add Glowstone Dust)">
                            {addItemSelected.possibleVariants.filter(v => v.name.endsWith('_2')).map(v => (
                              <option key={v.name} value={v.name}>{v.displayName}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    )}

                    {/* Enchantments (if applicable) */}
                    {addItemSelected.possibleEnchantments && addItemSelected.possibleEnchantments.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Sparkles className="w-3 h-3 text-purple-400" /> Enchantments (optional)
                        </p>
                        <div className="flex gap-2 flex-wrap">
                          <select
                            value={addItemEnchantName}
                            onChange={e => setAddItemEnchantName(e.target.value)}
                            className="bg-secondary/60 border border-white/8 rounded-lg px-2 py-1 text-xs text-foreground flex-1 min-w-[120px]"
                          >
                            {addItemSelected.possibleEnchantments.map(e => (
                              <option key={e.name} value={e.name}>
                                {e.name.replace(/_/g, ' ')} (max {e.level})
                              </option>
                            ))}
                          </select>
                          <Input
                            type="number"
                            min={1}
                            max={addItemSelected.possibleEnchantments.find(e => e.name === addItemEnchantName)?.level || 5}
                            value={addItemEnchantLevel || ''}
                            onChange={e => {
                              const raw = e.target.value;
                              setAddItemEnchantLevel(raw === '' ? 0 : Math.min(addItemSelected.possibleEnchantments?.find(en => en.name === addItemEnchantName)?.level || 5, parseInt(raw) || 0));
                            }}
                            onBlur={() => { if (addItemEnchantLevel < 1) setAddItemEnchantLevel(1); }}
                            className="bg-secondary/60 border-white/8 rounded-lg h-7 w-16 text-xs"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              if (addItemEnchantName && !addItemEnchantments.find(e => e.name === addItemEnchantName)) {
                                setAddItemEnchantments([...addItemEnchantments, { name: addItemEnchantName, level: addItemEnchantLevel }]);
                              }
                            }}
                            className="rounded-lg h-7 px-2 text-xs border-white/10"
                          >
                            <Plus className="w-3 h-3" />
                          </Button>
                        </div>
                        {addItemEnchantments.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {addItemEnchantments.map((e, i) => (
                              <span key={i} className="inline-flex items-center gap-1 bg-purple-500/10 border border-purple-500/20 text-purple-200 text-[10px] px-2 py-0.5 rounded-full">
                                {e.name.replace(/_/g, ' ')} {toRoman(e.level)}
                                <button onClick={() => setAddItemEnchantments(addItemEnchantments.filter((_, j) => j !== i))} className="hover:text-red-400">
                                  <X className="w-2.5 h-2.5" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Submit */}
                    <div className="flex justify-end gap-2 pt-1">
                      <Button variant="ghost" size="sm" onClick={handleAddItemCancel} className="rounded-xl h-8 px-3 text-xs">
                        Cancel
                      </Button>
                      <Button
                        size="sm"
                        onClick={handleAddItemSubmit}
                        disabled={addingItem}
                        className="rounded-xl h-8 px-4 text-xs gap-1.5"
                      >
                        {addingItem ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                        {addingItem ? 'Adding…' : 'Add to Project'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Render a tree per root node (multi-item support) */}
            {rootNodes.map((rn, ri) => {
              const itemCh = getRootItemChildren(rn);
              const bookCh = getRootBookChildren(rn);
              return (
                <div key={rn.id} className={ri > 0 ? 'mt-8 pt-6 border-t border-white/5' : ''}>
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mb-3">
                    {rootNodes.length > 1 ? `${rn.display_name} Recipe` : 'Main Recipe'}
                  </p>
                  <div className="space-y-0.5">
                    {renderNodeTree(rn, 0, bookCh.length === 0 && itemCh.length === 0, '', itemCh)}
                  </div>

                  {/* Book section for this root */}
                  {bookCh.length > 0 && (
                    <>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] mt-6 mb-3">Enchanted Book components</p>
                      <div className="space-y-0.5">
                        {bookCh.map((bookNode, i) => (
                          <div key={bookNode.id}>
                            {renderNodeTree(bookNode, 0, i === bookCh.length - 1)}
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Enchantment Book Guide (all enchanted roots) */}
          {enchantedRoots.length > 0 && (
            <div className="glass-strong rounded-2xl border border-white/5 p-6">
              <div className="flex items-center gap-2 mb-6">
                <BookOpen className="w-5 h-5 text-amber-400" />
                <h2 className="font-bold text-lg text-foreground">Enchanted Book Guide</h2>
              </div>

              <div className="grid gap-4">
                {enchantedRoots.flatMap(eRoot => getBookRequirements(eRoot.enchantments || []).map(req => ({ ...req, _rootId: eRoot.id }))).map((req) => {
                  const isExpanded = expandedBook === req.enchantmentName;
                  const strategy = getBestStrategy(req.enchantmentName, req.targetLevel);

                  return (
                    <div key={`${(req as any)._rootId}-${req.enchantmentName}`} className="glass rounded-xl border border-white/5 overflow-hidden">
                      <button
                        onClick={() => setExpandedBook(isExpanded ? null : req.enchantmentName)}
                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors text-left"
                      >
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-xl">📕</div>
                          <div>
                            <p className="font-bold text-foreground">{req.displayName} {toRoman(req.targetLevel)}</p>
                            <p className="text-xs text-muted-foreground">{req.booksNeeded} level-1 books needed</p>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </button>

                      {isExpanded && (
                        <div className="px-5 pb-5 pt-1 space-y-5 border-t border-white/5 mt-1">
                          <div className="p-3 rounded-xl bg-amber-400/5 border border-amber-400/20 flex gap-3">
                            <Sparkles className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-200/80 leading-relaxed font-medium">{strategy}</p>
                          </div>

                          {req.anvilSteps.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Anvil Combining Progress</p>
                              <div className="space-y-2">
                                {req.anvilSteps.map(step => (
                                  <div key={step.step} className="flex items-center gap-3 text-sm px-3 py-2 rounded-lg bg-white/5">
                                    <span className="text-muted-foreground font-mono text-xs">#{step.step}</span>
                                    <span className="flex-1 font-medium">{step.count}× [{toRoman(step.inputLevel)} + {toRoman(step.inputLevel)}]</span>
                                    <ArrowLeft className="w-3 h-3 text-muted-foreground rotate-180" />
                                    <span className="text-purple-400 font-bold">{step.count}× {toRoman(step.outputLevel)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          <div>
                            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-3">Where to hunt</p>
                            <div className="grid sm:grid-cols-2 gap-2">
                              {req.sources.map((src, i) => (
                                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-secondary/40 border border-white/5">
                                  <span className="text-lg">{src.icon}</span>
                                  <div>
                                    <p className="text-xs font-bold text-foreground">{src.method}</p>
                                    <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{src.description}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Collaboration */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-4 flex items-center gap-2">
              <Users className="w-4 h-4" /> Team & Roles
            </h2>

            {/* Invite button + success message */}
            <div className="flex items-center gap-2 flex-wrap">
              {!showInviteForm && (
                <Button
                  onClick={() => { setShowInviteForm(true); setCollabError(''); setCollabSuccess(''); soundManager.playSound('button'); }}
                  variant="outline"
                  className="rounded-xl border-white/10 hover:border-primary/40 hover:text-primary gap-1.5 px-4 h-10"
                >
                  <UserPlus className="w-4 h-4" /> Invite Member
                </Button>
              )}
              {collabSuccess && (
                <span className="text-emerald-400 text-sm flex items-center gap-1.5 animate-in fade-in">
                  <CheckCircle className="w-3.5 h-3.5" /> {collabSuccess}
                </span>
              )}
            </div>

            {/* Invite Dialog */}
            {showInviteForm && (
              <div className="mt-3 p-4 rounded-xl bg-primary/5 border border-primary/15 space-y-3 animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <UserPlus className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">Send Invite</span>
                  </div>
                  <button onClick={() => { setShowInviteForm(false); setCollabError(''); }} className="text-muted-foreground/60 hover:text-foreground transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="space-y-2.5">
                  <Input
                    value={collabEmail}
                    onChange={e => setCollabEmail(e.target.value)}
                    placeholder="Enter email to invite…"
                    className="bg-secondary/60 border-white/8 rounded-xl h-9 focus:border-primary/50"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Role</label>
                      <select
                        value={collabRole}
                        onChange={e => setCollabRole(e.target.value as MemberRole)}
                        className="w-full bg-secondary/60 border border-white/8 rounded-xl px-3 py-2 text-sm text-foreground h-9"
                      >
                        <option value="member">General Member</option>
                        <option value="miner">⛏ Miner</option>
                        <option value="builder">🔨 Builder</option>
                        <option value="planner">🧠 Planner</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 block">Message (optional)</label>
                    <textarea
                      value={collabMessage}
                      onChange={e => setCollabMessage(e.target.value)}
                      placeholder="Hey! Want to help me build this?"
                      rows={2}
                      maxLength={200}
                      className="w-full bg-secondary/60 border border-white/8 rounded-xl px-3 py-2 text-sm text-foreground resize-none focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
                    />
                  </div>
                </div>

                {collabError && <p className="text-destructive text-sm">{collabError}</p>}

                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" onClick={() => { setShowInviteForm(false); setCollabError(''); }} className="rounded-xl h-8 px-3 text-xs">
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleSendInvite}
                    disabled={inviteSending || !collabEmail.trim()}
                    className="rounded-xl h-8 px-4 text-xs gap-1.5"
                  >
                    {inviteSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />}
                    {inviteSending ? 'Sending…' : 'Send Invite'}
                  </Button>
                </div>
              </div>
            )}

            {/* Member list with role management */}
            {members.length > 0 && (
              <div className="mt-5 space-y-2">
                {members.map(m => {
                  const isOwner = m.role === 'owner';
                  const isProjectOwner = project.owner_id === user?.id;
                  const memberName = (m.profiles as any)?.full_name || (m.profiles as any)?.email || 'User';
                  const lastActive = (m.profiles as any)?.last_active_at;
                  const memberLevel = (m.profiles as any)?.minecraft_level ?? 0;
                  const isCurrentUser = m.user_id === user?.id;
                  const isActive = isCurrentUser || (lastActive && (new Date().getTime() - new Date(lastActive).getTime()) < 5 * 60 * 1000);
                  const roleIcon = m.role === 'miner' ? <HardHat className="w-3 h-3" /> :
                    m.role === 'builder' ? <Hammer className="w-3 h-3" /> :
                      m.role === 'planner' ? <BrainCircuit className="w-3 h-3" /> :
                        m.role === 'owner' ? <Sparkles className="w-3 h-3" /> : null;
                  const roleColor = m.role === 'miner' ? 'text-amber-400' :
                    m.role === 'builder' ? 'text-blue-400' :
                      m.role === 'planner' ? 'text-purple-400' :
                        m.role === 'owner' ? 'text-emerald-400' : 'text-muted-foreground';

                  return (
                    <div key={m.user_id} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <div className="relative">
                          <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/25 flex items-center justify-center text-xs text-primary font-bold">
                            {memberName[0].toUpperCase()}
                          </div>
                          <div className={`absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full border border-[#0a0a0b] ${isActive ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-zinc-500'}`} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-medium text-foreground leading-tight">
                              {memberName}
                              {isCurrentUser && <span className="text-[10px] text-primary/60 ml-1.5 font-normal">(You)</span>}
                            </p>
                            {/* XP Level badge */}
                            <span
                              className="inline-flex items-center gap-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/15"
                              title={`Minecraft XP Level: ${memberLevel}`}
                            >
                              <Shield className="w-2.5 h-2.5" />
                              Lv {memberLevel}
                            </span>
                          </div>
                          <div className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider ${roleColor}`}>
                            {roleIcon}
                            <span>{m.role}</span>
                            <span className="text-muted-foreground/40 font-normal normal-case">
                              {isActive ? '• Active now' : lastActive ? `• ${new Date(lastActive).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : ''}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Inline level editor for current user */}
                        {isCurrentUser && (
                          <div className="flex items-center gap-1">
                            <label className="text-[9px] text-muted-foreground/50">Lv</label>
                            <input
                              type="number"
                              min={0}
                              max={32767}
                              defaultValue={memberLevel}
                              onBlur={async (e) => {
                                const newLevel = Math.max(0, parseInt(e.target.value) || 0);
                                if (newLevel !== memberLevel) {
                                  try {
                                    await updateProfile({ minecraft_level: newLevel });
                                    await loadProject();
                                    toast({ title: 'Level Updated', description: `Your level is now ${newLevel}` });
                                  } catch (err) {
                                    toast({ title: 'Error', description: (err as Error).message, variant: 'destructive' });
                                  }
                                }
                              }}
                              className="w-12 h-6 text-center text-[11px] bg-secondary/60 border border-white/8 rounded-lg text-foreground"
                            />
                          </div>
                        )}
                        {/* Role dropdown: project owner can change anyone's role including their own */}
                        {(isProjectOwner || isCurrentUser) && (
                          <select
                            value={m.role}
                            onChange={e => handleChangeRole(m.user_id, e.target.value as MemberRole)}
                            className="bg-secondary/60 border border-white/8 rounded-lg px-2 py-1 text-[11px] text-foreground cursor-pointer"
                          >
                            <option value="miner">⛏ Miner</option>
                            <option value="builder">🔨 Builder</option>
                            <option value="planner">🧠 Planner</option>
                            <option value="member">General</option>
                          </select>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Your Tasks (role-based suggestions) */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-1 flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Your Tasks
            </h2>
            <p className="text-[10px] text-muted-foreground mb-4">
              Based on your role: <span className="font-bold text-foreground capitalize">{myRole === 'owner' ? 'General (pick a role above!)' : myRole}</span>
            </p>
            {(myRole === 'owner' || myRole === 'member') && (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/5 border border-amber-500/15 text-xs text-amber-300/80">
                💡 Pick a specialization (Miner, Builder, or Planner) in the Team section above to get focused tasks!
              </div>
            )}
            {suggestedTasks.length > 0 ? (
              <div className="space-y-2">
                {suggestedTasks.slice(0, 8).map(task => {
                  const priorityColor = task.priority === 'high' ? 'border-red-500/25 bg-red-500/5' :
                    task.priority === 'medium' ? 'border-amber-500/25 bg-amber-500/5' :
                      'border-white/5 bg-white/[0.02]';
                  const priorityDot = task.priority === 'high' ? 'bg-red-400' :
                    task.priority === 'medium' ? 'bg-amber-400' : 'bg-white/30';
                  const actionIcon = task.action === 'collect' ? '📦' :
                    task.action === 'craft' ? '⚒' :
                      task.action === 'plan' ? '📋' : '🔍';

                  return (
                    <div key={task.id} className={`p-3 rounded-xl border ${priorityColor} transition-colors`}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-sm mt-0.5">{actionIcon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <div className={`w-1.5 h-1.5 rounded-full ${priorityDot}`} />
                            <span className="text-xs font-bold text-foreground">{task.displayName}</span>
                            <span className="text-[10px] text-muted-foreground">×{task.qty}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{task.reason}</p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 text-center py-4">No tasks to show right now</p>
            )}
          </div>

          {/* Plan Versioning */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest flex items-center gap-2">
                <History className="w-4 h-4 text-primary" /> Plan Versions
              </h2>
              <span className="text-[10px] text-muted-foreground bg-white/5 px-2 py-0.5 rounded-full">
                v{(project as any).plan_version || 1}
              </span>
            </div>

            {/* Save snapshot */}
            <div className="flex gap-2 mb-4">
              <Input
                value={snapshotLabel}
                onChange={e => setSnapshotLabel(e.target.value)}
                placeholder="Snapshot label (optional)…"
                className="bg-secondary/60 border-white/8 rounded-xl h-9 text-sm focus:border-primary/50"
              />
              <Button
                onClick={handleSaveSnapshot}
                disabled={savingSnapshot}
                variant="outline"
                className="rounded-xl border-white/10 hover:border-primary/40 hover:text-primary gap-1.5 px-3 h-9 text-xs"
              >
                {savingSnapshot ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                Save
              </Button>
            </div>

            {/* Snapshot list */}
            {snapshots.length > 0 ? (
              <div>
                <button
                  onClick={() => setShowVersions(!showVersions)}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-2"
                >
                  {showVersions ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {snapshots.length} saved version{snapshots.length !== 1 ? 's' : ''}
                </button>

                {showVersions && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {snapshots.map(snap => (
                      <div key={snap.id} className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            v{snap.version} — {snap.label}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(snap.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                        {project.owner_id === user?.id && (
                          <Button
                            size="sm" variant="ghost"
                            onClick={() => handleRestoreSnapshot(snap.version)}
                            disabled={restoringVersion === snap.version}
                            className="h-7 px-2.5 text-[10px] rounded-lg text-muted-foreground hover:text-primary"
                          >
                            {restoringVersion === snap.version
                              ? <Loader2 className="w-3 h-3 animate-spin" />
                              : 'Restore'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground/50 text-center py-2">No saved versions yet</p>
            )}
          </div>
        </div>

        {/* ── Right: Progress + Activity ────────────────────── */}
        <div className="space-y-6">

          {/* Progress Card */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-6">Progress</h2>

            <div className="flex justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(222 35% 12%)" strokeWidth="8" />
                  <circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke="hsl(152 80% 48%)" strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${progressPct * 2.639} 263.9`}
                    className="transition-all duration-1000 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black gradient-text-green">{progressPct}%</span>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-tighter">Done</span>
                </div>
              </div>
            </div>

            <Progress value={progressPct} className="h-1.5 bg-secondary [&>div]:bg-primary rounded-full mb-4" />

            <div className="space-y-3">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-2"><CheckCircle className="w-3.5 h-3.5 text-emerald-400" /> Tasks Complete</span>
                <span className="font-bold">{progress?.completed_nodes} / {nodes.length}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground flex items-center gap-2"><Layers className="w-3.5 h-3.5 text-blue-400" /> Resources Gathers</span>
                <span className="font-bold">{progress?.completed_resources} / {progress?.total_resources}</span>
              </div>
            </div>
          </div>

          {/* Bottleneck List */}
          {bottlenecks.length > 0 && (
            <div className="glass-strong rounded-2xl border border-white/5 p-6">
              <h2 className="font-semibold text-[10px] text-muted-foreground uppercase tracking-[0.2em] mb-4">Critical Blockers</h2>
              <div className="space-y-3">
                {bottlenecks.slice(0, 3).map(b => (
                  <div key={b.node_id} className="p-3 rounded-xl bg-red-500/5 border border-red-500/10">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs font-bold text-red-200">{b.display_name}</span>
                      <span className="text-[10px] font-mono text-red-400">-{b.remaining_qty} units</span>
                    </div>
                    <div className="w-full bg-red-500/10 h-1 rounded-full overflow-hidden">
                      <div className="bg-red-500 h-full" style={{ width: `${(b.collected_qty / b.required_qty) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Feed */}
          <div className="glass-strong rounded-2xl border border-white/5 p-6">
            <h2 className="font-semibold text-sm text-muted-foreground uppercase tracking-widest mb-6 flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" /> Active Feed
            </h2>
            {contributions.length === 0 ? (
              <div className="text-center py-10 opacity-40">
                <p className="text-sm">No recent signals</p>
              </div>
            ) : (
              <div className="space-y-6 relative before:absolute before:left-[13px] before:top-2 before:bottom-2 before:w-px before:bg-white/5">
                {contributions.slice(0, 15).map(c => {
                  const isMilestone = c.action === 'milestone';
                  const isRestored = c.action === 'restored';
                  const initials = ((c.profiles as any)?.full_name || (c.profiles as any)?.email || 'U')[0].toUpperCase();

                  if (isMilestone) {
                    return (
                      <div key={c.id} className="flex gap-4 relative group">
                        <div className="w-7 h-7 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center z-10 animate-pulse">
                          <Trophy className="w-3.5 h-3.5 text-emerald-400" />
                        </div>
                        <div className="flex-1 min-w-0 bg-emerald-500/5 border border-emerald-500/10 rounded-xl p-3 transform transition-all group-hover:scale-[1.02] group-hover:bg-emerald-500/10">
                          <p className="text-xs leading-normal">
                            <span className="font-black text-emerald-400 uppercase tracking-wider mr-2">Milestone</span>
                            <span className="text-foreground">
                              The team completed <span className="text-emerald-400 font-bold">{(c.crafting_nodes as any)?.display_name}</span>!
                            </span>
                          </p>
                          <p className="text-[10px] text-emerald-500/50 mt-1 uppercase tracking-tighter">
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (isRestored) {
                    return (
                      <div key={c.id} className="flex gap-4 relative">
                        <div className="w-7 h-7 rounded-full bg-amber-900/50 border border-white/10 flex items-center justify-center text-[10px] font-black text-amber-400 z-10">
                          ↺
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs leading-normal">
                            <span className="font-bold text-amber-400">
                              {(c.profiles as any)?.full_name || (c.profiles as any)?.email}
                            </span>
                            <span className="text-muted-foreground"> restored plan to </span>
                            <span className="text-amber-400 font-bold">Version {c.quantity}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground/50 mt-1 uppercase tracking-tighter">
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  if (c.action === 'saved') {
                    return (
                      <div key={c.id} className="flex gap-4 relative group">
                        <div className="w-7 h-7 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center z-10">
                          <Save className="w-3.5 h-3.5 text-blue-400" />
                        </div>
                        <div className="flex-1 min-w-0 bg-blue-500/5 border border-blue-500/10 rounded-xl p-3 transition-all group-hover:bg-blue-500/10">
                          <p className="text-xs leading-normal">
                            <span className="font-bold text-blue-400">
                              {(c.profiles as any)?.full_name || (c.profiles as any)?.email}
                            </span>
                            <span className="text-muted-foreground"> saved plan as </span>
                            <span className="text-blue-400 font-bold">Version {c.quantity}</span>
                          </p>
                          <p className="text-[10px] text-blue-500/50 mt-1 uppercase tracking-tighter">
                            {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={c.id} className="flex gap-4 relative">
                      <div className="w-7 h-7 rounded-full bg-secondary border border-white/10 flex items-center justify-center text-[10px] font-black text-primary z-10">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs leading-normal">
                          <span className="font-bold text-foreground">
                            {(c.profiles as any)?.full_name || (c.profiles as any)?.email}
                          </span>
                          <span className="text-muted-foreground"> {c.action} </span>
                          <span className="text-primary font-bold">
                            {(c.crafting_nodes as any)?.display_name || 'item'}
                          </span>
                          <span className="text-muted-foreground"> ×{c.quantity}</span>
                        </p>
                        <p className="text-[10px] text-muted-foreground/50 mt-1 uppercase tracking-tighter">
                          {new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Item Detail Modal */}
      <ItemDetailModal
        itemName={detailItemName}
        open={showItemDetail}
        onClose={() => { setShowItemDetail(false); setDetailItemName(null); }}
      />

      {/* Enchantment Grid Modal */}
      <EnchantmentGridModal
        open={showEnchantGrid}
        onClose={() => { setShowEnchantGrid(false); setEnchantGridItem(null); setEnchantGridEnchants([]); }}
        itemName={enchantGridItem}
        activeEnchantments={enchantGridEnchants}
      />
    </div>
  );
};

export default ProjectDetail;
