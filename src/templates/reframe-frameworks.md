# OpenOwl Reframe — UI Framework Knowledge Base

When the user asks to change, pick, migrate, or "reframe" their UI framework, use this file to guide the conversation and generate the right migration prompt.

## Decision Questions

Ask these in order. Stop early if the answer narrows to 1-2 frameworks.

1. **What framework/library does your project currently use?** (React, Vue, Svelte, plain HTML, etc.)
2. **What's your priority?** (a) Stunning animations, (b) Fast setup / ship quickly, (c) Full design control, (d) Accessibility-first, (e) Business/enterprise look
3. **Do you use Tailwind CSS already?** (Yes -> most options work. No -> Chakra UI or DaisyUI are easier without it)
4. **Light mode, dark mode, or both?**
5. **Is this a landing page, a dashboard/app, or both?**

## Quick Selection Guide

| Priority | Recommended |
|----------|-------------|
| Fastest setup | DaisyUI, Preline UI |
| Stunning animations | Aceternity UI, Magic UI |
| Maximum control | shadcn/ui, Headless UI |
| Most free components | Origin UI (400+) |
| Multi-framework (React + Vue + Svelte) | Park UI, DaisyUI, Flowbite |
| AI product aesthetic | Cult UI |
| Polished defaults + accessibility | HeroUI, Chakra UI |
| Business/enterprise | Flowbite, shadcn/ui |

## Comparison Matrix

| Framework | Styling | Animation | Setup | Best For | Cost |
|-----------|---------|-----------|-------|----------|------|
| shadcn/ui | Tailwind + Radix | Minimal | Medium | Full apps, dashboards | Free |
| Aceternity UI | Tailwind + Framer Motion | Heavy, cinematic | Easy (copy-paste) | Animated landing pages | Free / Pro |
| Magic UI | Tailwind + Motion | Purposeful, polished | Easy (shadcn CLI) | SaaS marketing | Free / Pro |
| DaisyUI | Tailwind plugin | CSS transitions | Very easy | Rapid prototyping | Free |
| HeroUI | Tailwind + React Aria | Smooth built-in | Easy | React apps, accessible | Free |
| Chakra UI | CSS-in-JS (Emotion) | Built-in transitions | Easy | Themed React apps | Free |
| Flowbite | Tailwind plugin | CSS transitions | Very easy | Multi-framework, business | Free / Pro |
| Preline UI | Tailwind plugin | CSS + minimal JS | Very easy | Speed-focused builds | Free / Pro |
| Park UI | Tailwind + Ark UI | Minimal | Medium | Multi-framework, design systems | Free |
| Origin UI | Tailwind + shadcn | Minimal | Easy (copy-paste) | Max component variety | Free |
| Headless UI | Custom Tailwind | Custom (Transition) | Medium-Hard | Full design control | Free |
| Cult UI | Tailwind + shadcn | Modern, subtle | Medium | AI apps, full-stack | Free |

---

## Framework Prompts

After the user selects a framework, use the corresponding prompt below. **Adapt it to the user's actual project** — replace generic references with their real file structure, existing routes, and components from `.owl/anatomy.md`.

---

### shadcn/ui

**Stack:** React, Tailwind CSS, Radix UI
**Install:** `npx shadcn@latest init`
**Site:** ui.shadcn.com

