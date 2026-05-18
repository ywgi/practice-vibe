import type { LayoutServerLoad } from './$types';
import { error } from '@sveltejs/kit';

export const load: LayoutServerLoad = async ({ locals }) => {
	if (locals.user?.role !== 'admin') {
		error(403, 'Forbidden');
	}
};
