<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { Button } from '$lib/components/ui/button';

	let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="space-y-8">
	<h1 class="text-2xl font-bold">Users</h1>

	<section class="rounded-lg border p-4">
		<h2 class="mb-4 text-lg font-semibold">Create user</h2>

		{#if form?.createError}
			<p class="mb-4 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{form.createError}
			</p>
		{/if}
		{#if form?.createSuccess}
			<p class="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">User created.</p>
		{/if}

		<form method="POST" action="?/create" class="grid gap-4 sm:grid-cols-2">
			<div class="space-y-1">
				<label for="email" class="block text-sm font-medium">Email</label>
				<input
					id="email"
					name="email"
					type="email"
					required
					class="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<div class="space-y-1">
				<label for="name" class="block text-sm font-medium">Name</label>
				<input
					id="name"
					name="name"
					type="text"
					required
					class="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<div class="space-y-1">
				<label for="password" class="block text-sm font-medium">Password</label>
				<input
					id="password"
					name="password"
					type="password"
					required
					class="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				/>
			</div>

			<div class="space-y-1">
				<label for="role" class="block text-sm font-medium">Role</label>
				<select
					id="role"
					name="role"
					class="w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
				>
					<option value="employee">Employee</option>
					<option value="admin">Admin</option>
				</select>
			</div>

			<div class="sm:col-span-2">
				<Button type="submit">Create user</Button>
			</div>
		</form>
	</section>

	<section>
		<h2 class="mb-4 text-lg font-semibold">All users</h2>

		{#if form?.archiveError}
			<p class="mb-2 rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
				{form.archiveError}
			</p>
		{/if}

		<div class="overflow-x-auto rounded-lg border">
			<table class="w-full text-sm">
				<thead class="border-b bg-muted/40">
					<tr>
						<th class="px-4 py-3 text-left font-medium">Email</th>
						<th class="px-4 py-3 text-left font-medium">Name</th>
						<th class="px-4 py-3 text-left font-medium">Role</th>
						<th class="px-4 py-3 text-left font-medium">Created</th>
						<th class="px-4 py-3 text-left font-medium">Archived</th>
						<th class="px-4 py-3 text-left font-medium"></th>
					</tr>
				</thead>
				<tbody>
					{#each data.users as user (user.id)}
						<tr class="border-b last:border-0">
							<td class="px-4 py-3">{user.email}</td>
							<td class="px-4 py-3">{user.name}</td>
							<td class="px-4 py-3">{user.role}</td>
							<td class="px-4 py-3">{user.createdAt.toLocaleDateString()}</td>
							<td class="px-4 py-3"
								>{user.archivedAt ? user.archivedAt.toLocaleDateString() : '—'}</td
							>
							<td class="px-4 py-3">
								{#if !user.archivedAt}
									<form method="POST" action="?/archive">
										<input type="hidden" name="userId" value={user.id} />
										<Button type="submit" variant="destructive" size="sm">Archive</Button>
									</form>
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>
</div>
