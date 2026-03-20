"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { InboundConfig } from "@/components/inbound-config"
import { OutboundConfig } from "@/components/outbound-config"
import { RoutingConfig } from "@/components/routing-config"
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
  ShieldCheck,
  Loader2,
  Github,
} from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SubscriptionManager } from "@/components/subscription-manager"
import { JsonEditor } from "@/components/json-editor"
import { useSingboxConfigStore } from "@/lib/store/singbox-config"
import { apiClient } from "@/lib/api"
import { useTranslation } from "@/lib/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"

export default function Home() {
  const { toast } = useToast()
  const { t } = useTranslation("page")
  const { t: tc } = useTranslation("common")

  // 使用全局 store
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
  const [jsonEditMode, setJsonEditMode] = useState(false)
  const [editedJson, setEditedJson] = useState("")
  const [validating, setValidating] = useState(false)

  // 获取计算后的完整配置
  const fullConfig = getFullConfig()
  const hasConfig = (config.inbounds?.length ?? 0) > 0 || (config.outbounds?.length ?? 0) > 0

  // 初始化
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
      toast({
        title: tc("error"),
        description: t("nameRequired"),
        variant: "destructive",
      })
      return
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
      toast({
        title: tc("error"),
        description: t("nameInvalid"),
        variant: "destructive",
      })
      return
    }

    if (instances.some(i => i.name === name)) {
      toast({
        title: tc("error"),
        description: t("nameExists"),
        variant: "destructive",
      })
      return
    }

    setCreating(true)
    try {
      resetConfig()
      const success = await createInstance(name)
      if (success) {
        toast({
          title: t("createSuccess"),
          description: t("createSuccessDesc", { name }),
        })
        setNewInstanceName("")
        setCreateDialogOpen(false)
      } else {
        toast({
          title: t("createFailed"),
          description: t("createFailedDesc"),
          variant: "destructive",
        })
      }
    } finally {
      setCreating(false)
    }
  }

  const handleValidateConfig = async () => {
    if (!currentInstance) {
      toast({
        title: tc("error"),
        description: t("selectOrCreate"),
        variant: "destructive",
      })
      return
    }

    setValidating(true)
    try {
      const result = await apiClient.checkInstanceConfig(currentInstance)
      if (result.valid) {
        toast({
          title: t("validateSuccess"),
          description: t("validateSuccessDesc"),
        })
      } else {
        toast({
          title: t("validateFailed"),
          description: result.message,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: t("validateError"),
        description: error instanceof Error ? error.message : String(error),
        variant: "destructive",
      })
    } finally {
      setValidating(false)
    }
  }

  const handleSaveConfig = async () => {
    if (!currentInstance) {
      toast({
        title: tc("error"),
        description: t("selectOrCreate"),
        variant: "destructive",
      })
      return
    }

    const result = await saveInstanceConfig()
    if (result.success) {
      if (result.valid === false) {
        toast({
          title: t("saveValidateFailed"),
          description: result.error,
          variant: "destructive",
        })
      } else if (result.warning) {
        toast({
          title: t("saveValidateWarning"),
          description: result.warning,
        })
      } else {
        toast({
          title: t("saveSuccess"),
          description: t("saveSuccessDesc", { name: currentInstance! }),
        })
      }
    } else {
      toast({
        title: t("saveFailed"),
        description: result.error,
        variant: "destructive",
      })
    }
  }

  const handleRunInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.runInstance(name)
      toast({
        title: t("startSuccess"),
        description: t("startSuccessDesc", { name }),
      })
      loadInstances()
    } catch (error) {
      toast({
        title: t("startFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleStopInstance = async (name: string) => {
    setActionLoading(name)
    try {
      await apiClient.stopInstance(name)
      toast({
        title: t("stopSuccess"),
        description: t("stopSuccessDesc", { name }),
      })
      loadInstances()
    } catch (error) {
      toast({
        title: t("stopFailed"),
        description: String(error),
        variant: "destructive",
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteInstance = async () => {
    if (!instanceToDelete) return
    const success = await deleteInstance(instanceToDelete)
    if (success) {
      toast({
        title: t("deleteSuccess"),
        description: t("deleteSuccessDesc", { name: instanceToDelete }),
      })
    } else {
      toast({
        title: t("deleteFailed"),
        description: t("deleteFailedDesc"),
        variant: "destructive",
      })
    }
    setDeleteDialogOpen(false)
    setInstanceToDelete(null)
  }

  const handleResetConfig = () => {
    setResetDialogOpen(false)
    resetConfig()
    toast({
      title: t("configReset"),
      description: t("configResetDesc"),
    })
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
    <main className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur-sm">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-sm">
                  <Zap className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold tracking-tight">{t("title")}</h1>
                  <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <a
                href="https://github.com/SpadesA99/singbox_ui"
                target="_blank"
                rel="noopener noreferrer"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-border hover:bg-accent transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
              <LanguageSwitcher />
              {/* Version Indicator */}
              <div className="flex items-center gap-2 rounded-full border border-border bg-muted px-4 py-2">
                <Server className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  {singboxVersion || tc("checking")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-6 py-8 max-w-[1800px]">
        {/* Instance Selector Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Label className="text-sm font-medium">{t("currentInstance")}</Label>
                <Select value={currentInstance || ""} onValueChange={handleInstanceSelect}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder={t("selectInstance")} />
                  </SelectTrigger>
                  <SelectContent>
                    {instances.length === 0 ? (
                      <div className="py-6 text-center text-sm text-muted-foreground">
                        {t("noInstances")}
                      </div>
                    ) : (
                      instances.map((instance) => (
                        <SelectItem key={instance.name} value={instance.name}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 rounded-full ${instance.running ? "bg-green-500" : "bg-gray-400"}`} />
                            {instance.name}
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateDialogOpen(true)}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  {tc("new")}
                </Button>

                {currentInstance && currentInstanceInfo && (
                  <>
                    <div className="h-6 w-px bg-border" />
                    <Badge variant={currentInstanceInfo.running ? "default" : "secondary"}>
                      {currentInstanceInfo.running ? t("running") : t("stopped")}
                    </Badge>

                    {currentInstanceInfo.running ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStopInstance(currentInstance)}
                        disabled={actionLoading === currentInstance}
                      >
                        {actionLoading === currentInstance ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Square className="h-4 w-4" />
                        )}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRunInstance(currentInstance)}
                        disabled={actionLoading === currentInstance}
                      >
                        {actionLoading === currentInstance ? (
                          <RotateCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleViewLogs}
                      disabled={!currentInstanceInfo.running}
                      title={t("viewLogs")}
                    >
                      <FileText className="h-4 w-4" />
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setInstanceToDelete(currentInstance)
                        setDeleteDialogOpen(true)
                      }}
                      disabled={currentInstanceInfo.running}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </>
                )}
              </div>

              <div className="flex items-center gap-3">
                {lastSavedAt && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Check className="h-3 w-3 text-green-500" />
                    {formatLastSaved()}
                  </div>
                )}

                <Button
                  onClick={() => setResetDialogOpen(true)}
                  variant="ghost"
                  size="sm"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  {tc("reset")}
                </Button>

                <Button
                  onClick={handleSaveConfig}
                  disabled={isSaving || !currentInstance}
                  variant={currentInstance ? "default" : "outline"}
                >
                  {isSaving ? (
                    <>
                      <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                      {tc("saving")}
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {t("saveConfig")}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Control Panel */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">{t("logLevel")}</Label>
                <Select value={config.log?.level ?? "info"} onValueChange={setLogLevel}>
                  <SelectTrigger className="w-[140px] h-9">
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
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-12">
            <RotateCw className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-3 text-muted-foreground">{t("loadingConfig")}</span>
          </div>
        )}

        {!isLoading && (
          <div className="grid grid-cols-12 gap-6">
            {/* Left Panel - Configuration */}
            <div className="col-span-7 space-y-6">
              {/* Tab Navigation */}
              <div className="flex gap-2 p-1 rounded-xl bg-muted border border-border">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      activeTab === tab.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-secondary"
                    }`}
                  >
                    <tab.icon className="h-4 w-4" />
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="animate-fade-in">
                {activeTab === "subscription" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Rss className="h-5 w-5 text-primary" />
                        {t("subscriptionTitle")}
                      </CardTitle>
                      <CardDescription>{t("subscriptionDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SubscriptionManager
                        onNodeSelect={(node) => {
                          handleOutboundChange(node.outbound)
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "inbound" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-primary" />
                        {t("inboundTitle")}
                      </CardTitle>
                      <CardDescription>{t("inboundDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <InboundConfig showCard={false} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "outbound" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-primary" />
                        {t("outboundTitle")}
                      </CardTitle>
                      <CardDescription>{t("outboundDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <OutboundConfig showCard={false} />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "routing" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Route className="h-5 w-5 text-primary" />
                        {t("routingTitle")}
                      </CardTitle>
                      <CardDescription>{t("routingDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <RoutingConfig
                        showCard={false}
                        availableOutbounds={availableOutbounds}
                      />
                    </CardContent>
                  </Card>
                )}

                {activeTab === "dns" && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Globe className="h-5 w-5 text-primary" />
                        {t("dnsTitle")}
                      </CardTitle>
                      <CardDescription>{t("dnsDesc")}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <DnsConfigComponent showCard={false} />
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>

            {/* Right Panel - Preview */}
            <div className="col-span-5 space-y-6">
              {/* Config Preview */}
              <Card className="sticky top-24">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <FileText className="h-5 w-5 text-primary" />
                        {t("preview")}
                      </CardTitle>
                      <CardDescription>{t("previewDesc")}</CardDescription>
                    </div>
                    {hasConfig && (
                      <div className="flex gap-2">
                        {jsonEditMode ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setJsonEditMode(false)
                                setEditedJson("")
                              }}
                            >
                              {tc("cancel")}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => {
                                try {
                                  const parsed = JSON.parse(editedJson)
                                  loadConfig(parsed)
                                  setJsonEditMode(false)
                                  setEditedJson("")
                                  toast({
                                    title: t("applied"),
                                    description: t("appliedDesc"),
                                  })
                                } catch (e) {
                                  toast({
                                    title: t("jsonError"),
                                    description: t("jsonErrorDesc"),
                                    variant: "destructive",
                                  })
                                }
                              }}
                            >
                              <Check className="h-4 w-4 mr-1" />
                              {tc("apply")}
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleValidateConfig}
                              disabled={validating || !currentInstance}
                            >
                              {validating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="h-4 w-4" />
                              )}
                              <span className="ml-1">{validating ? t("validating") : t("validateConfig")}</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setEditedJson(JSON.stringify(fullConfig, null, 2))
                                setJsonEditMode(true)
                              }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                navigator.clipboard.writeText(JSON.stringify(fullConfig, null, 2))
                                toast({
                                  title: t("copied"),
                                  description: t("copiedDesc"),
                                })
                              }}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {hasConfig ? (
                    <JsonEditor
                      value={jsonEditMode ? editedJson : JSON.stringify(fullConfig, null, 2)}
                      onChange={jsonEditMode ? setEditedJson : undefined}
                      readOnly={!jsonEditMode}
                      height="500px"
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <FileText className="h-12 w-12 mb-4 opacity-20" />
                      <p className="text-sm">{t("previewEmpty")}</p>
                      <p className="text-xs mt-1">{t("previewEmptyHint")}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>

      {/* Create Instance Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("createInstance")}</DialogTitle>
            <DialogDescription>
              {t("createInstanceDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="instance-name">{t("instanceName")}</Label>
              <Input
                id="instance-name"
                placeholder={t("instanceNamePlaceholder")}
                value={newInstanceName}
                onChange={(e) => setNewInstanceName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    handleCreateInstance()
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">
                {t("instanceNameHint")}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateDialogOpen(false)}
            >
              {tc("cancel")}
            </Button>
            <Button onClick={handleCreateInstance} disabled={creating}>
              {creating ? (
                <>
                  <RotateCw className="h-4 w-4 mr-2 animate-spin" />
                  {tc("creating")}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  {tc("create")}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Instance Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteDesc", { name: instanceToDelete || "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInstance}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {tc("delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Config Dialog */}
      <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmReset")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmResetDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tc("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetConfig}>
              {tc("reset")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Logs Dialog */}
      <Dialog open={logsDialogOpen} onOpenChange={setLogsDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{t("instanceLogs", { name: currentInstance || "" })}</DialogTitle>
            <DialogDescription>
              {t("instanceLogsDesc")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <RotateCw className="h-6 w-6 animate-spin text-primary" />
                <span className="ml-2 text-muted-foreground">{t("loadingLogs")}</span>
              </div>
            ) : (
              <pre className="bg-muted p-4 rounded-lg text-sm overflow-auto max-h-[60vh] whitespace-pre-wrap font-mono">
                {instanceLogs || t("noLogs")}
              </pre>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogsDialogOpen(false)}>
              {tc("close")}
            </Button>
            <Button onClick={handleViewLogs} disabled={logsLoading}>
              <RotateCw className={`h-4 w-4 mr-2 ${logsLoading ? "animate-spin" : ""}`} />
              {tc("refresh")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  )
}
