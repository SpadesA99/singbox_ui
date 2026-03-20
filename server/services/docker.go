package services

import (
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/mount"
	"github.com/docker/docker/client"
	"github.com/docker/docker/pkg/stdcopy"
)

// Docker 容器配置常量
const (
	SingBoxContainerName = "sing-box"
	SingBoxContainerPrefix = "sing-box-" // 用于多配置容器命名
	SingBoxImageName     = "ghcr.io/sagernet/sing-box:latest"
	ContainerConfigDir   = "/etc/sing-box"
	ContainerDataDir     = "/var/lib/sing-box"
	// 宿主机数据目录（通过环境变量配置，默认为 /root/singbox_data）
	DefaultHostDataDir = "/root/singbox_data"
)

// DockerService Docker 服务封装
type DockerService struct {
	cli *client.Client
	ctx context.Context
}

// NewDockerService 创建 Docker 服务实例
func NewDockerService() (*DockerService, error) {
	cli, err := client.NewClientWithOpts(client.FromEnv, client.WithAPIVersionNegotiation())
	if err != nil {
		return nil, fmt.Errorf("failed to create docker client: %w", err)
	}

	return &DockerService{
		cli: cli,
		ctx: context.Background(),
	}, nil
}

// Close 关闭 Docker 客户端
func (d *DockerService) Close() error {
	if d.cli != nil {
		return d.cli.Close()
	}
	return nil
}

// EnsureImage 确保镜像存在，如不存在则拉取
func (d *DockerService) EnsureImage() error {
	log.Printf("Checking if image %s exists...", SingBoxImageName)

	// 检查镜像是否已存在
	images, err := d.cli.ImageList(d.ctx, types.ImageListOptions{
		Filters: filters.NewArgs(filters.Arg("reference", SingBoxImageName)),
	})
	if err != nil {
		return fmt.Errorf("failed to list images: %w", err)
	}

	if len(images) > 0 {
		log.Printf("Image %s already exists", SingBoxImageName)
		return nil
	}

	// 拉取镜像
	log.Printf("Pulling image %s...", SingBoxImageName)
	reader, err := d.cli.ImagePull(d.ctx, SingBoxImageName, types.ImagePullOptions{})
	if err != nil {
		return fmt.Errorf("failed to pull image: %w", err)
	}
	defer reader.Close()

	// 等待拉取完成
	_, err = io.Copy(io.Discard, reader)
	if err != nil {
		return fmt.Errorf("failed to read pull response: %w", err)
	}

	log.Printf("Image %s pulled successfully", SingBoxImageName)
	return nil
}

