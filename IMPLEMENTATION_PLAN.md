# ModuleX Mobile App — Implementation Plan

> Last updated: 2026-03-19
> Based on full deep-dive of the Centrix web frontend at `D:\My Projects\Centrix\src`

---

## 1. What I Learned From the Codebase

### Architecture Patterns

- **Strict 4-layer per module**: `interface → impl → service → hook` — identical structure across every module
- **`createModuleHook()` factory** in `shared/hook/useModuleService.js` — single function generates all entity CRUDs (products, services, orders, appointments, bills, inventory) for any module; all three modules (parlour/pharmacy/restaurant) use it
- **Singleton provider pattern** — one service instance per module lifetime via `getXxxService()` provider functions
- **Hooks are the only entry point to UI** — components never touch API/service directly
- **Navigation**: `onNavigate(path)` prop drilled from root; App.jsx uses `window.history.pushState` + a `popstate` listener — no React Router
- **No global state library** — state flows via sessionStorage + localStorage + React props

### Storage Contract (Web → Mobile Mapping)

#### localStorage (persistent across sessions)

| Key | Type | Set When | Contents |
|-----|------|----------|----------|
| `theme` | string | App mount | `default` \| `ocean` \| `rose` \| `emerald` \| `violet` \| `parlour` |
| `accessToken` | JWT string | Login / signup | Bearer token for all API calls |
| `refreshToken` | JWT string | Login / signup | Used to get new accessToken on 401 |
| `user` | JSON | Login | Cached auth user object |
| `loggedInUser` | JSON | PortalSelectionPage | `{ id, username, roles, email }` |
| `registeredUser` | JSON | PreviewPage (signup) | Full user + business data from person API |
| `dmsFolderMap` | JSON | PreviewPage (signup) | `{ userRootFolderId, roleFolders: { Business, Customer, Employee }, businesses: { [bizId]: { folderId, productsFolderId, servicesFolderId, ordersFolderId, appointmentsFolderId, billsFolderId } } }` |

#### sessionStorage (cleared on page/tab close)

| Key | Type | Set When | Contents |
|-----|------|----------|----------|
| `signupData` | JSON | AuthenticationPage | `{ username, email, password }` — survives page refresh during signup |
| `completeProfileData` | JSON | ProfilePage submit | Full profile + businesses array |
| `userProfile` | JSON | PortalSelectionPage | Full person API response |
| `businessTypeMap` | JSON | PortalSelectionPage | `{ [businessType]: [{ id, businessName, businessType, ... }] }` |
| `selectedBusinessType` | string | OwnerPortal dropdown | Active module type (e.g. `"Parlour"`) |
| `selectedBusiness` | string | OwnerPortal dropdown | Active business name |
| `activeTab` | string | OwnerPortal | Last visited tab name |
| `dmsPreviewFolders` | JSON | PreviewPage | Cached DMS folder structure for retry safety during signup |

**Mobile replaces all of these with AsyncStorage**, keyed identically and split into `auth.storage.ts`, `session.storage.ts`, `dms.storage.ts`.

### Backend Ports

| Service | Port | Base Path |
|---------|------|-----------|
| Auth | 8085 | `/auth/*`, `/auth-user/*` |
| Person + all modules | 8086 | `/persons/*`, `/business/*`, `/parlourProduct/*`, `/pharmacyProduct/*`, `/restaurantProduct/*`, `/parlourInventory/*`, etc. |
| DMS | 8087 | `/file/*`, `/folder/*` |

### Standard API Response Envelope

All module + person APIs return:
```json
{
  "success": true,
  "message": "...",
  "data": { ... } | [ ... ],
  "totalPages": 1,
  "error": null
}
```

DMS (folder/file) APIs return the same shape with `data` as `FolderDto` or `FileDto`.

### Business Types & Module Mapping

| Business Type | Module Hook | Backend Prefix |
|--------------|-------------|----------------|
| Parlour | `useParlour()` | `parlour` |
| Pharmacy | `usePharmacy()` | `pharmacy` |
| Restaurant | `useRestaurant()` | `restaurant` |
| Electronics | `useElectronics()` (stub) | `electronics` (stub) |
| Gym, Retail, Fashion, Custom | Not yet implemented | — |

Module is resolved in `OwnerPortal` as:
```js
const activeModule = selectedModule.includes('restaurant') ? restaurant
  : selectedModule.includes('pharmacy') ? pharmacy
  : selectedModule.includes('parlour') ? parlour
  : null;
```

### Module Entity Matrix

| Module | Products | Services | Orders | Appointments | Bills | Inventory |
|--------|----------|----------|--------|--------------|-------|-----------|
| Parlour | `/parlourProduct/*` | `/parlourService/*` | `/parlourOrder/*` | `/parlourAppointment/*` | `/parlourBill/*` | `/parlourInventory/*` |
| Pharmacy | `/pharmacyProduct/*` | `/pharmacyService/*` | `/pharmacyOrder/*` | `/pharmacyAppointment/*` | `/pharmacyBill/*` | `/pharmacyInventory/*` |
| Restaurant | `/restaurantProduct/*` | `/restaurantService/*` | `/restaurantOrder/*` | `/restaurantAppointment/*` | `/restaurantBill/*` | `/restaurantInventory/*` |

All on port 8086.

### DMS Image Display Contract

- `POST /file/create-multiple` (multipart) — `multipartFiles[]` + `resourceFileDtoListString` (JSON)
- `GET /file/get-resource?fileId=N` — single file binary stream
- `GET /file/get-resource/multiple?fileIdList=URL_ENCODED_JSON` — ZIP archive of multiple files
- Web: JSZip + blob URLs; Mobile: `expo-file-system` download → extract → local `file://` URI cache

### DMS Folder Structure

```
Centrix (app root, VITE_DMS_APP_ROOT_FOLDER_ID)
└── Business App Root (VITE_DMS_BUSINESS_APP_ROOT_FOLDER_ID)
    └── ${username}_${uuid}                ← user root folder (personFolderId)
        ├── Business                       ← role folder (roleFolders.Business)
        │   └── ${businessName}_${uuid}   ← branch folder (businesses[bizId].folderId)
        │       ├── Products               ← category (businesses[bizId].productsFolderId)
        │       │   └── ${productId}_${uuid}  ← per-entity folder
        │       ├── Services               ← category (businesses[bizId].servicesFolderId)
        │       ├── Orders                 ← category (businesses[bizId].ordersFolderId)
        │       │   └── ${orderId}
        │       ├── Appointments           ← category (businesses[bizId].appointmentsFolderId)
        │       │   └── ${appointmentId}
        │       └── Bills                  ← category (businesses[bizId].billsFolderId)
        │           └── ${billId}
        ├── Customer                       ← role folder (roleFolders.Customer)
        │   └── ${customerId}
        └── Employee                       ← role folder (roleFolders.Employee)
            └── ${employeeId}
```

`ensureBusinessDmsFolders(bizId, bizName)` repairs any missing subfolders for existing businesses. Deduplicates concurrent calls via an internal `Map`.

### Theme System

6 themes defined as CSS variables in `App.jsx`:

| Theme | Primary Color |
|-------|--------------|
| `default` | Orange `#f97316` |
| `ocean` | Blue `#0ea5e9` |
| `rose` | Pink `#e11d48` |
| `emerald` | Green `#10b981` |
| `violet` | Purple `#8b5cf6` |
| `parlour` | Gold `#f59e0b` |

CSS variable names: `--accent-primary`, `--accent-secondary`, `--accent-tertiary`, `--accent-gradient-from`, `--accent-gradient-to`, `--accent-bg`, `--accent-bg-hover`, `--accent-text`, `--accent-text-hover`, `--accent-border`, `--accent-soft-bg`, `--accent-shadow`, `--accent-glow`

Utility classes: `.accent-bg`, `.accent-hover-bg`, `.accent-soft-bg`, `.accent-gradient-bg`, `.accent-text`, `.accent-hover-text`, `.accent-border`, `.accent-shadow`, `.accent-glow`

### Password Validation Rules

```typescript
const PASSWORD_RULES = [
  { label: 'At least 8 characters',             test: (p) => p.length >= 8 },
  { label: '1 uppercase letter (A-Z)',           test: (p) => /[A-Z]/.test(p) },
  { label: '1 lowercase letter (a-z)',           test: (p) => /[a-z]/.test(p) },
  { label: '1 number (0-9)',                     test: (p) => /\d/.test(p) },
  { label: '1 special character (@$!%*?&#_-)',   test: (p) => /[@$!%*?&#_\-]/.test(p) },
];
```

AuthService backend regex: `/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$!%*?&#_\-])[A-Za-z\d@#$!%*?&#_\-]{8,}$/`

### Username Validation

- Pattern: `/^[a-zA-Z0-9_]{3,20}$/`
- Availability checked via `GET /auth-user/check-username/:username`

### Inventory Batch Model

