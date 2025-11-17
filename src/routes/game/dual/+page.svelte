<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { goto } from '$app/navigation'
  import GameBoard from '$lib/components/GameBoard.svelte'
  import NextPieces from '$lib/components/NextPieces.svelte'
  import ScoreBoard from '$lib/components/ScoreBoard.svelte'
  import GameControls from '$lib/components/GameControls.svelte'
  import { DualGameManager, type DualGameSnapshot } from '$lib/game/dual-game'
  import { P2PConnection } from '$lib/multiplayer/p2p'
  import type { GameMessage } from '$lib/game/types'
  import { MatchmakingService } from '$lib/multiplayer/matchmaking'

  const MATCHMAKING_URL = import.meta.env.VITE_MATCHMAKING_URL

  let gameManager: DualGameManager | null = null
  let matchmakingService: MatchmakingService
  let roomId: string | null = null
  let isPlayer1 = $state(false) // Our player role

  // Game state for rendering - this is the COMBINED board showing both players
  let gameState = $state({
    board: [] as number[][],
    colorBoard: [] as string[][],
    currentPiece: null as any,
    nextPieces: [] as any[],
    score: 0,
    linesCleared: 0,
    level: 1,
    gameOver: false,
    shadowY: 0,
  })

  // Opponent state - we'll merge their pieces onto our board
  let opponentState = $state({
    board: [] as number[][],
    colorBoard: [] as string[][],
    score: 0,
    linesCleared: 0,
    level: 1,
    gameOver: false,
  })

  // Game result tracking
  let gameResult = $state<'playing' | 'win' | 'lose' | 'tie'>('playing')

  // Rematch state
  let rematchRequested = $state(false)
  let opponentRematch = false
  let showOpponentLeft = $state(false)

  let gameInterval: ReturnType<typeof setInterval>
  let dropSpeed = $state(600)
  let matchmaking = $state<'searching' | 'connected' | 'disconnected'>(
    'searching'
  )
  let p2p: P2PConnection
  let unsubscribeGameManager: (() => void) | null = null

  onMount(() => {
    connectToMatchmaking()
    window.addEventListener('keydown', handleKeyDown)
  })

  onDestroy(() => {
    if (gameInterval) clearInterval(gameInterval)
    unsubscribeGameManager?.()
    if (p2p) p2p.destroy()
    if (matchmakingService) {
      matchmakingService.leaveQueue().catch(() => {})
    }
    window.removeEventListener('keydown', handleKeyDown)
  })

  async function connectToMatchmaking() {
    try {
      console.log('[DualMode] Starting matchmaking...')
      matchmakingService = new MatchmakingService(MATCHMAKING_URL)

      console.log('[DualMode] Joining queue...')
      const result = await matchmakingService.joinQueue()
      console.log('[DualMode] joinQueue resolved with result:', result)

      roomId = result.roomId
      isPlayer1 = result.isHost // Host becomes player 1

      console.log(
        '[DualMode] Matched! roomId=',
        roomId,
        'isHost=',
        result.isHost
      )

      initializeGameManager()

      console.log('[DualMode] Creating P2P connection, isHost=', result.isHost)
      p2p = new P2PConnection(result.isHost)
      console.log('[DualMode] P2P instance created')

      // Set up P2P callbacks BEFORE initializing
      console.log('[DualMode] Setting up P2P callbacks...')
      p2p.onSignal(signal => {
        if (!roomId) return
        console.log('[DualMode] P2P generated signal, sending to DO')
        matchmakingService.sendSignal(roomId, signal)
      })

      p2p.onConnection(connected => {
        console.log('[DualMode] P2P connection state changed:', connected)
        if (connected) {
          matchmaking = 'connected'
          startGameLoop()
          gameManager?.setConnectionState(true)
        } else {
          matchmaking = 'disconnected'
          gameManager?.setConnectionState(false)
          if (!gameState.gameOver) {
            showOpponentLeft = true
          }
        }
      })

      p2p.onMessage(message => {
        handleRemoteMessage(message)
      })

      // Set up signal relay from matchmaking to P2P
      matchmakingService.onSignal(signal => {
        console.log('[DualMode] Received signal from DO, passing to P2P')
        p2p.signal(signal)
      })
      console.log('[DualMode] Callbacks set up')

      console.log('[DualMode] About to initialize P2P')
      await p2p.initialize()
      console.log('[DualMode] P2P initialized successfully')
    } catch (error) {
      console.error('[DualMode] Error during matchmaking/connection:', error)
      matchmaking = 'disconnected'
    }
  }

  function initializeGameManager() {
    unsubscribeGameManager?.()
    gameManager = new DualGameManager({
      isPlayer1,
      sendMessage: message => {
        if (p2p && p2p.isConnected()) {
          p2p.send(message)
        }
      },
    })
    unsubscribeGameManager = gameManager.subscribe(applySnapshot)
  }

  function applySnapshot(snapshot: DualGameSnapshot) {
    gameState = snapshot.gameState
    opponentState = snapshot.opponentState
    gameResult = snapshot.gameResult
  }

  function startGameLoop() {
    if (gameInterval) clearInterval(gameInterval)
    gameInterval = setInterval(() => {
      if (matchmaking === 'connected' && gameManager && !gameState.gameOver) {
        gameManager.tick()
      }
    }, dropSpeed)
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (gameState.gameOver || matchmaking !== 'connected') return

    switch (e.key) {
      case 'ArrowLeft':
        e.preventDefault()
        gameManager?.moveLeft()
        break
      case 'ArrowRight':
        e.preventDefault()
        gameManager?.moveRight()
        break
      case 'ArrowDown':
        e.preventDefault()
        gameManager?.softDrop()
        break
      case 'ArrowUp':
      case ' ':
        e.preventDefault()
        gameManager?.rotate()
        break
      case 'Enter':
        e.preventDefault()
        gameManager?.hardDrop()
        break
    }
  }

  function handleRemoteMessage(message: GameMessage) {
    console.log('[DualMode] Received remote message:', message.type)
    switch (message.type) {
      case 'action':
      case 'gameOver':
        gameManager?.handleRemoteMessage(message)
        break
      case 'restart':
        // Opponent requested rematch
        opponentRematch = true
        checkRematchStart()
        break
    }
  }

  function handleLeft() {
    gameManager?.moveLeft()
  }

  function handleRight() {
    gameManager?.moveRight()
  }

  function handleRotate() {
    gameManager?.rotate()
  }

  function handleDrop() {
    gameManager?.hardDrop()
  }

  function handleDown() {
    gameManager?.softDrop()
  }

  // Rematch functions
  function requestRematch() {
    if (!rematchRequested && p2p && p2p.isConnected()) {
      rematchRequested = true
      const message: GameMessage = { type: 'restart', data: {} }
      p2p.send(message)
      checkRematchStart()
    }
  }

  function leaveGame() {
    goto('/')
  }

  function checkRematchStart() {
    if (rematchRequested && opponentRematch && gameManager) {
      // Both players want to rematch - reset game state
      gameManager.resetForRematch()
      const snapshot = gameManager.getSnapshot()
      gameState = snapshot.gameState
      opponentState = snapshot.opponentState
      gameResult = 'playing'
      rematchRequested = false
      opponentRematch = false
      showOpponentLeft = false
      startGameLoop()
    }
  }