// CreateAndStartContainer 创建并启动 sing-box 容器
func (d *DockerService) CreateAndStartContainer(hostConfigDir string) (string, error) {
	// 先尝试删除可能存在的同名容器
	_ = d.RemoveContainer()

	// 获取宿主机上的实际配置目录
	// 如果设置了 HOST_SINGBOX_DIR 环境变量（用于 Docker-in-Docker 场景），使用它
	hostSingboxDir := os.Getenv("HOST_SINGBOX_DIR")
	if hostSingboxDir == "" {
		// 默认使用传入的路径，清理路径防止穿越
		hostSingboxDir = filepath.Clean(hostConfigDir)
	}

	log.Printf("Mounting host directory %s to container /etc/sing-box", hostSingboxDir)

	// 确保 ACME 数据目录存在（使用容器内部路径创建目录）
	// hostConfigDir 是 singbox-ui 容器内的路径
	// hostSingboxDir 是宿主机路径，用于 Docker API 挂载配置
	internalAcmeDir := filepath.Join(hostConfigDir, "acme")
	if err := os.MkdirAll(internalAcmeDir, 0755); err != nil {
		log.Printf("Warning: failed to create ACME directory %s: %v", internalAcmeDir, err)
	}
	// 宿主机上对应的 ACME 目录路径（用于 Docker mount）
	hostAcmeDir := hostSingboxDir + "/acme"

	// 容器配置
	// sing-box 镜像使用 sing-box 作为入口点
	// 命令格式: -D /var/lib/sing-box -C /etc/sing-box/ run
	config := &container.Config{
		Image: SingBoxImageName,
		Cmd:   []string{"-D", ContainerDataDir, "-C", ContainerConfigDir + "/", "run"},
	}

	// 主机配置
	hostConfig := &container.HostConfig{
		// 使用 host 网络模式
		NetworkMode: "host",

		// 配置文件挂载
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   hostSingboxDir,
				Target:   "/etc/sing-box",
				ReadOnly: true,
			},
			{
				// ACME 数据目录（用于自动证书申请）
				Type:     mount.TypeBind,
				Source:   hostAcmeDir,
				Target:   "/var/lib/sing-box/acme",
				ReadOnly: false,
			},
		},

		// 添加 NET_ADMIN 能力（sing-box 需要）
		CapAdd: []string{"NET_ADMIN"},

		// 重启策略
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},

		// 资源限制
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024, // 512MB
			NanoCPUs: 1000000000,        // 1 CPU
		},
	}

	// 创建容器
	resp, err := d.cli.ContainerCreate(
		d.ctx,
		config,
		hostConfig,
		nil, // networkingConfig
		nil, // platform
		SingBoxContainerName,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	// 启动容器
	if err := d.cli.ContainerStart(d.ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		// 如果启动失败，删除容器
		_ = d.cli.ContainerRemove(d.ctx, resp.ID, types.ContainerRemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Container %s started with ID: %s", SingBoxContainerName, resp.ID[:12])
	return resp.ID, nil
}

// StopContainer 停止 sing-box 容器
func (d *DockerService) StopContainer() error {
	timeout := 10 // 10 秒超时
	stopOptions := container.StopOptions{
		Timeout: &timeout,
	}

	if err := d.cli.ContainerStop(d.ctx, SingBoxContainerName, stopOptions); err != nil {
		return fmt.Errorf("failed to stop container: %w", err)
	}

	log.Printf("Container %s stopped", SingBoxContainerName)
	return nil
}

// RemoveContainer 删除 sing-box 容器
func (d *DockerService) RemoveContainer() error {
	if err := d.cli.ContainerRemove(d.ctx, SingBoxContainerName, types.ContainerRemoveOptions{
		Force: true,
	}); err != nil {
		// 忽略容器不存在的错误
		if !strings.Contains(err.Error(), "No such container") {
			return fmt.Errorf("failed to remove container: %w", err)
		}
	}

	log.Printf("Container %s removed", SingBoxContainerName)
	return nil
}

// GetContainerStatus 获取容器状态
func (d *DockerService) GetContainerStatus() (running bool, containerID string, err error) {
	containers, err := d.cli.ContainerList(d.ctx, types.ContainerListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("name", SingBoxContainerName)),
	})
	if err != nil {
		return false, "", fmt.Errorf("failed to list containers: %w", err)
	}

	if len(containers) == 0 {
		return false, "", nil
	}

	c := containers[0]
	return c.State == "running", c.ID, nil
}

// GetContainerLogs 获取容器日志
func (d *DockerService) GetContainerLogs(tail string) (string, error) {
	if tail == "" {
		tail = "100"
	}

	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	}

	reader, err := d.cli.ContainerLogs(d.ctx, SingBoxContainerName, options)
	if err != nil {
		return "", fmt.Errorf("failed to get container logs: %w", err)
	}
	defer reader.Close()

	// 使用 stdcopy 分离 stdout 和 stderr
	var stdout, stderr strings.Builder
	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}

	// 合并输出
	logs := stdout.String()
	if stderr.Len() > 0 {
		logs += "\n--- STDERR ---\n" + stderr.String()
	}

	return logs, nil
}

