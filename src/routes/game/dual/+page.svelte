<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import GameBoard from '$lib/components/GameBoard.svelte';
	import NextPieces from '$lib/components/NextPieces.svelte';
	import ScoreBoard from '$lib/components/ScoreBoard.svelte';
	import GameControls from '$lib/components/GameControls.svelte';
	import { TetrisEngine, BOARD_WIDTH, EXTENDED_HEIGHT } from '$lib/game/engine';
	import { P2PConnection } from '$lib/multiplayer/p2p';
	import type { GameMessage } from '$lib/game/types';

	let localEngine: TetrisEngine;
	let remoteEngine: TetrisEngine;

	let localState = $state({
		board: [] as number[][],
		colorBoard: [] as string[][],
		currentPiece: null as any,
		nextPieces: [] as any[],
		score: 0,
		linesCleared: 0,
		level: 1,
		gameOver: false,
		shadowY: 0
	});

	let remoteState = $state({
		board: [] as number[][],
		colorBoard: [] as string[][],
		currentPiece: null as any,
		score: 0,
		linesCleared: 0
	});

	let gameInterval: ReturnType<typeof setInterval>;
	let dropSpeed = $state(600);
	let matchmaking = $state<'searching' | 'connected' | 'disconnected'>('searching');
	let p2p: P2PConnection;

	onMount(() => {
		initializeGame();
		connectToMatchmaking();
	});

	onDestroy(() => {
		if (gameInterval) clearInterval(gameInterval);
		if (p2p) p2p.destroy();
		window.removeEventListener('keydown', handleKeyDown);
	});

	async function connectToMatchmaking() {
		// This is a simplified version - you'll need to implement WebSocket connection to Durable Object
		// For now, we'll simulate a connection
		setTimeout(() => {
			matchmaking = 'connected';
			const isHost = Math.random() > 0.5;
			p2p = new P2PConnection(isHost);
			p2p.initialize();

			p2p.onConnection((connected) => {
				if (connected) {
					matchmaking = 'connected';
					startGameLoop();
				} else {
					matchmaking = 'disconnected';
				}
			});

			p2p.onMessage((message) => {
				handleRemoteMessage(message);
			});
		}, 2000);
	}

	function initializeGame() {
		localEngine = new TetrisEngine(true);
		remoteEngine = new TetrisEngine(true);

		localEngine.initialize();
		remoteEngine.initialize();

		updateLocalState();
		updateRemoteState();

		window.addEventListener('keydown', handleKeyDown);
	}

	function startGameLoop() {
		gameInterval = setInterval(() => {
			if (matchmaking === 'connected' && !localState.gameOver) {
				localEngine.move('down');
				updateLocalState();
				sendGameState();
			}
		}, dropSpeed);
	}

	function updateLocalState() {
		localState.board = localEngine.getBoard();
		localState.colorBoard = localEngine.getColorBoard();
		localState.currentPiece = localEngine.getCurrentPiece();
		localState.nextPieces = localEngine.getNextPieces();
		localState.score = localEngine.getScore();
		localState.linesCleared = localEngine.getLinesCleared();
		localState.level = localEngine.getLevel();
		localState.gameOver = localEngine.isGameOver();
		localState.shadowY = localEngine.calculateShadowPosition();

		if (localState.gameOver) {
			clearInterval(gameInterval);
			sendGameOver();
		}
	}

	function updateRemoteState() {
		remoteState.board = remoteEngine.getBoard();
		remoteState.colorBoard = remoteEngine.getColorBoard();
		remoteState.currentPiece = remoteEngine.getCurrentPiece();
		remoteState.score = remoteEngine.getScore();
		remoteState.linesCleared = remoteEngine.getLinesCleared();
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (localState.gameOver || matchmaking !== 'connected') return;

		let moved = false;
		switch (e.key) {
			case 'ArrowLeft':
				e.preventDefault();
				moved = localEngine.move('left');
				break;
			case 'ArrowRight':
				e.preventDefault();
				moved = localEngine.move('right');
				break;
			case 'ArrowDown':
				e.preventDefault();
				moved = localEngine.move('down');
				break;
			case 'ArrowUp':
			case ' ':
				e.preventDefault();
				moved = localEngine.move('rotate');
				break;
			case 'Enter':
				e.preventDefault();
				localEngine.drop();
				moved = true;
				break;
		}

		if (moved) {
			updateLocalState();
			sendGameState();
		}
	}

	function sendGameState() {
		if (p2p && p2p.isConnected()) {
			const message: GameMessage = {
				type: 'state',
				data: {
					board: localState.board,
					colorBoard: localState.colorBoard,
					currentPiece: localState.currentPiece,
					score: localState.score,
					linesCleared: localState.linesCleared
				}
			};
			p2p.send(message);

			// Check if lines were cleared and shift opponent's board
			const previousLines = remoteState.linesCleared;
			if (localState.linesCleared > previousLines) {
				const linesDiff = localState.linesCleared - previousLines;
				if (linesDiff >= 2) {
					const shiftMessage: GameMessage = {
						type: 'linesCleared',
						data: { lines: linesDiff }
					};
					p2p.send(shiftMessage);
				}
			}
		}
	}

	function sendGameOver() {
		if (p2p && p2p.isConnected()) {
			const message: GameMessage = {
				type: 'gameOver',
				data: {
					score: localState.score,
					linesCleared: localState.linesCleared
				}
			};
			p2p.send(message);
		}
	}

	function handleRemoteMessage(message: GameMessage) {
		switch (message.type) {
			case 'state':
				remoteState.board = message.data.board;
				remoteState.colorBoard = message.data.colorBoard;
				remoteState.currentPiece = message.data.currentPiece;
				remoteState.score = message.data.score;
				remoteState.linesCleared = message.data.linesCleared;
				break;

			case 'linesCleared':
				// Shift local board down when opponent clears lines
				for (let i = 0; i < message.data.lines; i++) {
					localEngine.shiftBoard('down');
				}
				updateLocalState();
				break;

			case 'gameOver':
				// Opponent lost, we win!
				localState.gameOver = true;
				clearInterval(gameInterval);
				break;
		}
	}

	function handleLeft() {
		if (localEngine.move('left')) {
			updateLocalState();
			sendGameState();
		}
	}

	function handleRight() {
		if (localEngine.move('right')) {
			updateLocalState();
			sendGameState();
		}
	}

	function handleRotate() {
		if (localEngine.move('rotate')) {
			updateLocalState();
			sendGameState();
		}
	}

	function handleDrop() {
		localEngine.drop();
		updateLocalState();
		sendGameState();
	}

	function handleDown() {
		if (localEngine.move('down')) {
			updateLocalState();
			sendGameState();
		}
	}
