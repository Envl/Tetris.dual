<script lang="ts">
	import type { Tetromino } from '$lib/game/types';

	interface Props {
		pieces: Tetromino[];
		cellSize?: number;
	}

	let { pieces, cellSize = 20 }: Props = $props();
</script>

<div class="next-pieces space-y-4">
	<h3 class="text-lg font-bold text-white mb-2">Next</h3>
	{#each pieces as piece, i}
		<div class="piece-preview bg-gray-800 p-2 rounded border border-gray-700">
			<div class="relative" style="width: {4 * cellSize}px; height: {4 * cellSize}px;">
				{#each piece.shape as row, y}
					{#each row as cell, x}
						{#if cell}
							<div
								class="absolute border border-gray-900/30"
								style="
									width: {cellSize}px;
									height: {cellSize}px;
									left: {x * cellSize}px;
									top: {y * cellSize}px;
									background-color: {piece.color};
									box-shadow: inset 0 0 5px rgba(255,255,255,0.3);
								"
							></div>
						{/if}
					{/each}
				{/each}
			</div>
		</div>
	{/each}
</div>

<style>
	.piece-preview {
		transition: transform 0.2s;
	}

	.piece-preview:hover {
		transform: scale(1.05);
	}
</style>
