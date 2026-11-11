# Worked example: a "user profile" feature

This shows the feature structure and public entry point rules from
SKILL.md with real file contents, end to end. Use it as a template shape
when scaffolding a new feature — adapt names, fields, and the data layer
to whatever the project actually uses.

It assumes a client-rendered React app, TanStack Query v5 for server
state and zod for response validation. If the project uses something
else, keep the shape and swap the library. Styling is left out.

## Folder layout

```text
features/
└── user-profile/
    ├── index.ts
    ├── screens/
    │   └── ProfileScreen.tsx
    ├── components/
    │   ├── ProfileHeader.tsx
    │   ├── ProfileStats.tsx
    │   └── ProfileEditForm.tsx
    ├── hooks/
    │   ├── useUserProfile.ts
    │   └── useUpdateProfile.ts
    ├── services/
    │   └── userProfileApi.ts
    ├── types/
    │   └── userProfile.types.ts
    └── utils/
        └── formatProfileStats.ts
```

## types/userProfile.types.ts

The schema is the single source for the type, so the value checked at
runtime and the type used at compile time cannot drift apart.

```ts
import { z } from 'zod';

export const userProfileSchema = z.object({
  id: z.string(),
  name: z.string(),
  title: z.string(),
  joinedAt: z.string(),
  stats: z.object({
    posts: z.number(),
    followers: z.number(),
    following: z.number(),
  }),
});

export type UserProfile = z.infer<typeof userProfileSchema>;

export interface UpdateProfileInput {
  name?: string;
  title?: string;
}
```

## services/userProfileApi.ts

All HTTP concerns live here. Nothing else in the feature talks to `fetch`
directly. The id is encoded before it enters the URL, and the response is
validated instead of being trusted as `UserProfile`.

```ts
import { userProfileSchema } from '../types/userProfile.types';
import type { UserProfile, UpdateProfileInput } from '../types/userProfile.types';

function profileUrl(userId: string) {
  return `/api/users/${encodeURIComponent(userId)}/profile`;
}

export async function fetchUserProfile(
  userId: string,
  signal?: AbortSignal
): Promise<UserProfile> {
  const res = await fetch(profileUrl(userId), { signal });
  if (!res.ok) throw new Error(`Failed to load profile (HTTP ${res.status})`);
  return userProfileSchema.parse(await res.json());
}

export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const res = await fetch(profileUrl(userId), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Failed to update profile (HTTP ${res.status})`);
  return userProfileSchema.parse(await res.json());
}
```

## hooks/useUserProfile.ts

The hook owns the data-fetching pattern (here, TanStack Query). Swap this
for whatever the project already uses. The query key comes from one
factory so the query and its invalidation cannot disagree, and the
`signal` lets an abandoned request be cancelled.

```ts
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile } from '../services/userProfileApi';

export const userProfileKeys = {
  detail: (userId: string) => ['userProfile', userId] as const,
};

export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: userProfileKeys.detail(userId),
    queryFn: ({ signal }) => fetchUserProfile(userId, signal),
  });
}
```

## hooks/useUpdateProfile.ts

Mutation logic, including cache invalidation, lives next to the query it
affects rather than inline in a form component. Returning the
invalidation promise keeps the mutation pending until the refetch is done.

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserProfile } from '../services/userProfileApi';
import type { UpdateProfileInput } from '../types/userProfile.types';
import { userProfileKeys } from './useUserProfile';

export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateUserProfile(userId, input),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: userProfileKeys.detail(userId) }),
  });
}
```

## utils/formatProfileStats.ts

A pure function — no React, no hooks — so it's trivial to unit test on its
own. Pass the app's locale when the output is server-rendered, so server
and client produce the same text.

```ts
export function formatProfileStats(
  stats: { posts: number; followers: number },
  locale?: string
) {
  const number = new Intl.NumberFormat(locale);
  return `${number.format(stats.posts)} posts · ${number.format(stats.followers)} followers`;
}
```

## components/ProfileHeader.tsx

The component only renders. It reads from the hook and does not import
the service, the query library, or formatting logic. It does depend on
the shape the hook returns (`data`, `isPending`, `isError`), which here is
TanStack Query's; a project that wants to hide the library returns its
own shape from the hook.

