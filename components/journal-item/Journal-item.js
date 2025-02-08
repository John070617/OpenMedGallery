Component({
  properties: {
    journal: {
      type: Object,
      value: {}
    }
  },

  methods: {
    onDelete() {
      this.triggerEvent('delete', { id: this.data.journal.id });
    },

    onToggle() {
      this.triggerEvent('toggle', { id: this.data.journal.id });
    }
  }
}); 