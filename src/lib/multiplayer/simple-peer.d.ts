declare module 'simple-peer' {
	namespace SimplePeer {
		export interface Options {
			initiator?: boolean;
			trickle?: boolean;
			config?: RTCConfiguration;
			stream?: MediaStream;
		}

		export interface SignalData {
			type?: string;
			sdp?: string;
			candidate?: RTCIceCandidateInit;
		}

		export interface Instance {
			send(data: string | Buffer | ArrayBuffer): void;
			signal(data: SignalData): void;
			destroy(): void;
			on(event: 'signal', callback: (data: SignalData) => void): void;
			on(event: 'connect', callback: () => void): void;
			on(event: 'data', callback: (data: Buffer) => void): void;
			on(event: 'close', callback: () => void): void;
			on(event: 'error', callback: (err: Error) => void): void;
			connected: boolean;
		}
	}

	interface SimplePeerConstructor {
		new (opts?: SimplePeer.Options): SimplePeer.Instance;
		(opts?: SimplePeer.Options): SimplePeer.Instance;
	}

	const SimplePeer: SimplePeerConstructor;
	export = SimplePeer;
}
