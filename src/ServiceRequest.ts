export default class ServiceRequest {
  [key: string]: any;

  constructor(values?: { [key: string]: any }) {
    if (values) {
      Object.assign(this, values);
    }
  }
}

export class ServiceResponse {
  [key: string]: any;

  constructor(values?: { [key: string]: any }) {
    if (values) {
      Object.assign(this, values);
    }
  }
}