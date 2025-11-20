const HOME_PATH = typeof process !== 'undefined' && process.env?.HOME ? `${process.env.HOME}/.pos_app` : null;
const STATE_FILE = 'state.json';

const defaultState = {
  products: [],
  tickets: [],
  sales: [],
  settings: {
    header: 'POS Demo',
    footer: '¡Gracias por su compra! 🎉',
    defaultVat: 21,
    printer: 'Predeterminada',
  },
  session: {
    cashOpen: false,
    openedAt: null,
  },
  cart: {
    vat: 21,
    lines: [],
  },
};

function createLocalDriver() {
  return {
    async load() {
      const raw = localStorage.getItem('pos_app_state');
      return raw ? JSON.parse(raw) : null;
    },
    async save(state) {
      localStorage.setItem('pos_app_state', JSON.stringify(state));
    },
    type: 'localStorage',
  };
}

function createFsDriver() {
  const fs = require('fs');
  const path = require('path');
  if (!fs.existsSync(HOME_PATH)) fs.mkdirSync(HOME_PATH, { recursive: true });
  const filePath = path.join(HOME_PATH, STATE_FILE);
  return {
    async load() {
      if (!fs.existsSync(filePath)) return null;
      return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    },
    async save(state) {
      fs.writeFileSync(filePath, JSON.stringify(state, null, 2));
    },
    type: 'fs',
  };
}

function detectDriver() {
  try {
    if (typeof require === 'function' && typeof process !== 'undefined' && HOME_PATH) {
      return createFsDriver();
    }
  } catch (e) {
    console.warn('No se pudo usar fs, usando almacenamiento local.', e);
  }
  return createLocalDriver();
}

export class DataStore {
  constructor() {
    this.driver = detectDriver();
    this.state = structuredClone(defaultState);
  }

  async hydrate() {
    const loaded = await this.driver.load();
    if (loaded) {
      this.state = Object.assign(structuredClone(defaultState), loaded);
    }
    // Fill missing defaults
    if (!this.state.cart) this.state.cart = structuredClone(defaultState.cart);
    if (!this.state.settings) this.state.settings = structuredClone(defaultState.settings);
    return this.state;
  }

  async persist() {
    await this.driver.save(this.state);
  }

  upsertProducts(list) {
    const byRef = new Map(this.state.products.map((p) => [p.reference, p]));
    list.forEach((p) => byRef.set(p.reference, { ...byRef.get(p.reference), ...p }));
    this.state.products = Array.from(byRef.values());
  }

  addTicket(ticket) {
    this.state.tickets.push(ticket);
    this.state.sales.push(...ticket.lines.map((l) => ({ reference: l.reference, qty: l.quantity })));
  }

  clearDaySales() {
    this.state.sales = [];
  }

  resetCart() {
    this.state.cart = structuredClone(defaultState.cart);
  }

  setCart(lines, vat) {
    this.state.cart.lines = lines;
    this.state.cart.vat = vat;
  }

  updateSettings(settings) {
    this.state.settings = { ...this.state.settings, ...settings };
  }

  openCash() {
    this.state.session.cashOpen = true;
    this.state.session.openedAt = new Date().toISOString();
  }

  closeCash() {
    this.state.session.cashOpen = false;
    this.state.session.openedAt = null;
  }
}