```typescript
interface InventoryBatch {
  id: number;
  productId: number;
  businessId: number;
  batchNumber: string;
  purchasedQuantity: number;
  remainingQuantity: number;
  costPrice: number | null;
  sellingPrice: number | null;
  supplierName: string;
  manufactureDate: string; // ISO date
  expiryDate: string;      // ISO date
  receivedDate: string;    // ISO date
  status: 'ACTIVE' | 'ON_HOLD' | 'QUARANTINED' | 'EXPIRED' | 'DEPLETED';
}
```

### createModuleHook — Full API Surface

The factory (`useModuleService.js`) exposes the following on every module hook:

**State:**
```typescript
products: Product[];           productsTotalPages: number;
services: Service[];           servicesTotalPages: number;
customers: Person[];           employees: Person[];
orders: Order[];               ordersTotalPages: number;
appointments: Appointment[];
bills: Bill[];
inventory: InventoryBatch[];
loading: boolean;              error: string | null;
```

**Product CRUD:** `loadProducts(page, limit)`, `createProduct(data, files[], parentFolderId)`, `updateProduct(data)`, `deleteProduct(id)`

**Service CRUD:** `loadServices(page, limit)`, `createService(data, files[], parentFolderId)`, `updateService(data)`, `deleteService(id)`

**Order CRUD:** `loadOrders(page, limit)`, `loadOrdersByCustomer(customerId, options)`, `createOrder(data, files[], parentFolderId)`, `updateOrder(data)`, `deleteOrder(id)`

**Appointment CRUD:** `loadAppointments(page, limit)`, `loadAppointmentsByCustomer(customerId, options)`, `createAppointment(data, files[], parentFolderId)`, `updateAppointment(data)`, `deleteAppointment(id)`

**Bills:** `loadBills()` (by selected businessId)

**Customers/Employees:** `loadCustomers()` (all persons), `loadEmployees()` (stub — returns [])

**Inventory:** `loadInventoryByBusiness(businessId)`, `loadInventoryByProduct(productId, businessId)`, `addInventoryBatch(data)`, `updateInventoryBatch(data)`, `deleteInventoryBatch(id)`, `updateBatchStatus(id, status)`, `getExpiringBatches(businessId, withinDays)`, `getTotalStock(productId, businessId)`

**Utility:** `clearError()`

**Business ID resolution** (used internally by load methods): reads `selectedBusinessType` + `selectedBusiness` from sessionStorage → looks up `businessTypeMap[type].find(b => b.businessName === name)` → returns `b.id`

### Auth API Endpoints (Full)

```
POST /auth/request-otp              { channel, value }
POST /auth/resend-otp               { channel, value }
POST /auth/verify-otp               { channel, value, otp }
POST /auth/request-reset-password-otp  { channel, value }
POST /auth/resend-reset-otp            { channel, value }
POST /auth/verify-reset-password-otp   { channel, value, otp }
POST /auth/signup                   { username, email, phone?, password, roles }
POST /auth/login                    { username, password }
POST /auth/refresh                  { refreshToken }
POST /auth/reset-password           { email, newPassword }

GET  /auth-user/:id
GET  /auth-user/username/:username
GET  /auth-user/email/:email
GET  /auth-user/phone/:phone
GET  /auth-user/check-username/:username   → { available: boolean }
PUT  /auth-user/:id
DELETE /auth-user/:id
```

### Person API Endpoints (Full)

```
POST /persons                        createPerson (no business)
POST /persons?hasBusiness=true       createPerson with businesses
PUT  /persons?updatePhone=true&updateEmail=true&updateTypes=true
GET  /persons/:id
GET  /persons/username/:username
GET  /persons/viewAll
DELETE /persons/:id

POST /business
PUT  /business?updatePhone=true&updateEmail=true&updateIsActive=true
GET  /business/:id
GET  /business/viewAll
DELETE /business/:id
```

### DMS Folder API Endpoints (Full)

```
POST /folder/create                        FolderDto → FolderDto
POST /folder/create-multiple               FolderDto[] → FolderDto[]
GET  /folder/view?folderId=N&isChildsRequired=true
POST /folder/view-multiple                 FolderFilterRequest → FolderDto[]
PUT  /folder/update
PUT  /folder/update-multiple
DELETE /folder/delete?folderId=N
DELETE /folder/delete-multiple?folderIdListString=URL_ENCODED_JSON
```

### DMS File API Endpoints (Full)

```
POST /file/create-multiple            multipart: multipartFiles[] + resourceFileDtoListString
GET  /file/get-resource?fileId=N      binary stream
GET  /file/get-resource/multiple?fileIdList=URL_ENCODED_JSON   ZIP archive
DELETE /file/delete?fileId=N
```

---

## 2. Technology Stack

| Concern | Web App | Mobile App |
|---------|---------|------------|
| Framework | React 18 + Vite | React Native + Expo SDK 52 |
| Language | JavaScript | TypeScript |
| Styling | Tailwind CSS + CSS variables | StyleSheet + typed theme constants |
| Icons | lucide-react | lucide-react-native |
| Routing | `window.history.pushState` + `onNavigate` prop | React Navigation 6 (Stack + Bottom Tabs) |
| HTTP | axios | axios (same — just different baseURL) |
| Token storage | localStorage (sync) | AsyncStorage (async — all reads awaited) |
| Session storage | sessionStorage (sync) | AsyncStorage with `session:` namespace |
| File upload | Browser `File` API + multipart | expo-image-picker + expo-document-picker |
| DMS images | JSZip + blob URLs | expo-file-system download → `file://` cache |
| Env vars | `import.meta.env.VITE_*` | `process.env.EXPO_PUBLIC_*` |
| Modals | `position: fixed` overlays | React Native `Modal` + `@gorhom/bottom-sheet` |
| Animations | Tailwind transitions | react-native-reanimated 3 |
| Gestures | Browser pointer events | react-native-gesture-handler |
| Zip extraction | jszip | jszip (works in RN with blob-util) |
| Testing | Jest + React Testing Library | Jest + React Native Testing Library |
| Toast | Custom `useToast` hook | Port of same hook + Reanimated slide-in |

---

## 3. Complete Screen List (25 total)

---

### Auth Flow

---

#### Screen 1 — SplashScreen
**Web equivalent:** None (new, mobile-only)

- App logo + name centered on dark background
- On mount: reads `accessToken` from AsyncStorage
- If token exists → validate → navigate to `OwnerTabNavigator` or `CustomerTabNavigator` based on roles
- If no token → navigate to `LoginScreen`
- **Components:** `ScreenWrapper`
- **Storage:** `auth.storage.ts` → `getAccessToken()`

---

#### Screen 2 — LandingScreen
**Web equivalent:** LandingPage.jsx

- App hero: tagline, "Get Started" CTA → `SignupEmailScreen`, "Sign In" → `LoginScreen`
- Feature highlights: billing, analytics, multi-location, unified identity
- Module showcase: Parlour & Spa, Restaurant, Gym, Fashion, Retail, More
- Horizontal scroll of module cards with icons
- **Components:** `ScreenWrapper`, `AppButton` x2, horizontal `FlatList` of feature cards
- **Backend:** None

---

#### Screen 3 — LoginScreen
**Web equivalent:** AuthenticationPage.jsx (login half)

- Username input + PasswordInput (secureTextEntry + eye toggle)
- "Login" primary button → `useAuth.login(username, password)`
- "Don't have an account? Sign Up" ghost link → `SignupEmailScreen`
- "Forgot password?" link → `ForgotPasswordEmailScreen`
- On success: reads roles from AsyncStorage → routes to `OwnerTabNavigator` or `CustomerTabNavigator`
- **Components:** `ScreenWrapper`, `AppCard`, `AppInput` (username), `PasswordInput`, `AppButton` x2
- **Backend:** `useAuth.login(username, password)`
- **Storage reads:** none on mount; writes `accessToken`, `refreshToken`, `user` on success

---

#### Screen 4 — SignupEmailScreen
**Web equivalent:** AuthenticationPage.jsx (signup step 1 — email entry)

- Step 1 of 5 in signup wizard
- Email input field
- "Send OTP" primary button → `useAuth.requestOtp('email', email)`
- Params out: `{ email }`
- **Components:** `ScreenWrapper`, `StepProgress` (1/5), `AppInput` (email), `AppButton`
- **Backend:** `POST /auth/request-otp`

---

#### Screen 5 — OtpVerificationScreen
**Web equivalent:** AuthenticationPage.jsx (OTP modal → full screen)

- Step 2 of 5
- 6-box OTP input: auto-advance on digit, backspace returns to previous box
- "Verify" button → `useAuth.verifyOtp('email', email, otp)`
- "Resend OTP" ghost link → `useAuth.resendOtp('email', email)` with 5-min, 3-attempt rate limit (enforced server-side)
- Params in: `{ email }` | Params out: `{ email, otpVerified: true }`
- **Components:** `ScreenWrapper`, `StepProgress` (2/5), `OtpInput` (6-box), `AppButton` x2
- **Backend:** `POST /auth/verify-otp`, `POST /auth/resend-otp`

