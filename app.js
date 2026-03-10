const WORKER_URL = "https://tiny-disk-1011.juliusbscales.workers.dev/api/data";

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

      // Edit mode
      editMode: false,
      renamingCategory: null,
      renameValue: "",
      dragSrcId: null,
      managingApp: null,
    }
  },
  mounted() {
    this.init()
  },
  methods: {

    // ─── Init ────────────────────────────────────────────────────────────────

    async init() {
      await this.loadCSV()
      await this.loadCategories()
    },

    // ─── CSV ─────────────────────────────────────────────────────────────────

    loadCSV() {
      return new Promise((resolve, reject) => {
        Papa.parse("Application_Descriptions.csv", {
          download: true,
          header: true,
          skipEmptyLines: true,
          complete: (results) => {
            results.data.forEach((row, index) => {
              const name = row["Application"]
              if (!name) return
              const lowerCaseName = name.toLowerCase().replace(/\s+/g, "_")
              const appObj = {
                id: `app${index + 1}`,
                name: name,
                description: row["Description"],
                function: row["Function"],
                importance: row["Importance"],
                link: "https://youtube.com",
                image: `images/${lowerCaseName}.png`
              }
              this.applications.push(appObj)
              this.showPopups[appObj.id] = false
              this.flippedPopups[appObj.id] = false
            })
            resolve()
          },
          error: (err) => {
            console.error("CSV load error:", err)
            reject(err)
          }
        })
      })
    },

    // ─── KV / Categories ─────────────────────────────────────────────────────

    async loadCategories() {
      try {
        const res = await fetch(WORKER_URL)
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
          this.bootstrapFromCSV()
          await this.saveCategories()
        }
      } catch (err) {
        console.error("KV load error, falling back to CSV:", err)
        this.bootstrapFromCSV()
      }

      this.currentCategory = this.categories["All"]?.list ?? []
      this.currentCategoryId = "All"
    },

    bootstrapFromCSV() {
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
        await fetch(WORKER_URL, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
      } catch (err) {
        console.error("KV save error:", err)
      }
    },

    // ─── Navigation ──────────────────────────────────────────────────────────

    switchCategory(categoryId) {
      this.currentCategoryId = categoryId
      this.currentCategory = this.categories[categoryId]?.list ?? []
      this.managingApp = null
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

    deleteCategory(id) {
      if (id === "All") return
      delete this.categories[id]
      if (this.currentCategoryId === id) {
        this.switchCategory("All")
      }
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
      // Only remove from non-All categories — All always reflects the full CSV
      for (const [key, cat] of Object.entries(this.categories)) {
        if (key === "All") continue
        cat.list = cat.list.filter(a => a.id !== appId)
      }
      if (this.currentCategoryId !== "All") {
        this.currentCategory = this.currentCategory.filter(a => a.id !== appId)
      }
      this.managingApp = null
      this.saveCategories()
    },

    toggleManageApp(appId) {
      this.managingApp = this.managingApp === appId ? null : appId
    },

    // ─── Drag to reorder ─────────────────────────────────────────────────────

    onDragStart(appId) {
      this.dragSrcId = appId
    },

    onDragOver(event) {
      event.preventDefault()
    },

    onDrop(targetAppId) {
      if (!this.dragSrcId || this.dragSrcId === targetAppId) return
      const list = this.currentCategory
      const srcIndex = list.findIndex(a => a.id === this.dragSrcId)
      const tgtIndex = list.findIndex(a => a.id === targetAppId)
      if (srcIndex === -1 || tgtIndex === -1) return
      const [moved] = list.splice(srcIndex, 1)
      list.splice(tgtIndex, 0, moved)
      this.categories[this.currentCategoryId].list = list
      this.dragSrcId = null
      this.saveCategories()
    },

    testPrint(input) {
      console.log(input)
    }
  }
})

app.mount("#app")