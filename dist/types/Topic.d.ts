import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';
interface TopicOptions {
    ros: RosLike;
    name: string;
    messageType: string;
    compression?: string;
    throttle_rate?: number;
    queue_size?: number;
    latch?: boolean;
    queue_length?: number;
}
export default class Topic extends EventEmitter {
    readonly ros: RosLike;
    readonly name: string;
    readonly messageType: string;
    readonly compression?: string;
    readonly throttle_rate?: number;
    readonly queue_size?: number;
    readonly latch?: boolean;
    readonly queue_length?: number;
    private isSubscribed;
    private isAdvertised;
    /** 存储绑定的重连处理器，便于精准卸载 */
    private _reconnectHandler;
    constructor(options: TopicOptions);
    /** 发送底层的订阅协议包 */
    private _sendSubscribe;
    /** 发送底层的公告协议包 */
    private _sendAdvertise;
    /**
     * 订阅话题
     * @param callback 接收消息的回调函数
     */
    subscribe(callback?: (message: any) => void): void;
    /** 取消订阅 */
    unsubscribe(): void;
    /** 公告话题（作为发布者） */
    advertise(): void;
    /** 取消公告 */
    unadvertise(): void;
    /** 发布消息 */
    publish(message: any): void;
    /** 内部状态处理：连接关闭时重置标志位 */
    private _handleClose;
}
export {};
//# sourceMappingURL=Topic.d.ts.map