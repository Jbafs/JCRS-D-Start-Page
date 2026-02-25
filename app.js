const app = Vue.createApp({
  data() {
    return {
      applications: [
        { id: 'app1', name: 'Application 1', description: 'Description for app 1', image: 'images/airflow.png',
          link: "https://www.youtube.com/watch?v=T14DQkV0fEQ"},
        { id: 'app2', name: 'Application 2', description: 'Description for app 2', image: 'images/nifi.png',
          link: "https://www.google.com/maps/place/421+Fox+Catcher+Rd,+Bel+Air,+MD+21015/@39.5044105,-76.3139375,17z/data=!3m1!4b1!4m6!3m5!1s0x89c7dd7a294312cd:0xaba614e451c3e661!8m2!3d39.5044105!4d-76.3113626!16s%2Fg%2F11crv1b7p_?entry=ttu&g_ep=EgoyMDI2MDIyMi4wIKXMDSoASAFQAw%3D%3D"},
        { id: 'app3', name: 'Application 3', description: 'Description for app 3', image: 'images/spark.png',
          link: "https://github.com/Tanker03"}
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

