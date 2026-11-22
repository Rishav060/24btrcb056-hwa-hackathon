(() => {
  'use strict';

  const CART_KEY = 'scent-engine-cart-v1';
  const ORDER_KEY = 'scent-engine-last-order';
  const ORDER_BACKUP_KEY = 'scent-engine-order-backup';
  const PRODUCT = {
    id: 'scent-engine',
    name: 'SCENT ENGINE',
    price: 54.99
  };
  const SCENTS = ['Rabbit', 'Anise', 'Pheasant', 'Fish', 'Fennel', 'Neutral Cotton'];
  const MAX_QTY = 9;
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

  const format = (value) => money.format(Number.isFinite(Number(value)) ? Number(value) : 0);

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (error) {
      return fallback;
    }
  }

  function sanitizeCart(raw) {
    if (!Array.isArray(raw)) return [];

    const merged = new Map();

    raw.forEach((entry) => {
      if (!entry || entry.id !== PRODUCT.id) return;

      const scent = SCENTS.includes(entry.scent) ? entry.scent : SCENTS[0];
      const quantity = Math.min(MAX_QTY, Math.max(1, Math.round(Number(entry.quantity) || 1)));
      const existing = merged.get(scent);

      if (existing) {
        existing.quantity = Math.min(MAX_QTY, existing.quantity + quantity);
      } else {
        merged.set(scent, { id: PRODUCT.id, scent, quantity });
      }
    });

    return Array.from(merged.values());
  }

  function readCart() {
    try {
      return sanitizeCart(safeParse(window.localStorage.getItem(CART_KEY) || '[]', []));
    } catch (error) {
      return [];
    }
  }

  function writeCart(cart) {
    const clean = sanitizeCart(cart);

    try {
      window.localStorage.setItem(CART_KEY, JSON.stringify(clean));
    } catch (error) {
      return clean;
    }

    syncCounters(clean);
    document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart: clean } }));
    return clean;
  }

  function countItems(cart) {
    return cart.reduce((total, item) => total + item.quantity, 0);
  }

  function subtotalOf(cart) {
    return cart.reduce((total, item) => total + PRODUCT.price * item.quantity, 0);
  }

  function syncCounters(cart) {
    const count = countItems(cart);

    document.querySelectorAll('[data-cart-count]').forEach((element) => {
      element.textContent = String(count);
    });

    document.querySelectorAll('.nav-bag').forEach((element) => {
      element.setAttribute('aria-label', `Bag, ${count} ${count === 1 ? 'item' : 'items'}`);
      element.classList.toggle('has-items', count > 0);
    });
  }

  function addItem(scent, quantity) {
    const safeScent = SCENTS.includes(scent) ? scent : SCENTS[0];
    const amount = Math.min(MAX_QTY, Math.max(1, Math.round(Number(quantity) || 1)));
    const cart = readCart();
    const existing = cart.find((item) => item.scent === safeScent);

    if (existing) {
      existing.quantity = Math.min(MAX_QTY, existing.quantity + amount);
    } else {
      cart.push({ id: PRODUCT.id, scent: safeScent, quantity: amount });
    }

    writeCart(cart);
    return safeScent;
  }

  function removeItem(scent) {
    writeCart(readCart().filter((item) => item.scent !== scent));
  }

  function changeQuantity(scent, delta) {
    const cart = readCart();
    const item = cart.find((entry) => entry.scent === scent);
    if (!item) return;

    item.quantity = Math.min(MAX_QTY, Math.max(1, item.quantity + delta));
    writeCart(cart);
  }

  function setQuantity(scent, value) {
    const cart = readCart();
    const item = cart.find((entry) => entry.scent === scent);
    if (!item) return;

    item.quantity = Math.min(MAX_QTY, Math.max(1, Math.round(Number(value) || 1)));
    writeCart(cart);
  }

  let toastTimer = 0;

  function showToast(message, linkLabel) {
    const toast = document.querySelector('[data-toast]');
    if (!toast) return;

    const messageNode = toast.querySelector('[data-toast-message]');
    const link = toast.querySelector('a');
    if (messageNode) messageNode.textContent = message;
    if (link && linkLabel) link.textContent = linkLabel;

    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3400);
  }

  function setThumbScent(thumb, scent) {
    if (!thumb) return;
    thumb.setAttribute('data-scent', scent);
  }

  function initProductPage() {
    const scentButtons = Array.from(document.querySelectorAll('[data-scent]'));
    if (!scentButtons.length) return;

    const scentLabel = document.querySelector('[data-scent-label]');
    const quantityInput = document.querySelector('#quantity');
    let selectedScent = 'Rabbit';

    const quantity = () => {
      const value = Math.min(MAX_QTY, Math.max(1, Math.round(Number(quantityInput && quantityInput.value) || 1)));
      if (quantityInput) quantityInput.value = String(value);
      return value;
    };

    scentButtons.forEach((button) => {
      button.addEventListener('click', () => {
        selectedScent = button.dataset.scent || 'Rabbit';
        scentButtons.forEach((item) => {
          const active = item === button;
          item.classList.toggle('is-selected', active);
          item.setAttribute('aria-pressed', String(active));
        });
        if (scentLabel) scentLabel.textContent = selectedScent;
      });
    });

    const decrease = document.querySelector('[data-qty-down]');
    const increase = document.querySelector('[data-qty-up]');

    if (decrease && quantityInput) {
      decrease.addEventListener('click', () => {
        quantityInput.value = String(Math.max(1, quantity() - 1));
      });
    }

    if (increase && quantityInput) {
      increase.addEventListener('click', () => {
        quantityInput.value = String(Math.min(MAX_QTY, quantity() + 1));
      });
    }

    if (quantityInput) {
      quantityInput.addEventListener('change', quantity);
    }

    document.querySelectorAll('[data-add-to-cart]').forEach((button) => {
      button.addEventListener('click', () => {
        const scent = addItem(selectedScent, quantity());
        showToast(`${scent} added to your bag`, 'View bag');
      });
    });

    const buyNow = document.querySelector('[data-buy-now]');
    if (buyNow) {
      buyNow.addEventListener('click', () => {
        addItem(selectedScent, quantity());
        window.location.assign('checkout.html');
      });
    }
  }

  function initCartPage() {
    const filled = document.querySelector('[data-cart-filled]');
    const empty = document.querySelector('[data-cart-empty]');
    const itemsRoot = document.querySelector('#cart-items');
    const template = document.querySelector('#cart-item-template');
    if (!filled || !empty || !itemsRoot || !template) return;

    const subtotalNode = document.querySelector('[data-summary-subtotal]');
    const totalNode = document.querySelector('[data-summary-total]');
    const inlineTotalNodes = document.querySelectorAll('[data-summary-total-inline]');
    const checkoutLinks = document.querySelectorAll('[data-checkout-link]');

    const render = (cart) => {
      const count = countItems(cart);
      const subtotal = subtotalOf(cart);

      filled.hidden = cart.length === 0;
      empty.hidden = cart.length > 0;
      itemsRoot.textContent = '';

      cart.forEach((item) => {
        const row = template.content.firstElementChild.cloneNode(true);
        row.dataset.scent = item.scent;

        const thumb = row.querySelector('.cart-thumb');
        setThumbScent(thumb, item.scent);

        const name = row.querySelector('[data-item-name]');
        const scent = row.querySelector('[data-item-scent]');
        const total = row.querySelector('[data-item-total]');
        const input = row.querySelector('[data-cart-qty]');

        if (name) name.textContent = PRODUCT.name;
        if (scent) scent.textContent = item.scent;
        if (total) total.textContent = format(PRODUCT.price * item.quantity);
        if (input) input.value = String(item.quantity);

        itemsRoot.appendChild(row);
      });

      if (subtotalNode) subtotalNode.textContent = format(subtotal);
      if (totalNode) totalNode.textContent = format(subtotal);
      inlineTotalNodes.forEach((node) => {
        node.textContent = format(subtotal);
      });

      checkoutLinks.forEach((link) => {
        const disabled = count === 0;
        link.classList.toggle('is-disabled', disabled);
        link.setAttribute('aria-disabled', String(disabled));
        link.setAttribute('href', disabled ? '#' : 'checkout.html');
      });
    };

    itemsRoot.addEventListener('click', (event) => {
      const action = event.target.closest('[data-cart-action]');
      const row = event.target.closest('.cart-item');
      if (!action || !row) return;

      const scent = row.dataset.scent;
      const type = action.dataset.cartAction;

      if (type === 'remove') {
        removeItem(scent);
        showToast('Removed from your bag', 'Keep exploring');
      } else if (type === 'increase') {
        changeQuantity(scent, 1);
      } else if (type === 'decrease') {
        changeQuantity(scent, -1);
      }
    });

    itemsRoot.addEventListener('change', (event) => {
      const input = event.target.closest('[data-cart-qty]');
      const row = event.target.closest('.cart-item');
      if (!input || !row) return;
      setQuantity(row.dataset.scent, input.value);
    });

    checkoutLinks.forEach((link) => {
      link.addEventListener('click', (event) => {
        if (link.classList.contains('is-disabled')) {
          event.preventDefault();
          showToast('Your bag is empty', 'Meet the engine');
        }
      });
    });

    document.addEventListener('cart:updated', (event) => render(event.detail.cart));
    render(readCart());
  }

  function buildOrderItems(cart) {
    return cart.map((item) => ({
      id: PRODUCT.id,
      name: PRODUCT.name,
      scent: item.scent,
      quantity: item.quantity,
      price: PRODUCT.price,
      lineTotal: PRODUCT.price * item.quantity
    }));
  }

  function localOrder(cart, customer) {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 5).toUpperCase();
    const subtotal = subtotalOf(cart);

    return {
      id: `SE-${stamp}-${random}`,
      status: 'concept',
      currency: 'USD',
      unitPrice: PRODUCT.price,
      items: buildOrderItems(cart),
      subtotal,
      shipping: 0,
      total: subtotal,
      customer,
      createdAt: new Date().toISOString(),
      source: 'browser'
    };
  }

  async function requestOrder(endpoint, payload) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 9000);

    try {
      const response = await window.fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (!response.ok) return null;
      const data = await response.json();
      return data && data.order ? data.order : null;
    } catch (error) {
      return null;
    } finally {
      window.clearTimeout(timer);
    }
  }

  function initCheckoutPage() {
    const form = document.querySelector('[data-checkout-form]');
    if (!form) return;

    let cart = readCart();
    if (!cart.length) {
      window.location.replace('cart.html');
      return;
    }

    const itemsRoot = document.querySelector('[data-checkout-items]');
    const template = document.querySelector('#checkout-item-template');
    const subtotalNodes = document.querySelectorAll('[data-checkout-subtotal]');
    const totalNodes = document.querySelectorAll('[data-checkout-total]');
    const errorNode = document.querySelector('[data-form-error]');
    const submitButton = document.querySelector('[data-checkout-submit]');
    const submitLabel = document.querySelector('[data-checkout-label]');
    const total = subtotalOf(cart);

    if (itemsRoot && template) {
      itemsRoot.textContent = '';

      cart.forEach((item) => {
        const row = template.content.firstElementChild.cloneNode(true);
        const thumb = row.querySelector('.cart-thumb');
        setThumbScent(thumb, item.scent);

        const variant = row.querySelector('[data-item-variant]');
        const lineTotal = row.querySelector('[data-item-total]');

        if (variant) variant.textContent = `${item.scent} · Qty ${item.quantity}`;
        if (lineTotal) lineTotal.textContent = format(PRODUCT.price * item.quantity);
        itemsRoot.appendChild(row);
      });
    }

    subtotalNodes.forEach((node) => {
      node.textContent = format(total);
    });

    totalNodes.forEach((node) => {
      node.textContent = format(total);
    });

    const fail = (message) => {
      if (errorNode) {
        errorNode.textContent = message;
        errorNode.hidden = false;
      }
      if (submitButton) submitButton.disabled = false;
      if (submitLabel) submitLabel.textContent = 'Place concept order';
    };

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      cart = readCart();

      if (!cart.length) {
        window.location.replace('cart.html');
        return;
      }

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (errorNode) {
        errorNode.hidden = true;
        errorNode.textContent = '';
      }
      if (submitButton) submitButton.disabled = true;
      if (submitLabel) submitLabel.textContent = 'Placing order…';

      const data = new window.FormData(form);
      const customer = {
        name: `${String(data.get('firstName') || '').trim()} ${String(data.get('lastName') || '').trim()}`.trim(),
        email: String(data.get('email') || '').trim(),
        address1: String(data.get('address1') || '').trim(),
        address2: String(data.get('address2') || '').trim(),
        city: String(data.get('city') || '').trim(),
        postal: String(data.get('postal') || '').trim(),
        country: String(data.get('country') || '').trim(),
        note: String(data.get('note') || '').trim()
      };

      const payload = {
        items: cart.map((item) => ({ id: PRODUCT.id, scent: item.scent, quantity: item.quantity })),
        customer
      };

      try {
        const endpoint = form.dataset.orderEndpoint || '/api/order';
        const remote = await requestOrder(endpoint, payload);
        const fallback = localOrder(cart, customer);
        const order = remote
          ? {
              ...fallback,
              ...remote,
              items: Array.isArray(remote.items) && remote.items.length ? remote.items : fallback.items,
              customer: { ...fallback.customer, ...(remote.customer || {}) },
              source: 'api'
            }
          : fallback;

      try {
        window.localStorage.setItem(ORDER_KEY, JSON.stringify(order));
        window.sessionStorage.setItem(ORDER_BACKUP_KEY, JSON.stringify(order));
      } catch (error) {
        try {
          window.sessionStorage.setItem(ORDER_BACKUP_KEY, JSON.stringify(order));
        } catch (storageError) {
          fail('Your browser could not save the confirmation. Please try again.');
          return;
        }
      }

      writeCart([]);
      window.location.assign(`success.html?order=${encodeURIComponent(order.id)}`);
      } catch (error) {
        fail('Something interrupted the order. Please try again.');
      }
    });
  }

  function initSuccessPage() {
    const content = document.querySelector('[data-success-content]');
    const empty = document.querySelector('[data-success-empty]');
    if (!content || !empty) return;

    const stored = safeParse(window.localStorage.getItem(ORDER_KEY) || 'null', null)
      || safeParse(window.sessionStorage.getItem(ORDER_BACKUP_KEY) || 'null', null);
    const order = stored && Array.isArray(stored.items) && stored.items.length ? stored : null;

    if (!order) {
      content.hidden = true;
      empty.hidden = false;
      return;
    }

    const setText = (selector, value) => {
      const node = document.querySelector(selector);
      if (node) node.textContent = value;
    };

    const date = new Date(order.createdAt);
    const dateLabel = Number.isNaN(date.getTime())
      ? 'Just now'
      : new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);

    setText('[data-order-id]', order.id || 'SE-CONCEPT');
    setText('[data-order-date]', dateLabel);
    setText('[data-order-total]', format(order.total));

    const itemsRoot = document.querySelector('[data-order-items]');
    const template = document.querySelector('#success-item-template');

    if (itemsRoot && template) {
      itemsRoot.textContent = '';
      order.items.forEach((item) => {
        const row = template.content.firstElementChild.cloneNode(true);
        const thumb = row.querySelector('.cart-thumb');
        setThumbScent(thumb, item.scent);

        const variant = row.querySelector('[data-item-variant]');
        const lineTotal = row.querySelector('[data-item-total]');

        if (variant) variant.textContent = `${item.scent || 'Rabbit'} · Qty ${item.quantity}`;
        if (lineTotal) lineTotal.textContent = format(item.lineTotal || item.price * item.quantity);
        itemsRoot.appendChild(row);
      });
    }

    const customer = order.customer || {};
    setText('[data-order-name]', customer.name || 'Concept buyer');
    setText('[data-order-address]', [customer.address1, customer.address2, customer.city, customer.postal, customer.country].filter(Boolean).join(', '));
    setText('[data-order-email]', customer.email || '');

    content.hidden = false;
    empty.hidden = true;
  }

  function init() {
    syncCounters(readCart());

    if (document.body.classList.contains('page-product')) initProductPage();
    if (document.body.classList.contains('page-cart')) initCartPage();
    if (document.body.classList.contains('page-checkout')) initCheckoutPage();
    if (document.body.classList.contains('page-success')) initSuccessPage();

    window.addEventListener('storage', (event) => {
      if (event.key !== CART_KEY) return;
      const cart = readCart();
      syncCounters(cart);
      document.dispatchEvent(new CustomEvent('cart:updated', { detail: { cart } }));
    });
  }

  init();
})();
