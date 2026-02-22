# ⛏ CraftChain: Minecraft Crafting Coordination Platform

CraftChain is a specialized project management and collaboration platform designed for Minecraft players to coordinate complex crafting goals, track resource gathering, and optimize their production chains.

---

## 📋 The Problem Statement
Minecraft crafting looks simple at first: grab some wood, make a table, build a pickaxe. But the deeper you go, the more it becomes a chain reaction of dependencies. One final goal often needs multiple intermediate items, raw resources, and teamwork to finish on time. In multiplayer worlds, the real challenge isn’t crafting—it’s **coordination**.

Most teams solve this by spamming messages like “who has iron?” or “did someone craft the blaze rods yet?”. It’s chaotic, unorganized, and often leads to wasted resources and time.

## 🎯 The Objective
**CraftChain** fixes the chaos by providing a Minecraft-themed dashboard where users can:
- **Plan** complex crafting projects (e.g., Beacons, Netherite Gear).
- **Visualize** full dependency trees for any item.
- **Collaborate** in real-time with teammates.
- **Identify Bottlenecks** that are holding up the project.

---

## 🚀 Key Features

### 1. Crafting Project System
- **Dynamic Goal Setting**: Create projects for any Minecraft item. The system automatically fetches and builds the entire recipe tree.
- **Multi-Target Support**: (Advanced) Add multiple final goals to a single project to manage a complex build site.
- **Detailed Metadata**: Track specific quantities, blocks, and items.

### 2. Dependency & Progress View
- **Interactive Tree Hierarchy**: View recipes in a structured tree format that updates as you go.
- **Status Indicators**: Instantly see what's **Gathered**, **Craftable**, or **Blocked** (unmet dependencies).
- **Smart Logic**: Prevents marking items as "Crafted" if you haven't gathered the required components yet.

### 3. Contribution & Collaboration
- **Real-time Tracking**: Mark resources as collected or items as crafted.
- **Member Roles**: Assign specific roles like **Miner**, **Builder**, **Planner**, or **Member** to organize the workforce.
- **Task Suggestions**: AI-driven task suggestions based on a user's role and current project needs.
- **Invite System**: Send secure invites to teammates via email to join specific projects.

### 4. Advanced Enchantment Management (Brownie Points+)
- **Enchantment Planning**: Add enchantments like *Sharpness V*, *Efficiency IV*, or *Mending* to your target items.
- **XP Level Requirements**: The system calculates the required XP levels based on Minecraft's table logic.
- **Anvil Combining Guide**: Generates a step-by-step anvil combining strategy (e.g., how many Level I books you need to reach Level V).
- **Member Capability**: Highlights which member has enough XP levels to perform specific enchantments.

### 5. Plan Versioning & Snapshots
- **Snapshot System**: Save versions of your plan before making major changes.
- **Rollback**: Restore previous snapshots if a crafting strategy goes wrong.

### 6. Immersive Minecraft UI
- **Pixel-Perfect Icons**: Uses official Minecraft assets for all items.
- **Sound System**: Integrated Minecraft sound effects for UI actions (crafting, button clicks, level-ups).
- **Theme**: A lush, dark-mode Minecraft aesthetic with custom animations.

---

## 🛠 Tech Stack
- **Frontend**: React, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js (TypeScript)
- **Database/Auth**: Supabase (PostgreSQL with RLS)
- **Data Source**: [minecraft-data](https://www.npmjs.com/package/minecraft-data)
- **Assets**: [node-minecraft-assets](https://github.com/PrismarineJS/node-minecraft-assets)

---

## 🛠️ Getting Started

### Prerequisites
- Node.js (v18+)
- Supabase Account (for API & Database)

### Installation

1. **Clone the repo**
   ```bash
   git clone https://github.com/SaiDattu3607/crafting-companion.git
   cd crafting-companion
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure Environment Variables**
   Create a `.env` file in the root:
   ```env
   VITE_SUPABASE_URL=your_supabase_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   PORT=3001
   ```

4. **Run the Backend**
   ```bash
   npm run server:dev
   ```

5. **Run the Frontend**
   ```bash
   npm run dev
   ```

The app will be available at `http://localhost:8080` (Frontend) and `http://localhost:3001` (Backend).

---

## 🌟 Extra Features Added (Beyond Requirements)
- **Interactive Enchantment Matrix**: A bespoke UI grid showing all possible enchantments for any item, their tier requirements, and current application status.
- **Visual Crafting Matrix**: High-fidelity 3x3 crafting grid visualizations for every item, including specialized layouts for Smithing and Potion Brewing.
- **Anvil Math Engine**: Deep logic that calculates the precise path of anvil combinations needed to reach high-tier enchantments (e.g. Sharpness V) from base books.
- **Sound Manager**: Customized sound profile for crafting, enchanting, and navigating.
- **Potion Variance**: Full support for Potion types (Splash, Lingering) and variants (Duration, Level II).
- **Leaderboards**: Track who is contributing the most to the project.
- **Bottleneck Analysis**: Special algorithm to detect which item is blocking the most "parent" nodes.
- **Dynamic Search**: High-performance debounced search for thousands of Minecraft items.
