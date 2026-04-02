// API 基础 URL - 使用相对路径
// 开发模式: Next.js rewrites 代理到后端
// 生产模式: 前后端同端口运行
const API_BASE_URL = '';

// API 客户端类
class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  // 通用请求方法
  private async request<T>(
    endpoint: string,
    options?: RequestInit
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...options?.headers,
        },
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Request failed' }));
        throw new Error(error.error || `HTTP ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Network request failed');
    }
  }

  // 生成 WireGuard 密钥对
  async generateWireGuardKeys(): Promise<{ privateKey: string; publicKey: string }> {
    return this.request('/api/wireguard/keygen', {
      method: 'POST',
    });
  }

  // 生成 VLESS 配置
  async generateVLESSConfig(config: VLESSConfigParams): Promise<XrayConfig> {
    return this.request('/api/config/vless', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // 生成 VMess 配置
  async generateVMessConfig(config: VMessConfigParams): Promise<XrayConfig> {
    return this.request('/api/config/vmess', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // 生成 Trojan 配置
  async generateTrojanConfig(config: TrojanConfigParams): Promise<XrayConfig> {
    return this.request('/api/config/trojan', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // 生成 WireGuard 配置
  async generateWireGuardConfig(config: WireGuardConfigParams): Promise<XrayConfig> {
    return this.request('/api/config/wireguard', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // 生成自签名证书（到实例目录）
  async generateSelfSignedCert(instance: string, domain: string, validDays: number = 365): Promise<CertificateInfo> {
    return this.request('/api/singbox/certificate', {
      method: 'POST',
      body: JSON.stringify({ instance, domain, valid_days: validDays }),
    });
  }

  // 生成 Reality x25519 密钥对
  async generateRealityKeypair(): Promise<{ private_key: string; public_key: string }> {
    return this.request('/api/singbox/reality/keypair', {
      method: 'POST',
    });
  }

  // 获取证书信息
  async getCertificateInfo(instance: string): Promise<CertificateInfo & { exists: boolean }> {
    return this.request(`/api/singbox/certificate?instance=${encodeURIComponent(instance)}`, {
      method: 'GET',
    });
  }

  // 上传证书文件
  async uploadCertificate(instance: string, certFile: File, keyFile: File): Promise<CertificateInfo> {
    const formData = new FormData();
    formData.append('instance', instance);
    formData.append('cert', certFile);
    formData.append('key', keyFile);

    const url = `${this.baseUrl}/api/singbox/certificate/upload`;
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.message || error.error || `HTTP ${response.status}`);
    }

    return await response.json();
  }

  // ========== 多配置多容器 API ==========

  // 列出所有命名配置及其容器状态
  async listInstances(): Promise<{ configs: InstanceInfo[] }> {
    return this.request('/api/singbox/instances', {
      method: 'GET',
    });
  }

  // 保存配置到命名实例
  async saveInstanceConfig(instanceName: string, config: any): Promise<{ message: string; name: string; valid?: boolean; warning?: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/config`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  // 验证命名实例的配置
  async checkInstanceConfig(instanceName: string): Promise<{ valid: boolean; message: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/check`, {
      method: 'POST',
    });
  }

  // 加载命名实例的配置
  async loadInstanceConfig(instanceName: string): Promise<any> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/config`, {
      method: 'GET',
    });
  }

  // 删除命名实例
  async deleteInstance(instanceName: string): Promise<{ message: string; name: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}`, {
      method: 'DELETE',
    });
  }

  // 启动命名实例容器
  async runInstance(instanceName: string): Promise<{ message: string; name: string; containerId: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/run`, {
      method: 'POST',
    });
  }

  // 停止命名实例容器
  async stopInstance(instanceName: string): Promise<{ message: string; name: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/stop`, {
      method: 'POST',
    });
  }

  // 获取命名实例状态
  async getInstanceStatus(instanceName: string): Promise<{ name: string; running: boolean; containerId: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/status`, {
      method: 'GET',
    });
  }

  // 获取命名实例日志
  async getInstanceLogs(instanceName: string): Promise<{ name: string; logs: string }> {
    return this.request(`/api/singbox/instances/${encodeURIComponent(instanceName)}/logs`, {
      method: 'GET',
    });
  }

  // 列出所有容器
  async listContainers(): Promise<{ containers: ContainerStatus[] }> {
    return this.request('/api/singbox/containers', {
      method: 'GET',
    });
  }

  // ========== Prober API ==========

  // 同步订阅节点到测速服务
  async syncProberNodes(): Promise<{ message: string; nodeCount: number }> {
    return this.request('/api/prober/sync', {
      method: 'POST',
    });
  }

  // 获取所有测速结果
  async getProberResults(): Promise<{ count: number; results: ProbeResult[] }> {
    return this.request('/api/prober/results', {
      method: 'GET',
    });
  }

  // 获取测速服务状态
  async getProberStatus(): Promise<ProberStats> {
    return this.request('/api/prober/status', {
      method: 'GET',
    });
  }

  // 启动测速服务
  async startProber(): Promise<{ message: string }> {
    return this.request('/api/prober/start', {
      method: 'POST',
    });
  }

  // 停止测速服务
  async stopProber(): Promise<{ message: string }> {
    return this.request('/api/prober/stop', {
      method: 'POST',
    });
  }

  // 保存测速结果到订阅文件
  async saveProberResults(): Promise<{ message: string; count: number }> {
    return this.request('/api/prober/save', {
      method: 'POST',
    });
  }
}

// 导出 API 客户端实例
export const apiClient = new ApiClient(API_BASE_URL);

// 类型定义
export interface VLESSConfigParams {
  address: string;
  port: number;
  uuid: string;
  flow?: string;
  encryption?: string;
  network: string;
  security?: string;
  sni?: string;
}

export interface VMessConfigParams {
  address: string;
  port: number;
  uuid: string;
  alterId?: number;
  security?: string;
  network: string;
  tls?: string;
  sni?: string;
}

export interface TrojanConfigParams {
  address: string;
  port: number;
  password: string;
  sni?: string;
  network: string;
}

export interface WireGuardConfigParams {
  privateKey: string;
  address: string[];
  peers: WireGuardPeer[];
  mtu?: number;
}

export interface WireGuardPeer {
  publicKey: string;
  endpoint: string;
  allowedIPs: string[];
}

export interface XrayConfig {
  log?: {
    level?: string;
    access?: string;
    error?: string;
  };
  inbounds: any[];
  outbounds: any[];
  route?: any;
}

export interface CertificateInfo {
  cert_path: string;
  key_path: string;
  host_cert_path: string;
  host_key_path: string;
  common_name: string;
  valid_from: string;
  valid_to: string;
  fingerprint: string;
}

export interface InstanceInfo {
  name: string;
  created_at: number;
  size: number;
  running: boolean;
  container_id?: string;
}

export interface ContainerStatus {
  name: string;
  container_id: string;
  state: string;
  status: string;
  created: number;
}

export interface ProbeResult {
  tag: string;
  protocol: string;
  address: string;
  port: number;
  online: boolean;
  latency: number;
  last_probe: string;
  success_rate: number;
}

export interface ProberStats {
  running: boolean;
  node_count: number;
  online_count: number;
  offline_count: number;
  last_probe_time: string;
}
