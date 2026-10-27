var picking = false;
var pickerState = {
  get picking() {
    return picking;
  },
  setPicking(v) {
    picking = !!v;
  }
};