// GetSingBoxVersion 创建临时容器执行 `sing-box version` 获取版本号
func (d *DockerService) GetSingBoxVersion() (string, error) {
	resp, err := d.cli.ContainerCreate(d.ctx, &container.Config{
		Image: SingBoxImageName,
		Cmd:   []string{"version"},
	}, nil, nil, nil, "")
	if err != nil {
		return "", fmt.Errorf("failed to create temp container: %w", err)
	}
	defer d.cli.ContainerRemove(d.ctx, resp.ID, types.ContainerRemoveOptions{Force: true})

	if err := d.cli.ContainerStart(d.ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		return "", fmt.Errorf("failed to start temp container: %w", err)
	}

	// 等待容器退出
	statusCh, errCh := d.cli.ContainerWait(d.ctx, resp.ID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		if err != nil {
			return "", fmt.Errorf("error waiting for container: %w", err)
		}
	case <-statusCh:
	case <-time.After(10 * time.Second):
		return "", fmt.Errorf("timeout waiting for version")
	}

	// 从容器日志读取输出（容器已退出，一次性读取）
	logReader, err := d.cli.ContainerLogs(d.ctx, resp.ID, types.ContainerLogsOptions{ShowStdout: true})
	if err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}
	defer logReader.Close()

	var stdout, stderr strings.Builder
	_, err = stdcopy.StdCopy(&stdout, &stderr, logReader)
	if err != nil {
		return "", fmt.Errorf("failed to parse logs: %w", err)
	}

	// 只取第一行：sing-box version x.x.x
	output := strings.TrimSpace(stdout.String())
	if i := strings.IndexByte(output, '\n'); i != -1 {
		output = output[:i]
	}
	return strings.TrimSpace(output), nil
}

// CheckNamedConfig 使用临时容器验证命名配置是否正确
func (d *DockerService) CheckNamedConfig(configName string, hostConfigDir string) (bool, string, error) {
	// 获取宿主机上的实际配置目录
	hostSingboxDir := os.Getenv("HOST_SINGBOX_DIR")
	if hostSingboxDir == "" {
		hostSingboxDir = filepath.Clean(hostConfigDir)
	} else {
		hostSingboxDir = filepath.Join(hostSingboxDir, "configs", configName)
	}

	resp, err := d.cli.ContainerCreate(d.ctx, &container.Config{
		Image: SingBoxImageName,
		Cmd:   []string{"check", "-C", ContainerConfigDir + "/"},
	}, &container.HostConfig{
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   hostSingboxDir,
				Target:   ContainerConfigDir,
				ReadOnly: true,
			},
		},
	}, nil, nil, "")
	if err != nil {
		return false, "", fmt.Errorf("failed to create check container: %w", err)
	}
	defer d.cli.ContainerRemove(d.ctx, resp.ID, types.ContainerRemoveOptions{Force: true})

	if err := d.cli.ContainerStart(d.ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		return false, "", fmt.Errorf("failed to start check container: %w", err)
	}

	// 等待容器退出
	statusCh, errCh := d.cli.ContainerWait(d.ctx, resp.ID, container.WaitConditionNotRunning)
	var exitCode int64
	select {
	case err := <-errCh:
		if err != nil {
			return false, "", fmt.Errorf("error waiting for check container: %w", err)
		}
		// errCh returned nil, still need to read status
		status := <-statusCh
		exitCode = status.StatusCode
	case status := <-statusCh:
		exitCode = status.StatusCode
	case <-time.After(30 * time.Second):
		return false, "", fmt.Errorf("timeout waiting for config check")
	}

	// 读取输出
	logReader, err := d.cli.ContainerLogs(d.ctx, resp.ID, types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
	})
	if err != nil {
		return false, "", fmt.Errorf("failed to read check logs: %w", err)
	}
	defer logReader.Close()

	var stdout, stderr strings.Builder
	_, _ = stdcopy.StdCopy(&stdout, &stderr, logReader)

	output := strings.TrimSpace(stderr.String())
	if output == "" {
		output = strings.TrimSpace(stdout.String())
	}

	if exitCode != 0 {
		return false, output, nil
	}
	return true, output, nil
}

