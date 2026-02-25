const app = Vue.createApp({
  data() {
    return {
      applications: [
        { id: 'app1', name: 'Application 1', description: 'Description for app 1', link: "youtube.com"},
        { id: 'app2', name: 'Application 2', description: 'Description for app 2', link: "youtube.com"},
        { id: 'app3', name: 'Application 3', description: 'Description for app 3', link: "youtube.com"}
      ],

      showPopups: {}
    }
  },

  created() {
    // Initialize popup visibility for each app
    this.applications.forEach(app => {
      this.showPopups[app.id] = false
    })
  },

  methods: {
    setPopup(id, value) {
      this.showPopups[id] = value
    }
  }
})

app.mount("#app")