</script>

<div class="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 p-4">
	<div class="max-w-7xl mx-auto">
		<!-- Header -->
		<div class="flex justify-between items-center mb-4">
			<button
				onclick={() => goto('/')}
				class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
			>
				← Back
			</button>
			<h1 class="text-3xl font-bold text-white">Dual Mode</h1>
			<div class="px-4 py-2 rounded" class:bg-green-600={matchmaking === 'connected'}
				class:bg-yellow-600={matchmaking === 'searching'}
				class:bg-red-600={matchmaking === 'disconnected'}>
				{#if matchmaking === 'searching'}
					⏳ Searching...
				{:else if matchmaking === 'connected'}
					✓ Connected
				{:else}
					✗ Disconnected
				{/if}
			</div>
		</div>

		<!-- Matchmaking Screen -->
		{#if matchmaking === 'searching'}
			<div class="flex items-center justify-center h-96">
				<div class="text-center">
					<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
					<h2 class="text-2xl text-white">Finding opponent...</h2>
				</div>
			</div>
		{:else if matchmaking === 'connected'}
			<!-- Game Area - Dual Boards -->
			<div class="flex flex-col gap-8">
				<!-- Opponent Board (Flipped) -->
				<div class="flex flex-col items-center">
					<h3 class="text-xl font-bold text-red-400 mb-2">Opponent</h3>
					<div class="flex gap-4 items-start">
						<ScoreBoard score={remoteState.score} lines={remoteState.linesCleared} level={1} />
						{#if remoteState.board.length > 0}
							<GameBoard
								board={remoteState.board.slice(4, 24)}
								colorBoard={remoteState.colorBoard.slice(4, 24)}
								currentPiece={remoteState.currentPiece}
								cellSize={20}
								showGhost={false}
								flipped={true}
							/>
						{/if}
					</div>
				</div>

				<!-- Local Board -->
				<div class="flex flex-col items-center">
					<h3 class="text-xl font-bold text-green-400 mb-2">You</h3>
					<div class="flex gap-4 items-start">
						<NextPieces pieces={localState.nextPieces} cellSize={15} />
						{#if localState.board.length > 0}
							<GameBoard
								board={localState.board.slice(4, 24)}
								colorBoard={localState.colorBoard.slice(4, 24)}
								currentPiece={localState.currentPiece}
								shadowY={localState.shadowY}
								cellSize={25}
								showGhost={true}
							/>
						{/if}
						<ScoreBoard score={localState.score} lines={localState.linesCleared} level={localState.level} />
					</div>
				</div>

				<!-- Controls -->
				<div class="lg:hidden">
					<GameControls
						onLeft={handleLeft}
						onRight={handleRight}
						onRotate={handleRotate}
						onDrop={handleDrop}
						onDown={handleDown}
					/>
				</div>
			</div>
		{/if}

		<!-- Game Over Modal -->
		{#if localState.gameOver}
			<div class="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
				<div class="bg-gray-800 p-8 rounded-lg border-4 border-green-500 max-w-md">
					<h2 class="text-3xl font-bold text-white mb-4">
						{remoteState.score < localState.score ? 'You Win!' : 'You Lose!'}
					</h2>
					<div class="text-gray-300 space-y-2 mb-6">
						<p class="text-xl">Your Score: <strong class="text-green-400">{localState.score}</strong></p>
						<p class="text-xl">Opponent: <strong class="text-red-400">{remoteState.score}</strong></p>
					</div>
					<div class="flex gap-4">
						<button
							onclick={() => goto('/game/dual')}
							class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
						>
							Play Again
						</button>
						<button
							onclick={() => goto('/')}
							class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
						>
							Menu
						</button>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>
