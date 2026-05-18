# Contributing

Conventions for this SvelteKit project. Audience: human contributors and AI coding assistants. Read this before writing code.

If something here conflicts with a clear instruction in an issue or PR description, the instruction wins — but explain why in the PR.

---

## Project setup

```sh
# install
[your-package-manager] install

# dev server
[your-package-manager] run dev

# typecheck
[your-package-manager] run check

# tests
[your-package-manager] run test
```

> Fill in the package manager and any project-specific scripts.

---

## Svelte 5: use runes, not legacy syntax

This project is Svelte 5. **Do not write Svelte 4 code.** The `npx sv migrate svelte-5` tool exists for a reason — if you find yourself reaching for `export let`, `$:`, `on:click`, or `<slot />`, stop and use the rune-based equivalent.

### Reactivity

Use runes. The mapping:

| Svelte 4 (don't use) | Svelte 5 (use this) |
| --- | --- |
| `let count = 0` (at component top level) | `let count = $state(0)` |
| `$: doubled = count * 2` | `let doubled = $derived(count * 2)` |
| `$: { sideEffect() }` | `$effect(() => { sideEffect() })` |
| `export let name` | `let { name } = $props()` |
| `createEventDispatcher` | callback props (e.g. `onsubmit`) |
| `on:click={handler}` | `onclick={handler}` |
| `<slot />`, `<slot name="x" />` | `{@render children()}`, named snippets |

### `$state` and mutation

`$state` returns a deeply reactive proxy. **Mutate it directly — don't reassign for the sake of "immutability."** This is the one place in the codebase where in-place mutation is correct:

```ts
let items = $state<Item[]>([]);

// good
items.push(newItem);
items[0].done = true;

// unnecessary, and breaks fine-grained reactivity
items = [...items, newItem];
```

For class-based state, mark each reactive field with `$state` — wrapping the instance does **not** make its fields reactive:

```ts
class Counter {
  count = $state(0);          // reactive
  history: number[] = $state([]); // reactive
}
```

### `$derived` vs `$effect`

The single rule: **if you are computing a value, use `$derived`. If you are performing an action, use `$effect`.**

- `$derived` is pure, memoized, and lazy. The expression must have no side effects.
- `$effect` is for DOM interactions, subscriptions, timers, logging — things the outside world needs to know about. Return a cleanup function if you set anything up:

```ts
$effect(() => {
  const id = setInterval(() => count++, 1000);
  return () => clearInterval(id);
});
```

Do **not** use `$effect` to sync state between two `$state` variables. That is what `$derived` is for. If you find yourself writing `$effect(() => { b = f(a) })`, replace it with `let b = $derived(f(a))`.

For derivations too complex for a single expression, use `$derived.by(() => { ... })`.

### Props

Always destructure `$props()` with an inline type. No `export let`. No `$$Props`.

```svelte
<script lang="ts">
  import type { Snippet } from 'svelte';

  type Props = {
    label: string;
    variant?: 'primary' | 'secondary';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  };

  let {
    label,
    variant = 'primary',
    disabled = false,
    onclick,
    children
  }: Props = $props();
</script>
```

Rules:
- Treat non-bindable props as **read-only**. Don't mutate them.
- Mark a prop with `$bindable()` only when the parent legitimately needs two-way binding (form inputs, controlled components).
- Forwarding props: `let { class: className, ...rest }: Props = $props()`.

### Events: callback props, not dispatchers

`createEventDispatcher` is gone. Pass callbacks as props.

```svelte
<!-- child -->
<script lang="ts">
  let { onsave }: { onsave: (value: string) => void } = $props();
</script>
<button onclick={() => onsave('hello')}>Save</button>

<!-- parent -->
<Child onsave={(v) => console.log(v)} />
```

### Snippets, not slots

```svelte
<!-- Card.svelte -->
<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    header,
    children
  }: { header?: Snippet; children: Snippet } = $props();
</script>

<div class="card">
  {#if header}<div class="card-header">{@render header()}</div>{/if}
  <div class="card-body">{@render children()}</div>
</div>

<!-- usage -->
<Card>
  {#snippet header()}<h2>Title</h2>{/snippet}
  <p>Body content.</p>
</Card>
```

### Shared reactive state: `.svelte.ts` files

Don't use `writable`/`readable` stores in new code. Use a `.svelte.ts` module instead. Runes work in these files.

You cannot directly `export` a reassignable `$state` primitive. Export an accessor function or an object:

```ts
// src/lib/state/counter.svelte.ts
export function createCounter(initial = 0) {
  let count = $state(initial);
  return {
    get value() { return count; },
    increment: () => count++,
    reset: () => { count = initial; }
  };
}
```

Existing stores still work — don't churn the codebase migrating them unless asked.

---

## SvelteKit: data loading and forms

### `+page.ts` vs `+page.server.ts`

| File | Runs on | Use when |
| --- | --- | --- |
| `+page.ts` | server + client | Public API calls, no secrets, serializable return values |
| `+page.server.ts` | server only | DB queries, private env vars, file system, secrets |

If a load function uses anything from `$env/static/private` or `$env/dynamic/private`, it **must** be `.server.ts`. The compiler will reject the alternative.

### Load functions return data, don't manage UI state

```ts
// src/routes/posts/[id]/+page.server.ts
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const post = await db.posts.findById(params.id);
  if (!post) error(404, 'Not found');
  return { post };
};
```

- Always type with the generated `./$types` imports — don't hand-roll the event type.
- Use the imported `error()` and `redirect()` helpers; throw them by calling, don't `throw` manually.
- Use the `fetch` provided by the load event, not the global `fetch`.

### Form actions: progressive enhancement first

Use `<form method="POST">` with named actions. The page should work without JavaScript before you reach for `use:enhance`.

```ts
// src/routes/login/+page.server.ts
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';

export const actions: Actions = {
  login: async ({ request, cookies }) => {
    const data = await request.formData();
    const email = data.get('email');

    if (typeof email !== 'string' || !email) {
      return fail(400, { email, missing: true });
    }
    // ...
    redirect(303, '/dashboard');
  }
};
```

Return `fail(status, data)` for validation errors. Throw `redirect(...)` for success redirects. Don't return a plain `{ status: 400, ... }` object — it bypasses SvelteKit's form handling.

---

## TypeScript: prefer functional style

The general posture: **pure functions and immutable data in the logic layer; mutation only at the reactivity boundary (`$state`).** Think functional core, imperative shell.

### Strict mode is non-negotiable

`tsconfig.json` must keep `"strict": true`. No `// @ts-ignore` — use `// @ts-expect-error` with a comment explaining why, and treat each one as a bug to fix.

### Prefer functions over classes

Reach for a function first. Only use a class when:
- You need to attach reactive `$state` fields to instances (see Svelte 5 section).
- You're implementing an interface that requires a class (rare).

No inheritance hierarchies. If you need polymorphism, use a discriminated union.

### Pure functions by default

```ts
// good — pure, total, predictable
export function totalPrice(items: ReadonlyArray<LineItem>): number {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

// avoid — mutation, hidden dependency
let cachedTotal = 0;
export function totalPrice(items: LineItem[]): void {
  cachedTotal = 0;
  for (const item of items) cachedTotal += item.price * item.qty;
}
```

Side effects (logging, fetching, DOM, randomness, `Date.now()`) belong at the edges — in `$effect`, in load functions, in form actions — not in the middle of pure transformations.

### Immutability in the logic layer

- Use `ReadonlyArray<T>` and `Readonly<T>` on function parameters and return types whenever the function shouldn't mutate them.
- Use `const` always. `let` only when reassignment is genuinely needed.
- Use `as const` for literal data and configuration:
  ```ts
  const ROLES = ['admin', 'editor', 'viewer'] as const;
  type Role = typeof ROLES[number]; // 'admin' | 'editor' | 'viewer'
  ```

Note: this is for the logic layer. Mutating a `$state` proxy is **correct** and idiomatic — see the Svelte 5 section.

### Discriminated unions over boolean flags

When state has more than two related conditions, model it as a union with a `kind` (or `type`, `status`) discriminant:

```ts
// good
type RequestState<T> =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'success'; data: T }
  | { kind: 'error'; message: string };

// avoid — impossible states are representable
type BadState<T> = {
  isLoading: boolean;
  isError: boolean;
  data?: T;
  error?: string;
};
```

Handle them with a `switch` and exhaustive checking:

```ts
function render<T>(state: RequestState<T>): string {
  switch (state.kind) {
    case 'idle': return '';
    case 'loading': return 'Loading…';
    case 'success': return JSON.stringify(state.data);
    case 'error': return state.message;
    default: {
      const _exhaustive: never = state;
      throw new Error(`Unhandled: ${_exhaustive}`);
    }
  }
}
```

Adding a new variant will then fail compilation in every `switch` that doesn't handle it — which is what you want.

### Errors as values, not exceptions, where it matters

For expected failure modes (validation, parsing, lookups), return a result instead of throwing:

```ts
type Result<T, E = string> =
  | { ok: true; value: T }
  | { ok: false; error: E };

export function parseAge(input: string): Result<number, 'not_a_number' | 'out_of_range'> {
  const n = Number(input);
  if (Number.isNaN(n)) return { ok: false, error: 'not_a_number' };
  if (n < 0 || n > 150) return { ok: false, error: 'out_of_range' };
  return { ok: true, value: n };
}
```

Reserve `throw` for truly exceptional cases (programming errors, unrecoverable I/O). In SvelteKit load functions and actions, use the framework's `error()` / `fail()` helpers — those are the established exception channels.

### Type things narrowly

- Prefer literal types and unions over `string`/`number` when the value is bounded.
- Avoid `any`. If you genuinely don't know the shape, use `unknown` and narrow.
- Avoid type assertions (`as Foo`) — they're a hint that the types are wrong upstream. Acceptable for `as const` and for narrowing after a guard you've verified.
- `null` vs `undefined`: use `undefined` for "field absent / not provided"; use `null` only when something explicitly represents "intentionally empty."

### Module organization

- Named exports only. No `export default` (except where SvelteKit requires it — `+page.svelte`, `+layout.svelte`, etc.).
- Co-locate types with the code that uses them. Only promote a type to `$lib/types/` when it's used in three or more places.

---

## File organization

```
src/
├── lib/
│   ├── components/    # reusable .svelte components
│   ├── server/        # server-only code (never imported from client)
│   ├── state/         # .svelte.ts shared reactive state
│   └── utils/         # pure functions, no reactivity
└── routes/
    └── [feature]/     # +page.svelte, +page.server.ts, +page.ts colocated
```

- `$lib/server/**` is enforced by SvelteKit — anything that should never reach the client goes there.
- Keep route directories shallow. If a route has many supporting components, put them in a `_components/` subdirectory inside the route folder (the underscore prefix excludes it from routing).

---

## Before opening a PR

1. `[pm] run check` passes with no errors and no new warnings.
2. `[pm] run test` passes.
3. The diff contains only changes related to the PR's stated goal. Unrelated cleanups go in a separate PR.
4. New components use runes, snippets, and callback props. No Svelte 4 patterns.
5. New TypeScript is `strict`-clean with no `any` and no `// @ts-ignore`.