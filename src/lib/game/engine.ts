import type { GameState, Tetromino, Position, Direction } from './types';
import { TETROMINOS, getRandomTetromino } from './tetrominos';

export const BOARD_WIDTH = 10;
export const BOARD_HEIGHT = 20;
export const EXTENDED_HEIGHT = 44; // For dual mode (20 visible + 24 for opponent)

export class TetrisEngine {
	private board: number[][];
	private colorBoard: string[][];
	private currentPiece: Tetromino | null = null;
	private nextPieces: Tetromino[] = [];
	private score = 0;
	private linesCleared = 0;
	private level = 1;
	private gameOver = false;
	private isDualMode: boolean;

	constructor(isDualMode = false) {
		this.isDualMode = isDualMode;
		const height = isDualMode ? EXTENDED_HEIGHT : BOARD_HEIGHT;
		this.board = Array(height)
			.fill(0)
			.map(() => Array(BOARD_WIDTH).fill(0));
		this.colorBoard = Array(height)
			.fill('')
			.map(() => Array(BOARD_WIDTH).fill(''));
	}

	initialize(): void {
		this.score = 0;
		this.linesCleared = 0;
		this.level = 1;
		this.gameOver = false;

		// Initialize with 3 next pieces
		this.nextPieces = [
			this.createTetromino(),
			this.createTetromino(),
			this.createTetromino()
		];
		this.spawnPiece();
	}

	private createTetromino(): Tetromino {
		const type = getRandomTetromino();
		const tetrominoData = TETROMINOS[type];
		return {
			type,
			shape: tetrominoData.shape[0],
			color: tetrominoData.color,
			position: { x: 3, y: 0 },
			rotation: 0
		};
	}

	private spawnPiece(): void {
		this.currentPiece = this.nextPieces.shift()!;
		this.nextPieces.push(this.createTetromino());

		if (!this.isValidPosition(this.currentPiece.position, this.currentPiece.shape)) {
			this.gameOver = true;
		}
	}

	move(direction: Direction): boolean {
		if (!this.currentPiece || this.gameOver) return false;

		let newPosition = { ...this.currentPiece.position };
		let newShape = this.currentPiece.shape;
		let newRotation = this.currentPiece.rotation;

		switch (direction) {
			case 'left':
				newPosition.x--;
				break;
			case 'right':
				newPosition.x++;
				break;
			case 'down':
				newPosition.y++;
				break;
			case 'rotate':
				const tetrominoData = TETROMINOS[this.currentPiece.type];
				newRotation = (this.currentPiece.rotation + 1) % tetrominoData.shape.length;
				newShape = tetrominoData.shape[newRotation];
				break;
		}

		if (this.isValidPosition(newPosition, newShape)) {
			this.currentPiece.position = newPosition;
			this.currentPiece.shape = newShape;
			this.currentPiece.rotation = newRotation;
			return true;
		}

		// If moving down failed, lock the piece
		if (direction === 'down') {
			this.lockPiece();
		}

		return false;
	}

	drop(): void {
		if (!this.currentPiece || this.gameOver) return;

		const shadowY = this.calculateShadowPosition();
		this.currentPiece.position.y = shadowY;
		this.lockPiece();
	}

	calculateShadowPosition(): number {
		if (!this.currentPiece) return 0;

		let shadowY = this.currentPiece.position.y;
		while (
			this.isValidPosition({ x: this.currentPiece.position.x, y: shadowY + 1 }, this.currentPiece.shape)
		) {
			shadowY++;
		}
		return shadowY;
	}

	private isValidPosition(position: Position, shape: number[][]): boolean {
		for (let y = 0; y < shape.length; y++) {
			for (let x = 0; x < shape[y].length; x++) {
				if (shape[y][x]) {
					const boardX = position.x + x;
					const boardY = position.y + y;

					// Check boundaries
					if (boardX < 0 || boardX >= BOARD_WIDTH || boardY < 0 || boardY >= this.board.length) {
						return false;
					}

					// Check collision with locked pieces
					if (this.board[boardY][boardX]) {
						return false;
					}
				}
			}
		}
		return true;
	}

	private lockPiece(): void {
		if (!this.currentPiece) return;

		const { position, shape, color } = this.currentPiece;

		// Lock the piece on the board
		for (let y = 0; y < shape.length; y++) {
			for (let x = 0; x < shape[y].length; x++) {
				if (shape[y][x]) {
					const boardY = position.y + y;
					const boardX = position.x + x;
					if (boardY >= 0 && boardY < this.board.length) {
						this.board[boardY][boardX] = 1;
						this.colorBoard[boardY][boardX] = color;
					}
				}
			}
		}

		// Clear lines and update score
		const clearedLines = this.clearLines();
		if (clearedLines > 0) {
			this.linesCleared += clearedLines;
			this.score += this.calculateScore(clearedLines);
			this.level = Math.floor(this.linesCleared / 10) + 1;
		}

		// Spawn next piece
		this.spawnPiece();
	}

	private clearLines(): number {
		let linesCleared = 0;
		const startY = this.isDualMode ? 4 : 0;
		const endY = this.isDualMode ? BOARD_HEIGHT + 4 : BOARD_HEIGHT;

		for (let y = endY - 1; y >= startY; y--) {
			if (this.board[y].every((cell) => cell === 1)) {
				// Remove the line
				this.board.splice(y, 1);
				this.colorBoard.splice(y, 1);
				// Add empty line at top
				this.board.splice(startY, 0, Array(BOARD_WIDTH).fill(0));
				this.colorBoard.splice(startY, 0, Array(BOARD_WIDTH).fill(''));
				linesCleared++;
				y++; // Check the same line again
			}
		}

		return linesCleared;
	}

	private calculateScore(lines: number): number {
		const baseScore = [0, 100, 300, 500, 800];
		return baseScore[lines] * this.level;
	}

	shiftBoard(direction: 'up' | 'down'): void {
		if (direction === 'up') {
			// Shift board up (remove bottom line, add empty top line)
			this.board.splice(this.board.length - 1, 1);
			this.colorBoard.splice(this.colorBoard.length - 1, 1);
			this.board.unshift(Array(BOARD_WIDTH).fill(0));
			this.colorBoard.unshift(Array(BOARD_WIDTH).fill(''));
		} else {
			// Shift board down (remove top line, add empty bottom line)
			this.board.shift();
			this.colorBoard.shift();
			this.board.push(Array(BOARD_WIDTH).fill(0));
			this.colorBoard.push(Array(BOARD_WIDTH).fill(''));
		}
	}

	getState(): GameState {
		return {
			board: this.board,
			currentPiece: this.currentPiece,
			nextPieces: this.nextPieces,
			score: this.score,
			linesCleared: this.linesCleared,
			level: this.level,
			gameOver: this.gameOver,
			paused: false
		};
	}

	getBoard(): number[][] {
		return this.board;
	}

	getColorBoard(): string[][] {
		return this.colorBoard;
	}

	getCurrentPiece(): Tetromino | null {
		return this.currentPiece;
	}

	getNextPieces(): Tetromino[] {
		return this.nextPieces;
	}

	isGameOver(): boolean {
		return this.gameOver;
	}

	getScore(): number {
		return this.score;
	}

	getLinesCleared(): number {
		return this.linesCleared;
	}

	getLevel(): number {
		return this.level;
	}
}
