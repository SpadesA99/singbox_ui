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

// 域名匹配分类结果
export interface DomainGroups {
  domain: string[]        // full: 精确匹配
  domain_suffix: string[] // 默认，后缀匹配
  domain_keyword: string[] // keyword: 关键词匹配
  domain_regex: string[]  // regex: 正则匹配
}

// 解析域名行，根据前缀分类：
//   full:xxx     → domain（精确）
//   keyword:xxx  → domain_keyword
//   regex:xxx    → domain_regex
//   suffix:xxx   → domain_suffix（显式）
//   xxx          → domain_suffix（默认）
export const parseDomainLines = (text: string): DomainGroups => {
  const groups: DomainGroups = { domain: [], domain_suffix: [], domain_keyword: [], domain_regex: [] }
  for (const line of parseLines(text)) {
    if (line.startsWith("full:")) {
      groups.domain.push(line.slice(5))
    } else if (line.startsWith("keyword:")) {
      groups.domain_keyword.push(line.slice(8))
    } else if (line.startsWith("regex:")) {
      groups.domain_regex.push(line.slice(6))
    } else if (line.startsWith("suffix:")) {
      groups.domain_suffix.push(line.slice(7))
    } else {
      groups.domain_suffix.push(line)
    }
  }
  return groups
}

// 将 sing-box 规则中的域名字段还原为带前缀的文本行
export const domainFieldsToLines = (rule: {
  domain?: string[]
  domain_suffix?: string[]
  domain_keyword?: string[]
  domain_regex?: string[]
}): string[] => {
  const lines: string[] = []
  for (const d of rule.domain || []) lines.push(`full:${d}`)
  for (const d of rule.domain_suffix || []) lines.push(d)
  for (const d of rule.domain_keyword || []) lines.push(`keyword:${d}`)
  for (const d of rule.domain_regex || []) lines.push(`regex:${d}`)
  return lines
}

// 将 DomainGroups 合并到 RouteRule 对象（只添加非空字段）
export const applyDomainGroups = (rule: Record<string, any>, groups: DomainGroups) => {
  if (groups.domain.length > 0) rule.domain = groups.domain
  if (groups.domain_suffix.length > 0) rule.domain_suffix = groups.domain_suffix
  if (groups.domain_keyword.length > 0) rule.domain_keyword = groups.domain_keyword
  if (groups.domain_regex.length > 0) rule.domain_regex = groups.domain_regex
}

// DomainGroups 是否有内容
export const hasDomainEntries = (groups: DomainGroups): boolean => {
  return groups.domain.length > 0 || groups.domain_suffix.length > 0 ||
    groups.domain_keyword.length > 0 || groups.domain_regex.length > 0
}
