import { DataStore } from './storage.js';

const store = new DataStore();
let state = await store.hydrate();

const productList = document.getElementById('product-list');
const searchInput = document.getElementById('search');
const cartLines = document.getElementById('cart-lines');
const csvInput = document.getElementById('csv-input');
const mappingDialog = document.getElementById('mapping-dialog');
const mappingForm = document.getElementById('mapping-form');
const mappingFields = document.getElementById('mapping-fields');
const settingsDialog = document.getElementById('settings-dialog');
const settingsForm = document.getElementById('settings-form');
const baseTotal = document.getElementById('base-total');
const vatTotal = document.getElementById('vat-total');
const grandTotal = document.getElementById('grand-total');
const ticketVat = document.getElementById('ticket-vat');
const salesTable = document.getElementById('sales-table');
const printArea = document.getElementById('print-area');

let pendingCsvRows = [];

function formatCurrency(value) {
  return `${value.toFixed(2)} €`;
}

function renderProducts(filter = '') {
  const query = filter.toLowerCase();
  const rows = state.products
    .filter((p) =>
      [p.reference, p.description, p.barcode].some((f) => (f || '').toLowerCase().includes(query))
    )
    .map(
      (p) => `<tr>
        <td>${p.reference}</td>
        <td>${p.description || ''}</td>
        <td>${p.barcode || ''}</td>
        <td>${formatCurrency(Number(p.price) || 0)}</td>
        <td><button data-ref="${p.reference}" class="secondary add-product">Añadir</button></td>
      </tr>`
    )
    .join('');
  productList.innerHTML = `<table><thead><tr><th>Ref</th><th>Descripción</th><th>Código barras</th><th>Precio</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  productList.querySelectorAll('.add-product').forEach((btn) => btn.addEventListener('click', addProductToCart));
}

function renderCart() {
  const rows = state.cart.lines
    .map((l, idx) => {
      const base = l.price * l.quantity * (1 - l.discount / 100);
      return `<tr>
        <td>${l.reference}</td>
        <td>${l.description || ''}</td>
        <td>${formatCurrency(l.price)}</td>
        <td><input data-idx="${idx}" data-field="quantity" type="number" min="1" value="${l.quantity}" /></td>
        <td><input data-idx="${idx}" data-field="discount" type="number" min="0" step="0.01" value="${l.discount}" /></td>
        <td>${formatCurrency(base)}</td>
        <td><button data-idx="${idx}" class="secondary remove-line">Eliminar</button></td>
      </tr>`;
    })
    .join('');
  cartLines.innerHTML = `<table><thead><tr><th>Ref</th><th>Descripción</th><th>Precio</th><th>Cantidad</th><th>DTO %</th><th>Subtotal</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
  cartLines.querySelectorAll('input').forEach((input) => input.addEventListener('change', updateLine));
  cartLines.querySelectorAll('.remove-line').forEach((btn) => btn.addEventListener('click', removeLine));
  refreshTotals();
}

function renderSales() {
  const grouped = state.sales.reduce((acc, sale) => {
    acc[sale.reference] = (acc[sale.reference] || 0) + sale.qty;
    return acc;
  }, {});
  const rows = Object.entries(grouped)
    .map(([reference, qty]) => `<tr><td>${reference}</td><td>${qty}</td></tr>`)
    .join('');
  salesTable.innerHTML = `<table><thead><tr><th>Referencia</th><th>Ventas</th></tr></thead><tbody>${rows}</tbody></table>`;
}

function refreshTotals() {
  ticketVat.value = state.cart.vat;
  const base = state.cart.lines.reduce((sum, l) => sum + l.price * l.quantity * (1 - l.discount / 100), 0);
  const vatAmount = (base * Number(state.cart.vat || 0)) / 100;
  baseTotal.textContent = formatCurrency(base);
  vatTotal.textContent = formatCurrency(vatAmount);
  grandTotal.textContent = formatCurrency(base + vatAmount);
}

function addProductToCart(event) {
  const ref = event.target.dataset.ref;
  const product = state.products.find((p) => p.reference === ref);
  if (!product) return;
  const existing = state.cart.lines.find((l) => l.reference === ref && l.discount === 0);
  if (existing) {
    existing.quantity += 1;
  } else {
    state.cart.lines.push({
      reference: product.reference,
      description: product.description,
      barcode: product.barcode,
      price: Number(product.price) || 0,
      quantity: 1,
      discount: 0,
    });
  }
  store.setCart(state.cart.lines, state.cart.vat);
  store.persist();
  renderCart();
}

