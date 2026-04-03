// Helper utilities for routing config

// Parse textarea lines to array (filter empty lines and comments)
export const parseLines = (text: string): string[] => {
  return text
    .split(/\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
}

// Normalize IPs to CIDR (plain IPs get /32 or /128 appended)
export const normalizeIpCidrs = (ips: string[]): string[] => {
  return ips.map((ip) => {
    if (ip.includes("/")) return ip
    return ip.includes(":") ? `${ip}/128` : `${ip}/32`
  })
}
