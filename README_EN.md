# Sing-box UI

**English | [中文](README.md)**

<div align="center">

[![Docker Image](https://img.shields.io/badge/ghcr.io-singbox__ui-blue?logo=docker)](https://github.com/SpadesA99/singbox_ui/pkgs/container/singbox_ui)
[![Build Status](https://github.com/SpadesA99/singbox_ui/actions/workflows/docker-build.yml/badge.svg)](https://github.com/SpadesA99/singbox_ui/actions)
[![GitHub Stars](https://img.shields.io/github/stars/SpadesA99/singbox_ui?style=flat&logo=github)](https://github.com/SpadesA99/singbox_ui/stargazers)
[![License](https://img.shields.io/github/license/SpadesA99/singbox_ui)](LICENSE)

**A modern web-based configuration management tool for sing-box**

Built with Go 1.24 + Next.js 16, managing sing-box via Docker containers

</div>

![Sing-box UI Screenshot](docs/image.png)

---

## Features

### Protocol Support

| Inbound | Outbound | Subscription Parsing |
|---------|----------|---------------------|
| WireGuard | All inbound protocols | VMess |
| Mixed (Socks5+HTTP) | direct | VLESS |
| VLESS | block | Trojan |
| VMess | | Shadowsocks |
| Trojan | | AnyTLS |
| Shadowsocks | | Clash YAML |
| Hysteria2 | | |
| TUIC | | |
| Naive | | |
| ShadowTLS | | |
| AnyTLS | | |
| HTTP | | |

### TLS Certificate Management

- **ACME Auto-cert**: Automatic Let's Encrypt certificate issuance and renewal
- **Manual Certificate**: Upload your own certificate files
- **Multi-protocol**: ACME support for VLESS, VMess, Trojan, Hysteria2, etc.

### Route Rule Configuration

- **Quick Templates**: One-click common rules (ad blocking, China IP/domain direct, private IP direct)
- **Quick Add Rules**: Quickly add IPs or domains to direct/proxy/block lists
- **Direct Mode**: Auto-configures direct mode when no proxy outbound exists

### Load Balancing

- **URLTest Mode**: Based on sing-box `urltest` outbound, auto-selects lowest latency node
- **Configurable Tolerance**: Custom latency tolerance (default 50ms) to avoid frequent switching
- **Dynamic Node Pool**: Flexibly select multiple nodes from subscriptions to form a load balancing group
- **Smart Routing**: Auto-generates routing rules for intelligent traffic distribution

### Multi-Instance Management

- Create multiple named sing-box instances
- Independent configuration and start/stop per instance
- Separate container logs and status monitoring

### WireGuard VPN Management

- Curve25519 key generation
- IP-bound key caching
- Client config management (batch generation, QR codes, config download)

### Node Health Probing

- Async concurrent multi-node probing
- Sliding window success rate statistics
- API polling for probe results

### Management

- Config preview (JSON editor)
- Container log viewer
- Container status monitoring

---

## Quick Start

### Docker Compose (Recommended)

Create `docker-compose.yml`:

```yaml
services:
  singbox-ui:
    image: ghcr.io/spadesa99/singbox_ui:latest
    container_name: singbox-ui
    restart: unless-stopped
    network_mode: host
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - ./data:/home/data
    environment:
      - DATA_DIR=/home/data
      - LISTEN_ADDR=127.0.0.1:7000
      - TZ=Asia/Shanghai
```

```bash
docker compose up -d
```

Visit http://127.0.0.1:7000

> **Notes**:
> - Uses `network_mode: host` for direct host network access
> - Listens on `127.0.0.1:7000` by default (local only), customizable via `LISTEN_ADDR`
> - Mounts Docker Socket to manage the sing-box container
> - Host mount path is auto-detected, no manual configuration needed
> - Bundled sing-box v1.13.5 image, auto-loaded on first start without network access

### Remote Access

The service listens on `127.0.0.1` by default. Use SSH tunnel for secure remote access:

```bash
ssh -L 7000:127.0.0.1:7000 user@your-server
```

Then visit http://127.0.0.1:7000 in your local browser.

> **Security Note**: Do not change `LISTEN_ADDR` to `0.0.0.0:7000` to expose it publicly — the panel has no authentication. For external access, use SSH tunneling or a reverse proxy with authentication (e.g., Nginx + Basic Auth).

---

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATA_DIR` | Data directory inside container | `/home/data` |
| `LISTEN_ADDR` | Server listen address | `127.0.0.1:7000` |
| `TZ` | Timezone | `Asia/Shanghai` |

---

## Tech Stack

| Frontend | Backend |
|----------|---------|
| Next.js 16 | Go 1.24 |
| React 19 | Gin 1.11 |
| Tailwind CSS | Docker SDK |
| shadcn/ui | |

---

## License

[MIT License](LICENSE)

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=SpadesA99/singbox_ui&type=Date)](https://star-history.com/#SpadesA99/singbox_ui&Date)

## Acknowledgments

- [sing-box](https://github.com/SagerNet/sing-box)
- [Next.js](https://nextjs.org/)
- [Gin](https://github.com/gin-gonic/gin)
- [shadcn/ui](https://ui.shadcn.com/)
