import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';
import ServiceRequest, { ServiceResponse } from './ServiceRequest';
interface ServiceOptions {
    ros: RosLike;
    name: string;
    serviceType: string;
}
export default class Service extends EventEmitter {
    private ros;
    private name;
    private serviceType;
    private isAdvertised;
    /** 存储绑定的重连处理器 */
    private _reconnectHandler;
    /** 存储服务请求处理函数，便于卸载 */
    private _currentServiceCallback;
    constructor(options: ServiceOptions);
    callService(request: ServiceRequest, callback?: (response: ServiceResponse) => void, failedCallback?: (error: any) => void): Promise<ServiceResponse>;
    /** 发送底层的服务公告协议 */
    private _sendAdvertise;
    /**
     * 公告服务（服务端模式）
     * @param callback 处理请求并返回结果的回调
     */
    advertise(callback: (request: ServiceRequest, response: ServiceResponse) => any): void;
    /**
     * 取消服务公告
     */
    unadvertise(): void;
    /** 内部状态处理：连接关闭时重置标志位 */
    private _handleClose;
}
export {};
//# sourceMappingURL=Service.d.ts.map