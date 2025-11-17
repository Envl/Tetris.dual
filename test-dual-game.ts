import { DualGameManager } from './src/lib/game/dual-game'

// Quick test to verify opponent pieces extending into local territory are visible
const manager1 = new DualGameManager({
  isPlayer1: true,
  sendMessage: msg => {
    console.log('Player 1 sends:', msg.type)
    if (msg.type === 'action') {
      manager2.handleRemoteMessage(msg)
    }
  },
})

const manager2 = new DualGameManager({
  isPlayer1: false,
  sendMessage: msg => {
    console.log('Player 2 sends:', msg.type)
    if (msg.type === 'action') {
      manager1.handleRemoteMessage(msg)
    }
  },
})

manager1.setConnectionState(true)
manager2.setConnectionState(true)

// Initialize both games
manager1.resetForRematch()
manager2.resetForRematch()

// Simulate some moves to get pieces locked
for (let i = 0; i < 20; i++) {
  manager1.tick()
  manager2.tick()
}

const snapshot1 = manager1.getSnapshot()
const snapshot2 = manager2.getSnapshot()

console.log('Player 1 board (top 25 rows):')
for (let y = 0; y < 25; y++) {
  console.log(snapshot1.gameState.board[y].join(' '))
}

console.log('\nPlayer 2 board (top 25 rows):')
for (let y = 0; y < 25; y++) {
  console.log(snapshot2.gameState.board[y].join(' '))
}

console.log('\nTest complete!')
