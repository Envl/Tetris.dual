export interface MatchmakingClient {
	joinQueue(): Promise<{ roomId: string; isHost: boolean }>;
	leaveQueue(): Promise<void>;
	sendSignal(roomId: string, signal: any): Promise<void>;
	onSignal(callback: (signal: any) => void): void;
}

export class MatchmakingService implements MatchmakingClient {
	private ws: WebSocket | null = null;
	private signalCallbacks: ((signal: any) => void)[] = [];

	constructor(private durableObjectUrl: string) {}

	async joinQueue(): Promise<{ roomId: string; isHost: boolean }> {
		return new Promise((resolve, reject) => {
			this.ws = new WebSocket(this.durableObjectUrl);

			this.ws.onopen = () => {
				this.ws?.send(JSON.stringify({ type: 'join' }));
			};

			this.ws.onmessage = (event) => {
				const data = JSON.parse(event.data);

				if (data.type === 'matched') {
					resolve({
						roomId: data.roomId,
						isHost: data.isHost
					});
				} else if (data.type === 'signal') {
					this.signalCallbacks.forEach((cb) => cb(data.signal));
				}
			};

			this.ws.onerror = (error) => {
				reject(error);
			};
		});
	}

	async leaveQueue(): Promise<void> {
		if (this.ws) {
			this.ws.send(JSON.stringify({ type: 'leave' }));
			this.ws.close();
			this.ws = null;
		}
	}

	async sendSignal(roomId: string, signal: any): Promise<void> {
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			this.ws.send(
				JSON.stringify({
					type: 'signal',
					roomId,
					signal
				})
			);
		}
	}

	onSignal(callback: (signal: any) => void): void {
		this.signalCallbacks.push(callback);
	}
}
