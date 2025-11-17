import { describe, it, expect, beforeEach } from 'vitest'
import {
  DualGameManager,
  createEmptyBoard,
  createEmptyColorBoard,
} from '../dual-game'
import { BOARD_WIDTH, CENTER_LINE, EXTENDED_HEIGHT } from '../engine'
import type { GameAction } from '../types'

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
      actionId: 'test-1',
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
      actionId: 'test-2',
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

  it('replays ordered log when older opponent action arrives late', () => {
    const newerSnapshot = createEmptyBoard()
    const newerColors = createEmptyColorBoard()
    newerSnapshot[CENTER_LINE - 3][2] = 7
    newerColors[CENTER_LINE - 3][2] = '#abc'

    const olderSnapshot = createEmptyBoard()
    const olderColors = createEmptyColorBoard()
    olderSnapshot[CENTER_LINE - 4][4] = 9
    olderColors[CENTER_LINE - 4][4] = '#def'

    const newerAction: GameAction = {
      actionId: 'newer',
      sequenceId: 2000,
      playerId: 1,
      type: 'pieceLocked',
      data: {
        boardSnapshot: {
          board: newerSnapshot,
          colorBoard: newerColors,
        },
        score: 500,
        linesCleared: 10,
        level: 8,
      },
    }

    const olderAction: GameAction = {
      actionId: 'older',
      sequenceId: 1000,
      playerId: 1,
      type: 'pieceLocked',
      data: {
        boardSnapshot: {
          board: olderSnapshot,
          colorBoard: olderColors,
        },
        score: 400,
        linesCleared: 8,
        level: 7,
      },
    }

    manager.handleRemoteAction(newerAction)
    manager.handleRemoteAction(olderAction)

    const snapshot = manager.getSnapshot()
    expect(snapshot.opponentState.board[CENTER_LINE - 3][2]).toBe(7)
    expect(snapshot.opponentState.colorBoard[CENTER_LINE - 3][2]).toBe('#abc')
    // Older snapshot should no longer be visible because replay preserved newer ordering
    expect(snapshot.opponentState.board[CENTER_LINE - 4][4]).toBe(0)
  })

  it('renders opponent locked piece that extends into local territory', () => {
    // Test that when opponent (Player 1) locks a piece that extends into
    // Player 2's territory, it's visible on Player 2's board
    const boardSnapshot = createEmptyBoard()
    const colorSnapshot = createEmptyColorBoard()

    // Place a piece that spans from Player 1's territory (row 20-21)
    // into Player 2's territory (row 22-23)
    boardSnapshot[20][4] = 1 // Player 1's territory
    boardSnapshot[21][4] = 1 // Player 1's territory (at boundary)
    boardSnapshot[22][4] = 1 // Player 2's territory
    boardSnapshot[23][4] = 1 // Player 2's territory

    colorSnapshot[20][4] = '#ff0'
    colorSnapshot[21][4] = '#ff0'
    colorSnapshot[22][4] = '#ff0'
    colorSnapshot[23][4] = '#ff0'

    const action: GameAction = {
      actionId: 'test-locked',
      sequenceId: 1000,
      playerId: 1,
      type: 'pieceLocked',
      data: {
        boardSnapshot: {
          board: boardSnapshot,
          colorBoard: colorSnapshot,
        },
        score: 100,
        linesCleared: 0,
        level: 1,
      },
    }

    manager.handleRemoteAction(action)
    const snapshot = manager.getSnapshot()

    // Check that all 4 blocks are visible in the combined board
    expect(snapshot.gameState.board[20][4]).toBe(1)
    expect(snapshot.gameState.board[21][4]).toBe(1)
    expect(snapshot.gameState.board[22][4]).toBe(1)
    expect(snapshot.gameState.board[23][4]).toBe(1)

    // Check colors too
    expect(snapshot.gameState.colorBoard[20][4]).toBe('#ff0')
    expect(snapshot.gameState.colorBoard[21][4]).toBe('#ff0')
    expect(snapshot.gameState.colorBoard[22][4]).toBe('#ff0')
    expect(snapshot.gameState.colorBoard[23][4]).toBe('#ff0')
  })
})