function updateLine(event) {
  const idx = Number(event.target.dataset.idx);
  const field = event.target.dataset.field;
  const value = Number(event.target.value);
  state.cart.lines[idx][field] = value;
  store.setCart(state.cart.lines, state.cart.vat);
  store.persist();
  refreshTotals();
}

function removeLine(event) {
  const idx = Number(event.target.dataset.idx);
  state.cart.lines.splice(idx, 1);
  store.setCart(state.cart.lines, state.cart.vat);
  store.persist();
  renderCart();
}

function parseCsv(text) {
  return text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(';').length > 1 ? line.split(';') : line.split(','));
}

function showMappingDialog(headers) {
  mappingFields.innerHTML = '';
  const options = headers.map((h, i) => `<option value="${i}">${h}</option>`).join('');
  const fields = [
    ['reference', 'Referencia'],
    ['description', 'Descripción'],
    ['barcode', 'Código de barras'],
    ['price', 'Precio venta'],
  ];
  fields.forEach(([key, label]) => {
    const wrapper = document.createElement('label');
    wrapper.innerHTML = `${label}<select name="${key}" required><option value="">Selecciona</option>${options}</select>`;
    mappingFields.appendChild(wrapper);
  });
  mappingDialog.showModal();
}

async function handleCsvImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const rows = parseCsv(text);
  const headers = rows[0];
  pendingCsvRows = rows.slice(1);
  showMappingDialog(headers);
}

mappingForm.addEventListener('close', () => {
  pendingCsvRows = [];
});

mappingForm.addEventListener('submit', (event) => event.preventDefault());
mappingForm.addEventListener('click', (event) => {
  if (event.target.value !== 'confirm') return;
  const formData = new FormData(mappingForm);
  const columnMap = Object.fromEntries(formData.entries());
  const products = pendingCsvRows.map((row) => ({
    reference: row[columnMap.reference] || '',
    description: row[columnMap.description] || '',
    barcode: row[columnMap.barcode] || '',
    price: Number(row[columnMap.price] || 0),
  }));
  store.upsertProducts(products.filter((p) => p.reference));
  store.persist();
  state = store.state;
  renderProducts(searchInput.value);
  mappingDialog.close('confirm');
});

function addManualLine() {
  const ref = document.getElementById('manual-ref').value.trim();
  const desc = document.getElementById('manual-desc').value.trim();
  const barcode = document.getElementById('manual-barcode').value.trim();
  const price = Number(document.getElementById('manual-price').value || 0);
  const discount = Number(document.getElementById('manual-discount').value || 0);
  if (!ref) return;
  state.cart.lines.push({ reference: ref, description: desc, barcode, price, quantity: 1, discount });
  store.setCart(state.cart.lines, state.cart.vat);
  store.persist();
  renderCart();
}

function handleSearch() {
  renderProducts(searchInput.value);
}

function clearCart() {
  state.cart.lines = [];
  store.resetCart();
  store.persist();
  renderCart();
}

function exportCsv(filename, rows, headers) {
  const csv = [headers.join(',')]
    .concat(rows.map((r) => headers.map((h) => r[h]).join(',')))
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
}

function exportProducts() {
  if (!state.products.length) return alert('No hay productos para exportar');
  exportCsv('productos.csv', state.products, ['reference', 'description', 'barcode', 'price']);
}

function exportSales() {
  const grouped = state.sales.reduce((acc, sale) => {
    acc[sale.reference] = (acc[sale.reference] || 0) + sale.qty;
    return acc;
  }, {});
  const rows = Object.entries(grouped).map(([reference, qty]) => ({ reference, qty }));
  if (!rows.length) return alert('No hay ventas registradas');
  exportCsv('ventas_dia.csv', rows, ['reference', 'qty']);
}

function buildTicketHTML(ticket, closing = false) {
  const { header, footer, printer } = state.settings;
  const linesHtml = ticket.lines
    .map(
      (l) => `<div class="ticket-line">
        <span>${l.quantity} x ${l.reference}</span>
        <span>${formatCurrency(l.price)}</span>
      </div>`
    )
    .join('');
  return `<div class="ticket">
    <h3>${header}</h3>
    <p class="muted">Impresora: ${printer}</p>
    <p class="muted">${closing ? 'Cierre de caja' : 'Ticket de venta'}</p>
    <div class="ticket-lines">${linesHtml}</div>
    <div class="ticket-totals">
      <div><span>Base</span><span>${formatCurrency(ticket.base)}</span></div>
      <div><span>IVA (${ticket.vat}%)</span><span>${formatCurrency(ticket.vatAmount)}</span></div>
      <div class="grand"><span>Total</span><span>${formatCurrency(ticket.total)}</span></div>
    </div>
    <p class="muted">${footer}</p>
  </div>`;
}