```
Build a modern, minimalist landing page using Next.js 14+ (App Router), TypeScript, Tailwind CSS, and shadcn/ui components.

ARCHITECTURE:
- Use Next.js App Router with server components by default, client components only when interactivity is needed
- Organize: /app for routes, /components/ui for shadcn primitives, /components/sections for page sections, /lib for utilities
- Use CSS variables for theming via shadcn's built-in system

DESIGN PRINCIPLES:
- Minimalist with generous whitespace (py-24 to py-32 section spacing)
- Max-width container (max-w-6xl mx-auto) with responsive padding
- Typography hierarchy: text-5xl/6xl hero -> text-3xl section titles -> text-lg body
- Muted color palette with ONE bold accent color for CTAs
- Subtle micro-interactions on hover (scale, opacity transitions)
- Dark mode support via shadcn's theme provider

SECTIONS TO BUILD:
1. Navbar - sticky, transparent-to-solid on scroll, logo left, nav center, CTA button right
2. Hero - large headline (max 8 words), subtext (max 2 lines), primary CTA button + secondary ghost button
3. Social proof - logo cloud of 5-6 partner/client logos in grayscale
4. Features - 3-column bento grid with icon, title, description per card
5. How it works - 3-step numbered process with connecting line
6. Testimonials - carousel or grid of 3 testimonial cards with avatar, quote, name, role
7. Pricing - 3-tier pricing table, highlight the recommended plan with ring/border accent
8. FAQ - accordion component
9. CTA - full-width section with headline, subtext, and primary action button
10. Footer - 4-column grid (brand, product links, company links, legal)

CODE QUALITY:
- Fully responsive (mobile-first)
- Semantic HTML (section, nav, main, footer)
- Accessible (proper aria labels, keyboard navigation)
- Performant (lazy load images, optimize fonts via next/font)
- Clean component separation (each section is its own component)
```

### Aceternity UI

**Stack:** React, Next.js, Tailwind CSS, Framer Motion
**Install:** Copy-paste or `npx shadcn@latest add [component]`
**Site:** ui.aceternity.com

```
Build a visually stunning, animation-rich landing page using Next.js 14+, TypeScript, Tailwind CSS, and Aceternity UI components with Framer Motion.

ARCHITECTURE:
- Next.js App Router with client components for animated sections
- Organize: /app, /components/aceternity (copied components), /components/sections, /lib
- Install Framer Motion for animation engine

DESIGN PRINCIPLES:
- Dark theme as primary (bg-black/bg-slate-950 backgrounds)
- Dramatic contrast with glowing accents (cyan, purple, or emerald)
- Layered depth via gradients, glows, and glassmorphism
- Cinematic scroll-triggered animations with staggered reveals
- Generous padding (py-32+), large typography (text-6xl/7xl hero)

SECTIONS TO BUILD WITH ACETERNITY COMPONENTS:
1. Navbar - floating navbar with backdrop blur, animated on scroll
2. Hero - use Spotlight or Lamp effect as background, massive headline with TextGenerateEffect, gradient text on key words
3. Logo cloud - use InfiniteMovingCards for auto-scrolling partner logos
4. Features - BentoGrid layout with animated cards
5. Product showcase - use 3DCard or ParallaxScroll for product screenshots/mockups
6. Testimonials - AnimatedTestimonials or InfiniteMovingCards
7. How it works - use TracingBeam component
8. Pricing - dark cards with GlowingStarsBackground, highlighted tier has animated border
9. CTA - full-width with BackgroundBeams or Meteors effect
10. Footer - clean 4-column layout

ANIMATION GUIDELINES:
- Page load: stagger hero elements (title -> subtitle -> buttons) with 0.15s delay each
- Scroll: use Framer Motion's whileInView for reveal animations
- Hover: cards lift (translateY -4px) with glow intensification
- Respect prefers-reduced-motion
```

### Magic UI

**Stack:** React, TypeScript, Tailwind CSS, Motion (Framer Motion)
**Install:** `npx shadcn@latest add [component]` (shadcn CLI compatible)
**Site:** magicui.design

