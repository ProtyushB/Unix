# web-preview — render Unix screens in Chrome

A standalone [Vite](https://vitejs.dev) + [react-native-web](https://necolas.github.io/react-native-web/)
harness for eyeballing screens in a desktop browser. Use it to check UI
correctness against a mockup **before** building to a device/emulator — then run
on the phone only for functional testing.

It is fully isolated from the native app: it lives in this folder, aliases
`react-native` → `react-native-web`, and never touches Metro, Expo, the native
entry (`index.js`), or the `android`/`ios` builds. Nothing here ships in the APK.

## Run it

```bash
npm run web
```

Opens on **http://localhost:5180**. Left sidebar = screen list. Top bar = device
preset + theme (all 16) + reload. The selected screen renders inside a phone
frame with the real app providers around it (theme, app context, signup draft,
navigation, safe-area, gesture handler).

## Add a screen to the gallery

Edit [`registry.tsx`](./registry.tsx) — one line per screen:

```ts
{ id: 'owner/wastage', title: 'Wastage', group: 'Owner',
  load: () => import('../src/screens/owner/WastageScreen') },
```

- `load` is a lazy `import()` so a screen that fails to bundle/run only breaks
  its own preview (an error boundary shows the stack, and a red `err` badge
  appears next to it in the sidebar) — never the whole harness.
- Default **and** named exports both work; pass `exportName` only to
  disambiguate a file that exports several components.
- Pass `params` for screens that read `route.params`:
  ```ts
  { id: 'owner/product-detail', title: 'Product Detail', group: 'Owner',
    params: { productId: 0, mode: 'add' },
    load: () => import('../src/screens/owner/ProductDetailScreen') },
  ```

## If a screen crashes with "must be used within XProvider"

Some screens need a context provider that normally lives in their navigator.
Add it to the `Stage` provider stack in [`PreviewApp.tsx`](./PreviewApp.tsx)
(that's how `SignupDraftProvider` got there). Keep additions lightweight and
global-safe.

## How the tricky bits are handled (see [`vite.config.ts`](./vite.config.ts))

| Concern | Handling |
|---|---|
| `react-native` core | aliased to `react-native-web` |
| `react-native-config` (no web build) | stubbed → `stubs/react-native-config.ts` |
| `@react-native-community/datetimepicker` (native-only, ships Flow source) | stubbed → real `<input type="date">` in `stubs/datetimepicker.tsx` |
| `lucide-react-native@1.11.0` (broken ESM) | aliased to `lucide-react` (same icon names + `size`/`color` API) |
| reanimated worklets in screen source | worklets babel plugin runs over `../src` |

## Known limitations

- **`Dimensions.get('window')`** reflects the **browser** window, not the phone
  frame (a react-native-web limitation). Most screens use flexbox so it rarely
  matters; a screen that keys layout off `Dimensions` may look off. Safe-area
  insets *are* faked to the device preset, so `useSafeAreaInsets()` is correct.
- **Native-only behavior** (biometrics, file system, image picker, share,
  real date picker, push) does nothing on web — this harness is for **UI**, not
  functional testing. Do functional testing on the device.
- API calls fire and typically fail/return empty against a browser origin, so
  data-driven screens show their loading/empty states. That's fine for layout
  review.
