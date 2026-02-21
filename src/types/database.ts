export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            profiles: {
                Row: {
                    avatar_url: string | null
                    bio: string | null
                    created_at: string | null
                    email: string | null
                    full_name: string | null
                    id: string
                    updated_at: string | null
                }
                Insert: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    email?: string | null
                    full_name?: string | null
                    id: string
                    updated_at?: string | null
                }
                Update: {
                    avatar_url?: string | null
                    bio?: string | null
                    created_at?: string | null
                    email?: string | null
                    full_name?: string | null
                    id?: string
                    updated_at?: string | null
                }
                Relationships: []
            }
            projects: {
                Row: {
                    id: string
                    name: string
                    description: string | null
                    root_item_name: string
                    owner_id: string
                    status: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    description?: string | null
                    root_item_name: string
                    owner_id: string
                    status?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    description?: string | null
                    root_item_name?: string
                    owner_id?: string
                    status?: string
                    updated_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "projects_owner_id_fkey"
                        columns: ["owner_id"]
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            project_members: {
                Row: {
                    id: string
                    project_id: string
                    user_id: string
                    role: string
                    joined_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    user_id: string
                    role?: string
                    joined_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    user_id?: string
                    role?: string
                    joined_at?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "project_members_project_id_fkey"
                        columns: ["project_id"]
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "project_members_user_id_fkey"
                        columns: ["user_id"]
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            crafting_nodes: {
                Row: {
                    id: string
                    project_id: string
                    parent_id: string | null
                    item_name: string
                    display_name: string
                    required_qty: number
                    collected_qty: number
                    is_resource: boolean
                    depth: number
                    status: string
                    enchantments: Json | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    parent_id?: string | null
                    item_name: string
                    display_name: string
                    required_qty?: number
                    collected_qty?: number
                    is_resource?: boolean
                    depth?: number
                    status?: string
                    enchantments?: Json | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    parent_id?: string | null
                    item_name?: string
                    display_name?: string
                    required_qty?: number
                    collected_qty?: number
                    is_resource?: boolean
                    depth?: number
                    status?: string
                    enchantments?: Json | null
                }
                Relationships: [
                    {
                        foreignKeyName: "crafting_nodes_project_id_fkey"
                        columns: ["project_id"]
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "crafting_nodes_parent_id_fkey"
                        columns: ["parent_id"]
                        referencedRelation: "crafting_nodes"
                        referencedColumns: ["id"]
                    }
                ]
            }
            contributions: {
                Row: {
                    id: string
                    project_id: string
                    node_id: string
                    user_id: string
                    quantity: number
                    action: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    project_id: string
                    node_id: string
                    user_id: string
                    quantity?: number
                    action?: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    project_id?: string
                    node_id?: string
                    user_id?: string
                    quantity?: number
                    action?: string
                }
                Relationships: [
                    {
                        foreignKeyName: "contributions_project_id_fkey"
                        columns: ["project_id"]
                        referencedRelation: "projects"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "contributions_node_id_fkey"
                        columns: ["node_id"]
                        referencedRelation: "crafting_nodes"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "contributions_user_id_fkey"
                        columns: ["user_id"]
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {}
        Functions: {
            find_bottleneck: {
                Args: { p_project_id: string }
                Returns: {
                    node_id: string
                    item_name: string
                    display_name: string
                    required_qty: number
                    collected_qty: number
                    remaining_qty: number
                    blocked_ancestors: number
                }[]
            }
            get_project_progress: {
                Args: { p_project_id: string }
                Returns: {
                    total_nodes: number
                    completed_nodes: number
                    total_resources: number
                    completed_resources: number
                    progress_pct: number
                }[]
            }
            check_children_complete: {
                Args: { p_node_id: string }
                Returns: boolean
            }
        }
        Enums: {}
        CompositeTypes: {}
    }
}

// Helper type to extract table Row types
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row'];
export type TablesInsert<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert'];
export type TablesUpdate<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update'];
