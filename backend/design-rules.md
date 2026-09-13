# Agentic UI — Design System Rules

> These rules are injected into the LLM composition prompt to ensure production-quality output.
> They are derived from Apple HIG, Material Design 3, and analysis of top SaaS/fintech apps.

## Spacing System (8px Grid)
- `4px` — tight spacing (icon-to-label, badge padding)
- `8px` — compact spacing (between small elements in a row)
- `12px` — default inner padding (list item vertical, chip padding)
- `16px` — standard container padding (card padding, section margin)
- `20px` — comfortable padding (header padding, form field height)
- `24px` — section gap (between cards, between groups)
- `32px` — major section divider
- `48px` — page-level vertical rhythm
- `64px` — hero spacing, header heights

## Typography Scale
| Role | Size | Weight | Line-height | Use |
|------|------|--------|-------------|-----|
| Caption | 11px | 400 | 1.3 | Timestamps, metadata |
| Small | 12px | 400 | 1.4 | Labels, secondary info |
| Body | 14px | 400 | 1.5 | Default text, descriptions |
| Body Large | 15px | 400 | 1.5 | Primary body content |
| Subhead | 16px | 500 | 1.4 | Section labels, nav items |
| Title 3 | 18px | 600 | 1.3 | Card titles, list headers |
| Title 2 | 20px | 600 | 1.3 | Section titles |
| Title 1 | 24px | 700 | 1.2 | Page titles |
| Large Title | 28px | 700 | 1.2 | Hero headings |
| Display | 34px | 800 | 1.1 | Feature numbers, KPIs |

## Color Opacity Hierarchy
- Primary text: 100% opacity
- Secondary text: 60% opacity
- Tertiary/disabled: 40% opacity
- Dividers/borders: 12% opacity (dark theme) / 8% opacity (light theme)
- Surface overlays: 4-8% of accent color

## Elevation & Shadows (Dark Theme)
- Level 0: flat (base surface)
- Level 1: `0 1px 3px rgba(0,0,0,0.2)` — cards, containers
- Level 2: `0 4px 12px rgba(0,0,0,0.25)` — floating cards, dropdowns
- Level 3: `0 8px 24px rgba(0,0,0,0.3)` — modals, bottom sheets
- Level 4: `0 16px 48px rgba(0,0,0,0.4)` — dialogs, popups

## Elevation & Shadows (Light Theme)
- Level 1: `0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)`
- Level 2: `0 4px 12px rgba(0,0,0,0.08), 0 2px 4px rgba(0,0,0,0.04)`
- Level 3: `0 8px 24px rgba(0,0,0,0.12)`
- Level 4: `0 16px 48px rgba(0,0,0,0.16)`

## Border Radius
- `4px` — small elements (badges, tags, chips)
- `8px` — buttons, inputs, small cards
- `12px` — medium cards, dropdown menus
- `16px` — large cards, modals
- `20px` — feature cards, hero sections
- `9999px` — pills, circular avatars

## Component Patterns

### Status Bar & Phone Bezel Mockup
- NEVER draw a status bar, dynamic island, battery icon, wifi icon, time, or phone bezel mockup inside the React component code.
- The host preview container frame already draws the phone mockups and overlay status bars automatically. Including them in the code will cause broken duplication.

### Header / App Bar
- Height: 56-64px
- Left: avatar (32-40px circle) or back arrow
- Center or left-aligned: title (Title 2, 20px, weight 600)
- Right: 1-2 action icons (24x24, in 40x40 touch target)
- Notification badge: 8px red circle with count

### Stat Cards / KPI Row
- 3-4 cards in a horizontal scroll or grid
- Each card: value (Display, 28-34px, weight 700) + label (Caption, 12px) + change indicator
- Change indicator: green ↑ or red ↓ with percentage
- Card background: surface color, border-radius 12-16px

### Data Table
- Header row: subhead (12px, uppercase, letter-spacing 0.5px, 60% opacity)
- Data rows: 56-64px height
- Left: icon/avatar (32-36px) + title (14-15px) + subtitle (12px, 60% opacity)
- Right: value or status badge
- Dividers: 1px line at 8% opacity

### Chart Area
- Container: full-width card, padding 20px
- Title: Title 3 (18px, weight 600) + subtitle (12px, 60% opacity)
- Chart height: 160-200px for mobile, 280-320px for web
- Axis labels: 11px, 40% opacity
- Grid lines: 1px dashed at 6% opacity
- Data line: 2.5px stroke, accent color
- Area fill: accent color at 8% opacity
- Tooltip: accent background, white text, border-radius 8px

### Bottom Tab Navigation (iOS)
- Height: 83px (includes 34px safe area)
- 5 items maximum
- Active: accent color icon (24px) + label (10px, weight 600)
- Inactive: 40% opacity icon + label
- Centered layout with equal spacing
- Tab bar background: surface color with subtle top border

