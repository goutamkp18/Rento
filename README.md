# Rento — Student Accommodation Discovery & PG Management SaaS

> **"Find your stay. Manage your space."**

Rento is a student accommodation discovery marketplace and PG management SaaS platform built with React, Vite, TypeScript, and Tailwind CSS. It connects university scholars with verified hostel & PG accommodations and equips PG owners with real-time bed inventory tracking, enquiry management, and operational dashboards.

---

## 🚀 Live Demo & Getting Started

### 1. Prerequisites
- **Node.js** (v18 or newer recommended, tested on Node v24.21.0)
- **npm** (v10 or newer)

### 2. Installation
```bash
# Clone the repository and navigate into the project directory
npm install
```

### 3. Running Locally in Development Mode
```bash
npm run dev
```
The application will launch at: **`http://localhost:5173/`**

### 4. Production Build Validation
```bash
npm run build
```
Compiles TypeScript using `tsc -b` and bundles assets with Vite.

---

## 🛠 Technology Stack

- **Framework**: React 18
- **Build Tool**: Vite 8
- **Language**: TypeScript (strict typing with comprehensive data models)
- **Styling**: Tailwind CSS (custom dark midnight palette with brand indigo and electric violet accents)
- **Routing**: React Router 7 (`react-router-dom`)
- **Icons**: Lucide React
- **Animations & Transitions**: Framer Motion & CSS hardware-accelerated transitions
- **Backend Ready Client**: `@supabase/supabase-js`

---

## 🗺 Implemented Route Structure

### 1. Public Discovery Website
| Route | Component | Description |
|---|---|---|
| `/` | `HomePage` | Hero section, college quick search, value propositions, popular PGs, 3-step workflow, dual student/owner CTAs, stats & testimonials, FAQ |
| `/pgs` | `ExplorePage` | Complete discovery catalog with real-time budget slider, room type checkboxes, food availability, amenities filter, sorting, and mobile drawer |
| `/pgs/:id` | `ListingDetailsPage` | Property photo gallery, college proximity, room matrix with bed counts, transparent cost breakdown, house rules, and visit booking modals |
| `/how-it-works` | `HowItWorksPage` | Interactive step-by-step presentation for both students and PG owners |
| `/owners` | `OwnersLandingPage` | B2B marketing landing page detailing bed tracking, enquiry triage, and proposed pricing |
| `/pricing` | `PricingPage` | Free Student tier, proposed ₹499/mo Starter tier, and enterprise tier with transparent prototype disclosures |

### 2. Authentication UI
| Route | Component | Description |
|---|---|---|
| `/login` | `LoginPage` | Email/password login with role toggle, 1-click demo persona switcher, password visibility toggle, and preserved redirect destination |
| `/signup` | `SignupPage` | Registration with Student vs PG Owner role selection (admin registration strictly forbidden on public signup) |
| `/forgot-password` | `ForgotPasswordPage` | Email reset link dispatch UI and recovery flow |

### 3. Student Portal (`/student/*`)
| Route | Component | Description |
|---|---|---|
| `/student/dashboard` | `StudentDashboardPage` | Personalized welcome, quick search shortcut, saved PGs counter, enquiry tracker, and college-proximity recommendations |
| `/student/compare` | `StudentComparePage` | Side-by-side comparison matrix of up to 3 accommodations across rent, deposit, upfront cost, food, rules, and amenities |
| `/student/favourites` | `StudentFavouritesPage` | Bookmarked properties with 1-click remove, persistent local storage sync, and empty state |
| `/student/enquiries` | `StudentEnquiriesPage` | Status-tracked enquiry threads, scheduled visit appointments, and property manager response threads |
| `/student/profile` | `StudentProfilePage` | Personal details, registered phone for visit SMS, and college affiliation |

### 4. PG Owner SaaS Portal (`/owner/*`)
| Route | Component | Description |
|---|---|---|
| `/owner/dashboard` | `OwnerDashboardPage` | Total properties, published count, live bed capacity, occupancy percentage bar, and student enquiry triage |
| `/owner/listings` | `OwnerListingsPage` | Property management table with status filtering, pause/resume listing controls, and submit for review |
| `/owner/listings/new` | `CreateEditListingPage` | 6-section property onboarding form (Basic info, university proximity, pricing, amenities, house rules, photos) |
| `/owner/listings/:id/edit` | `CreateEditListingPage` | Edit existing listing metadata and terms |
| `/owner/listings/:id/rooms` | `OwnerRoomsPage` | Live bed vacancy visualizer matrix with slot-level occupied vs vacant indicators and capacity validation |
| `/owner/enquiries` | `OwnerEnquiriesPage` | Two-pane inbox to respond to student queries, confirm visit dates, or decline slots with reasons |
| `/owner/subscription` | `OwnerSubscriptionPage` | Early Access complimentary status and proposed future commercial pricing |
| `/owner/settings` | `OwnerSettingsPage` | Business name, primary manager contact, and registered city |

### 5. Minimal Admin Interface
| Route | Component | Description |
|---|---|---|
| `/admin/listings` | `AdminListingsPage` | Operations review queue, separate publication status and physical on-site verification status, approve/reject controls with mandatory rejection reasons |

---

## 🔌 Teammate Backend (Supabase) Integration Guide

This frontend has been designed from the ground up for seamless backend integration:

### 1. Environment Variables
Add your Supabase project credentials to `.env`:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-supabase-anon-key
```

### 2. Service Layer Architecture
All frontend components communicate solely through `src/services/`:
- [listingsService.ts](file:///d:/rento/src/services/listingsService.ts): Connects to `pg_listings`, `rooms`, and `listing_images`
- [roomsService.ts](file:///d:/rento/src/services/roomsService.ts): Queries and updates bed capacities in `rooms`
- [enquiriesService.ts](file:///d:/rento/src/services/enquiriesService.ts): Syncs student inquiries and owner responses with `enquiries`
- [favouritesService.ts](file:///d:/rento/src/services/favouritesService.ts): Syncs student bookmarks with `favourites`
- [authService.ts](file:///d:/rento/src/services/authService.ts): Authenticates with Supabase Auth (`supabase.auth.signInWithPassword` & `signUp`)

When `VITE_SUPABASE_URL` is empty, the frontend runs smoothly in local fixture mode using persistent browser storage so you can demo the full UI immediately. Once credentials are provided, `src/lib/supabase.ts` activates live queries automatically.
