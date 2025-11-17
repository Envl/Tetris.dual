import { describe, it, expect } from 'vitest'
import { DualGameManager } from '../dual-game'
import { EXTENDED_HEIGHT, BOARD_WIDTH } from '../engine'
import { TetrisEngine } from '../engine'

// Access private engine and opponent state for testing
function getInternalState(manager: any) {
  return {
    engineBoard: manager.engine.getBoard(),
    engineColorBoard: manager.engine.getColorBoard(),
    opponentBoard: manager.opponentState.board,
    opponentColorBoard: manager.opponentState.colorBoard,
  }
}

describe('Core synchronization test', () => {
  it('should sync engine and opponent state correctly', () => {
    const manager1 = new DualGameManager({
      isPlayer1: true,
      sendMessage: msg => {
        if (msg.type === 'action') {
          manager2.handleRemoteMessage(msg)
        }
      },
    })

    const manager2 = new DualGameManager({
      isPlayer1: false,
      sendMessage: msg => {
        if (msg.type === 'action') {
          manager1.handleRemoteMessage(msg)
        }
      },
    })

    manager1.setConnectionState(true)
    manager2.setConnectionState(true)

    // Tick for a while
    for (let i = 0; i < 300; i++) {
      manager1.tick()
      manager2.tick()
    }

    const state1 = getInternalState(manager1)
    const state2 = getInternalState(manager2)

    console.log('Checking synchronization...')

    // The key invariant: Manager 1's engine board should equal Manager 2's opponent board
    // (because Manager 1's pieces are Manager 2's opponent pieces)
    let engineToOpponentMismatches = 0
    for (let y = 0; y < EXTENDED_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const m1Engine = state1.engineBoard[y][x]
        const m2Opponent = state2.opponentBoard[y][x]

        if (m1Engine !== m2Opponent) {
          engineToOpponentMismatches++
          if (engineToOpponentMismatches <= 5) {
            console.log(
              `M1 engine[${y},${x}]=${m1Engine} !== M2 opponent[${y},${x}]=${m2Opponent}`
            )
          }
        }
      }
    }

    console.log(`Total M1 engine vs M2 opponent mismatches: ${engineToOpponentMismatches}`)

    // And vice versa: Manager 2's engine board should equal Manager 1's opponent board
    let opponentToEngineMismatches = 0
    for (let y = 0; y < EXTENDED_HEIGHT; y++) {
      for (let x = 0; x < BOARD_WIDTH; x++) {
        const m2Engine = state2.engineBoard[y][x]
        const m1Opponent = state1.opponentBoard[y][x]

        if (m2Engine !== m1Opponent) {
          opponentToEngineMismatches++
          if (opponentToEngineMismatches <= 5) {
            console.log(
              `M2 engine[${y},${x}]=${m2Engine} !== M1 opponent[${y},${x}]=${m1Opponent}`
            )
          }
        }
      }
    }

    console.log(`Total M2 engine vs M1 opponent mismatches: ${opponentToEngineMismatches}`)

    expect(engineToOpponentMismatches).toBe(0)
    expect(opponentToEngineMismatches).toBe(0)

    console.log('Synchronization test passed!')
  })
})