```
Build a polished, trend-forward SaaS landing page using Next.js 14+, TypeScript, Tailwind CSS, and Magic UI animated components.

ARCHITECTURE:
- Next.js App Router, server components where possible
- Magic UI components installed via shadcn CLI into /components/magicui
- Section components in /components/sections

DESIGN PRINCIPLES:
- Clean and modern, inspired by Linear/Vercel aesthetic
- Light or dark mode with smooth toggle transition
- Restrained animation - purposeful motion that guides attention, not distracts
- High contrast text, muted backgrounds
- ONE signature color (blue-500, violet-500, or emerald-500) for accents

SECTIONS TO BUILD:
1. Navbar - clean horizontal nav, ShimmerButton for primary CTA
2. Hero - large headline with AnimatedGradientText on key phrase, NumberTicker for a live stat
3. Social proof - Marquee component for auto-scrolling logos
4. Features - MagicCard components in a 3-column grid
5. Bento showcase - BentoGrid layout with mixed tile sizes
6. Metrics - NumberTicker showing key stats
7. Testimonials - Marquee of testimonial cards
8. Pricing - 3 tiers with NeonGradientCard for featured plan
9. CTA - centered with AnimatedShinyText headline
10. Footer - minimal 3-4 column grid

ANIMATION STRATEGY:
- Use BlurIn / FadeIn for section entrance animations
- NumberTicker for statistics or metrics
- Marquee for horizontally scrolling content
- Keep transitions under 600ms, use ease-out curves
- Mobile: reduce or disable particle/meteor effects
```

### DaisyUI

**Stack:** Tailwind CSS plugin (framework-agnostic)
**Install:** `npm i -D daisyui` + add to tailwind.config
**Site:** daisyui.com

```
Build a clean, professional landing page using Tailwind CSS and DaisyUI component classes.

ARCHITECTURE:
- Framework of choice with Tailwind CSS + DaisyUI plugin
- Use DaisyUI's semantic class system (btn, card, hero, navbar, etc.)
- Select a DaisyUI theme (or create custom) in tailwind.config.js

DESIGN PRINCIPLES:
- Pick ONE DaisyUI theme as base (e.g., "winter" for clean light, "night" for dark)
- Minimalist layout with clean spacing (p-8 to p-16 sections)
- Let DaisyUI's built-in design system handle consistency

SECTIONS TO BUILD:
1. Navbar - "navbar" component with "btn btn-primary" for CTA
2. Hero - "hero" component with "hero-content"
3. Social proof - logo row with "opacity-50 grayscale"
4. Features - "card" components in responsive grid
5. Stats - "stats" component with "stat" items
6. Steps - "steps" component
7. Testimonials - "card" grid with "avatar"
8. Pricing - "card" components with "badge badge-primary"
9. FAQ - "collapse" components
10. Footer - "footer" component with 3-4 columns

CODE QUALITY:
- Fully responsive using Tailwind breakpoints
- Zero custom CSS needed
- Accessible by default
- Fast load times (CSS-only, no JS shipped)
- Works with any framework or plain HTML
```

### HeroUI (formerly NextUI)

**Stack:** React, Tailwind CSS, React Aria
**Install:** `npm i @heroui/react`
**Site:** heroui.com

```
Build an elegant, accessible landing page using Next.js 14+, TypeScript, Tailwind CSS, and HeroUI components.

ARCHITECTURE:
- Next.js App Router with HeroUI Provider wrapping the app
- Import only needed components from @heroui/react (tree-shakeable)

DESIGN PRINCIPLES:
- Soft, modern aesthetic with rounded corners and smooth surfaces
- Light mode primary with dark mode support
- Smooth transitions on all interactive elements
- Clean sans-serif typography, generous line heights

SECTIONS TO BUILD:
1. Navbar - HeroUI Navbar with NavbarBrand, NavbarContent, NavbarItem
2. Hero - large headline, Button (color="primary" size="lg") + Button (variant="bordered")
3. Social proof - Avatar group for client logos or Chip components
4. Features - Card components in grid with CardHeader, CardBody
5. Product demo - Tabs component for interactive views
6. Testimonials - Card grid with User component
7. Pricing - Card components with Chip for "Popular" badge
8. FAQ - Accordion component
9. CTA - centered section with Input + Button combo
10. Footer - clean grid with Link components
```

### Chakra UI

**Stack:** React, Emotion (CSS-in-JS)
**Install:** `npm i @chakra-ui/react`
**Site:** chakra-ui.com