---

#### Screen 6 — SignupCredentialsScreen
**Web equivalent:** AuthenticationPage.jsx (signup steps 2–3 — username + password)

- Step 3 of 5
- Sub-steps: username → password → confirm password
- Username input: real-time availability check via `GET /auth-user/check-username/:username`
- PasswordInput x2: validated against PASSWORD_RULES (5 rules)
- `PasswordChecklist`: 5 circle icons (grey → green as rules pass), hover tooltip on each
- `PasswordMatch`: inline indicator showing match / mismatch
- Params in: `{ email, otpVerified }` | Params out: `{ email, username, password }`
- **Components:** `ScreenWrapper`, `StepProgress` (3/5), `AppInput` (username), `PasswordInput` x2, `PasswordChecklist`, `PasswordMatch`, `AppButton`
- **Backend:** `GET /auth-user/check-username/:username` (real-time), `POST /auth/signup` on submit
- **Storage write on submit:** `signupData = { username, email, password }` in session storage

---

#### Screen 7 — ProfilePersonalScreen
**Web equivalent:** ProfilePage.jsx (personal info section)

- Step 4 of 5
- Fields: First Name, Last Name, Phone Number (10-digit validation)
- Pre-fills from session storage `signupData` (username, email)
- Params in: `{ email, username, password }` | Params out: `{ email, username, password, firstName, lastName, phoneNumber }`
- **Components:** `ScreenWrapper`, `StepProgress` (4/5), `AppInput` x3, `AppButton`
- **Validators:** `validators.ts` — `/^\d{10}$/`

---

#### Screen 8 — ProfileBusinessScreen
**Web equivalent:** ProfilePage.jsx (business section)

- Step 5 of 5
- Toggle: "Do you have a business?" YES / NO
- If YES: business form fields:
  - Business Name (required)
  - Business Type → `BusinessTypePickerSheet` bottom sheet
  - Business Phone (10-digit)
  - Business Email
  - Registration Number (optional)
- "Add another business" button → repeats form
- "Remove" button per business
- Params in: `{ ...personal }` | Params out: `{ ...personal, businesses: [{ businessName, businessType, businessPhone, businessEmail, registrationNumber? }] }`
- **Components:** `ScreenWrapper`, `StepProgress` (5/5), `AppInput` x4, `SelectField` (businessType), `AppButton`

---

#### Screen 8b — BusinessTypePickerSheet
**Web equivalent:** ProfilePage.jsx (`<select>` element → bottom sheet on mobile)

- Not a full screen — bottom sheet overlay launched from `ProfileBusinessScreen`
- Radio list: Parlour, Pharmacy, Restaurant, Gym, Retail, Fashion, Electronics, Custom
- Confirm button
- **Components:** `@gorhom/bottom-sheet`, radio row list, `AppButton`
- **Constants:** `utils/businessTypes.ts`

---

#### Screen 9 — ReviewScreen
**Web equivalent:** PreviewPage.jsx

- Review all collected signup data before account creation
- Personal info card: firstName, lastName, username, email, phoneNumber, password (masked)
- Business info cards (one per business): name, type
- Roles preview: CUSTOMER always shown; BUSINESS_OWNER shown if businesses > 0
- "Save & Continue" → triggers DMS folder creation + `person.createPerson()`
- "Cancel" → back to ProfileBusinessScreen
- Loading spinner overlay during creation
- Error display with retry (DMS creation is idempotent via sessionStorage cache)
- **Components:** `ScreenWrapper`, `AppCard` x2+, `SectionHeader`, `AppButton` x2, `LoadingSpinner`, `ErrorBanner`
- **Backend:**
  1. `POST /folder/create` (user root folder: `${username}_${uuid}`)
  2. `POST /folder/create-multiple` (3 role folders: Business, Customer, Employee)
  3. Per business: `POST /folder/create` (branch) + `POST /folder/create-multiple` (5 categories)
  4. `POST /persons?hasBusiness=true` (createPerson with enriched folderIds)
- **Storage writes:** `registeredUser`, `dmsFolderMap` in localStorage

---

#### Screen 10 — PortalSelectionScreen
**Web equivalent:** PortalSelectionPage.jsx

- Shown after registration (and optionally after login when user has both roles)
- Populates storage: `loggedInUser`, `userProfile`, `businessTypeMap`
- Card: "Owner Portal" (visible if `BUSINESS_OWNER` role) → `OwnerTabNavigator`
- Card: "Customer Portal" (visible if `CUSTOMER` role) → `CustomerTabNavigator`
- Success notification display (simulated email sent)
- **Components:** `ScreenWrapper`, `AppCard` x2, `AppButton` x2
- **Backend:** none on this screen; storage reads from `registeredUser` in localStorage
- **Storage writes:** `loggedInUser` (localStorage), `userProfile` + `businessTypeMap` (session)

---

#### Screen 11 — ForgotPasswordEmailScreen
**Web equivalent:** AuthenticationPage.jsx — `forgotPasswordStep === 'email'`

- Standalone screen (not inside signup wizard)
- Email input field
- "Send OTP" → `useAuth.requestResetPasswordOtp(email)` — validates email exists in DB first
- Back button → `LoginScreen`
- **Components:** `ScreenWrapper`, `AppInput` (email), `AppButton` x2
- **Backend:** `POST /auth/request-reset-password-otp`

---

#### Screen 12 — ForgotPasswordOtpScreen
**Web equivalent:** AuthenticationPage.jsx — `forgotPasswordStep === 'otp'`

- 6-box OTP input for reset password verification
- "Verify" → `useAuth.verifyResetPasswordOtp('email', email, otp)`
- "Resend OTP" → `POST /auth/resend-reset-otp`
- Params in: `{ email }`
- **Components:** `ScreenWrapper`, `OtpInput`, `AppButton` x2
- **Backend:** `POST /auth/verify-reset-password-otp`, `POST /auth/resend-reset-otp`

---

#### Screen 13 — ForgotPasswordNewScreen
**Web equivalent:** AuthenticationPage.jsx — `forgotPasswordStep === 'newPassword'`

- New Password input + Confirm Password input
- `PasswordChecklist` (5 rules, circle icons, hover tooltips)
- `PasswordMatch` indicator
- Same-password check: backend rejects if new == old (`BadRequestException`)
- "Reset Password" → `useAuth.resetPassword(email, newPassword)` → `POST /auth/reset-password`
- On success: navigate to `LoginScreen` + show success toast
- **Components:** `ScreenWrapper`, `PasswordInput` x2, `PasswordChecklist`, `PasswordMatch`, `AppButton`, `Toast`
- **Backend:** `POST /auth/reset-password { email, newPassword }`

---

### Owner Portal

---

#### Screen 14 — DashboardScreen
**Web equivalent:** OwnerPortal.jsx — Dashboard tab

- `BusinessSelector` in header: shows `[ModuleType] / [BusinessName]`, tap → `BusinessSwitcherSheet`
- Stats row (horizontal ScrollView): Revenue, Orders, Appointments, Customers — each as a mini card
- Quick actions row: + Product | + Order | + Appointment | + Invoice (each navigates to add mode)
- Recent Orders: `FlatList` (last 5 orders) with "See all" → `OperationsScreen`
- Upcoming Appointments: `FlatList` (next 5) with "See all" → `OperationsScreen`
- **Components:** `ScreenWrapper`, `BusinessSelector`, `AppCard`, `OrderCard`, `AppointmentCard`, `SectionHeader`, `LoadingSpinner`, `EmptyState`
- **Backend:** `activeModule.loadOrders(1, 5)`, `activeModule.loadAppointments(1, 5)`
- **Storage reads:** `selectedBusiness`, `selectedBusinessType`, `businessTypeMap`
- On mount: reads storage, resolves `activeModule`, calls `ensureBusinessDmsFolders(bizId, bizName)`

---

#### Screen 15 — CatalogScreen
**Web equivalent:** OwnerPortal.jsx — Products + Services tabs (merged with segmented control)

- Segmented control at top: **Products** | **Services**
- Products tab:
  - `FlatList` of `ProductCard` rows (image thumb | name | price | status pill)
  - Pull-to-refresh → `activeModule.loadProducts(page, limit)`
  - Search bar → client-side filter on name/brand
  - Tap row → `ProductDetailScreen` (view mode)
- Services tab:
  - `FlatList` of `ServiceCard` rows (image thumb | name | price | duration)
  - Pull-to-refresh → `activeModule.loadServices(page, limit)`
  - Tap row → `ServiceDetailScreen` (view mode)
