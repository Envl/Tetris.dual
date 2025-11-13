import SimplePeer from 'simple-peer';
import type { GameMessage } from '$lib/game/types';

export class P2PConnection {
	private peer: SimplePeer.Instance | null = null;
	private messageHandlers: ((message: GameMessage) => void)[] = [];
	private connectionHandlers: ((connected: boolean) => void)[] = [];

	constructor(private isInitiator: boolean) {}

	initialize(signalingData?: SimplePeer.SignalData): void {
		this.peer = new SimplePeer({
			initiator: this.isInitiator,
			trickle: false
		});

		this.peer.on('signal', (data) => {
			// Send this signal data to the other peer via your signaling server
			console.log('Signal data:', JSON.stringify(data));
			// You'll need to send this to your Durable Object for relay
		});

		this.peer.on('connect', () => {
			console.log('P2P connection established');
			this.connectionHandlers.forEach((handler) => handler(true));
		});

		this.peer.on('data', (data) => {
			try {
				const message = JSON.parse(data.toString()) as GameMessage;
				this.messageHandlers.forEach((handler) => handler(message));
			} catch (error) {
				console.error('Failed to parse P2P message:', error);
			}
		});

		this.peer.on('close', () => {
			console.log('P2P connection closed');
			this.connectionHandlers.forEach((handler) => handler(false));
		});

		this.peer.on('error', (err) => {
			console.error('P2P error:', err);
		});

		if (signalingData && !this.isInitiator) {
			this.peer.signal(signalingData);
		}
	}

	signal(data: SimplePeer.SignalData): void {
		if (this.peer) {
			this.peer.signal(data);
		}
	}

	send(message: GameMessage): void {
		if (this.peer && this.peer.connected) {
			this.peer.send(JSON.stringify(message));
		}
	}

	onMessage(handler: (message: GameMessage) => void): void {
		this.messageHandlers.push(handler);
	}

	onConnection(handler: (connected: boolean) => void): void {
		this.connectionHandlers.push(handler);
	}

	destroy(): void {
		if (this.peer) {
			this.peer.destroy();
			this.peer = null;
		}
	}

	isConnected(): boolean {
		return this.peer?.connected ?? false;
	}
}