### Sidebar Navigation (Web)
- Width: 240-280px
- Logo/brand: top, 48px height area
- Nav items: 40-44px height, padding 12px 16px
- Active item: accent background at 10% opacity, accent text, left 3px accent border
- Hover: surface hover at 6% opacity
- Section labels: 11px uppercase, 40% opacity, padding-top 24px
- Bottom: user avatar + name + settings icon

### Transaction / List Item
- Height: 64-72px
- Left: icon in colored circle (40px) or avatar
- Middle: title (15px, weight 500) + subtitle (12px, 60% opacity)
- Right: amount (15px, weight 600, green/red for +/-) 
- If brand mentioned: show brand logo (20-24px) instead of generic icon

### Form Inputs
- Height: 48px
- Border: 1px solid at 15% opacity
- Border-radius: 8-12px
- Focus state: 2px accent border
- Label: 12px above, 60% opacity
- Placeholder: 40% opacity

### Buttons
- Primary: accent background, white text, height 48px, radius 12px, weight 600
- Secondary: transparent background, accent border, accent text
- Ghost: transparent, accent text only
- Disabled: 40% opacity on all
- Padding: 16px 24px horizontal

### Empty States
- Centered illustration or icon (64x64)
- Title (18px, weight 600)
- Description (14px, 60% opacity, max-width 280px)
- CTA button below

