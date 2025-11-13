import type { Config } from 'tailwindcss';

export default {
	content: ['./src/**/*.{html,js,svelte,ts}'],
	theme: {
		extend: {
			colors: {
				tetris: {
					cyan: '#00f0f0',
					blue: '#0000f0',
					orange: '#f0a000',
					yellow: '#f0f000',
					green: '#00f000',
					purple: '#a000f0',
					red: '#f00000'
				}
			}
		}
	},
	plugins: []
} satisfies Config;