```
Build a clean, accessible landing page using Next.js 14+, TypeScript, and Chakra UI.

ARCHITECTURE:
- Next.js App Router with ChakraProvider at root
- Use Chakra's design tokens and theme extension

DESIGN PRINCIPLES:
- Clean and warm aesthetic using Chakra's polished defaults
- Consistent spacing using Chakra's space scale
- Color mode support (light/dark)
- Accessible-first: every component follows WAI-ARIA

SECTIONS TO BUILD:
1. Navbar - Flex with HStack, Button for CTA
2. Hero - VStack centered, Heading size="4xl", Text, HStack with two Buttons
3. Social proof - HStack of grayscale Image components
4. Features - SimpleGrid of VStack cards with Icon, Heading, Text
5. Stats - Stat component group
6. Testimonials - SimpleGrid of Card with Avatar, Text
7. Pricing - SimpleGrid of Card, Badge for "Popular"
8. FAQ - Accordion component
9. CTA - Box with bg gradient, VStack centered
10. Footer - SimpleGrid with VStack, Heading, Link
```

### Flowbite

**Stack:** Tailwind CSS (React, Vue, Svelte, Angular)
**Install:** `npm i flowbite flowbite-react`
**Site:** flowbite.com

```
Build a professional, conversion-optimized landing page using Next.js 14+, Tailwind CSS, and Flowbite React components.

DESIGN PRINCIPLES:
- Business-professional aesthetic (clean, trustworthy, conversion-focused)
- Cool neutral palette with strong brand accent
- Focus on readability and clear information hierarchy

SECTIONS TO BUILD:
1. Navbar - Flowbite Navbar with Navbar.Brand, Navbar.Toggle
2. Hero - large Heading, Button group
3. Social proof - row of client logos
4. Features - Card components in responsive grid
5. Content - alternating image + text rows
6. Testimonials - Blockquote or Card with Rating
7. Pricing - Card with List for features, Badge
8. FAQ - Accordion component
9. Newsletter CTA - TextInput + Button in styled Banner
10. Footer - Flowbite Footer
```

### Headless UI

**Stack:** React or Vue, Tailwind CSS (by Tailwind Labs)
**Install:** `npm i @headlessui/react`
**Site:** headlessui.com

```
Build a custom-designed, fully accessible landing page using Next.js 14+, TypeScript, Tailwind CSS, and Headless UI.

ARCHITECTURE:
- Headless UI only for interactive behavior (menus, dialogs, tabs, disclosure, transitions)
- All visual design is custom Tailwind - Headless UI provides zero styling
- Organize: /app, /components/ui (custom-styled wrappers), /components/sections

DESIGN PRINCIPLES:
- Completely custom aesthetic
- Minimalist, editorial-quality design (think Stripe, Linear, Vercel)
- Monochrome base with ONE signature accent color
- Large whitespace, precise typography, meticulous alignment
- Every interactive element is keyboard-navigable and screen-reader friendly

HEADLESS UI COMPONENTS:
- Popover - navbar dropdowns
- Disclosure - mobile menu, FAQ items
- Dialog - modals/overlays
- Transition - smooth enter/leave animations
- RadioGroup - plan selection
- Switch - toggles
- TabGroup - tabbed content
```

### Cult UI

**Stack:** React, Next.js, Tailwind CSS, shadcn/ui foundation
**Install:** Copy-paste or CLI
**Site:** cult-ui.com

```
Build a modern, AI-forward landing page using Next.js 14+, TypeScript, Tailwind CSS, and Cult UI components.

DESIGN PRINCIPLES:
- Tech-forward, developer-centric aesthetic
- Dark mode primary with high-contrast accents
- Modern gradients and subtle glow effects
- Clean code-like typography (mono fonts for accents)
- Purposeful animation that communicates AI/tech sophistication

SECTIONS TO BUILD:
1. Navbar - modern floating nav with glass effect
2. Hero - bold headline with animated text effect, gradient mesh background
3. Features - AI blocks for feature cards
4. Live demo - interactive component showing product in action
5. Code showcase - syntax-highlighted code examples
6. Testimonials - modern card layout
7. Pricing - clean tier comparison
8. Open source / community - GitHub stars counter, contributor avatars
9. CTA - compelling action section
10. Footer - developer-friendly footer with docs links
```