// execInContainer 在运行中的容器内执行命令
func (d *DockerService) execInContainer(cmd ...string) (string, error) {
	execConfig := types.ExecConfig{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	}

	execResp, err := d.cli.ContainerExecCreate(d.ctx, SingBoxContainerName, execConfig)
	if err != nil {
		return "", fmt.Errorf("failed to create exec: %w", err)
	}

	attachResp, err := d.cli.ContainerExecAttach(d.ctx, execResp.ID, types.ExecStartCheck{})
	if err != nil {
		return "", fmt.Errorf("failed to attach to exec: %w", err)
	}
	defer attachResp.Close()

	var stdout, stderr strings.Builder
	_, err = stdcopy.StdCopy(&stdout, &stderr, attachResp.Reader)
	if err != nil {
		return "", fmt.Errorf("failed to read exec output: %w", err)
	}

	output := strings.TrimSpace(stdout.String())
	if output == "" {
		output = strings.TrimSpace(stderr.String())
	}

	return output, nil
}


// GetNamedContainerName 获取命名配置的容器名称
func GetNamedContainerName(configName string) string {
	return SingBoxContainerPrefix + configName
}

// CreateAndStartNamedContainer 创建并启动命名的 sing-box 容器
func (d *DockerService) CreateAndStartNamedContainer(configName string, hostConfigDir string) (string, error) {
	containerName := GetNamedContainerName(configName)

	// 先尝试删除可能存在的同名容器
	_ = d.RemoveNamedContainer(configName)

	// 获取宿主机上的实际配置目录
	hostSingboxDir := os.Getenv("HOST_SINGBOX_DIR")
	if hostSingboxDir == "" {
		hostSingboxDir = filepath.Clean(hostConfigDir)
	} else {
		// 如果设置了 HOST_SINGBOX_DIR，需要添加配置名称路径
		hostSingboxDir = filepath.Join(hostSingboxDir, "configs", configName)
	}

	log.Printf("Creating named container %s, mounting %s to /etc/sing-box", containerName, hostSingboxDir)

	// 确保 ACME 数据目录存在（使用容器内部路径创建目录）
	// hostConfigDir 是 singbox-ui 容器内的路径（如 /home/data/singbox/configs/vless）
	// hostSingboxDir 是宿主机路径，用于 Docker API 挂载配置
	internalAcmeDir := filepath.Join(hostConfigDir, "acme")
	if err := os.MkdirAll(internalAcmeDir, 0755); err != nil {
		log.Printf("Warning: failed to create ACME directory %s: %v", internalAcmeDir, err)
	}
	// 宿主机上对应的 ACME 目录路径（用于 Docker mount）
	hostAcmeDir := hostSingboxDir + "/acme"

	// 容器配置
	config := &container.Config{
		Image: SingBoxImageName,
		Cmd:   []string{"-D", ContainerDataDir, "-C", ContainerConfigDir + "/", "run"},
	}

	// 主机配置
	hostConfig := &container.HostConfig{
		NetworkMode: "host",
		Mounts: []mount.Mount{
			{
				Type:     mount.TypeBind,
				Source:   hostSingboxDir,
				Target:   "/etc/sing-box",
				ReadOnly: true,
			},
			{
				// ACME 数据目录（用于自动证书申请）
				Type:     mount.TypeBind,
				Source:   hostAcmeDir,
				Target:   "/var/lib/sing-box/acme",
				ReadOnly: false,
			},
		},
		CapAdd: []string{"NET_ADMIN"},
		RestartPolicy: container.RestartPolicy{
			Name: "unless-stopped",
		},
		Resources: container.Resources{
			Memory:   512 * 1024 * 1024,
			NanoCPUs: 1000000000,
		},
	}

	// 创建容器
	resp, err := d.cli.ContainerCreate(
		d.ctx,
		config,
		hostConfig,
		nil,
		nil,
		containerName,
	)
	if err != nil {
		return "", fmt.Errorf("failed to create container: %w", err)
	}

	// 启动容器
	if err := d.cli.ContainerStart(d.ctx, resp.ID, types.ContainerStartOptions{}); err != nil {
		_ = d.cli.ContainerRemove(d.ctx, resp.ID, types.ContainerRemoveOptions{Force: true})
		return "", fmt.Errorf("failed to start container: %w", err)
	}

	log.Printf("Named container %s started with ID: %s", containerName, resp.ID[:12])
	return resp.ID, nil
}

