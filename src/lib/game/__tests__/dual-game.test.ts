import { describe, it, expect, beforeEach } from 'vitest'
import {
  DualGameManager,
  createEmptyBoard,
  createEmptyColorBoard,
} from '../dual-game'
import type { GameAction } from '../types'
import { BOARD_WIDTH, CENTER_LINE, EXTENDED_HEIGHT } from '../engine'

const noop = () => {}

describe('DualGameManager action synchronization', () => {
  let manager: DualGameManager

  beforeEach(() => {
    manager = new DualGameManager({
      isPlayer1: false,
      sendMessage: noop,
    })
    manager.setConnectionState(true)
  })

  it('applies opponent board snapshots without overwriting local territory', () => {
    const baseline = manager.getSnapshot()

    const boardSnapshot = createEmptyBoard()
    const colorSnapshot = createEmptyColorBoard()
    const targetRow = CENTER_LINE - 1
    boardSnapshot[targetRow][0] = 1
    colorSnapshot[targetRow][0] = '#ff0'

    const action: GameAction = {
      sequenceId: 0,
      playerId: 1,
      type: 'boardShift',
      data: {
        direction: 'down',
        lines: 1,
        boardSnapshot: {
          board: boardSnapshot,
          colorBoard: colorSnapshot,
        },
        score: 100,
        linesCleared: 2,
        level: 3,
      },
    }

    manager.handleRemoteAction(action)
    const snapshot = manager.getSnapshot()

    expect(snapshot.opponentState.board[targetRow][0]).toBe(1)
    expect(snapshot.opponentState.colorBoard[targetRow][0]).toBe('#ff0')

    const centerColumn = Math.floor(BOARD_WIDTH / 2) - 2
    expect(snapshot.gameState.board[CENTER_LINE][centerColumn]).toBe(
      baseline.gameState.board[CENTER_LINE - 1][centerColumn]
    )
  })

  it('queues out-of-order remote actions until missing sequences arrive', () => {
    const lockedBoard = createEmptyBoard()
    const lockedColor = createEmptyColorBoard()
    const lockRow = CENTER_LINE - 2
    const lockCol = 3
    lockedBoard[lockRow][lockCol] = 2
    lockedColor[lockRow][lockCol] = '#0ff'

    const shiftBoard = createEmptyBoard()
    const shiftColors = createEmptyColorBoard()
    const shiftRow = CENTER_LINE - 1
    const shiftCol = 1
    shiftBoard[shiftRow][shiftCol] = 1
    shiftColors[shiftRow][shiftCol] = '#f0f'

    const firstAction: GameAction = {
      sequenceId: 0,
      playerId: 1,
      type: 'boardShift',
      data: {
        direction: 'down',
        lines: 1,
        boardSnapshot: {
          board: shiftBoard,
          colorBoard: shiftColors,
        },
        score: 80,
        linesCleared: 1,
        level: 2,
      },
    }

    manager.handleRemoteAction(firstAction)
    shiftBoard[lockRow][lockCol] = 2
    shiftColors[lockRow][lockCol] = '#0ff'

    const lateAction: GameAction = {
      sequenceId: 1,
      playerId: 1,
      type: 'pieceLocked',
      data: {
        boardSnapshot: {
          board: shiftBoard,
          colorBoard: shiftColors,
        },
        score: 40,
        linesCleared: 4,
        level: 5,
      },
    }

    manager.handleRemoteAction(lateAction)
    const snapshot = manager.getSnapshot()
    expect(snapshot.opponentState.board[lockRow][lockCol]).toBe(2)
    expect(snapshot.opponentState.colorBoard[lockRow][lockCol]).toBe('#0ff')
    expect(snapshot.opponentState.board[shiftRow][shiftCol]).toBe(1)
  })
})
