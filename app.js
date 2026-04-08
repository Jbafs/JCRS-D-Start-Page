const WORKER_URL = "https://tiny-disk-1011.juliusbscales.workers.dev";

const app = Vue.createApp({
  data() {
    return {
      applications: [],
      categories: {},
      showPopups: {},
      flippedPopups: {},
      popupTimers: {},

      // Widgets
      widgets: [],
      widgetDragSrcId: null,
      dragSrcCategoryId: null,
      showAddWidgetPanel: false,

      // Favorites
      favoriteIds: [],

      // Sidebar
      sidebarExpanded: false,
      recentIds: [],

      // Edit mode
      editMode: false,
      dragSrcId: null,
      managingApp: null,
      flippedUpOverlays: {},


      // Search
      searchQuery: "",

      // Announcements
      showAnnouncements: false,
      announcements: [
        {
          id: 1,
          title: "Scheduled Maintenance",
          body: "The platform will be offline for maintenance on Saturday, March 22 from 2–4 AM EST.",
          date: "2026-03-20",
          type: "warning",
          read: false,
        },
        {
          id: 2,
          title: "New App Available: DataViz Pro",
          body: "DataViz Pro has been added to the catalogue. Check it out under Analytics.",
          date: "2026-03-18",
          type: "info",
          read: false,
        },
        {
          id: 3,
          title: "Welcome to JCRS-D!",
          body: "Use the sidebar to quickly access recent and most-used apps. Tip: press / to search.",
          date: "2026-03-01",
          type: "info",
          read: true,
        },
      ],

      // Settings
      showSettings: false,
      settings: {
        theme: 'light',
        gridDensity: 'comfortable',
        widgetLayout: 'stack',
        showRecent: true,
        showMostUsed: true,
      },

      // ── System health (hardcoded; replace with API later) ──────
      health: {
        systemStatus: {
          overall: 'healthy',
          uptime: '99.97%',
          since: '2026-01-14',
          lastChecked: '2 min ago',
        },
        cpu:    { used: 42, label: '42%' },
        memory: { used: 67, label: '6.7 / 10 GB' },
        disk:   { used: 55, label: '275 / 500 GB' },
        services: [
          { name: 'API Gateway',        status: 'up',       latency: '18ms'  },
          { name: 'Auth Service',       status: 'up',       latency: '24ms'  },
          { name: 'Database (primary)', status: 'up',       latency: '5ms'   },
          { name: 'Database (replica)', status: 'up',       latency: '7ms'   },
          { name: 'File Storage',       status: 'degraded', latency: '210ms' },
          { name: 'Email Service',      status: 'up',       latency: '45ms'  },
          { name: 'Cache (Redis)',       status: 'up',       latency: '1ms'   },
          { name: 'Job Queue',          status: 'up',       latency: '12ms'  },
        ],
        alerts: [
          { id: 1, severity: 'warning', message: 'File Storage latency elevated (>200ms)',         time: '8 min ago'  },
          { id: 2, severity: 'info',    message: 'Scheduled backup completed successfully',        time: '1 hr ago'   },
          { id: 3, severity: 'info',    message: 'Database replica resync finished',               time: '3 hrs ago'  },
          { id: 4, severity: 'error',   message: 'Email Service: 3 delivery failures (resolved)',  time: '6 hrs ago'  },
        ],
      },
    }
  },
  computed: {
    recentApps() {
      return this.recentIds
        .map(id => this.applications.find(a => a.id === id))
        .filter(Boolean)
    },
    mostUsedApps() {
      return [...this.applications]
        .filter(a => (a.clicks ?? 0) > 0)
        .sort((a, b) => (b.clicks ?? 0) - (a.clicks ?? 0))
        .slice(0, 3)
    },
    searchResults() {
      if (!this.isSearching) return []
      const q = this.searchQuery.trim().toLowerCase()
      return this.applications.filter(a =>
        a.name.toLowerCase().includes(q) ||
        (a.description ?? "").toLowerCase().includes(q)
      )
    },
    isSearching() {
      return this.searchQuery.trim().length > 0
    },
    unreadCount() {
      return this.announcements.filter(a => !a.read).length
    },
    visibleWidgets() {
      return this.widgets.filter(w => w.visible)
    },
    hiddenWidgets() {
      return this.widgets.filter(w => !w.visible)
    },
    favoriteApps() {
      return this.favoriteIds
        .map(id => this.applications.find(a => a.id === id))
        .filter(Boolean)
    }
  },
  mounted() {
    this.init()

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // / → focus search
      if (e.key === '/' && !typing) {
        e.preventDefault()
        this.$nextTick(() => document.getElementById('searchInput')?.focus())
        return
      }

      // Escape → clear search, close panels, exit modes
      if (e.key === 'Escape') {
        if (this.searchQuery) {
          this.searchQuery = ""
          document.getElementById('searchInput')?.blur()
        } else if (this.showSettings) {
          this.closeSettings()
        } else if (this.editMode) {
          this.toggleEditMode()
        }
        return
      }

      // E → toggle edit mode
      if (e.key === 'e' && !typing && !this.showSettings) {
        this.toggleEditMode()
        return
      }

    })

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.categoryOverlay') && !e.target.closest('.manageBtn')) {
        this.managingApp = null
      }
      if (!e.target.closest('.addWidgetPanel') && !e.target.closest('.addWidgetBtn')) {
        this.showAddWidgetPanel = false
      }
    })
  },
  methods: {

    // ─── Init ────────────────────────────────────────────────────────────────

    async init() {
      await this.loadSettings()
      await this.loadApps()
      await Promise.all([
        this.loadData(),
        this.loadRecent()
      ])
    },

    // ─── Apps (KV) ───────────────────────────────────────────────────────────

    async loadApps() {
      try {
        const res = await fetch(`${WORKER_URL}/api/apps`)
        const json = await res.json()
        this.applications = json.apps ?? []
        this.applications.forEach(app => {
          if (!app.docsLink) app.docsLink = `https://docs.example.com/apps/${app.id}`
          this.showPopups[app.id] = false
          this.flippedPopups[app.id] = false
        })
      } catch (err) {
        console.error("Failed to load apps:", err)
      }
    },

    seedAppsFromCSV() {
      return new Promise((resolve, reject) => {
        Papa.parse("Application_Descriptions.csv", {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: async (results) => {
            const apps = results.data
              .filter(row => row["Application"])
              .map((row, index) => {
                const name = row["Application"]
                const lowerCaseName = name.toLowerCase().replace(/\s+/g, "_")
                return {
                  id: `app${index + 1}`,
                  name,
                  description: row["Description"] ?? "",
                  function: row["Function"] ?? "",
                  importance: row["Importance"] ?? "",
                  link: "https://youtube.com",
                  docsLink: "",
                  image: `images/${lowerCaseName}.png`,
                  clicks: 0
                }
              })
            try {
              await fetch(`${WORKER_URL}/api/apps`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ apps })
              })
              console.log(`✓ Seeded ${apps.length} apps to KV.`)
              resolve(apps)
            } catch (err) {
              console.error("Seed failed:", err)
              reject(err)
            }
          },
          error: reject
        })
      })
    },

    // ─── Data: categories + widgets (KV) ─────────────────────────────────────

    async loadData() {
      try {
        const res = await fetch(`${WORKER_URL}/api/data`)
        const json = await res.json()
        const hasCategories = json.categories && Object.keys(json.categories).length > 0

        this.bootstrapCategories()

        // Load favorites
        this.favoriteIds = json.favoriteIds ?? []

        if (json.widgets && json.widgets.length > 0) {
          this.widgets = json.widgets
          this.syncWidgetsWithCategories()
          // Ensure favorites widget exists if it was added after initial bootstrap
          if (!this.widgets.find(w => w.type === 'favorites')) {
            this.widgets.unshift({ id: 'w_favorites', type: 'favorites', visible: true })
          }
        } else {
          this.bootstrapWidgets()
          await this.saveData()
        }
      } catch (err) {
        console.error("KV data load error:", err)
        this.bootstrapCategories()
        this.bootstrapWidgets()
      }
    },

    bootstrapCategories() {
      // Sort all apps by their function/category so same-category apps are adjacent
      const sorted = [...this.applications].sort((a, b) => {
      const fa = (a.function ?? '').toLowerCase()
      const fb = (b.function ?? '').toLowerCase()
      return fa < fb ? -1 : fa > fb ? 1 : 0
  })

  this.categories = {
    All: { id: "All", label: "All Apps", list: sorted }
  }
},

    bootstrapWidgets() {
      this.widgets = [
      { id: 'w_favorites', type: 'favorites', visible: true },
      { id: 'w_cat_All',   type: 'category',  categoryId: 'All', visible: true },
      { id: 'w_health',    type: 'health',    visible: true },
    ]
  },

    syncWidgetsWithCategories() {
    // Only ensure the All widget exists — we no longer create per-category widgets
    const hasAll = this.widgets.find(w => w.type === 'category' && w.categoryId === 'All')
    if (!hasAll) {
      this.widgets.splice(1, 0, { id: 'w_cat_All', type: 'category', categoryId: 'All', visible: true })
    }
    },

    async saveData() {
      const payload = { categories: {}, widgets: this.widgets, favoriteIds: this.favoriteIds }
      for (const [key, cat] of Object.entries(this.categories)) {
        payload.categories[key] = {
          id: cat.id,
          label: cat.label,
          appIds: cat.list.map(a => a.id)
        }
      }
      try {
        await fetch(`${WORKER_URL}/api/data`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error("KV save error:", err)
      }
    },

    // ─── Widget helpers ───────────────────────────────────────────────────────

    categoryApps(categoryId) {
      return this.categories[categoryId]?.list ?? []
    },

    widgetTitle(widget) {
      if (widget.type === 'category') return this.categories[widget.categoryId]?.label ?? widget.categoryId
      if (widget.type === 'health')   return 'System Health'
      if (widget.type === 'favorites') return 'Favorites'
      return widget.id
    },

    removeWidget(widgetId) {
      const w = this.widgets.find(w => w.id === widgetId)
      if (w) { w.visible = false; this.saveData() }
    },

    restoreWidget(widgetId) {
      const w = this.widgets.find(w => w.id === widgetId)
      if (w) { w.visible = true; this.saveData() }
    },

    onWidgetDragStart(widgetId) {
      this.widgetDragSrcId = widgetId
    },

    onWidgetDrop(targetId) {
      if (!this.widgetDragSrcId || this.widgetDragSrcId === targetId) return
      const srcIdx = this.widgets.findIndex(w => w.id === this.widgetDragSrcId)
      const tgtIdx = this.widgets.findIndex(w => w.id === targetId)
      if (srcIdx === -1 || tgtIdx === -1) { this.widgetDragSrcId = null; return }
      const [moved] = this.widgets.splice(srcIdx, 1)
      this.widgets.splice(tgtIdx, 0, moved)
      this.widgetDragSrcId = null
      this.saveData()
    },

    // ─── Recent + Click tracking ──────────────────────────────────────────────

    async loadRecent() {
      try {
        const res = await fetch(`${WORKER_URL}/api/recent`)
        this.recentIds = await res.json()
      } catch (err) {
        console.error("Failed to load recent:", err)
      }
    },

    async handleAppClick(app) {
      try {
        const res = await fetch(`${WORKER_URL}/api/click/${app.id}`, { method: "POST" })
        const json = await res.json()
        this.recentIds = json.recent
        const localApp = this.applications.find(a => a.id === app.id)
        if (localApp) localApp.clicks = (localApp.clicks || 0) + 1
      } catch (err) {
        console.error("Click track failed:", err)
      }
      window.open(app.link, "_blank")
    },

    // ─── Popups ──────────────────────────────────────────────────────────────

    setPopup(key, value) {
      if (this.editMode) return
      clearTimeout(this.popupTimers[key])
      if (value) {
        this.popupTimers[key] = setTimeout(() => {
          this.showPopups[key] = true
          this.$nextTick(() => {
            const appEl = document.querySelector(`[data-popup-key="${key}"]`)
            if (appEl) {
              const rect = appEl.getBoundingClientRect()
              this.flippedPopups[key] = rect.right + 300 > window.innerWidth
            }
          })
        }, 400)
      } else {
        // Short delay so mouse can transit from card to popup without it closing
        this.popupTimers[key] = setTimeout(() => {
          this.showPopups[key] = false
        }, 120)
      }
    },

    // ─── Edit Mode ───────────────────────────────────────────────────────────

    toggleEditMode() {
      this.editMode = !this.editMode
      if (!this.editMode) {
        this.managingApp = null
        this.showAddWidgetPanel = false
        Object.keys(this.showPopups).forEach(id => this.showPopups[id] = false)
      }
    },

    // ─── Favorites ───────────────────────────────────────────────────────────

    isAppFavorited(appId) {
      return this.favoriteIds.includes(appId)
    },

    toggleFavorite(appId) {
      const idx = this.favoriteIds.indexOf(appId)
      if (idx === -1) {
        this.favoriteIds.push(appId)
      } else {
        this.favoriteIds.splice(idx, 1)
      }
      this.saveData()
    },

    // ─── App ↔ Category ──────────────────────────────────────────────────────

    toggleAppInCategory(appId, categoryId) {
      if (categoryId === "All") return
      const cat = this.categories[categoryId]
      const exists = cat.list.find(a => a.id === appId)
      if (exists) {
        cat.list = cat.list.filter(a => a.id !== appId)
      } else {
        const appObj = this.applications.find(a => a.id === appId)
        if (appObj) cat.list.push(appObj)
      }
      this.saveData()
    },

    appInCategory(appId, categoryId) {
      return !!this.categories[categoryId]?.list.find(a => a.id === appId)
    },


    toggleManageApp(appId) {
      if (this.managingApp === appId) {
        this.managingApp = null
        return
      }
      this.managingApp = appId
      this.$nextTick(() => {
        const appEl = document.querySelector(`[data-id="${appId}"]`)
        const overlay = appEl?.closest('.application')?.querySelector('.categoryOverlay')
        if (appEl && overlay) {
          const appRect = appEl.getBoundingClientRect()
          const overlayW = 200
          const overlayH = overlay.offsetHeight || 200
          this.flippedPopups[appId] = appRect.right + overlayW + 10 > window.innerWidth
          this.flippedUpOverlays[appId] = appRect.bottom + overlayH > window.innerHeight
        }
      })
    },

    // ─── Settings ────────────────────────────────────────────────────────────

    async loadSettings() {
      try {
        const res = await fetch(`${WORKER_URL}/api/settings`)
        const json = await res.json()
        if (json && Object.keys(json).length > 0) {
          Object.assign(this.settings, json)
        }
      } catch (err) {
        console.error("Failed to load settings:", err)
      }
      this.applySettings()
    },

    async saveSettings() {
      this.applySettings()
      try {
        await fetch(`${WORKER_URL}/api/settings`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(this.settings)
        })
      } catch (err) {
        console.error("Failed to save settings:", err)
      }
    },

    applySettings() {
      document.body.dataset.theme   = this.settings.theme
      document.body.dataset.density = this.settings.gridDensity
    },

    openAnnouncements()  { this.showAnnouncements = true  },
    closeAnnouncements() { this.showAnnouncements = false },
    markAllRead()        { this.announcements.forEach(a => a.read = true) },
    markRead(id) {
      const a = this.announcements.find(a => a.id === id)
      if (a) a.read = true
    },

    openSettings()  { this.showSettings = true  },
    closeSettings() { this.showSettings = false },

    // ─── Drag to reorder apps (per-widget) ───────────────────────────────────

    onDragStart(appId, categoryId) {
      this.dragSrcId = appId
      this.dragSrcCategoryId = categoryId
    },

    onDragOver(event) {
      event.preventDefault()
    },

    onDrop(targetAppId, categoryId) {
      if (!this.dragSrcId || this.dragSrcId === targetAppId) return
      if (this.dragSrcCategoryId !== categoryId) { this.dragSrcId = null; return }

      const list = this.categories[categoryId].list
      const srcIndex = list.findIndex(a => a.id === this.dragSrcId)
      const tgtIndex = list.findIndex(a => a.id === targetAppId)
      if (srcIndex === -1 || tgtIndex === -1) { this.dragSrcId = null; return }

      const [moved] = list.splice(srcIndex, 1)
      list.splice(tgtIndex, 0, moved)

      this.dragSrcId = null
      this.saveData()
    },

  }
})

app.mount("#app")
