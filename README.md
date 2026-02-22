# ⛏ CraftChain: The Ultimate Minecraft Production Platform

[![Deployment](https://img.shields.io/badge/Live%20Demo-Render-43c22d?style=for-the-badge&logo=render)](https://crafting-companion-1.onrender.com/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-181818?style=for-the-badge&logo=supabase&logoColor=3ECF8E)](https://supabase.io/)

**CraftChain** is a deep-tier project management and coordination suite for Minecraft players. It specializes in transforming complex crafting goals into actionable, real-time production schedules for servers and teams.

---

## 📺 Live Demo
**Website URL**: [https://crafting-companion-1.onrender.com/](https://crafting-companion-1.onrender.com/)

---

## � Complete Feature Catalog

### 📦 1. Crafting & Goal Management
*   **Multi-Item Goal Projects**: Create projects with dozens of final targets (e.g., "Full Netherite Kit", "Beacon Setup") in one dashboard.
*   **Recursive Dependency Engine**: Input any goal item, and the system automatically generates a multi-level tree of every raw resource and intermediate step required.
*   **Smart Quantity Tracking**: Real-time calculation of "Needed" vs "Gathered" as you update the plan.
*   **Target Variants**: Full support for item variants like Potions (Splash, Lingering) and tiered durations.
*   **Dynamic Metadata**: Fetches official Minecraft stats (stack sizes, block types) for every node.

### ✨ 2. The Master Enchantment Suite
*   **Master Enchantment Plan**: A central command center for all enchantments required across the entire project.
*   **Interactive Matrix UI**: A high-fidelity grid showing:
    *   **Applied**: Enchantments currently on your item.
    *   **Table Ability**: Which levels can be obtained via a standard level-30 Enchanting Table.
    *   **Trade/Loot Only**: Highlights "Treasure" enchantments like Mending or Swift Sneak.
*   **Anvil Math Engine**: Deep logic that calculates the precise path of combining books:
    *   Automatically determines how many Level I books are needed for a Level V output.
    *   Generates step-by-step combining guides (e.g., *Combine 2x [III+III] to get 1x [IV]*).
*   **Strategy Advisor**: Dynamic tooltips suggesting the best way to get specific enchantments (Villager Trading, Fishing, etc.).
*   **XP Level Requirements**: Real-time calculation of the minimum XP levels needed to perform specific crafts.

### 👥 3. Teamwork & Collaboration
*   **Team Role System**: Assign members to specialized roles:
    *   ⛏️ **Miner**: Prioritizes raw material gathering.
    *   🔨 **Builder**: Focuses on final item assembly.
    *   📜 **Planner**: Manages goals and snapshots.
    *   🧪 **Alchemist**: Specializes in brewing and potion chains.
*   **Real-Time Sync**: Powered by Supabase, every update is instantly visible to all teammates without refreshing.
*   **Interactive Leaderboard**: Competitive tracking of total units contributed per member (Gold/Silver/Bronze tiers).
*   **Project Invite System**: Send secure unique invites via email to onboard new teammates.
*   **Active Feed**: A live "Activity Log" showing every resource gathered, milestone reached, or snapshot created.

### � 4. Advanced Analytics & Tools
*   **Bottleneck Detection**: An algorithm that identifies the "Top Bottleneck"—the specific resource holding up the largest number of parent items.
*   **Progress Visualization**: Visual progress bars and percentage tracking for individual items and the overall project.
*   **Detailed Item Modals**: 
    *   **Crafting Matrix**: 3x3 grid visualization of recipes.
    *   **Smithing Table UI**: Visual layouts for armor trimming and netherite upgrades.
    *   **Brewing Stand UI**: Clear paths for potion brewing.
*   **Project Snapshots**: Version control for your plans. Save a "Snapshot" of the project state and restore it instantly if needed.

### 🎨 5. Immersive UI & Experience
*   **Minecraft Aesthetics**: High-quality dark-mode design with glassmorphism and custom pixel-themed icons.
*   **Official Assets**: Uses the [PrismarineJS](https://github.com/PrismarineJS) Minecraft-Assets for thousands of pixel-perfect item and block icons.
*   **Dynamic Sound Suite**: 
    *   Anvil clinks on enchantments.
    *   Level-up sounds on milestones.
    *   Crafting sounds when marking items as complete.
*   **High Performance Search**: Debounced, high-speed fuzzy search for 1,000+ Minecraft items.
*   **Glassmorphism Effects**: Modern polished look with vibrant purple and emerald emphasis.

---

## 🛠 Tech Stack

*   **Frontend**: React 18, Vite, TypeScript, Lucide Icons
*   **Styling**: Tailwind CSS + Shadcn/UI (Radix Primitives)
*   **Backend**: Node.js, Express 5 (Modern wildcard routing)
*   **Infrastructure**: Supabase (PostgreSQL + RLS + Realtime)
*   **Data APIs**: [minecraft-data](https://www.npmjs.com/package/minecraft-data)
*   **Hosting**: Railway (Auto-scaling & CD)

---

## 🏃 Installation & Setup

```bash
# Clone
git clone https://github.com/SaiDattu3607/crafting-companion.git
cd crafting-companion

# Install
npm install

# Run (Backend)
npm run server:dev

# Run (Frontend - Separate Terminal)
npm run dev
```

### Environment Variables (.env)
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
PORT=3001
```

---

## 🌟 The "Extra Mile" (Technical Achievements)
1.  **Recursive Flattener**: A custom algorithm that flattens deeply nested recipe JSONs into a flat dependencies table with correct quantity multipliers.
2.  **Anvil Strategy Generator**: A recursive combinatorics logic that determines the most efficient way to merge books based on level requirements.
3.  **Realtime Presence**: Leveraging Supabase realtime to show active contributions on the project dashboard without delay.

---

### Created by [Sai Dattu](https://github.com/SaiDattu3607)