function printTicket(ticket, closing = false) {
  printArea.innerHTML = buildTicketHTML(ticket, closing);
  window.print();
}

function charge() {
  if (!state.session.cashOpen) return alert('Debes abrir caja antes de cobrar.');
  if (!state.cart.lines.length) return alert('Añade líneas al ticket.');
  const vat = Number(ticketVat.value || state.cart.vat || 0);
  const base = state.cart.lines.reduce((sum, l) => sum + l.price * l.quantity * (1 - l.discount / 100), 0);
  const vatAmount = (base * vat) / 100;
  const total = base + vatAmount;
  const ticket = {
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    vat,
    base,
    vatAmount,
    total,
    lines: structuredClone(state.cart.lines),
  };
  store.addTicket(ticket);
  store.resetCart();
  state = store.state;
  store.persist();
  renderCart();
  renderSales();
  printTicket(ticket);
}

function openCash() {
  store.openCash();
  state = store.state;
  store.persist();
  alert('Caja abierta.');
}

function closeCash() {
  if (!state.session.cashOpen) return alert('La caja ya está cerrada.');
  const exportToday = confirm('¿Exportar ventas del día a CSV?');
  const grouped = state.sales.reduce((acc, sale) => {
    acc[sale.reference] = (acc[sale.reference] || 0) + sale.qty;
    return acc;
  }, {});
  if (exportToday) {
    const rows = Object.entries(grouped).map(([reference, qty]) => ({ reference, qty }));
    if (rows.length) exportCsv('ventas_dia.csv', rows, ['reference', 'qty']);
  }
  const base = state.sales.reduce((sum, sale) => {
    const product = state.products.find((p) => p.reference === sale.reference);
    const price = product ? Number(product.price) : 0;
    return sum + price * sale.qty;
  }, 0);
  const vatAmount = (base * Number(state.settings.defaultVat || 0)) / 100;
  const total = base + vatAmount;
  const ticket = { lines: Object.entries(grouped).map(([reference, qty]) => ({ reference, quantity: qty, price: 0, discount: 0 })), vat: state.settings.defaultVat, base, vatAmount, total };
  printTicket(ticket, true);
  store.clearDaySales();
  store.closeCash();
  state = store.state;
  store.persist();
  renderSales();
}

function openSettings() {
  document.getElementById('setting-header').value = state.settings.header;
  document.getElementById('setting-footer').value = state.settings.footer;
  document.getElementById('setting-default-vat').value = state.settings.defaultVat;
  document.getElementById('setting-printer').value = state.settings.printer;
  settingsDialog.showModal();
}

settingsForm.addEventListener('click', (event) => {
  if (event.target.value !== 'save') return;
  const header = document.getElementById('setting-header').value;
  const footer = document.getElementById('setting-footer').value;
  const defaultVat = Number(document.getElementById('setting-default-vat').value || 0);
  const printer = document.getElementById('setting-printer').value;
  store.updateSettings({ header, footer, defaultVat, printer });
  store.persist();
  state = store.state;
  ticketVat.value = state.settings.defaultVat;
  settingsDialog.close('save');
});

function restoreUi() {
  ticketVat.value = state.cart.vat ?? state.settings.defaultVat;
  renderProducts();
  renderCart();
  renderSales();
}

csvInput.addEventListener('change', handleCsvImport);
searchInput.addEventListener('input', handleSearch);

document.getElementById('btn-add-manual').addEventListener('click', addManualLine);
document.getElementById('btn-clear-cart').addEventListener('click', clearCart);
document.getElementById('btn-export-products').addEventListener('click', exportProducts);
document.getElementById('btn-export-sales').addEventListener('click', exportSales);
document.getElementById('btn-charge').addEventListener('click', charge);

document.getElementById('btn-open-cash').addEventListener('click', openCash);
document.getElementById('btn-close-cash').addEventListener('click', closeCash);
document.getElementById('btn-settings').addEventListener('click', openSettings);

ticketVat.addEventListener('change', (event) => {
  state.cart.vat = Number(event.target.value || 0);
  store.setCart(state.cart.lines, state.cart.vat);
  store.persist();
  refreshTotals();
});

restoreUi();