```tsx
import { useUserProfile } from '../hooks/useUserProfile';

interface ProfileHeaderProps {
  userId: string;
}

export function ProfileHeader({ userId }: ProfileHeaderProps) {
  const { data, isPending, isError } = useUserProfile(userId);

  if (isPending) return <ProfileHeaderSkeleton />;
  if (isError || !data) return <ProfileHeaderError />;

  return (
    <header>
      <h1>{data.name}</h1>
      <p>{data.title}</p>
    </header>
  );
}

function ProfileHeaderSkeleton() {
  return <div role="status" aria-busy="true" aria-label="Loading profile" />;
}

function ProfileHeaderError() {
  return <p role="alert">Couldn't load this profile.</p>;
}
```

`ProfileHeaderSkeleton` and `ProfileHeaderError` stay in this file because
they're small, private, and only ever used by `ProfileHeader`. Move a
sub-component to its own file under `components/` once a second component
needs it.

## components/ProfileStats.tsx

```tsx
import { useUserProfile } from '../hooks/useUserProfile';
import { formatProfileStats } from '../utils/formatProfileStats';

interface ProfileStatsProps {
  userId: string;
}

export function ProfileStats({ userId }: ProfileStatsProps) {
  const { data, isPending, isError } = useUserProfile(userId);

  if (isPending) return <p role="status">Loading stats…</p>;
  if (isError || !data) return <p role="alert">Couldn't load stats.</p>;

  return <p>{formatProfileStats(data.stats)}</p>;
}
```

## components/ProfileEditForm.tsx

```tsx
import { useState } from 'react';
import type { FormEvent } from 'react';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import type { UserProfile } from '../types/userProfile.types';

interface ProfileEditFormProps {
  profile: UserProfile;
  onSaved?: () => void;
}

export function ProfileEditForm({ profile, onSaved }: ProfileEditFormProps) {
  const [name, setName] = useState(profile.name);
  const { mutate, isPending, isError } = useUpdateProfile(profile.id);

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    mutate({ name }, { onSuccess: onSaved });
  }

  return (
    <form onSubmit={handleSubmit}>
      <label htmlFor="profile-name">Name</label>
      <input
        id="profile-name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </button>
      {isError && <p role="alert">Couldn't save your changes. Try again.</p>}
    </form>
  );
}
```

`useState(profile.name)` reads the prop once. The screen below keys the
form by `profile.id`, so it starts fresh when a different profile is shown.

## screens/ProfileScreen.tsx

The screen composes the feature's components. The components and the
screen call the same hook with the same key, so they share one cached
request.

```tsx
import { ProfileEditForm } from '../components/ProfileEditForm';
import { ProfileHeader } from '../components/ProfileHeader';
import { ProfileStats } from '../components/ProfileStats';
import { useUserProfile } from '../hooks/useUserProfile';

interface ProfileScreenProps {
  userId: string;
}

export function ProfileScreen({ userId }: ProfileScreenProps) {
  const { data: profile } = useUserProfile(userId);

  return (
    <main>
      <ProfileHeader userId={userId} />
      <ProfileStats userId={userId} />
      {profile && <ProfileEditForm key={profile.id} profile={profile} />}
    </main>
  );
}
```

## index.ts (the feature's public API)

Only what other features are meant to use is exported. The service, the
mutation hook, and the remaining components stay internal until something
outside the feature needs them.

```ts
export { ProfileScreen } from './screens/ProfileScreen';
export { ProfileHeader } from './components/ProfileHeader';
export { useUserProfile } from './hooks/useUserProfile';
export type { UserProfile, UpdateProfileInput } from './types/userProfile.types';
```

## Using it from a route

The route/composition layer lazy-loads the screen file directly, not the
barrel, so the profile chunk does not pull in everything else the barrel
exports. This is the one deep import into the feature.

```tsx
// routes/ProfileRoute.tsx (route/composition layer)
import { lazy, Suspense } from 'react';

const ProfileScreen = lazy(() =>
  import('../features/user-profile/screens/ProfileScreen').then((m) => ({
    default: m.ProfileScreen,
  }))
);

export function ProfileRoute({ userId }: { userId: string }) {
  return (
    <Suspense fallback={<p role="status">Loading…</p>}>
      <ProfileScreen userId={userId} />
    </Suspense>
  );
}
```

How `userId` reaches the route depends on the router, and the app's
`QueryClientProvider` belongs with the application's root composition,
not in this feature. In a Next.js App Router project the `page.tsx` file
renders the screen instead, and the files above that use hooks need
`'use client'`.

Everything else outside `features/user-profile/` imports only from the
feature's entry point (`features/user-profile`, written in the alias or
relative form the project uses) — never from
`features/user-profile/hooks/useUserProfile` directly. That boundary is
what lets the internals of this feature be refactored later without
breaking anything that consumes it.