- FAB (bottom-right) → `ProductDetailScreen` or `ServiceDetailScreen` in add mode
- **Components:** `ScreenWrapper`, `TopTabBar`, `FlatList`, `ProductCard`, `ServiceCard`, `FAB`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadProducts()`, `activeModule.loadServices()`

---

#### Screen 16 — ProductDetailScreen
**Web equivalent:** `ParlourProductDetails.jsx`, `PharmacyProductDetails.jsx`, `RestaurantProductDetails.jsx`

- Works in **view**, **edit**, and **add** modes
- `ImageGallery` at top: horizontal swipeable FlatList + dot indicators
- Image tap → full-screen viewer; "+" tap → `expo-image-picker` → multipart upload to DMS
- Form fields: name, description, price, stock, status, brand, volume, volumeUnit
- Pharmacy-specific fields: genericName, dosageForm, strength, routeOfAdministration, isPrescriptionRequired, expiryDate
- Header "Edit" button → switches to edit mode; "Save" + "Cancel" in edit mode
- Delete button → `ConfirmDialog` → `activeModule.deleteProduct(id)`
- **Components:** `ScreenWrapper`, `ImageGallery`, `DmsImage`, `AppInput`, `AppButton`, `StatusPill`, `ConfirmDialog`, `Toast`
- **Backend:** `activeModule.updateProduct()`, `activeModule.deleteProduct()`, `activeModule.createProduct()`, `useFile.uploadMultipleFiles()`, `useDmsImages()`
- **DMS:** images stored in `businesses[bizId].productsFolderId`

---

#### Screen 17 — ServiceDetailScreen
**Web equivalent:** `ParlourServiceDetails.jsx`, `PharmacyServiceDetails.jsx`, `RestaurantServiceDetails.jsx`

- Identical layout to `ProductDetailScreen` but for services
- Form fields: name, description, price, duration (minutes), status
- No pharmacy-specific fields
- **Components:** same as `ProductDetailScreen`
- **Backend:** `activeModule.updateService()`, `activeModule.deleteService()`, `activeModule.createService()`, `useDmsImages()`
- **DMS:** images stored in `businesses[bizId].servicesFolderId`

---

#### Screen 18 — OperationsScreen
**Web equivalent:** OwnerPortal.jsx — Orders + Appointments + Billing tabs (merged)

- Segmented control: **Orders** | **Appointments** | **Bills**
- Orders tab: `FlatList` of `OrderCard` (order# | customer name | amount | status pill | date)
- Appointments tab: `FlatList` of `AppointmentCard` (date/time | customer | service | status)
- Bills tab: `FlatList` of `BillCard` (bill# | customer | amount | status | download icon)
- Pull-to-refresh on each tab
- FAB → add new Order / Appointment / Bill
- **Components:** `ScreenWrapper`, `TopTabBar`, `FlatList`, `OrderCard`, `AppointmentCard`, `BillCard`, `FAB`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadOrders()`, `activeModule.loadAppointments()`, `activeModule.loadBills()`

---

#### Screen 19 — OrderDetailScreen
**Web equivalent:** `ParlourOrderDetails.jsx`, `PharmacyOrderDetails.jsx`, `RestaurantOrderDetails.jsx`

- Customer info card: name, phone
- Ordered items `FlatList`: product name | quantity | unit price | line total
- Payment summary card: subtotal, tax, total, amount paid, refunded
- `StatusPill` badge: PENDING / CONFIRMED / COMPLETED / CANCELLED
- "Update Status" button → `StatusPickerSheet` bottom sheet
- "Generate Bill" button (if not yet billed) → `activeModule.createBill()`
- **Components:** `ScreenWrapper`, `AppCard`, `FlatList`, `StatusPill`, `AppButton`, `Toast`, `ConfirmDialog`
- **Backend:** `activeModule.updateOrder()`, `activeModule.createBill()`

---

#### Screen 20 — AppointmentDetailScreen
**Web equivalent:** `ParlourAppointmentDetails.jsx`, `PharmacyAppointmentDetails.jsx`

- Appointment info card: customer name, service, date, time, notes
- `StatusPill`: SCHEDULED / CONFIRMED / COMPLETED / CANCELLED
- "Update Status" → `StatusPickerSheet` bottom sheet with status options
- "Cancel Appointment" danger button → `ConfirmDialog` → `activeModule.updateAppointment()`
- **Components:** `ScreenWrapper`, `AppCard`, `StatusPill`, `AppButton`, `ConfirmDialog`, `Toast`
- **Backend:** `activeModule.updateAppointment()`

---

#### Screen 21 — BillingDetailScreen
**Web equivalent:** `ParlourBillingDetails.jsx`, `PharmacyBillingDetails.jsx`, `RestaurantBillingDetails.jsx`

- Bill info card: bill number, customer, date, line items, subtotal, tax, total
- `StatusPill`: PAID / UNPAID / PARTIALLY_PAID
- "Download Bill" → `expo-file-system` save + `expo-sharing` native share sheet
- "Mark as Paid" button → `activeModule.updateBill()`
- **Components:** `ScreenWrapper`, `AppCard`, `FlatList`, `StatusPill`, `AppButton`, `Toast`
- **Backend:** `activeModule.updateBill(billId, billData)`
- **Download:** `expo-file-system` + `expo-sharing`

---

#### Screen 22 — InventoryScreen
**Web equivalent:** `InventoryPage.jsx` (inside OwnerPortal — Inventory tab)

- **List view** (default):
  - Segmented row in TableShell header: status filter (ALL/ACTIVE/ON_HOLD/QUARANTINED/EXPIRED/DEPLETED) + "Expiring 30d" toggle
  - Search bar (by product name or batch number)
  - `FlatList` of inventory batch rows: product name | batch# | purchased | remaining (color-coded) | expiry date (styled: strikethrough if expired, red if ≤30 days) | status pill
  - Action buttons per row: View | Edit | Delete
  - Pull-to-refresh → `activeModule.loadInventoryByBusiness(businessId)`
- **Detail view** (tap row):
  - Batch Info card: product, batch#, supplier, received/manufacture/expiry dates, status
  - Stock card: purchased qty, remaining qty, stock used %, usage progress bar, cost price, selling price
  - "Edit" button → Edit view
- **Add / Edit view** (FAB or Edit button):
  - Left column: Product (select), Batch Number, Supplier, Manufacture Date, Expiry Date, Received Date, Status
  - Right column: Purchased Quantity, Remaining Quantity, Cost Price (₹), Selling Price (₹)
  - Expiry warning: shows "Expires in X days" in amber if ≤90 days
  - On save: `activeModule.addInventoryBatch(payload)` or `activeModule.updateInventoryBatch(payload)`
- **Validation:** productId required, purchasedQuantity > 0, expiry ≥ manufacture date
- **Components:** `ScreenWrapper`, `TopTabBar` (status filter), `FlatList`, `InventoryBatchCard`, `FAB`, `AppCard`, `AppInput`, `SelectField`, `DatePicker`, `StatusPill`, `ProgressBar`, `AppButton`, `ConfirmDialog`, `Toast`
- **Backend:** full inventory API surface via `activeModule`
- **Critical:** useEffect depends only on `selectedBusinessId` (NOT `activeModule` — causes infinite loop); reads `activeModule.inventory` directly (no local copy)

---

#### Screen 23 — PeopleScreen
**Web equivalent:** OwnerPortal.jsx — Employees + Customers tabs (merged)

- Segmented control: **Employees** | **Customers**
- Each tab: `FlatList` of `PersonCard` (avatar initials | name | role | phone)
- Search bar (client-side filter)
- Pull-to-refresh
- FAB → add new (future)
- **Components:** `ScreenWrapper`, `TopTabBar`, `FlatList`, `PersonCard`, `AvatarBadge`, `FAB`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadCustomers()` (calls `GET /persons/viewAll`), `activeModule.loadEmployees()` (stub — [])

---

#### Screen 24 — AccountScreen
**Web equivalent:** OwnerPortal.jsx — Account tab (settings)

- Profile header card: avatar initials circle, full name, email, role badge
- Settings list rows (with chevron):
  - Edit Profile
  - My Businesses → `BusinessListScreen`
  - Theme → `ThemePickerSheet` (6 themes shown as color swatches)
  - Notifications (future)
  - Help
  - Privacy Policy
- "Add Business" → `@gorhom/bottom-sheet` with businessName + businessType form
- "Logout" danger button → `ConfirmDialog` → clears all AsyncStorage → `LoginScreen`
- **Components:** `ScreenWrapper`, `AppCard`, `AvatarBadge`, `SectionHeader`, `AppButton`, `ConfirmDialog`, `Toast`, `ThemePickerSheet`
- **Backend:** `useAuth.logout()` (clears storage), `usePerson.updatePerson()`
- **Storage on logout:** clears `accessToken`, `refreshToken`, `user`, `loggedInUser`, `registeredUser`, `dmsFolderMap`, all sessionStorage keys

---

### Customer Portal

---

#### Screen 25 — ExploreScreen
**Web equivalent:** CustomerPortal.jsx — main view

- Search bar at top → filter businesses by name
- Horizontal scrollable category chips: All | Parlour | Pharmacy | Restaurant | Electronics
- "Featured" section: horizontal `FlatList` of `BusinessCard` (image | name | type | rating)
- "Nearby" section: vertical `FlatList` of `BusinessCard`
- Tap business → detail/booking flow (future)
- **Components:** `ScreenWrapper`, `AppInput` (search), chip row, `FlatList` x2, `BusinessCard`, `LoadingSpinner`, `EmptyState`
- **Backend:** TBD — browse businesses by type

---

#### Screen 26 — BookingsScreen
**Web equivalent:** CustomerPortal.jsx — Bookings tab

- Segmented control: **Upcoming** | **Past**
- Each tab: `FlatList` of `AppointmentCard` (date/time | business name | service | status)
- Pull-to-refresh
- Tap → appointment detail view (read-only)
- **Components:** `ScreenWrapper`, `TopTabBar`, `FlatList`, `AppointmentCard`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadAppointmentsByCustomer(personId, { status: 'SCHEDULED,CONFIRMED' })` for Upcoming; `{ status: 'COMPLETED,CANCELLED' }` for Past

