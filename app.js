const WORKER_URL = "https://tiny-disk-1011.juliusbscales.workers.dev";

const app = Vue.createApp({
  data() {
    return {
      applications: [],
      categories: {},
      showPopups: {},
      flippedPopups: {},
      popupTimers: {},
      showCategories: false,
      currentCategory: null,
      currentCategoryId: "All",

      // Sidebar
      sidebarExpanded: false,
      recentIds: [],

      // Edit mode
      editMode: false,
      renamingCategory: null,
      renameValue: "",
      dragSrcId: null,
      managingApp: null,
      flippedUpOverlays: {},

      // Bulk select
      bulkSelectMode: false,
      selectedAppIds: [],
      showBulkPanel: false,

      // Confirm dialog
      confirm: {
        visible: false,
        icon: '&#128465;',
        title: '',
        message: '',
        okLabel: 'Delete',
        onOk: null,
      },

      // New App modal
      showNewAppModal: false,
      editingAppId: null,
      newApp: {
        name: '',
        link: '',
        image: '',
        description: '',
        function: '',
        categoryIds: [],
        imageError: false,
        error: '',
        saving: false,
      },

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
        defaultCategory: 'All',
        gridDensity: 'comfortable',
        showRecent: true,
        showMostUsed: true,
        showDashboard: true,
        dashboardWidgets: {
          systemStatus: true,
          cpuMemory:    true,
          services:     true,
          recentAlerts: true,
        },
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
          { name: 'Cache (Redis)',      status: 'up',       latency: '1ms'   },
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
    filteredApps() {
      const q = this.searchQuery.trim().toLowerCase()
      if (!q) return this.currentCategory ?? []
      return (this.applications).filter(a =>
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
    // For bulk panel: which categories have ALL selected apps, SOME, or NONE
    bulkCategoryStates() {
      const states = {}
      for (const [key, cat] of Object.entries(this.categories)) {
        if (key === 'All') { states[key] = 'all'; continue }
        const ids = cat.list.map(a => a.id)
        const inCount = this.selectedAppIds.filter(id => ids.includes(id)).length
        if (inCount === 0) states[key] = 'none'
        else if (inCount === this.selectedAppIds.length) states[key] = 'all'
        else states[key] = 'some'
      }
      return states
    }
  },
  mounted() {
    window.seedAppsFromCSV = () => this.seedAppsFromCSV()
    this.init()

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'

      // / → focus search (only when not already typing)
      if (e.key === '/' && !typing) {
        e.preventDefault()
        this.$nextTick(() => document.getElementById('searchInput')?.focus())
        return
      }

      // Escape → clear search, close panels
      if (e.key === 'Escape') {
        if (this.searchQuery) {
          this.searchQuery = ""
          document.getElementById('searchInput')?.blur()
        } else if (this.showSettings) {
          this.closeSettings()
        } else if (this.showCategories) {
          this.showCategories = false
        } else if (this.bulkSelectMode) {
          this.exitBulkSelect()
        } else if (this.editMode) {
          this.toggleEditMode()
        }
        return
      }

      // E → toggle edit mode (when not typing)
      if (e.key === 'e' && !typing && !this.showSettings) {
        this.toggleEditMode()
        return
      }

      // B → toggle bulk select (when in edit mode, not typing)
      if (e.key === 'b' && !typing && this.editMode && !this.showSettings) {
        this.toggleBulkSelect()
        return
      }
    })

    // Close filters panel and category overlay on outside click
    document.addEventListener('click', (e) => {
      // If Vue re-rendered during this click (e.g. catLabel replaced by input),
      // e.target is detached from the DOM. Treat detached targets as inside the panel
      // to avoid incorrectly closing it.
      if (e.target.isConnected && !e.target.closest('.filtersWrapper')) {
        this.showCategories = false
      }
      if (!e.target.closest('.categoryOverlay') && !e.target.closest('.manageBtn')) {
        this.managingApp = null
      }
      if (!e.target.closest('.bulkPanel') && !e.target.closest('.bulkPanelBtn')) {
        this.showBulkPanel = false
      }
    })
  },
  methods: {

    // ─── Init ────────────────────────────────────────────────────────────────

    async init() {
      await this.loadSettings()
      await this.loadApps()
      await Promise.all([
        this.loadCategories(),
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

    // ─── Categories (KV) ─────────────────────────────────────────────────────

    async loadCategories() {
      try {
        const res = await fetch(`${WORKER_URL}/api/data`)
        const json = await res.json()
        const hasData = json.categories && Object.keys(json.categories).length > 0

        if (hasData) {
          this.categories = {}
          for (const [key, cat] of Object.entries(json.categories)) {
            this.categories[key] = {
              id: cat.id,
              label: cat.label,
              list: cat.appIds
                .map(id => this.applications.find(a => a.id === id))
                .filter(Boolean)
            }
          }
        } else {
          this.bootstrapCategories()
          await this.saveCategories()
        }
      } catch (err) {
        console.error("KV categories load error:", err)
        this.bootstrapCategories()
      }

      this.currentCategory = this.categories[this.settings.defaultCategory]?.list
        ?? this.categories["All"]?.list
        ?? []
      this.currentCategoryId = this.categories[this.settings.defaultCategory]
        ? this.settings.defaultCategory
        : "All"
    },

    bootstrapCategories() {
      this.categories = {
        All: { id: "All", label: "All", list: [...this.applications] }
      }
      this.applications.forEach(app => {
        const cat = app.function
        if (!cat) return
        if (!this.categories[cat]) {
          this.categories[cat] = { id: cat, label: cat, list: [] }
        }
        this.categories[cat].list.push(app)
      })
    },

    async saveCategories() {
      const payload = { categories: {} }
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
      // In bulk select mode, clicking an app toggles selection
      if (this.bulkSelectMode) {
        this.toggleAppSelection(app.id)
        return
      }
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

    // ─── Navigation ──────────────────────────────────────────────────────────

    openCategories() {
      this.showCategories = true
    },

    switchCategory(categoryId) {
      this.currentCategoryId = categoryId
      this.currentCategory = this.categories[categoryId]?.list ?? []
      this.managingApp = null
      this.selectedAppIds = []
      this.showCategories = false
    },

    // ─── Popups ──────────────────────────────────────────────────────────────

    setPopup(id, value) {
      if (this.editMode) return
      if (value) {
        this.popupTimers[id] = setTimeout(() => {
          this.showPopups[id] = true
          this.$nextTick(() => {
            const appEl = document.querySelector(`[data-id="${id}"]`)
            if (appEl) {
              const rect = appEl.getBoundingClientRect()
              this.flippedPopups[id] = rect.right + 300 > window.innerWidth
            }
          })
        }, 400)
      } else {
        clearTimeout(this.popupTimers[id])
        this.popupTimers[id] = null
        this.showPopups[id] = false
      }
    },

    // ─── Edit Mode ───────────────────────────────────────────────────────────

    toggleEditMode() {
      this.editMode = !this.editMode
      if (!this.editMode) {
        this.managingApp = null
        this.renamingCategory = null
        this.exitBulkSelect()
        Object.keys(this.showPopups).forEach(id => this.showPopups[id] = false)
      }
    },

    // ─── Category CRUD ───────────────────────────────────────────────────────

    createCategory() {
      const id = `cat_${Date.now()}`
      this.categories[id] = { id, label: "New Category", list: [] }
      this.startRename(id, "New Category")
      this.saveCategories()
    },

    startRename(id, currentLabel) {
      this.renamingCategory = id
      this.renameValue = currentLabel
      this.$nextTick(() => {
        const input = document.getElementById(`rename-input-${id}`)
        if (input) { input.focus(); input.select() }
      })
    },

    commitRename(id) {
      const trimmed = this.renameValue.trim()
      if (!trimmed) { this.renamingCategory = null; return }
      this.categories[id].label = trimmed
      this.renamingCategory = null
      this.saveCategories()
    },

    onRenameBlur(id, event) {
      const panel = document.querySelector('.filtersPanel')
      const relatedTarget = event.relatedTarget
      // If focus is moving to another element inside the panel, defer the commit
      // so that click handlers inside the panel fire first (e.g. startRename on another cat)
      if (panel && relatedTarget && panel.contains(relatedTarget)) {
        this.$nextTick(() => this.commitRename(id))
      } else {
        this.commitRename(id)
      }
    },

    deleteCategory(id) {
      if (id === "All") return
      delete this.categories[id]
      if (this.currentCategoryId === id) this.switchCategory("All")
      this.saveCategories()
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
      if (this.currentCategoryId === categoryId) {
        this.currentCategory = cat.list
      }
      this.saveCategories()
    },

    appInCategory(appId, categoryId) {
      return !!this.categories[categoryId]?.list.find(a => a.id === appId)
    },

    deleteApp(appId) {
      if (this.currentCategoryId !== "All") {
        this.currentCategory = this.currentCategory.filter(a => a.id !== appId)
      }
      this.managingApp = null
      this.saveCategories()
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

          // Horizontal: flip left if not enough space on the right
          this.flippedPopups[appId] = appRect.right + overlayW + 10 > window.innerWidth

          // Vertical: flip up if not enough space below
          this.flippedUpOverlays[appId] = appRect.bottom + overlayH > window.innerHeight
        }
      })
    },

    // ─── Bulk Select ─────────────────────────────────────────────────────────

    toggleBulkSelect() {
      this.bulkSelectMode = !this.bulkSelectMode
      if (!this.bulkSelectMode) {
        this.selectedAppIds = []
        this.showBulkPanel = false
      }
    },

    exitBulkSelect() {
      this.bulkSelectMode = false
      this.selectedAppIds = []
      this.showBulkPanel = false
    },

    toggleAppSelection(appId) {
      const idx = this.selectedAppIds.indexOf(appId)
      if (idx === -1) {
        this.selectedAppIds.push(appId)
      } else {
        this.selectedAppIds.splice(idx, 1)
      }
    },

    isAppSelected(appId) {
      return this.selectedAppIds.includes(appId)
    },

    selectAll() {
      this.selectedAppIds = this.filteredApps.map(a => a.id)
    },

    deselectAll() {
      this.selectedAppIds = []
    },

    // Bulk assign: clicking a category in bulk panel cycles none→all→none
    // If some are in it, clicking adds all; if all are in it, clicking removes all
    bulkToggleCategory(categoryId) {
      if (categoryId === 'All') return
      const cat = this.categories[categoryId]
      const state = this.bulkCategoryStates[categoryId]

      if (state === 'all') {
        // Remove all selected apps from this category
        cat.list = cat.list.filter(a => !this.selectedAppIds.includes(a.id))
      } else {
        // Add all selected apps that aren't already in this category
        for (const appId of this.selectedAppIds) {
          if (!cat.list.find(a => a.id === appId)) {
            const appObj = this.applications.find(a => a.id === appId)
            if (appObj) cat.list.push(appObj)
          }
        }
      }

      if (this.currentCategoryId === categoryId) {
        this.currentCategory = cat.list
      }
      this.saveCategories()
    },

    openBulkPanel() {
      this.showBulkPanel = true
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
      // Theme
      document.body.dataset.theme = this.settings.theme

      // Grid density
      document.body.dataset.density = this.settings.gridDensity
    },

    openAnnouncements() {
      this.showAnnouncements = true
    },
    closeAnnouncements() {
      this.showAnnouncements = false
    },
    markAllRead() {
      this.announcements.forEach(a => a.read = true)
    },
    markRead(id) {
      const a = this.announcements.find(a => a.id === id)
      if (a) a.read = true
    },

    openSettings() {
      this.showSettings = true
      this.showCategories = false
    },

    closeSettings() {
      this.showSettings = false
    },

    // ─── Drag to reorder (per-category) ──────────────────────────────────────

    onDragStart(appId) {
      this.dragSrcId = appId
    },

    onDragOver(event) {
      event.preventDefault()
    },

    onDrop(targetAppId) {
      if (!this.dragSrcId || this.dragSrcId === targetAppId) return

      // Reorder only within the currently viewed category list
      const list = this.categories[this.currentCategoryId].list
      const srcIndex = list.findIndex(a => a.id === this.dragSrcId)
      const tgtIndex = list.findIndex(a => a.id === targetAppId)
      if (srcIndex === -1 || tgtIndex === -1) { this.dragSrcId = null; return }

      const [moved] = list.splice(srcIndex, 1)
      list.splice(tgtIndex, 0, moved)

      // Keep currentCategory reference in sync
      this.currentCategory = list

      // If we're reordering "All", also reflect in applications array for global order
      if (this.currentCategoryId === "All") {
        const appSrc = this.applications.findIndex(a => a.id === this.dragSrcId)
        const appTgt = this.applications.findIndex(a => a.id === targetAppId)
        if (appSrc !== -1 && appTgt !== -1) {
          const [movedApp] = this.applications.splice(appSrc, 1)
          this.applications.splice(appTgt, 0, movedApp)
        }
      }

      this.dragSrcId = null
      this.saveCategories()
    },

    // ─── Save apps to KV ─────────────────────────────────────────────────────

    async saveApps() {
      try {
        await fetch(`${WORKER_URL}/api/apps`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ apps: this.applications })
        })
      } catch (err) {
        console.error("Failed to save apps:", err)
      }
    },

    // ─── New App Modal ────────────────────────────────────────────────────────

    openNewAppModal() {
      this.editingAppId = null
      this.newApp = {
        name: '', link: '', image: '', description: '',
        function: '', categoryIds: [], imageError: false, error: '', saving: false
      }
      this.showNewAppModal = true
    },

    closeNewAppModal() {
      this.showNewAppModal = false
      this.editingAppId = null
    },

    autoSlugImage() {
      // Only auto-fill image if user hasn't typed one manually
      if (!this.newApp.image || this.newApp.image.startsWith('images/')) {
        const slug = this.newApp.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '')
        this.newApp.image = slug ? `images/${slug}.png` : ''
      }
    },

    async saveNewApp() {
      this.newApp.error = ''
      if (!this.newApp.name.trim()) { this.newApp.error = 'Name is required.'; return }
      if (!this.newApp.link.trim()) { this.newApp.error = 'Link is required.'; return }

      this.newApp.saving = true
      try {
        const id = `app_${Date.now()}`
        const appObj = {
          id,
          name: this.newApp.name.trim(),
          link: this.newApp.link.trim(),
          image: this.newApp.image.trim() || 'images/placeholder.png',
          description: this.newApp.description.trim(),
          function: this.newApp.function.trim(),
          clicks: 0,
        }

        // Add to applications list
        this.applications.push(appObj)
        this.showPopups[id] = false
        this.flippedPopups[id] = false

        // Add to All category
        this.categories['All'].list.push(appObj)

        // Add to selected categories
        for (const catId of this.newApp.categoryIds) {
          if (this.categories[catId] && catId !== 'All') {
            this.categories[catId].list.push(appObj)
          }
        }

        // Refresh current view
        this.currentCategory = this.categories[this.currentCategoryId]?.list ?? []

        // Persist both apps and categories
        await Promise.all([this.saveApps(), this.saveCategories()])
        this.closeNewAppModal()
      } catch (err) {
        this.newApp.error = 'Save failed. Please try again.'
        console.error(err)
      } finally {
        this.newApp.saving = false
      }
    },

    testPrint(input) {
      console.log(input)
    },

    // ─── Confirmation dialog ──────────────────────────────────────────────────

    showConfirm({ icon = '🗑', title, message, okLabel = 'Delete', onOk }) {
      this.confirm = { visible: true, icon, title, message, okLabel, onOk }
    },

    okConfirm() {
      if (typeof this.confirm.onOk === 'function') this.confirm.onOk()
      this.confirm.visible = false
    },

    cancelConfirm() {
      this.confirm.visible = false
    },

    confirmDeleteApp(appId) {
      const app = this.applications.find(a => a.id === appId)
      this.showConfirm({
        icon: '🗑',
        title: 'Remove app?',
        message: `"${app?.name ?? appId}" will be removed from this category. It will still exist in other categories and in the main list.`,
        okLabel: 'Remove',
        onOk: () => this.deleteApp(appId)
      })
    },

    confirmDeleteCategory(catId) {
      const cat = this.categories[catId]
      this.showConfirm({
        icon: '📂',
        title: 'Delete category?',
        message: `"${cat?.label ?? catId}" will be deleted. Apps inside it will not be removed.`,
        okLabel: 'Delete',
        onOk: () => this.deleteCategory(catId)
      })
    },
  }
})

app.mount("#app")