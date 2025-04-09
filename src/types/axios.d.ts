declare module 'axios' {
  export interface AxiosResponse<T = any> {
    data: T;
    status: number;
    statusText: string;
    headers: any;
    config: any;
  }

  export interface AxiosRequestConfig {
    url?: string;
    method?: string;
    baseURL?: string;
    headers?: any;
    params?: any;
    data?: any;
  }

  export default function axios(config: AxiosRequestConfig): Promise<AxiosResponse>;
  export default function axios(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse>;
} 