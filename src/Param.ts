import { RosLike } from './Ros';
import Service from './Service';
import ServiceRequest from './ServiceRequest';

interface ParamOptions {
  ros: RosLike;
  name: string;
}

export default class Param {
  private ros: RosLike;
  private name: string;

  constructor(options: ParamOptions) {
    this.ros = options.ros;
    this.name = options.name;
  }

  get(callback?: (value: any) => void): Promise<any> {
    return new Promise((resolve, reject) => {
      const service = new Service({
        ros: this.ros,
        name: '/rosapi/get_param',
        serviceType: 'rosapi/GetParam'
      });

      const request = new ServiceRequest({
        name: this.name,
        default: ''
      });

      service.callService(request, (response: any) => {
        if (callback) callback(response.value);
        resolve(response.value);
      }, (error: any) => {
        reject(error);
      });
    });
  }

  set(value: any, callback?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const service = new Service({
        ros: this.ros,
        name: '/rosapi/set_param',
        serviceType: 'rosapi/SetParam'
      });

      const request = new ServiceRequest({
        name: this.name,
        value: JSON.stringify(value)
      });

      service.callService(request, () => {
        if (callback) callback();
        resolve();
      }, (error: any) => {
        reject(error);
      });
    });
  }

  delete(callback?: () => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const service = new Service({
        ros: this.ros,
        name: '/rosapi/delete_param',
        serviceType: 'rosapi/DeleteParam'
      });

      const request = new ServiceRequest({
        name: this.name
      });

      service.callService(request, () => {
        if (callback) callback();
        resolve();
      }, (error: any) => {
        reject(error);
      });
    });
  }
}
