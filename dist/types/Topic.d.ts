import EventEmitter from './EventEmitter';
import Ros from './Ros';
interface TopicOptions {
    ros: Ros;
    name: string;
    messageType: string;
    compression?: string;
    throttle_rate?: number;
    queue_size?: number;
    latch?: boolean;
    queue_length?: number;
}
export default class Topic extends EventEmitter {
    readonly ros: Ros;
    readonly name: string;
    readonly messageType: string;
    readonly compression?: string;
    readonly throttle_rate?: number;
    readonly queue_size?: number;
    readonly latch?: boolean;
    readonly queue_length?: number;
    private isSubscribed;
    private isAdvertised;
    constructor(options: TopicOptions);
    subscribe(callback?: (message: any) => void): void;
    unsubscribe(): void;
    advertise(): void;
    unadvertise(): void;
    publish(message: any): void;
}
export {};
//# sourceMappingURL=Topic.d.ts.map