import EventEmitter from './EventEmitter';
import { RosLike } from './Ros';
import ServiceRequest, { ServiceResponse } from './ServiceRequest';

interface ServiceOptions {
  ros: RosLike;
  name: string;
  serviceType: string;
}

export default class Service extends EventEmitter {
  private ros: RosLike;
  private name: string;
  private serviceType: string;
  private isAdvertised = false;

/** 存储绑定的重连处理器 */
  private _reconnectHandler: () => void;
  /** 存储服务请求处理函数，便于卸载 */
  private _currentServiceCallback: ((request: ServiceRequest, response: ServiceResponse) => any) | null = null;
  constructor(options: ServiceOptions) {
    super();
    
    this.ros = options.ros;
    this.name = options.name;
    this.serviceType = options.serviceType;
    // 预定义重连恢复逻辑
    this._reconnectHandler = () => {
      if (this.isAdvertised && this._currentServiceCallback) {
        this._sendAdvertise();
      }
    };
  }

  callService(request: ServiceRequest, callback?: (response: ServiceResponse) => void, failedCallback?: (error: any) => void): Promise<ServiceResponse> {
    return new Promise((resolve, reject) => {
      const serviceId = this.ros.getNextId();
      
      const serviceMessage = {
        op: 'call_service',
        id: serviceId,
        service: this.name,
        type: this.serviceType,
        args: request
      };

      // 监听服务响应
      const responseHandler = (message: any) => {
        if (message.id === serviceId) {
          this.ros.off(serviceId, responseHandler);

          // rosbridge-level error
          if (message.result === false) {
            const error = new Error(
              message.error || `Service ${this.name} call failed`
            );
            failedCallback?.(error);
            reject(error);
            return;
          }

          // protocol error
          if (message.result === undefined) {
            const error = new Error('Invalid service response');
            failedCallback?.(error);
            reject(error);
            return;
          }

          // success
          const response = new ServiceResponse(message.values ?? {});
          callback?.(response);
          resolve(response);
        }
      };

      this.ros.on(serviceId, responseHandler);
      this.ros.callOnConnection(serviceMessage);
    });
  }
  /** 发送底层的服务公告协议 */
  private _sendAdvertise(): void {
    this.isAdvertised = true;
    const advertiseMessage = {
      op: 'advertise_service',
      type: this.serviceType,
      service: this.name
    };
    this.ros.callOnConnection(advertiseMessage);
  }
  /**
   * 公告服务（服务端模式）
   * @param callback 处理请求并返回结果的回调
   */
  advertise(callback: (request: ServiceRequest, response: ServiceResponse) => any): void {
    if (this.isAdvertised) return;

    this._currentServiceCallback = callback;

    // 1. 防御性卸载旧监听
    this.ros.off('connection', this._reconnectHandler);
    this.ros.off('close', this._handleClose);
    this.ros.off('service_request:' + this.name);

    // 2. 挂载生命周期监听
    this.ros.on('connection', this._reconnectHandler);
    this.ros.on('close', this._handleClose);

    // 3. 监听服务请求
    this.ros.on('service_request:' + this.name, (message: any) => {
      const request = new ServiceRequest(message.args);
      const response = new ServiceResponse();
      
      try {
        const result = callback(request, response);
        
        const responseMessage = {
          op: 'service_response',
          service: this.name,
          id: message.id,
          values: response,
          result: result !== false
        };
        
        this.ros.callOnConnection(responseMessage);
      } catch (error) {
        const errorMessage = {
          op: 'service_response',
          service: this.name,
          id: message.id,
          result: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
        
        this.ros.callOnConnection(errorMessage);
      }
    });

    // 4. 执行物理公告
    this._sendAdvertise();
  }

  /**
   * 取消服务公告
   */
  unadvertise(): void {
    if (!this.isAdvertised) return;

    const unadvertiseMessage = {
      op: 'unadvertise_service',
      service: this.name
    };

    this.ros.callOnConnection(unadvertiseMessage);
    this.isAdvertised = false;
    this._currentServiceCallback = null;

    // 彻底清理资源：移除所有相关监听
    this.ros.off('service_request:' + this.name);
    this.ros.off('connection', this._reconnectHandler);
    this.ros.off('close', this._handleClose);
  }

  /** 内部状态处理：连接关闭时重置标志位 */
  private _handleClose = () => {
    this.isAdvertised = false;
  };
}
