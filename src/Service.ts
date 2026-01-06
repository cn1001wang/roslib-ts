import EventEmitter from './EventEmitter';
import Ros from './Ros';
import ServiceRequest, { ServiceResponse } from './ServiceRequest';

interface ServiceOptions {
  ros: Ros;
  name: string;
  serviceType: string;
}

export default class Service extends EventEmitter {
  private ros: Ros;
  private name: string;
  private serviceType: string;
  private isAdvertised = false;

  constructor(options: ServiceOptions) {
    super();
    
    this.ros = options.ros;
    this.name = options.name;
    this.serviceType = options.serviceType;
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

  advertise(callback: (request: ServiceRequest, response: ServiceResponse) => boolean | void): void {
    if (this.isAdvertised) {
      return;
    }

    const advertiseMessage = {
      op: 'advertise_service',
      service: this.name,
      type: this.serviceType
    };

    this.ros.callOnConnection(advertiseMessage);
    this.isAdvertised = true;

    // 监听服务请求
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

    // 监听连接关闭事件
    this.ros.on('close', () => {
      this.isAdvertised = false;
    });

    this.ros.on('connection', () => {
      if (!this.isAdvertised) {
        this.advertise(callback);
      }
    });
  }

  unadvertise(): void {
    if (!this.isAdvertised) {
      return;
    }

    const unadvertiseMessage = {
      op: 'unadvertise_service',
      service: this.name
    };

    this.ros.callOnConnection(unadvertiseMessage);
    this.isAdvertised = false;
    
    // 移除事件监听器
    this.ros.off('service_request:' + this.name);
  }
}