## Anti-Patterns (NEVER do these)
- Never use placeholder circles with initials when avatar img tags are available
- Never hardcode font names — use the provided fonts only
- Never use more than 2 accent colors
- Never put text smaller than 11px
- Never make touch targets smaller than 44x44px
- Never use pure black (#000000) as background in dark theme — use near-black (#0A0A0F to #141419)
- Never center-align body text paragraphs
- Never use generic "Lorem ipsum" — always use realistic data
- NEVER draw or include status bars or phone mockup frames on mobile screens (since the outer preview container handles this).
- Never use more than 3 levels of text hierarchy per section

## Noise Gradient Patterns
- Use SVG `feTurbulence` + `feColorMatrix` for grain texture -- never plain `linear-gradient()` for large backgrounds
- Layer structure: base color -> radial gradient color stops -> noise overlay (mix-blend-mode: overlay, opacity 0.25-0.35)
- Base frequency: 0.55-0.75 for fine grain, 0.3-0.5 for coarse grain
- Number of octaves: 3 for subtle, 4-5 for heavy texture
- Apply via CSS ::before (gradient) and ::after (noise) pseudo-elements
- Use for: hero sections, feature backgrounds, CTA areas, card highlights
- Never use for: data tables, form inputs, navigation bars

## Micro-Interactions
- Cards: `transition: transform 0.2s ease, box-shadow 0.2s ease;` -- hover: `translateY(-2px)` + increased shadow
- Buttons: `transition: all 0.15s ease;` -- hover: `filter: brightness(1.1); transform: scale(1.02);`
- List items: `transition: background 0.15s ease;` -- hover: subtle background highlight at 4-6% opacity
- Links: `transition: color 0.15s ease, opacity 0.15s ease;` -- hover: accent color or reduced opacity
- Use CSS `:hover` in a `<style>` block -- do not rely on inline styles for hover states
- Keep all transitions under 300ms -- anything longer feels sluggish
- Never animate layout properties (width, height, padding) -- only transform, opacity, box-shadow, background

## Image Requirements
- Every screen MUST include at least one real image (hero, card thumbnail, product photo, or background)
- Use provided stock `<img>` tags with `object-fit: cover` and appropriate `border-radius`
- Hero images: full-width, 200-320px height, rounded-xl to rounded-2xl
- Card thumbnails: aspect-ratio 16:9 or 4:3, rounded-lg
- Profile/avatar images: circular (border-radius: 9999px), 32-48px
- Never use plain colored rectangles or empty divs as image placeholders
- Never use base64 encoded images -- always external URLs

## Glass Morphism
- Navigation bars: `backdrop-filter: blur(20px) saturate(180%);` + semi-transparent background
- Dark theme: `background: rgba(0,0,0,0.6);` + `border: 1px solid rgba(255,255,255,0.08);`
- Light theme: `background: rgba(255,255,255,0.7);` + `border: 1px solid rgba(0,0,0,0.06);`
- Floating cards/modals: `backdrop-filter: blur(16px);` + slightly higher opacity background
- Use sparingly -- max 2-3 glass elements per screen
- Always ensure sufficient contrast for text over glass surfaces
- Never combine glass morphism with noise gradients on the same element

## Radix UI + Framer Motion (Shadcn/UI & Watermelon UI Component Recipes)
Use these blueprints to generate advanced, production-grade, and accessible interactive interfaces.

### 1. Animated Sliding Tabs (Watermelon UI slider style)
Use Framer Motion's `layoutId` on a background pill for premium, fluid active-tab slide animations instead of static tab switches.
```jsx
import { motion } from 'framer-motion';

function SegmentedControl() {
  const tabs = ['Overview', 'Analytics', 'Settings'];
  const [activeTab, setActiveTab] = React.useState('Overview');

  return (
    <div className="flex gap-1 bg-zinc-900/60 p-1 rounded-xl border border-white/5">
      {tabs.map(tab => (
        <button
          key={tab}
          onClick={() => setActiveTab(tab)}
          className="relative px-4 py-2 text-sm font-medium rounded-lg transition-colors focus:outline-none"
          style={{ color: activeTab === tab ? '#FFFFFF' : 'rgba(255,255,255,0.6)' }}
        >
          {activeTab === tab && (
            <motion.span
              layoutId="active-tab"
              className="absolute inset-0 bg-white/10 rounded-lg z-0"
              transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            />
          )}
          <span className="relative z-10">{tab}</span>
        </button>
      ))}
    </div>
  );
}
```

### 2. Spring-Action Cards (Watermelon UI card hover)
Use spring-loaded hover, tap, and exit animations to make layouts feel responsive, interactive, and premium.
```jsx
import { motion } from 'framer-motion';
import * as Lucide from 'lucide-react';

function HoverCard() {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="p-6 bg-zinc-900 border border-white/5 rounded-2xl hover:border-violet-500/20 shadow-lg cursor-pointer select-none"
    >
      <div className="w-10 h-10 rounded-xl bg-violet-500/10 flex items-center justify-center text-violet-400 mb-4 border border-violet-500/20">
        <Lucide.Sparkles size={18} />
      </div>
      <h4 className="text-white font-semibold text-base mb-1">Adaptive Intelligence</h4>
      <p className="text-zinc-400 text-sm">Dynamic styling layers designed with custom token patterns.</p>
    </motion.div>
  );
}
```

### 3. Accessible Dialog Modal (Shadcn/UI spring-modal)
Combine Radix Dialog primitives with Framer Motion transitions for accessible overlays and spring-loaded popups.
```jsx
import * as Dialog from '@radix-ui/react-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import * as Lucide from 'lucide-react';

function CustomModal() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
      <Dialog.Trigger className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg">
        Configure Server
      </Dialog.Trigger>
      
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Backdrop Overlay */}
            <Dialog.Overlay asChild>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
              />
            </Dialog.Overlay>

            {/* Modal Dialog Content */}
            <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md z-50 focus:outline-none" forceMount>
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                transition={{ type: 'spring', duration: 0.4 }}
                className="bg-zinc-950 border border-white/10 p-6 rounded-2xl shadow-2xl relative"
              >
                <Dialog.Title className="text-lg font-bold text-white mb-2">Deploy Changes</Dialog.Title>
                <Dialog.Description className="text-sm text-zinc-400 mb-6">
                  Are you sure you want to push current build components to production? This action is atomic.
                </Dialog.Description>
                
                <div className="flex justify-end gap-3">
                  <Dialog.Close className="px-4 py-2 bg-zinc-900 hover:bg-zinc-800 text-zinc-300 font-semibold rounded-xl text-sm transition-colors">
                    Cancel
                  </Dialog.Close>
                  <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl text-sm transition-colors">
                    Deploy
                  </button>
                </div>

                <Dialog.Close className="absolute top-4 right-4 p-1.5 hover:bg-white/5 rounded-lg text-zinc-400 hover:text-white transition-colors">
                  <Lucide.X size={16} />
                </Dialog.Close>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
}
```

### 4. Interactive Accordion (Shadcn/UI standard accordion)
Use Radix Accordion combined with clean CSS height transitions or layout animation states.
```jsx
import * as Accordion from '@radix-ui/react-accordion';
import * as Lucide from 'lucide-react';

function CustomAccordion() {
  return (
    <Accordion.Root type="single" collapsible className="w-full space-y-2">
      <Accordion.Item value="item-1" className="border border-white/5 bg-zinc-900/40 rounded-xl overflow-hidden">
        <Accordion.Trigger className="flex justify-between items-center w-full p-4 text-left font-medium text-white hover:bg-white/5 transition-colors group focus:outline-none">
          <span>Is the data layout responsive?</span>
          <Lucide.ChevronDown 
            className="transition-transform duration-200 text-zinc-400 group-data-[state=open]:rotate-180 group-hover:text-white" 
            size={16} 
          />
        </Accordion.Trigger>
        <Accordion.Content className="data-[state=open]:animate-slideDown data-[state=closed]:animate-slideUp overflow-hidden bg-white/1">
          <div className="p-4 text-sm text-zinc-400 border-t border-white/5">
            Yes. The system utilizes auto-scalable Flexbox layouts combined with Tailwind's grid matrices.
          </div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}
```

