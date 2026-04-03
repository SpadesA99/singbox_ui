// Shared types for outbound protocol form components

// Props shared by all outbound protocol form components
export interface OutboundFormProps {
  initialConfig: any
  setOutbound: (index: number, outbound: any) => void
}

// Helper: extract transport Host field (compatible with array and string formats)
export function extractTransportHost(transport: any): string {
  if (!transport) return ""
  const headerHost = Array.isArray(transport.headers?.Host)
    ? transport.headers.Host[0]
    : transport.headers?.Host
  const directHost = Array.isArray(transport.host)
    ? transport.host[0]
    : transport.host
  return headerHost || directHost || ""
}