</script>

<div class="min-h-screen bg-linear-to-b from-gray-900 to-gray-800 p-4">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="flex justify-between items-center mb-4">
      <button
        onclick={() => goto('/')}
        class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded"
      >
        ← Back
      </button>
      <h1 class="text-3xl font-bold text-white">Dual Mode - Push Battle</h1>
      <div
        class="px-4 py-2 rounded"
        class:bg-green-600={matchmaking === 'connected'}
        class:bg-yellow-600={matchmaking === 'searching'}
        class:bg-red-600={matchmaking === 'disconnected'}
      >
        {#if matchmaking === 'searching'}
          ⏳ Searching...
        {:else if matchmaking === 'connected'}
          ✓ Connected ({isPlayer1 ? 'Player 1' : 'Player 2'})
        {:else}
          ✗ Disconnected
        {/if}
      </div>
    </div>

    <!-- Matchmaking Screen -->
    {#if matchmaking === 'searching'}
      <div class="flex items-center justify-center h-96">
        <div class="text-center">
          <div
            class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"
          ></div>
          <h2 class="text-2xl text-white">Finding opponent...</h2>
        </div>
      </div>
    {:else if matchmaking === 'connected'}
      <!-- Game Area - Shared Board -->
      <div class="flex justify-center gap-4 items-center">
        <!-- Opponent Info -->
        <div class="text-center">
          <h3 class="text-xl font-bold text-red-400 mb-2">
            Opponent ({isPlayer1 ? 'Player 2' : 'Player 1'})
          </h3>
          <ScoreBoard
            score={opponentState.score}
            lines={opponentState.linesCleared}
            level={opponentState.level}
          />
        </div>

        <!-- Single Shared Board -->
        <div class="flex gap-4 items-center">
          <div class="flex flex-col gap-2">
            <NextPieces pieces={gameState.nextPieces} cellSize={15} />
          </div>

          {#if gameState.board.length > 0}
            <div class="relative">
              <GameBoard
                board={gameState.board}
                colorBoard={gameState.colorBoard}
                currentPiece={gameState.currentPiece}
                shadowY={gameState.shadowY}
                cellSize={20}
                showGhost={true}
                flipped={!isPlayer1}
              />
            </div>
          {/if}

          <ScoreBoard
            score={gameState.score}
            lines={gameState.linesCleared}
            level={gameState.level}
          />
        </div>

        <!-- Your Info -->
        <div class="text-center">
          <h3 class="text-xl font-bold text-green-400 mb-2">
            You ({isPlayer1 ? 'Player 1' : 'Player 2'})
          </h3>
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

    <!-- Game Over/Rematch Modal -->
    {#if gameState.gameOver || opponentState.gameOver}
      <div
        class="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      >
        <div
          class="bg-gray-800 p-8 rounded-lg border-4 max-w-md"
          class:border-green-500={gameResult === 'win'}
          class:border-red-500={gameResult === 'lose'}
          class:border-yellow-500={gameResult === 'tie'}
        >
          <h2 class="text-3xl font-bold text-white mb-4">
            {#if gameResult === 'win'}You Win! 🎉
            {:else if gameResult === 'lose'}You Lose 😢
            {:else if gameResult === 'tie'}It's a Tie! 🤝
            {:else}Game Over{/if}
          </h2>
          <div class="text-gray-300 space-y-2 mb-6">
            <p class="text-xl">
              Your Score: <strong class="text-green-400"
                >{gameState.score}</strong
              >
            </p>
            <p class="text-xl">
              Opponent: <strong class="text-red-400"
                >{opponentState.score}</strong
              >
            </p>
          </div>
          {#if showOpponentLeft}
            <div class="text-red-400 text-lg mb-4">Opponent left the game.</div>
          {:else}
            <div class="flex gap-4">
              <button
                onclick={requestRematch}
                class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-6 rounded-lg"
                disabled={rematchRequested}
              >
                {rematchRequested ? 'Waiting for Opponent...' : 'Play Again'}
              </button>
              <button
                onclick={leaveGame}
                class="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-bold py-3 px-6 rounded-lg"
              >
                Menu
              </button>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>
