# RCLimit: UI/UX Design System & Interface Standards

**Document Type:** UI/UX Architecture & Frontend Guidelines  
**Scope:** `rclimit-ui` (React, Tailwind CSS, Vite, Shadcn UI)  
**Context:** Loan Origination System (LOS), Ledger Management, Sub-Limit Dashboards  
**Date:** October 2026  

---

## 1. Real-World Inspiration & Reference Links

When building a high-density financial SaaS, avoid consumer-facing design patterns (large images, excessive whitespace). Instead, optimize for data readability, keyboard navigation, and operational speed.

### Top UI/UX Research Galleries
* **[SaaSUI Design](https://www.saasui.design/)**: The best curated gallery for specific SaaS screens (Dashboards, Settings, Data Tables). Study how top products handle complex data grids.
* **[Mobbin](https://mobbin.com/)**: Essential for researching real-world mobile app and responsive web flows. Excellent for studying how fintechs handle onboarding and loan application states.
* **[Saas Interface](https://saasinterface.com/)**: A massive library of UX patterns specifically for B2B applications.

### Best-in-Class Component Systems (For React/Tailwind)
* **[Shadcn UI](https://ui.shadcn.com/)**: The gold standard for React components. Built on Radix UI, it guarantees accessibility (ARIA standards, keyboard navigation) while giving you full control over the Tailwind styling.
* **[Tailwind UI Catalyst](https://tailwindui.com/templates/catalyst)**: Official application UI kit from Tailwind. Perfect reference for Master-Detail layouts and dense data tables.
* **[Linear App](https://linear.app/)**: The industry benchmark for high-density, keyboard-first UI. Study their command palette, contextual menus, and split-pane views.
* **[Stripe Dashboard](https://stripe.com/)**: The canonical reference for presenting financial ledgers, transactional statuses, tabular numbers, and error states cleanly.

---

## 2. Theming Architecture & Color Strategy

To support multi-tenancy (e.g., Anna Finance vs. other DSA partners) and standard Light/Dark modes, the application uses **CSS Variable-driven theming** integrated with Tailwind CSS.

### A. CSS Variable Foundation
Instead of hardcoding Tailwind colors (e.g., `bg-blue-600`), map semantic CSS variables in your root stylesheet. This allows instant brand-switching per tenant.

```css
/* global.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    /* Brand Primary (Anna Finance Indigo) */
    --primary: 243 75% 59%; 
    --primary-foreground: 210 40% 98%;
    /* Semantic States */
    --success: 142 71% 45%;
    --warning: 38 92% 50%;
    --danger: 348 83% 47%;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    /* Adjusted for Dark Mode Contrast */
    --primary: 217.2 91.2% 59.8%; 
  }
}
```

### B. Tailwind Configuration Mapping
Extend `tailwind.config.js` to consume these variables, ensuring UI components remain agnostic to the specific tenant's brand colors.

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        success: "hsl(var(--success))",
        warning: "hsl(var(--warning))",
        danger: "hsl(var(--danger))",
      },
    },
  },
}
```

### C. Semantic Palette Rules
Do not use bright colors arbitrarily. Reserve them strictly for financial status and SLA indicators.
* **Primary Brand (`bg-primary`):** Used *only* for primary workflow actions ("Disburse Loan", "Convert Lead").
* **Success (`text-success`):** Positive headroom, Credit ledger entries, `VERIFIED` Vahan statuses.
* **Warning (`text-warning`):** Approaching RC SLAs, Pending PDDs, `AMBER` CIBIL scores.
* **Danger (`text-danger`):** `STOP_SUPPLY` flags, Debit line-item deductions, Overdue SLAs.

---

## 3. Core Typographic Standards

### A. Typography for Financials
When displaying loan amounts, EMIs, and ledger balances (e.g., `₹15,00,000.00`), the numbers must align perfectly vertically across table rows to allow fast visual scanning.
* **Standard:** Use Tabular Nums (Monospaced figures).
* **Tailwind Implementation:** Add `font-mono` or `tabular-nums` (`font-feature-settings: 'tnum'`) to all currency and date displays.
* **Font Family:** Use a highly legible sans-serif for UI (e.g., *Inter* or *Geist*) and a crisp monospace for data (e.g., *JetBrains Mono* or *Geist Mono*).

---

## 4. Desktop Layout Architecture

### A. Master-Detail Split Pane
Avoid forcing users to navigate to completely new pages to view loan details.
* **Left Pane (35%):** Searchable, filterable list of Leads or Loans.
* **Right Pane (65%):** The detailed view of the selected record, including the PDD checklist, threaded comments, and ledger timeline.
* **Visual Divider:** Interactive resizable border (`border-l border-slate-200 dark:border-slate-800`).

### B. Inline Filtering & Search
* Replace bulky filter sidebars with **Filter Chips** integrated directly into the search bar (`[Product: USED_CV ✕]`, `[Status: SANCTIONED ✕]`).

---

## 5. Mobile-First Optimization (Crucial for Financial SaaS)

Designing data-heavy tables for mobile (320px - 430px wide) requires structural transformations. Do not force horizontal scrolling on large tables.

### A. Data Tables $\rightarrow$ Stacked Cards
On mobile viewports (`< 768px`), data tables must collapse into responsive cards.
* **Desktop:** Standard `<table>` with columns for Applicant, Amount, Reg No, Status.
* **Mobile:** A vertical stack of `<div>` cards. 
  * *Top Row:* Applicant Name & Status Badge.
  * *Middle Row:* Key-value pairs (Reg No: GJ05BX..., Amount: ₹15L).
  * *Bottom Row:* Quick action buttons (`View Ledger`, `Upload PDD`).

### B. Bottom Sheet Drawers (Replacing Center Modals)
Center modals fail on mobile when the virtual keyboard opens, blocking input fields.
* **Standard:** Use **Bottom Sheets** (Slide-up panels) on mobile. 
* **Implementation:** Anchor the modal to `bottom-0`, add a drag handle (`h-1.5 w-12 rounded-full bg-slate-300`), and give it a rounded top (`rounded-t-2xl`). On desktop, this same component acts as a standard centered modal.

### C. Horizontal Snap Carousels for Metrics
Stacking multiple metric cards (Headroom, Utilization, Pending RCs) vertically pushes the actual data off-screen on mobile.
* **Standard:** Use a horizontal swipeable carousel.
* **Tailwind Implementation:** 
  
```html
  <div class="flex overflow-x-auto snap-x snap-mandatory gap-3 scrollbar-hide">
     <div class="w-[85vw] shrink-0 snap-center">... Metric 1 ...</div>
     <div class="w-[85vw] shrink-0 snap-center">... Metric 2 ...</div>
  </div>
```

### D. Sticky Bottom Action Docks (FABs)
Reaching top-right action buttons on modern, tall phones is ergonomically difficult.
* **Standard:** Move contextual actions (e.g., `+ Add Disbursal Line`) to a sticky dock at the bottom of the screen (`fixed bottom-0 inset-x-0 pb-safe`). Apply a frosted glass effect (`backdrop-blur-md bg-background/80`) so data scrolls cleanly underneath it.

---

## 6. Accessibility (a11y) & Input Standards

### A. Mobile Form Interactions
* **Numeric Keypads:** For fields capturing Sanctioned Amounts, EMI, or Sub-limits, always use `inputmode="decimal"` or `type="number"`. This forces the mobile OS to show the large number pad instead of the QWERTY keyboard.
* **Touch Targets:** Any clickable element (buttons, dropdowns, checkboxes) must be a minimum of **48x48 pixels** (`h-12 w-12`) to prevent accidental misclicks by field agents.

### B. HATEOAS State Indication
Action buttons must dynamically reflect the backend state.
* If a Lead cannot be converted (e.g., missing Vahan verification), do not just hide the button. Show it in a disabled state with a tooltip explaining *why* (e.g., "Requires verified RC check to convert"). This reduces user frustration and support tickets.
* **Glow Effects:** Use subtle pulsing animations (`animate-pulse`) on badges that require immediate operational attention (like `STOP_SUPPLY`).