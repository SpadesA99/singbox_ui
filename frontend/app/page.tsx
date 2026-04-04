"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { InboundConfig } from "@/components/inbound"
import { OutboundConfig } from "@/components/outbound"
import { RoutingConfig } from "@/components/route"
import { DnsConfigComponent } from "@/components/dns-config"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  RotateCw,
  RotateCcw,
  Save,
  FileText,
  Server,
  Shield,
  ArrowRightLeft,
  Route,
  Zap,
  Rss,
  Check,
  Globe,
  Copy,
  Plus,
  Play,
  Square,
  Trash2,
  Pencil,
  Code,
  X,
  Github,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SubscriptionManager } from "@/components/subscription-manager"
import { JsonEditor } from "@/components/json-editor"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import AnsiToHtml from "ansi-to-html"

export default function Home() {
  const { toast } = useToast()
  const { t } = useTranslation("page")
  const { t: tc } = useTranslation("common")

  // Global store
  const {
    config,
    currentInstance,
    instances,
    setLogLevel,
    getFullConfig,
    setOutbound,
    resetConfig,
    loadConfig,
    isLoading,
    isSaving,
    lastSavedAt,
    loadInstances,
    loadInstanceConfig,
    saveInstanceConfig,
    createInstance,
    deleteInstance,
  } = useSingboxConfigStore()

  const [singboxVersion, setSingboxVersion] = useState<string>("")
  const [activeTab, setActiveTab] = useState<"subscription" | "inbound" | "outbound" | "routing" | "dns">("inbound")
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [newInstanceName, setNewInstanceName] = useState("")
  const [creating, setCreating] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [instanceToDelete, setInstanceToDelete] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [resetDialogOpen, setResetDialogOpen] = useState(false)
  const [logsDialogOpen, setLogsDialogOpen] = useState(false)
  const [instanceLogs, setInstanceLogs] = useState("")
  const [logsLoading, setLogsLoading] = useState(false)
  
  // JSON Drawer State
  const [jsonDrawerOpen, setJsonDrawerOpen] = useState(false)
  const [jsonEditMode, setJsonEditMode] = useState(false)
  const [editedJson, setEditedJson] = useState("")
  
  const [validating, setValidating] = useState(false)
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [errorDialogTitle, setErrorDialogTitle] = useState("")
  const [errorDialogMessage, setErrorDialogMessage] = useState("")
  const ansiConverter = useMemo(() => new AnsiToHtml({ fg: "#ccc", bg: "transparent", newline: true }), [])

  const fullConfig = getFullConfig()
  const hasConfig = (config.inbounds?.length ?? 0) > 0 || (config.outbounds?.length ?? 0) > 0

  useEffect(() => {
    loadInstances()
    checkSingboxVersion()
    const interval = setInterval(loadInstances, 5000)
    return () => clearInterval(interval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const checkSingboxVersion = async () => {
    try {
      const response = await fetch("/api/singbox/version")
      if (response.ok) {
        const data = await response.json()
        setSingboxVersion(data.version)
      }
    } catch (error) {
      console.log("sing-box not installed")
    }
  }

  const handleInstanceSelect = async (instanceName: string) => {
    if (instanceName === currentInstance) return
    const loaded = await loadInstanceConfig(instanceName)
    if (loaded) {
      toast({
        title: t("configLoaded"),
        description: t("configLoadedDesc", { name: instanceName }),
      })
    }
  }

  const handleCreateInstance = async () => {
    const name = newInstanceName.trim()
    if (!name) {
      toast({ title: tc("error"), description: t("nameRequired"), variant: "destructive" })
      return
    }
    if (!/^[a-zA-Z][a-zA-Z_-]{1,9}$/.test(name)) {
      toast({ title: tc("error"), description: t("nameInvalid"), variant: "destructive" })
      return
    }
    if (instances.some(i => i.name === name)) {
      toast({ title: tc("error"), description: t("nameExists"), variant: "destructive" })
      return
    }

    setCreating(true)
    try {
      resetConfig()
      const success = await createInstance(name)
      if (success) {
        toast({ title: t("createSuccess"), description: t("createSuccessDesc", { name }) })
        setNewInstanceName("")
        setCreateDialogOpen(false)
      } else {
        toast({ title: t("createFailed"), description: t("createFailedDesc"), variant: "destructive" })
      }
    } finally {
      setCreating(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!currentInstance) {
      toast({ title: tc("error"), description: t("selectOrCreate"), variant: "destructive" })
      return
    }

    const result = await saveInstanceConfig()
    if (result.success) {
      if (result.valid === false) {
        setErrorDialogTitle(t("saveValidateFailed"))
        setErrorDialogMessage(result.error || "")
        setErrorDialogOpen(true)
        return
      } else if (result.warning) {
        toast({ title: t("saveValidateWarning"), description: result.warning })
      } else {
        toast({ title: t("saveSuccess"), description: t("saveSuccessDesc", { name: currentInstance }) })
      }
      try {
        await apiClient.runInstance(currentInstance)
        toast({ title: t("startSuccess"), description: t("startSuccessDesc", { name: currentInstance }) })
        loadInstances()
      } catch (error) {
        toast({ title: t("startFailed"), description: error instanceof Error ? error.message : String(error), variant: "destructive" })
      }
    } else {
      toast({ title: t("saveFailed"), description: result.error, variant: "destructive" })
    }
  }

  const handleRunInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.runInstance(name)
      toast({ title: t("startSuccess"), description: t("startSuccessDesc", { name }) })
      loadInstances()
    } catch (error) {
      toast({ title: t("startFailed"), description: String(error), variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleStopInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.stopInstance(name)
      toast({ title: t("stopSuccess"), description: t("stopSuccessDesc", { name }) })
      loadInstances()
    } catch (error) {
      toast({ title: t("stopFailed"), description: String(error), variant: "destructive" })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteInstance = async () => {
    if (!instanceToDelete) return
    const success = await deleteInstance(instanceToDelete)
    if (success) {
      toast({ title: t("deleteSuccess"), description: t("deleteSuccessDesc", { name: instanceToDelete }) })
    } else {
      toast({ title: t("deleteFailed"), description: t("deleteFailedDesc"), variant: "destructive" })
    }
    setDeleteDialogOpen(false)
    setInstanceToDelete(null)
  }

  const handleResetConfig = () => {
    setResetDialogOpen(false)
    resetConfig()
    toast({ title: t("configReset"), description: t("configResetDesc") })
  }

  const handleViewLogs = async () => {
    if (!currentInstance) return
    setLogsLoading(true)
    setLogsDialogOpen(true)
    try {
      const response = await apiClient.getInstanceLogs(currentInstance)
      setInstanceLogs(response.logs || t("noLogs"))
    } catch (error) {
      setInstanceLogs(t("getLogsFailed") + ": " + (error instanceof Error ? error.message : tc("unknown")))
    } finally {
      setLogsLoading(false)
    }
  }

  const handleOutboundChange = (outbound: any) => {
    if (outbound) {
      setOutbound(0, outbound)
    }
  }

  const availableOutbounds = useMemo(() => {
    const tags = (config.outbounds ?? []).map((o) => o.tag).filter(Boolean)
    return tags.length > 0 ? tags : ["direct", "block"]
  }, [config.outbounds])

  const tabs = [
    { id: "subscription" as const, label: t("tabs.subscription"), icon: Rss },
    { id: "inbound" as const, label: t("tabs.inbound"), icon: Shield },
    { id: "outbound" as const, label: t("tabs.outbound"), icon: ArrowRightLeft },
    { id: "routing" as const, label: t("tabs.routing"), icon: Route },
    { id: "dns" as const, label: t("tabs.dns"), icon: Globe },
  ]

  const formatLastSaved = () => {
    if (!lastSavedAt) return null
    const diff = Date.now() - lastSavedAt
    if (diff < 60000) return t("justSaved")
    if (diff < 3600000) return t("minutesAgo", { n: Math.floor(diff / 60000) })
    return t("hoursAgo", { n: Math.floor(diff / 3600000) })
  }

  const currentInstanceInfo = instances.find(i => i.name === currentInstance)

  return (
    <div className="flex h-screen bg-zinc-50 dark:bg-zinc-950 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 flex-shrink-0 border-r bg-white dark:bg-zinc-900/40 flex flex-col z-20 shadow-sm">
        <div className="h-16 flex items-center px-6 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shadow-sm text-primary-foreground">
              <Zap className="h-4 w-4" />
            </div>
            <div>
              <span className="font-bold text-lg tracking-tight block leading-tight">{t("title")}</span>
              <span className="text-[10px] text-muted-foreground uppercase tracking-widest">{t("subtitle")}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 py-6 flex flex-col gap-1 px-3 overflow-y-auto">
          <div className="text-xs font-semibold text-muted-foreground/70 px-3 mb-3 uppercase tracking-wider">
            {t("configuration")}
          </div>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-primary/10 text-primary shadow-sm"
                  : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
              }`}
            >
              <tab.icon className={`h-4 w-4 ${activeTab === tab.id ? "text-primary" : "text-muted-foreground/70"}`} />
              {tab.label}
            </button>
          ))}
        </nav>

        {/* Sidebar Footer Controls */}
        <div className="p-4 border-t border-border/50 bg-zinc-50/50 dark:bg-zinc-900/20 space-y-4 shrink-0">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground w-16">{t("logLevel")}</Label>
            <Select value={config.log?.level ?? "info"} onValueChange={setLogLevel}>
              <SelectTrigger className="flex-1 h-8 text-xs bg-white dark:bg-zinc-800">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="trace">Trace</SelectItem>
                <SelectItem value="debug">Debug</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="fatal">Fatal</SelectItem>
                <SelectItem value="panic">Panic</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <LanguageSwitcher />
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white dark:bg-zinc-800 px-2 py-1 rounded-md border shadow-sm">
                <Server className="h-3 w-3" />
                <span>{singboxVersion || tc("checking")}</span>
              </div>
              <a
                href="https://github.com/SpadesA99/singbox_ui"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground transition-colors"
                title="GitHub Repository"
              >
                <Github className="h-4 w-4" />
              </a>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 z-10 relative">
        {/* Top Header Action Bar */}
        <header className="h-16 flex-shrink-0 border-b border-border/50 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md flex items-center justify-between px-6 z-20">
          {/* Left: Instance Context */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <Label className="text-sm font-medium text-muted-foreground hidden sm:block">{t("currentInstance")}</Label>
              <Select value={currentInstance || ""} onValueChange={handleInstanceSelect}>
                <SelectTrigger className="w-[180px] h-9 bg-secondary/30 focus:ring-1">
                  <SelectValue placeholder={t("selectInstance")} />
                </SelectTrigger>
                <SelectContent>
                  {instances.length === 0 ? (
                    <div className="py-4 text-center text-sm text-muted-foreground">{t("noInstances")}</div>
                  ) : (
                    instances.map((instance) => (
                      <SelectItem key={instance.name} value={instance.name}>
                        <div className="flex items-center gap-2">
                          <div className={`h-2 w-2 rounded-full shadow-sm ${instance.running ? "bg-emerald-500 shadow-emerald-500/50" : "bg-zinc-300 dark:bg-zinc-600"}`} />
                          <span className="font-medium">{instance.name}</span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Instance Quick Actions */}
            <div className="flex items-center gap-1 border-l border-border/50 pl-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary hover:bg-primary/10" title={tc("new")} onClick={() => setCreateDialogOpen(true)}>
                <Plus className="h-4 w-4" />
              </Button>
              {currentInstance && (
                <>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10" title={tc("reset")} onClick={() => setResetDialogOpen(true)}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10" title={tc("delete")} onClick={() => { setInstanceToDelete(currentInstance); setDeleteDialogOpen(true); }} disabled={currentInstanceInfo?.running}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Right: Core Operations */}
          <div className="flex items-center gap-3">
            {lastSavedAt && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground hidden lg:flex mr-2">
                <Check className="h-3 w-3 text-emerald-500" />
                {formatLastSaved()}
              </div>
            )}

            {currentInstance && currentInstanceInfo && (
              <div className="flex items-center gap-2 mr-2">
                {currentInstanceInfo.running ? (
                  <Button variant="outline" size="sm" className="h-9 border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-400" onClick={() => handleStopInstance(currentInstance)} disabled={actionLoading === currentInstance}>
                    {actionLoading === currentInstance ? <RotateCw className="h-4 w-4 mr-2 animate-spin" /> : <Square className="h-4 w-4 mr-2" />}
                    {t("stopContainer")}
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" className="h-9 border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400" onClick={() => handleRunInstance(currentInstance)} disabled={actionLoading === currentInstance}>
                    {actionLoading === currentInstance ? <RotateCw className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                    {t("startContainer")}
                  </Button>
                )}
                <Button variant="outline" size="sm" className="h-9" onClick={handleViewLogs} disabled={!currentInstanceInfo.running}>
                  <FileText className="h-4 w-4 mr-2" />
                  {t("viewLogs")}
                </Button>
              </div>
            )}

            <Button onClick={handleSaveConfig} disabled={isSaving || !currentInstance} className="h-9 shadow-sm">
              {isSaving ? <RotateCw className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              {t("saveConfig")}
            </Button>

            <div className="h-5 w-px bg-border mx-1"></div>

            <Button variant="ghost" size="sm" className="h-9 text-muted-foreground hover:text-primary hover:bg-primary/10" onClick={() => setJsonDrawerOpen(true)}>
              <Code className="h-4 w-4 mr-2" />
              JSON
            </Button>
          </div>
        </header>

        {/* Scrollable Workspace */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 relative">
          <div className="max-w-5xl mx-auto pb-20 animate-in fade-in duration-500">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 text-muted-foreground">
                <RotateCw className="h-8 w-8 animate-spin mb-4 text-primary" />
                <p>{t("loadingConfig")}</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Active Tab Header Info */}
                <div className="mb-8">
                  <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
                    {(() => {
                      const ActiveIcon = tabs.find(t => t.id === activeTab)?.icon
                      return ActiveIcon ? <ActiveIcon className="h-6 w-6 text-primary" /> : null
                    })()}
                    {tabs.find(t => t.id === activeTab)?.label}
                  </h2>
                  <p className="text-muted-foreground mt-1.5">
                    {t(`${activeTab}Desc`)}
                  </p>
                </div>

                {/* Tab Content Rendering Container */}
                <div className="pt-2">
                  {activeTab === "subscription" && <SubscriptionManager onNodeSelect={(node) => handleOutboundChange(node.outbound)} />}
                  {activeTab === "inbound" && <InboundConfig showCard={false} />}
                  {activeTab === "outbound" && <OutboundConfig showCard={false} />}
                  {activeTab === "routing" && <RoutingConfig showCard={false} availableOutbounds={availableOutbounds} />}
                  {activeTab === "dns" && <DnsConfigComponent showCard={false} />}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* JSON Drawer Overlay & Content */}
      {jsonDrawerOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 animate-in fade-in duration-200" 
            onClick={() => setJsonDrawerOpen(false)} 
          />
          {/* Sliding Panel */}
          <div className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] bg-background border-l shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-300">
            <div className="h-16 flex items-center justify-between px-6 border-b shrink-0 bg-muted/30">
              <div className="flex items-center gap-2 font-semibold">
                <Code className="h-5 w-5 text-primary" />
                {t("preview")}
              </div>
              <div className="flex items-center gap-2">
                {hasConfig && (
                  <>
                    {jsonEditMode ? (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setJsonEditMode(false); setEditedJson(""); }}>{tc("cancel")}</Button>
                        <Button size="sm" onClick={() => {
                          try {
                            const parsed = JSON.parse(editedJson)
                            loadConfig(parsed)
                            setJsonEditMode(false)
                            setEditedJson("")
                            toast({ title: t("applied"), description: t("appliedDesc") })
                          } catch (e) {
                            toast({ title: t("jsonError"), description: t("jsonErrorDesc"), variant: "destructive" })
                          }
                        }}><Check className="h-4 w-4 mr-1" />{tc("apply")}</Button>
                      </>
                    ) : (
                      <>
                        <Button size="sm" variant="outline" onClick={() => { setEditedJson(JSON.stringify(fullConfig, null, 2)); setJsonEditMode(true); }}>
                          <Pencil className="h-4 w-4 mr-2" /> {tc("edit")}
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(JSON.stringify(fullConfig, null, 2)); toast({ title: t("copied"), description: t("copiedDesc") }); }}>
                          <Copy className="h-4 w-4 mr-2" /> {tc("copy")}
                        </Button>
                      </>
                    )}
                  </>
                )}
                <div className="h-4 w-px bg-border mx-2" />
                <Button variant="ghost" size="icon" onClick={() => setJsonDrawerOpen(false)} className="hover:bg-destructive/10 hover:text-destructive">
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>
            
            {/* Editor Body */}
            <div className="flex-1 overflow-hidden p-6 bg-zinc-50 dark:bg-zinc-950">
              {hasConfig ? (
                <div className="h-full rounded-lg border overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
                  <JsonEditor 
                    value={jsonEditMode ? editedJson : JSON.stringify(fullConfig, null, 2)} 
                    onChange={jsonEditMode ? setEditedJson : undefined} 
                    readOnly={!jsonEditMode} 
                    height="100%" 
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <FileText className="h-12 w-12 mb-4 opacity-20" />
                  <p>{t("previewEmpty")}</p>
                  <p className="text-xs mt-2">{t("previewEmptyHint")}</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createInstance")}</DialogTitle>
            <DialogDescription>{t("createInstanceDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">{t("instanceName")}</Label>
              <Input
                id="instance-name"
                placeholder={t("instanceNamePlaceholder")}
                value={newInstanceName}
                maxLength={10}
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z_-]/g, "")
                  setNewInstanceName(val)
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCreateInstance()
                }}
              />
              <p className="text-xs text-muted-foreground">{t("instanceNameHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleCreateInstance} disabled={creating}>
              {creating ? <><RotateCw className="h-4 w-4 mr-2 animate-spin" />{tc("creating")}</> : <><Plus className="h-4 w-4 mr-2" />{tc("create")}</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmDeleteDesc", { name: instanceToDelete || "" })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteInstance} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{tc("delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmReset")}</AlertDialogTitle>
            <AlertDialogDescription>{t("confirmResetDesc")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfig}>{tc("reset")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("instanceLogs", { name: currentInstance || "" })}</DialogTitle>
            <DialogDescription>{t("instanceLogsDesc")}</DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RotateCw className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">{t("loadingLogs")}</span>
              </div>
            ) : (
              <pre
                className="bg-black text-green-400 p-4 rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono"
                dangerouslySetInnerHTML={{ __html: instanceLogs ? ansiConverter.toHtml(instanceLogs) : t("noLogs") }}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>{tc("close")}</Button>
            <Button onClick={handleViewLogs} disabled={logsLoading}>
              <RotateCw className={`h-4 w-4 mr-2 ${logsLoading ? "animate-spin" : ""}`} />
              {tc("refresh")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={errorDialogOpen} onOpenChange={setErrorDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-destructive">{errorDialogTitle}</DialogTitle>
          </DialogHeader>
          <pre className="bg-black text-red-400 p-4 rounded-lg text-sm overflow-auto max-h-[40vh] whitespace-pre-wrap font-mono select-all">
            {errorDialogMessage}
          </pre>
          <DialogFooter>
            <Button variant="outline" onClick={() => { navigator.clipboard.writeText(errorDialogMessage); toast({ title: t("copied"), description: t("copiedDesc") }); }}>
              <Copy className="h-4 w-4 mr-2" />{tc("copy")}
            </Button>
            <Button onClick={() => setErrorDialogOpen(false)}>{tc("close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
