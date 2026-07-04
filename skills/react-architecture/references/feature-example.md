# Worked example: a "user profile" feature
 
This shows what section 2 ("Organize by feature") and section 3 ("Barrel
exports") look like with real file contents, end to end. Use it as a
template shape when scaffolding a new feature — adapt names, fields, and
the data layer to whatever the project actually uses.
 
## Folder layout
 
```
features/
└── user-profile/
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
    ├── utils/
    │   └── formatProfileStats.ts
    └── index.ts
```
 
## types/userProfile.types.ts
 
```ts
export interface UserProfile {
  id: string;
  name: string;
  title: string;
  joinedAt: string;
  stats: {
    posts: number;
    followers: number;
    following: number;
  };
}
 
export interface UpdateProfileInput {
  name?: string;
  title?: string;
}
```
 
## services/userProfileApi.ts
 
All HTTP concerns live here. Nothing else in the feature talks to `fetch`
directly.
 
```ts
import type { UserProfile, UpdateProfileInput } from '../types/userProfile.types';
 
export async function fetchUserProfile(userId: string): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}/profile`);
  if (!res.ok) throw new Error('Failed to load profile');
  return res.json();
}
 
export async function updateUserProfile(
  userId: string,
  input: UpdateProfileInput
): Promise<UserProfile> {
  const res = await fetch(`/api/users/${userId}/profile`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error('Failed to update profile');
  return res.json();
}
```
 
## hooks/useUserProfile.ts
 
The hook owns the data-fetching pattern (here, TanStack Query). Swap this
for whatever the project already uses — the point is that the component
below never needs to know which one it is.
 
```ts
import { useQuery } from '@tanstack/react-query';
import { fetchUserProfile } from '../services/userProfileApi';
 
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: ['userProfile', userId],
    queryFn: () => fetchUserProfile(userId),
  });
}
```
 
## hooks/useUpdateProfile.ts
 
Mutation logic, including cache invalidation, lives next to the query it
affects rather than inline in a form component.
 
```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateUserProfile } from '../services/userProfileApi';
import type { UpdateProfileInput } from '../types/userProfile.types';
 
export function useUpdateProfile(userId: string) {
  const queryClient = useQueryClient();
 
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateUserProfile(userId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['userProfile', userId] });
    },
  });
}
```
 
## utils/formatProfileStats.ts
 
A pure function — no React, no hooks — so it's trivial to unit test on its
own.
 
```ts
export function formatProfileStats(stats: { posts: number; followers: number }) {
  return `${stats.posts.toLocaleString()} posts · ${stats.followers.toLocaleString()} followers`;
}
```
 
## components/ProfileHeader.tsx
 
The component only renders. It reads from the hook and stays unaware of
React Query, the API shape, or formatting logic.
 
```tsx
import { useUserProfile } from '../hooks/useUserProfile';
 
interface ProfileHeaderProps {
  userId: string;
}
 
export function ProfileHeader({ userId }: ProfileHeaderProps) {
  const { data, isLoading, error } = useUserProfile(userId);
 
  if (isLoading) return <ProfileHeaderSkeleton />;
  if (error || !data) return <ProfileHeaderError />;
 
  return (
    <header>
      <h1>{data.name}</h1>
      <p>{data.title}</p>
    </header>
  );
}
 
function ProfileHeaderSkeleton() {
  return <div className="animate-pulse h-12 w-48 bg-gray-200" />;
}
 
function ProfileHeaderError() {
  return <p role="alert">Couldn't load this profile.</p>;
}
```
 
`ProfileHeaderSkeleton` and `ProfileHeaderError` stay in this file because
they're small, private, and only ever used by `ProfileHeader` — see the
note at the end of section 1 in SKILL.md about private sub-components
versus genuinely reusable ones.
 
## components/ProfileStats.tsx
 
```tsx
import { useUserProfile } from '../hooks/useUserProfile';
import { formatProfileStats } from '../utils/formatProfileStats';
 
interface ProfileStatsProps {
  userId: string;
}
 
export function ProfileStats({ userId }: ProfileStatsProps) {
  const { data } = useUserProfile(userId);
  if (!data) return null;
 
  return <p>{formatProfileStats(data.stats)}</p>;
}
```
 
## components/ProfileEditForm.tsx
 
```tsx
import { useState } from 'react';
import { useUpdateProfile } from '../hooks/useUpdateProfile';
import type { UserProfile } from '../types/userProfile.types';
 
interface ProfileEditFormProps {
  profile: UserProfile;
  onSaved?: () => void;
}
 
export function ProfileEditForm({ profile, onSaved }: ProfileEditFormProps) {
  const [name, setName] = useState(profile.name);
  const { mutate, isPending } = useUpdateProfile(profile.id);
 
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    mutate({ name }, { onSuccess: onSaved });
  }
 
  return (
    <form onSubmit={handleSubmit}>
      <input value={name} onChange={(e) => setName(e.target.value)} />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Saving…' : 'Save'}
      </button>
    </form>
  );
}
```
 
## index.ts (the feature's public API)
 
```ts
export { ProfileHeader } from './components/ProfileHeader';
export { ProfileStats } from './components/ProfileStats';
export { ProfileEditForm } from './components/ProfileEditForm';
export { useUserProfile } from './hooks/useUserProfile';
export { useUpdateProfile } from './hooks/useUpdateProfile';
export type { UserProfile, UpdateProfileInput } from './types/userProfile.types';
```
 
## Using it from a page
 
```tsx
// app/profile/[userId]/page.tsx (or pages/ equivalent)
import { lazy, Suspense } from 'react';
 
const ProfileHeader = lazy(() =>
  import('@/features/user-profile').then((m) => ({ default: m.ProfileHeader }))
);
 
export default function ProfilePage({ params }: { params: { userId: string } }) {
  return (
    <Suspense fallback={<div>Loading…</div>}>
      <ProfileHeader userId={params.userId} />
    </Suspense>
  );
}
```
 
Everything outside `features/user-profile/` imports only from
`@/features/user-profile` (the barrel) — never from
`@/features/user-profile/hooks/useUserProfile` directly. That boundary is
what lets the internals of this feature be refactored later without
breaking anything that consumes it.