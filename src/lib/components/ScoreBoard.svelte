<script lang="ts">
	interface Props {
		score: number;
		lines: number;
		level: number;
	}

	let { score, lines, level }: Props = $props();
</script>

<div class="scoreboard bg-gray-800 p-4 rounded-lg border border-gray-700 space-y-2">
	<div class="stat">
		<div class="stat-label text-gray-400 text-sm">Score</div>
		<div class="stat-value text-2xl font-bold text-white">{score.toLocaleString()}</div>
	</div>
	<div class="stat">
		<div class="stat-label text-gray-400 text-sm">Lines</div>
		<div class="stat-value text-xl font-bold text-blue-400">{lines}</div>
	</div>
	<div class="stat">
		<div class="stat-label text-gray-400 text-sm">Level</div>
		<div class="stat-value text-xl font-bold text-green-400">{level}</div>
	</div>
</div>