---

#### Screen 27 — CustomerOrdersScreen
**Web equivalent:** CustomerPortal.jsx — Orders tab

- Segmented control: **Active** | **History**
- Each tab: `FlatList` of `OrderCard` (order# | business | amount | status | date)
- Pull-to-refresh
- Tap → order detail view (read-only)
- **Components:** `ScreenWrapper`, `TopTabBar`, `FlatList`, `OrderCard`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadOrdersByCustomer(personId, { status: 'PENDING,CONFIRMED' })` for Active

---

#### Screen 28 — BillsScreen
**Web equivalent:** CustomerPortal.jsx — Bills tab

- `FlatList` of `BillCard` (bill# | business name | amount | status | download icon)
- Download tap → `expo-file-system` + `expo-sharing`
- Pull-to-refresh
- **Components:** `ScreenWrapper`, `FlatList`, `BillCard`, `EmptyState`, `LoadingSpinner`
- **Backend:** `activeModule.loadBills()` filtered by personId (customer)

---

#### Screen 29 — CustomerProfileScreen
**Web equivalent:** CustomerPortal.jsx — Profile section

- Profile card: avatar initials, full name, email, phone
- "Switch to Owner Portal" card (visible only if user has `BUSINESS_OWNER` role) → `OwnerTabNavigator`
- Settings rows: Theme, Notifications, Language, Help, Contact Us
- "Logout" danger button → clears AsyncStorage → `LoginScreen`
- **Components:** `ScreenWrapper`, `AppCard`, `AvatarBadge`, `SectionHeader`, `AppButton`, `Toast`, `ConfirmDialog`
- **Backend:** `useAuth.logout()`
- **Storage reads:** `loggedInUser` roles to conditionally show "Switch to Owner Portal"

---

## 4. Auth Flow State Machine

```
AuthenticationPage (web) → Screens 3–13 (mobile)

SIGNUP WIZARD:
  SignupEmailScreen
    ↓ { email }
  OtpVerificationScreen
    ↓ { email, otpVerified: true }
  SignupCredentialsScreen
    ↓ { email, username, password }          ← also calls POST /auth/signup here
  ProfilePersonalScreen
    ↓ { email, username, password, firstName, lastName, phoneNumber }
  ProfileBusinessScreen
    ↓ { ...all, businesses: [{ businessName, businessType, businessPhone, businessEmail }] }
  ReviewScreen
    → DMS folder creation (5 API calls per business)
    → POST /persons?hasBusiness=true
    → writes localStorage + sessionStorage
    ↓
  PortalSelectionScreen
    → /customer-portal OR /business-portal

FORGOT PASSWORD:
  LoginScreen → ForgotPasswordEmailScreen
    ↓ { email }
  ForgotPasswordOtpScreen
    ↓ { email, otpVerified: true }
  ForgotPasswordNewScreen
    → POST /auth/reset-password
    ↓
  LoginScreen (+ success toast)
```

State is passed via React Navigation params between auth screens. After auth completes, state lives in AsyncStorage.

---

## 5. Navigation Tree

```
RootNavigator
├── (if not authenticated) AuthNavigator [Stack]
│   ├── SplashScreen
│   ├── LandingScreen
│   ├── LoginScreen
│   ├── SignupEmailScreen
│   ├── OtpVerificationScreen
│   ├── SignupCredentialsScreen
│   ├── ProfilePersonalScreen
│   ├── ProfileBusinessScreen
│   ├── ReviewScreen
│   ├── PortalSelectionScreen
│   ├── ForgotPasswordEmailScreen
│   ├── ForgotPasswordOtpScreen
│   └── ForgotPasswordNewScreen
│
├── (if BUSINESS_OWNER) OwnerTabNavigator [Bottom Tabs]
│   ├── Dashboard [Tab] → DashboardScreen
│   ├── Catalog [Tab] → Stack:
│   │   ├── CatalogScreen (Products/Services top tabs)
│   │   ├── ProductDetailScreen
│   │   └── ServiceDetailScreen
│   ├── Operations [Tab] → Stack:
│   │   ├── OperationsScreen (Orders/Appointments/Bills top tabs)
│   │   ├── OrderDetailScreen
│   │   ├── AppointmentDetailScreen
│   │   └── BillingDetailScreen
│   ├── Inventory [Tab] → Stack:
│   │   └── InventoryScreen (List/Detail/Add/Edit views — single screen, internal state)
│   ├── People [Tab] → Stack:
│   │   └── PeopleScreen (Employees/Customers top tabs)
│   └── Account [Tab] → AccountScreen
│
└── (if CUSTOMER only) CustomerTabNavigator [Bottom Tabs]
    ├── Explore [Tab] → ExploreScreen
    ├── Bookings [Tab] → BookingsScreen
    ├── Orders [Tab] → CustomerOrdersScreen
    ├── Bills [Tab] → BillsScreen
    └── Profile [Tab] → CustomerProfileScreen
```

`RootNavigator` reads AsyncStorage on mount → determines initial navigator.

---

## 6. Bottom Sheets (modal overlays, not full screens)

| Sheet | Launched From | Contents |
|-------|--------------|----------|
| `BusinessTypePickerSheet` | ProfileBusinessScreen | Radio list of 8 business types |
| `BusinessSwitcherSheet` | DashboardScreen header | Module type list → business list for selected type |
| `StatusPickerSheet` | OrderDetailScreen, AppointmentDetailScreen | Status radio list |
| `ThemePickerSheet` | AccountScreen | 6 color swatches |
| `AddBusinessSheet` | AccountScreen | businessName + businessType form |

All use `@gorhom/bottom-sheet`.

---

## 7. Component Catalogue

### Common

| Component | Web Equivalent | Notes |
|-----------|----------------|-------|
| `AppButton` | Tailwind button classes | `variant`: `primary` (orange), `secondary` (slate), `ghost`, `danger` |
| `AppInput` | styled `<input>` | `leftIcon`, `rightIcon`, `error`, `disabled`, `keyboardType`, `secureTextEntry` |
| `AppCard` | glass `div` | `bg: rgba(30,41,59,0.4)` + `border: rgba(71,85,105,0.5)`, `borderRadius: 16` |
| `StatusPill` | `StatusPill.jsx` | `label → color` mapping: ACTIVE/PAID/COMPLETED→green, PENDING→amber, CANCELLED/EXPIRED→red, ON_HOLD→slate |
| `AvatarBadge` | avatar initials circle | 2-letter initials, configurable size + color, optional badge dot |
| `LoadingSpinner` | Tailwind spinner | `ActivityIndicator` wrapper with overlay option |
| `EmptyState` | empty table state | icon + heading + message + optional CTA button |
| `ErrorState` | error toast/banner | error message + "Retry" button |
| `Toast` | `Toast.jsx` + `useToast` | slide-in from bottom, auto-dismiss after `duration`ms, `type`: success/error/info |
| `ConfirmDialog` | `ConfirmDialog.jsx` | `Modal` with title, message, Cancel + Confirm (danger color) |
| `SectionHeader` | icon + title row | icon (lucide) + title + optional "See all" link |
| `ErrorBanner` | inline error div | red bg + message, dismissible |

### Forms

| Component | Web Equivalent | Notes |
|-----------|----------------|-------|
| `OtpInput` | 6 HTML `<input>` boxes | 6 `TextInput` refs, auto-focus on change, backspace returns focus to previous |
| `PasswordInput` | styled `<input type="password">` | `secureTextEntry` + eye icon toggle |
| `PasswordChecklist` | `PasswordChecklist` JSX | 5 circle icons grey→green as rules pass; long-press shows tooltip text |
| `PasswordMatch` | `PasswordMatch` JSX | inline "Passwords match / do not match" with icon |
| `SelectField` | `<select>` | Tap → `@gorhom/bottom-sheet` with radio/check list + confirm button |
| `StepProgress` | `StepProgress` JSX | Filled/empty circles + connecting lines; `step` + `total` props |
| `DatePicker` | `<input type="date">` | Platform-native DateTimePicker (`@react-native-community/datetimepicker`) |
| `ProgressBar` | CSS `<div>` bar | Used in InventoryScreen stock usage display |

### List Cards

| Component | Web Equivalent | Contents |
|-----------|----------------|----------|
| `ProductCard` | product table row | image thumb \| name \| brand \| price \| status pill |
| `ServiceCard` | service table row | image thumb \| name \| price \| duration |
| `OrderCard` | order table row | order# \| customer name \| amount \| status pill \| date |
| `AppointmentCard` | appointment table row | date/time \| customer \| service \| status pill |
| `BillCard` | bill table row | bill# \| customer \| amount \| status pill \| download icon |
| `PersonCard` | employee/customer row | `AvatarBadge` \| name \| role \| phone |
| `BusinessCard` | customer portal card | image \| business name \| type \| rating |
| `InventoryBatchCard` | inventory table row | product name \| batch# \| remaining (color) \| expiry (styled) \| status pill \| actions |

### Media

| Component | Web Equivalent | Notes |
|-----------|----------------|-------|
| `ImageGallery` | `MediaGallery.jsx` | Horizontal `FlatList` + dot page indicators + zoom tap |
| `DmsImage` | `useDmsImages` resolution | Takes `dmsFileId` → resolves via `useDmsImages` → local `file://` URI → `<Image>` |

### Layout

| Component | Web Equivalent | Notes |
|-----------|----------------|-------|
| `ScreenWrapper` | `div.min-h-screen` | `SafeAreaView` + `KeyboardAvoidingView` + dark `#0f172a` background |
| `TopTabBar` | segment tabs in OwnerPortal | Horizontal pill buttons for Products/Services, Orders/Appointments/Bills, etc. |
| `FAB` | "Add" button | Fixed bottom-right orange circle + `Plus` icon, `position: absolute` |
| `BusinessSelector` | business dropdown in header | Shows current `[ModuleType] / [BusinessName]`, tap → `BusinessSwitcherSheet` |

---

## 8. Custom Hooks (src/hooks/)

| Hook | Web Equivalent | Returns |
|------|----------------|---------|
| `useToast` | `useToast.js` | `{ toasts, showToast(msg, type, duration), dismissToast(id) }` — auto-dismiss after `duration`ms (default 3000) |
| `useBusinessSelector` | sessionStorage reads in OwnerPortal | `{ selectedBusiness, selectedModule, setSelectedBusiness, setSelectedModule }` — reads/writes AsyncStorage |

---

## 9. Context (src/context/)

| Context | Web Equivalent | Provides |
|---------|----------------|---------|
| `AppContext` | localStorage `theme` + sessionStorage `selectedBusiness` | `theme`, `setTheme`, `selectedBusiness`, `selectedModule`, `setSelectedBusiness`, `setSelectedModule` |

---

## 10. Folder Structure

```
modulex-mobile-app/
├── app.json                           # Expo config (name, slug, SDK 52)
├── app.config.js                      # Dynamic config (env vars → extra)
├── babel.config.js                    # Babel + react-native-reanimated plugin (must be FIRST)
├── tsconfig.json                      # TypeScript strict + path alias @/ → src/
├── package.json
├── .env                               # EXPO_PUBLIC_* API URLs
├── .env.example
│
├── assets/
│   ├── icon.png
│   ├── splash.png
│   └── fonts/
│       ├── Inter-Regular.ttf
│       ├── Inter-Medium.ttf
│       ├── Inter-SemiBold.ttf
│       ├── Inter-Bold.ttf
│       └── Inter-ExtraBold.ttf
│
└── src/
    ├── navigation/
    │   ├── RootNavigator.tsx           # AsyncStorage auth check → Auth stack OR Main tabs
    │   ├── AuthNavigator.tsx           # Stack: Splash→Landing→Login→Signup→Profile→Review→Success
    │   ├── OwnerTabNavigator.tsx       # Bottom tabs: Dashboard|Catalog|Operations|Inventory|People|Account
    │   └── CustomerTabNavigator.tsx   # Bottom tabs: Explore|Bookings|Orders|Bills|Profile
    │
    ├── backend/                        # Mirror of web backend — TypeScript port
    │   ├── auth/
    │   │   ├── api/
    │   │   │   ├── auth.api.interface.ts    # Method signatures
    │   │   │   └── auth.api.impl.ts         # axios HTTP calls (all /auth/* + /auth-user/* endpoints)
    │   │   ├── config/
    │   │   │   ├── api.config.ts            # baseURL = EXPO_PUBLIC_AUTH_API_URL || localhost:8085
    │   │   │   └── axios.instance.ts        # axios + JWT interceptor + auto-refresh on 401
    │   │   ├── service/
    │   │   │   └── auth.service.ts          # Validation + AsyncStorage token management
    │   │   ├── provider/
    │   │   │   └── auth.provider.ts         # Singleton
    │   │   ├── hook/
    │   │   │   └── useAuth.ts               # Only entry point for screens
    │   │   └── index.ts
    │   │
    │   ├── person/
    │   │   ├── api/
    │   │   │   ├── person.api.interface.ts
    │   │   │   └── person.api.impl.ts       # createPerson, updatePerson, getById, getByUsername, getAll, deletePerson + same for business
    │   │   ├── config/
    │   │   │   ├── api.config.ts            # baseURL = EXPO_PUBLIC_PERSON_API_URL || localhost:8086
    │   │   │   └── axios.instance.ts        # JWT injection from AsyncStorage
    │   │   ├── service/
    │   │   │   └── person.service.ts
    │   │   ├── provider/
    │   │   │   └── person.provider.ts
    │   │   ├── hook/
    │   │   │   └── usePerson.ts
    │   │   └── index.ts
    │   │
    │   ├── dms/
    │   │   ├── api/
    │   │   │   ├── file.api.interface.ts
    │   │   │   ├── file.api.impl.ts         # POST /file/create-multiple, GET /file/get-resource, DELETE /file/delete
    │   │   │   ├── folder.api.interface.ts
    │   │   │   └── folder.api.impl.ts       # POST/GET/PUT/DELETE /folder/*
    │   │   ├── config/
    │   │   │   ├── api.config.ts            # baseURL = EXPO_PUBLIC_DMS_API_URL || localhost:8087
    │   │   │   └── axios.instance.ts        # No auth header needed for DMS
    │   │   ├── service/
    │   │   │   ├── dms.service.ts
    │   │   │   ├── file.service.ts
    │   │   │   └── folder.service.ts
    │   │   ├── provider/
    │   │   │   ├── dms.provider.ts
    │   │   │   ├── file.provider.ts
    │   │   │   └── folder.provider.ts
    │   │   ├── hook/
    │   │   │   ├── useFile.ts
    │   │   │   ├── useFolder.ts
    │   │   │   └── useDmsImages.ts          # GET ZIP → expo-file-system → file:// URI map
    │   │   ├── util/
    │   │   │   ├── BusinessFolderUtils.ts   # createBusinessDmsFolders, createRoleFolders
    │   │   │   ├── EntityFolderUtils.ts     # createEntityFolder
    │   │   │   ├── ProductFolderUtils.ts
    │   │   │   ├── ServiceFolderUtils.ts
    │   │   │   ├── OrderFolderUtils.ts
    │   │   │   ├── AppointmentFolderUtils.ts
    │   │   │   ├── BillFolderUtils.ts
    │   │   │   └── ensureBusinessDmsFolders.ts  # Repair + dedup concurrent calls
    │   │   ├── dms-implant.config.ts        # Folder tree definition (roles, categories, entity naming)
    │   │   └── index.ts
    │   │
    │   └── modules/
    │       ├── shared/
    │       │   └── hook/
    │       │       └── useModuleService.ts  # createModuleHook factory — exact port from JS to TS
    │       │
    │       ├── parlour/
    │       │   ├── api/
    │       │   │   ├── parlour.api.interface.ts
    │       │   │   └── parlour.api.impl.ts  # All /parlourProduct, /parlourService, /parlourOrder, /parlourAppointment, /parlourBill, /parlourInventory endpoints
    │       │   ├── config/
    │       │   │   ├── api.config.ts        # All route constants
    │       │   │   └── axios.instance.ts
    │       │   ├── service/
    │       │   │   └── parlour.service.ts   # Validation wrappers + api delegation
    │       │   ├── provider/
    │       │   │   └── parlour.provider.ts
    │       │   ├── hook/
    │       │   │   └── useParlour.ts        # = createModuleHook(getParlourService, 'Parlour')
    │       │   └── index.ts
    │       │
    │       ├── pharmacy/                    # Identical structure, /pharmacy* endpoints
    │       │   ├── api/
    │       │   │   ├── pharmacy.api.interface.ts
    │       │   │   └── pharmacy.api.impl.ts
    │       │   ├── config/
    │       │   │   ├── api.config.ts
    │       │   │   └── axios.instance.ts
    │       │   ├── service/
    │       │   │   └── pharmacy.service.ts
    │       │   ├── provider/
    │       │   │   └── pharmacy.provider.ts
    │       │   ├── hook/
    │       │   │   └── usePharmacy.ts
    │       │   └── index.ts
    │       │
    │       └── restaurant/                  # Identical structure, /restaurant* endpoints
    │           ├── api/
    │           │   ├── restaurant.api.interface.ts
    │           │   └── restaurant.api.impl.ts
    │           ├── config/
    │           │   ├── api.config.ts
    │           │   └── axios.instance.ts
    │           ├── service/
    │           │   └── restaurant.service.ts
    │           ├── provider/
    │           │   └── restaurant.provider.ts
    │           ├── hook/
    │           │   └── useRestaurant.ts
    │           └── index.ts
    │
    ├── storage/                             # AsyncStorage abstraction
    │   ├── auth.storage.ts                  # accessToken, refreshToken, user, loggedInUser
    │   ├── session.storage.ts               # signupData, userProfile, businessTypeMap, selectedBusiness, selectedBusinessType, activeTab, completeProfileData, dmsPreviewFolders
    │   └── dms.storage.ts                   # dmsFolderMap
    │
    ├── screens/
    │   ├── auth/
    │   │   ├── SplashScreen.tsx             # Screen 1
    │   │   ├── LandingScreen.tsx            # Screen 2
    │   │   ├── LoginScreen.tsx              # Screen 3
    │   │   ├── SignupEmailScreen.tsx         # Screen 4
    │   │   ├── OtpVerificationScreen.tsx    # Screen 5
    │   │   ├── SignupCredentialsScreen.tsx  # Screen 6 — username + password + availability check
    │   │   ├── ProfilePersonalScreen.tsx    # Screen 7
    │   │   ├── ProfileBusinessScreen.tsx    # Screen 8 — business form + bottom sheet picker
    │   │   ├── ReviewScreen.tsx             # Screen 9 — DMS creation + person API
    │   │   ├── PortalSelectionScreen.tsx    # Screen 10
    │   │   ├── ForgotPasswordEmailScreen.tsx  # Screen 11
    │   │   ├── ForgotPasswordOtpScreen.tsx    # Screen 12
    │   │   └── ForgotPasswordNewScreen.tsx    # Screen 13 — same-password validation enforced server-side
    │   │
    │   ├── owner/
    │   │   ├── DashboardScreen.tsx          # Screen 14
    │   │   ├── CatalogScreen.tsx            # Screen 15 — Products/Services segmented
    │   │   ├── ProductDetailScreen.tsx      # Screen 16 — view/edit/add + DMS images
    │   │   ├── ServiceDetailScreen.tsx      # Screen 17
    │   │   ├── OperationsScreen.tsx         # Screen 18 — Orders/Appointments/Bills segmented
    │   │   ├── OrderDetailScreen.tsx        # Screen 19
    │   │   ├── AppointmentDetailScreen.tsx  # Screen 20
    │   │   ├── BillingDetailScreen.tsx      # Screen 21
    │   │   ├── InventoryScreen.tsx          # Screen 22 — internal view state: list/detail/add/edit
    │   │   ├── PeopleScreen.tsx             # Screen 23
    │   │   └── AccountScreen.tsx            # Screen 24
    │   │
    │   └── customer/
    │       ├── ExploreScreen.tsx            # Screen 25
    │       ├── BookingsScreen.tsx           # Screen 26
    │       ├── CustomerOrdersScreen.tsx     # Screen 27
    │       ├── BillsScreen.tsx              # Screen 28
    │       └── CustomerProfileScreen.tsx   # Screen 29
    │
    ├── components/
    │   ├── common/
    │   │   ├── AppButton.tsx               # primary | secondary | ghost | danger
    │   │   ├── AppInput.tsx                # leftIcon, rightIcon, error, disabled
    │   │   ├── AppCard.tsx                 # glass card container
    │   │   ├── StatusPill.tsx              # status → color mapping
    │   │   ├── AvatarBadge.tsx             # initials circle + optional badge
    │   │   ├── LoadingSpinner.tsx          # ActivityIndicator + optional fullscreen overlay
    │   │   ├── EmptyState.tsx              # icon + message + optional CTA
    │   │   ├── ErrorState.tsx              # error + retry button
    │   │   ├── ErrorBanner.tsx             # inline dismissible error bar
    │   │   ├── Toast.tsx                   # Reanimated slide-in, auto-dismiss
    │   │   ├── ConfirmDialog.tsx           # Modal: title + message + Cancel + Confirm
    │   │   └── SectionHeader.tsx           # icon + title + optional "See all"
    │   │
    │   ├── forms/
    │   │   ├── OtpInput.tsx                # 6-box auto-advance + backspace
    │   │   ├── PasswordInput.tsx           # secureTextEntry + eye toggle
    │   │   ├── PasswordChecklist.tsx       # 5 rule circles grey→green, long-press tooltip
    │   │   ├── PasswordMatch.tsx           # inline match / mismatch indicator
    │   │   ├── SelectField.tsx             # tap → bottom sheet radio list
    │   │   ├── StepProgress.tsx            # filled/empty dots + connecting line
    │   │   ├── DatePicker.tsx              # @react-native-community/datetimepicker wrapper
    │   │   └── ProgressBar.tsx             # used in inventory stock usage display
    │   │
    │   ├── list/
    │   │   ├── ProductCard.tsx             # image | name | brand | price | status pill
    │   │   ├── ServiceCard.tsx             # image | name | price | duration
    │   │   ├── OrderCard.tsx               # order# | customer | amount | status | date
    │   │   ├── AppointmentCard.tsx         # date/time | customer | service | status
    │   │   ├── BillCard.tsx                # bill# | customer | amount | status | download
    │   │   ├── PersonCard.tsx              # AvatarBadge | name | role | phone
    │   │   ├── BusinessCard.tsx            # image | name | type | rating
    │   │   └── InventoryBatchCard.tsx      # product | batch# | remaining (color) | expiry (styled) | status pill | actions
    │   │
    │   ├── media/
    │   │   ├── ImageGallery.tsx            # horizontal FlatList + dot indicators + zoom
    │   │   └── DmsImage.tsx                # dmsFileId → useDmsImages → file:// URI → Image
    │   │
    │   └── layout/
    │       ├── ScreenWrapper.tsx           # SafeAreaView + KeyboardAvoidingView + dark bg
    │       ├── TopTabBar.tsx               # Segmented control (Products/Services style)
    │       ├── FAB.tsx                     # Floating action button, absolute bottom-right
    │       └── BusinessSelector.tsx        # Header: current business + module, tap → sheet
    │
    ├── hooks/
    │   ├── useToast.ts                     # Toast queue: showToast(), dismissToast(), auto-dismiss
    │   └── useBusinessSelector.ts          # Read/write selectedBusiness + selectedModule in AsyncStorage
    │
    ├── context/
    │   └── AppContext.tsx                  # theme + selectedBusiness + selectedModule
    │
    ├── theme/
    │   ├── colors.ts                       # Dark palette + 6 accent themes (maps CSS vars to TS objects)
    │   ├── typography.ts                   # Inter font scale (Regular/Medium/SemiBold/Bold/ExtraBold)
    │   ├── spacing.ts                      # 4px base grid constants
    │   └── index.ts
    │
    └── utils/
        ├── statusColors.ts                 # ACTIVE/PAID/COMPLETED→green, PENDING→amber, CANCELLED/EXPIRED→red, ON_HOLD→slate
        ├── formatters.ts                   # formatDate(iso→DD MMM YYYY), formatCurrency(₹), formatPhone()
        ├── validators.ts                   # email, phone (10-digit), password (PASSWORD_RULES), username (/^[a-zA-Z0-9_]{3,20}$/)
        └── businessTypes.ts                # PARLOUR, PHARMACY, RESTAURANT, ELECTRONICS, GYM, RETAIL, FASHION, CUSTOM constants
```

---

## 11. Implementation Phases

### Phase 1 — Project Bootstrap

1. `npx create-expo-app modulex-mobile-app --template expo-template-blank-typescript`
2. Install all dependencies (see list below)
3. `babel.config.js`: add `react-native-reanimated` plugin **as the first plugin** (required)
4. `tsconfig.json`: strict mode + path alias `"@/*": ["src/*"]`
5. `.env` with all `EXPO_PUBLIC_*` API URL variables
6. `app.config.js`: load env vars into `extra` object
7. Set up Inter font loading via `expo-font` in `App.tsx`

**Core dependencies:**
```
@react-navigation/native
@react-navigation/bottom-tabs
@react-navigation/native-stack
react-native-screens
react-native-safe-area-context
@react-native-async-storage/async-storage
axios
expo-image-picker
expo-document-picker
expo-file-system
expo-sharing
expo-font
react-native-reanimated
react-native-gesture-handler
@gorhom/bottom-sheet
@react-native-community/datetimepicker
lucide-react-native
react-native-svg
jszip
react-native-blob-util
```

---

### Phase 2 — Storage & Theme

1. `storage/auth.storage.ts` — typed async get/set/clear for `accessToken`, `refreshToken`, `user`, `loggedInUser`
2. `storage/session.storage.ts` — typed async get/set for `signupData`, `userProfile`, `businessTypeMap`, `selectedBusiness`, `selectedBusinessType`, `activeTab`, `completeProfileData`, `dmsPreviewFolders`
3. `storage/dms.storage.ts` — typed async get/set for `dmsFolderMap` (full folder structure type)
4. `theme/colors.ts` — port all 6 CSS variable themes to typed TS color objects
5. `theme/typography.ts` — Inter font scales
6. `theme/spacing.ts` — 4px grid
7. `context/AppContext.tsx` — React Context providing theme + business selector state

---

### Phase 3 — Backend Services (Port from Web JS → TS)

All 4 layers ported 1:1 from JavaScript to TypeScript.

**Critical porting differences:**

| Web | Mobile |
|-----|--------|
| `localStorage.getItem('accessToken')` | `await AuthStorage.getAccessToken()` |
| `sessionStorage.getItem('businessTypeMap')` | `await SessionStorage.getBusinessTypeMap()` |
| `import.meta.env.VITE_*` | `process.env.EXPO_PUBLIC_*` |
| Axios interceptors: sync token read | Interceptors must be `async` (AsyncStorage is async) |
| On 401 refresh failure: `window.location.href = '/login'` | Navigate via navigation ref (`RootNavigator` exposes a `navigationRef`) |
| `crypto.randomUUID()` | `expo-crypto` → `Crypto.randomUUID()` |
| `File` API for uploads | `expo-image-picker` result → `FormData` with `uri` field |
| `JSZip` + blob URL | `JSZip` + `expo-file-system.writeAsStringAsync` / `FileSystem.downloadAsync` |

**Port order (dependencies first):**
1. `auth/` — blocks everything
2. `person/` — needed for signup ReviewScreen
3. `dms/` — needed for file upload + image display
4. `modules/shared/useModuleService.ts` — factory hook
5. `modules/parlour/`, `modules/pharmacy/`, `modules/restaurant/` — in parallel

**useModuleService.ts port notes:**
- `getSelectedBusinessId()` reads from `SessionStorage` (async) — must be awaited inside `useCallback`
- `inventory` state + all inventory methods already in factory — do NOT omit
- `loadInventoryByBusiness` useEffect **must only depend on `selectedBusinessId`**, NOT the module object (new object reference every render → infinite loop)
- Read `activeModule.inventory` directly, no local copy

---

### Phase 4 — Navigation

Set up `RootNavigator`, `AuthNavigator`, `OwnerTabNavigator`, `CustomerTabNavigator` as per Navigation Tree.

**Auth state check in `RootNavigator`:**
```typescript
const token = await AuthStorage.getAccessToken();
const user = await AuthStorage.getUser();
const initialRoute = token && user ? 'Main' : 'Auth';
```

**Tab bar icons** (lucide-react-native):
- Owner: `LayoutDashboard`, `Package`, `ClipboardList`, `Archive`, `Users`, `User`
- Customer: `Compass`, `Calendar`, `ShoppingBag`, `Receipt`, `User`

---

### Phase 5 — Common Components

Build components in this order (dependencies first):
1. `AppButton`, `AppInput`, `AppCard` — used by everything
2. `StatusPill`, `AvatarBadge`, `LoadingSpinner`, `EmptyState`, `ErrorState`, `ErrorBanner`
3. `Toast`, `ConfirmDialog`, `SectionHeader`
4. `OtpInput`, `PasswordInput`, `PasswordChecklist`, `PasswordMatch`, `SelectField`, `StepProgress`, `DatePicker`, `ProgressBar`
5. `ScreenWrapper`, `TopTabBar`, `FAB`, `BusinessSelector`
6. `ProductCard`, `ServiceCard`, `OrderCard`, `AppointmentCard`, `BillCard`, `PersonCard`, `BusinessCard`, `InventoryBatchCard`
7. `ImageGallery`, `DmsImage`

---

### Phase 6 — Auth Screens (Screens 1–13)

Build in order: Splash → Landing → Login → SignupEmail → OtpVerification → SignupCredentials → ProfilePersonal → ProfileBusiness → Review → PortalSelection → ForgotPasswordEmail → ForgotPasswordOtp → ForgotPasswordNew

State passed via React Navigation `route.params` between wizard screens.

---

### Phase 7 — Owner Portal Screens (Screens 14–24)

Build in order: Dashboard → Catalog → ProductDetail → ServiceDetail → Operations → OrderDetail → AppointmentDetail → BillingDetail → Inventory → People → Account

---

### Phase 8 — Customer Portal Screens (Screens 25–29)

Build in order: Explore → Bookings → CustomerOrders → Bills → CustomerProfile

---

### Phase 9 — DMS Image Handling (Mobile-specific)

```
useDmsImages(files: { dmsFileId: number }[]) → { [dmsFileId: number]: string }

Flow:
1. Build URL: GET /file/get-resource/multiple?fileIdList=URL_ENCODED_JSON with Bearer token
2. Response is ZIP binary
3. FileSystem.downloadAsync(url, cacheDir/temp.zip, { headers: { Authorization } })
4. Read ZIP with JSZip from the local file
5. For each entry: FileSystem.writeAsStringAsync(cacheDir/<dmsFileId>.jpg, base64Content, { encoding: 'base64' })
6. Return map: { [dmsFileId]: 'file://.../<dmsFileId>.jpg' }
7. Cleanup: delete temp files on component unmount (useEffect return)
```

---

### Phase 10 — Environment Variables

```bash
# .env
EXPO_PUBLIC_AUTH_API_URL=https://auth.eternitytechnologies.in
EXPO_PUBLIC_PERSON_API_URL=https://modulex.eternitytechnologies.in
EXPO_PUBLIC_PARLOUR_API_URL=https://modulex.eternitytechnologies.in
EXPO_PUBLIC_PHARMACY_API_URL=https://modulex.eternitytechnologies.in
EXPO_PUBLIC_RESTAURANT_API_URL=https://modulex.eternitytechnologies.in
EXPO_PUBLIC_DMS_API_URL=https://dms.eternitytechnologies.in
EXPO_PUBLIC_DMS_APP_ROOT_FOLDER_ID=1
EXPO_PUBLIC_DMS_BUSINESS_APP_ROOT_FOLDER_ID=2
```

---

## 12. File Count Summary

| Layer | Files |
|-------|-------|
| Navigation | 4 |
| Backend — auth | 6 |
| Backend — person | 6 |
| Backend — dms | 16 |
| Backend — modules × 3 | 18 |
| Storage abstraction | 3 |
| Screens — auth | 13 |
| Screens — owner | 11 |
| Screens — customer | 5 |
| Components — common | 12 |
| Components — forms | 8 |
| Components — list | 8 |
| Components — media | 2 |
| Components — layout | 4 |
| Hooks | 2 |
| Context | 1 |
| Theme | 4 |
| Utils | 4 |
| Config / env / root | 6 |
| **Total** | **~133 files** |

---

## 13. Key Implementation Pitfalls (From Web Bugs)

| Pitfall | Root Cause | Mobile Solution |
|---------|-----------|-----------------|
| Inventory API infinite loop | `activeModule` is new object ref every render; using it as `useEffect` dep triggers: load → setState → parent re-render → new ref → load again | `useEffect` depends only on `selectedBusinessId`; read `activeModule.inventory` directly, no local copy |
| DMS folder double-creation on retry | Signup creates folders, fails, retries, creates duplicate folders | Cache folder IDs in `session.storage.dmsPreviewFolders`; check before creating; key by `username + businessName\|businessType` |
| Double BCrypt encoding on password reset | `resetPassword` pre-encoded password before passing to `updateUser` which also encodes | Pass raw password to `updateUser` — it handles encoding internally |
| `getBusinessId` scope error | Function defined inside nested render function; called from outer JSX | Define `getBusinessId` at component level (reads from storage/context) |
| `activeModule.inventory` stale on first load | `loadInventoryByBusiness` sets hook state; reading `activeModule.inventory` immediately after await gets old value | Wait for state update via `useEffect` on `activeModule.inventory` OR redesign to return data directly |
| sessionStorage lost on tab close | OTP verified state stored only in Redis (server) + web memory | On mobile: no tab close issue; OTP state is server-side Redis only — no client caching needed |