// StopNamedContainer 停止命名的 sing-box 容器
func (d *DockerService) StopNamedContainer(configName string) error {
	containerName := GetNamedContainerName(configName)
	timeout := 10
	stopOptions := container.StopOptions{
		Timeout: &timeout,
	}

	if err := d.cli.ContainerStop(d.ctx, containerName, stopOptions); err != nil {
		if !strings.Contains(err.Error(), "No such container") {
			return fmt.Errorf("failed to stop container: %w", err)
		}
	}

	log.Printf("Named container %s stopped", containerName)
	return nil
}

// RemoveNamedContainer 删除命名的 sing-box 容器
func (d *DockerService) RemoveNamedContainer(configName string) error {
	containerName := GetNamedContainerName(configName)
	if err := d.cli.ContainerRemove(d.ctx, containerName, types.ContainerRemoveOptions{
		Force: true,
	}); err != nil {
		if !strings.Contains(err.Error(), "No such container") {
			return fmt.Errorf("failed to remove container: %w", err)
		}
	}

	log.Printf("Named container %s removed", containerName)
	return nil
}

// GetNamedContainerStatus 获取命名容器状态
func (d *DockerService) GetNamedContainerStatus(configName string) (running bool, containerID string, err error) {
	containerName := GetNamedContainerName(configName)
	containers, err := d.cli.ContainerList(d.ctx, types.ContainerListOptions{
		All: true,
	})
	if err != nil {
		return false, "", fmt.Errorf("failed to list containers: %w", err)
	}

	// 手动过滤容器名称，因为 Docker API 的 name filter 是子字符串匹配
	for _, c := range containers {
		for _, name := range c.Names {
			if name == "/"+containerName {
				return c.State == "running", c.ID, nil
			}
		}
	}

	return false, "", nil
}

// GetNamedContainerLogs 获取命名容器日志
func (d *DockerService) GetNamedContainerLogs(configName string, tail string) (string, error) {
	containerName := GetNamedContainerName(configName)
	if tail == "" {
		tail = "100"
	}

	options := types.ContainerLogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Tail:       tail,
		Timestamps: true,
	}

	reader, err := d.cli.ContainerLogs(d.ctx, containerName, options)
	if err != nil {
		return "", fmt.Errorf("failed to get container logs: %w", err)
	}
	defer reader.Close()

	var stdout, stderr strings.Builder
	_, err = stdcopy.StdCopy(&stdout, &stderr, reader)
	if err != nil {
		return "", fmt.Errorf("failed to read logs: %w", err)
	}

	logs := stdout.String()
	if stderr.Len() > 0 {
		logs += "\n--- STDERR ---\n" + stderr.String()
	}

	return logs, nil
}

// ListAllSingboxContainers 列出所有 sing-box 容器
func (d *DockerService) ListAllSingboxContainers() ([]ContainerInfo, error) {
	containers, err := d.cli.ContainerList(d.ctx, types.ContainerListOptions{
		All:     true,
		Filters: filters.NewArgs(filters.Arg("name", SingBoxContainerPrefix)),
	})
	if err != nil {
		return nil, fmt.Errorf("failed to list containers: %w", err)
	}

	var result []ContainerInfo
	for _, c := range containers {
		name := ""
		if len(c.Names) > 0 {
			name = strings.TrimPrefix(c.Names[0], "/")
			name = strings.TrimPrefix(name, SingBoxContainerPrefix)
		}
		result = append(result, ContainerInfo{
			Name:        name,
			ContainerID: c.ID[:12],
			State:       c.State,
			Status:      c.Status,
			Created:     c.Created,
		})
	}

	return result, nil
}

// ContainerInfo 容器信息
type ContainerInfo struct {
	Name        string `json:"name"`
	ContainerID string `json:"container_id"`
	State       string `json:"state"`
	Status      string `json:"status"`
	Created     int64  `json:"created"`
}
