const app = Vue.createApp({
  data() {
    return {
      applications: [],
      showPopups: {}
    }
  },

  mounted() {
    this.loadCSV()
  },

  methods: {
    loadCSV() {
      Papa.parse("Application_Descriptions.csv", {
        download: true,
        header: true,
        skipEmptyLines: true,

        complete: (results) => {
          results.data.forEach((row, index) => {
            const name = row["Application"]

            if (!name) return

            const lowerCaseName = name
              .toLowerCase()
              .replace(/\s+/g, "_")

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

          console.log("Loaded apps:", this.applications)
        },

        error: (err) => {
          console.error("CSV load error:", err)
        }
      })
    },

    setPopup(id, value) {
      this.showPopups[id] = value
    }
  }
})

app.mount("#app")