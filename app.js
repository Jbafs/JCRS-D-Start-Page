const WORKER_URL = "https://tiny-disk-1011.juliusbscales.workers.dev/api/data";

const app = Vue.createApp({
  data() {
    return {
      applications: [],
      categories: {},
      showPopups: {},
      showCategories: false,
      currentCategory: null
    }
  },
  mounted() {
    this.init()
  },
  methods: {

    async init() {
      await this.loadCSV()
      await this.loadCategories()
    },

    // Loads apps from CSV into this.applications
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

    // Tries KV first, falls back to bootstrapping from CSV
    async loadCategories() {
      try {
        const res = await fetch(WORKER_URL)
        const json = await res.json()
        const hasData = json.categories && Object.keys(json.categories).length > 0

        if (hasData) {
          // KV has data — reconstruct lists from appIds
          this.categories = {}
          for (const [key, cat] of Object.entries(json.categories)) {
            this.categories[key] = {
              id: cat.id,
              label: cat.label,
              list: cat.appIds
                .map(id => this.applications.find(a => a.id === id))
                .filter(Boolean) // silently drop appIds no longer in CSV
            }
          }
        } else {
          // KV is empty — bootstrap from CSV and save
          this.bootstrapFromCSV()
          await this.saveCategories()
        }
      } catch (err) {
        console.error("KV load error, falling back to CSV:", err)
        this.bootstrapFromCSV()
      }

      this.currentCategory = this.categories["All"]?.list ?? []
    },

    // Builds categories from CSV function column (first-run only)
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

    // Serializes categories to KV (appIds only, no full app objects)
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

    setPopup(id, value) {
      this.showPopups[id] = value
    },

    switchCategory(category) {
      console.log("Switching to category:", category)
      this.currentCategory = this.categories[category]?.list ?? []
    },

    testPrint(input) {
      console.log(input)
    }
  }
})

app.mount("#app")