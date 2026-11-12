const $ = (id) => document.getElementById(id);

export class UI {
  constructor() {
    this.world = $('world');
    this.coinEl = $('coinCount'); this.coinPill = $('coinPill');
    this.shownCoins = 0;
    this.taskEl = $('task'); this.taskTitle = $('taskTitle'); this.taskSub = $('taskSub'); this.taskFill = $('taskFill');
    this.hintEl = $('hint');
    this.wringGuide = $('wringGuide');
    this.shop = $('shop'); this.shopList = $('shopList'); this.shopBadge = $('shopBadge');
    this.cele = $('celebrate');
    this.title = $('title');
    $('shopClose').onclick = () => this.toggleShop(false);
    $('btnShop').onclick = () => this.toggleShop();
    this.tags = {};
  }
  setCoins(n, bump = false) {
    this.shownCoins = n;
    this.coinEl.textContent = Math.floor(n).toLocaleString();
    if (bump) { this.coinPill.classList.remove('bump'); void this.coinPill.offsetWidth; this.coinPill.classList.add('bump'); }
  }
  setBasket(num, done, total) {
    $('basketLabel').textContent = `Basket ${num}`;
    const d = $('basketDots');
    if (d.children.length !== total) { d.innerHTML = ''; for (let i = 0; i < total; i++) d.appendChild(document.createElement('i')); }
    [...d.children].forEach((c, i) => c.classList.toggle('on', i < done));
  }
  task(title, sub, p = null) {
    this.taskEl.classList.remove('hidden');
    if (title !== undefined && this._tt !== title) { this.taskTitle.textContent = title; this._tt = title; }
    if (sub !== undefined && this._ts !== sub) { this.taskSub.textContent = sub; this._ts = sub; }
    if (p !== null) this.taskFill.style.width = `${Math.round(Math.max(0, Math.min(1, p)) * 100)}%`;
  }
  hideTask() { this.taskEl.classList.add('hidden'); }
  hint(html) {
    if (!html) { this.hintEl.classList.add('hidden'); this._h = null; return; }
    if (this._h !== html) { this.hintEl.innerHTML = html; this._h = html; }
    this.hintEl.classList.remove('hidden');
  }
  popup(text, x, y, cls = '') {
    const el = document.createElement('div'); el.className = 'popup ' + cls; el.textContent = text;
    el.style.left = x + 'px'; el.style.top = y + 'px'; this.world.appendChild(el);
    setTimeout(() => el.remove(), 1400);
  }
  flyCoins(x, y, n, onEach) {
    const r = this.coinPill.querySelector('.coin').getBoundingClientRect();
    const tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    for (let i = 0; i < n; i++) {
      const el = document.createElement('div'); el.className = 'flycoin';
      el.style.left = x + 'px'; el.style.top = y + 'px';
      this.world.appendChild(el);
      const a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 50;
      const mx = x + Math.cos(a) * d, my = y + Math.sin(a) * d - 30;
      const delay = i * 55;
      el.animate([
        { transform: 'translate(0,0) scale(.3)', offset: 0 },
        { transform: `translate(${mx - x}px,${my - y}px) scale(1.15)`, offset: 0.3 },
        { transform: `translate(${tx - x}px,${ty - y}px) scale(.8)`, offset: 1 },
      ], { duration: 750, delay, easing: 'cubic-bezier(.5,0,.6,1)', fill: 'forwards' });
      setTimeout(() => { el.remove(); onEach?.(i); }, 750 + delay);
    }
  }
  ring() { const el = document.createElement('div'); el.className = 'ring'; el.innerHTML = '<span>☀</span>'; this.world.appendChild(el); return el; }
  place(el, x, y, vis = true) { el.style.left = x + 'px'; el.style.top = y + 'px'; el.style.display = vis ? '' : 'none'; }
  zoneTag(id, text) {
    if (!this.tags[id]) { const el = document.createElement('div'); el.className = 'zone-tag hidden'; el.textContent = text; this.world.appendChild(el); this.tags[id] = el; }
    return this.tags[id];
  }
  toggleShop(on) {
    const open = on ?? !this.shop.classList.contains('open');
    this.shop.classList.toggle('open', open);
    this.onShop?.(open);
  }
  get shopOpen() { return this.shop.classList.contains('open'); }
  renderShop(items, coins, onBuy) {
    this.shopList.innerHTML = '';
    let any = false;
    for (const it of items) {
      const c = document.createElement('div'); c.className = 'card';
      const max = it.level >= it.max;
      const can = !max && coins >= it.cost;
      if (can) any = true;
      c.innerHTML = `<div class="ic" style="background:${it.color}"><span style="font-size:32px">${it.icon}</span></div>
        <div><div class="nm">${it.name} <span class="lv">${it.levelText}</span></div><div class="ds">${it.desc}</div></div>`;
      const b = document.createElement('button'); b.className = 'buy' + (max ? ' max' : '');
      if (max) b.textContent = 'MAX'; else { b.innerHTML = `<div class="coin"></div>${it.cost.toLocaleString()}`; if (!can) b.disabled = true; }
      b.onclick = () => onBuy(it.id);
      c.appendChild(b); this.shopList.appendChild(c);
    }
    this.shopBadge.classList.toggle('on', any);
  }
  showCelebrate(rows, onNext) {
    $('celeRows').innerHTML = rows.map(([a, b]) => `<div><span>${a}</span><b>${b}</b></div>`).join('');
    this.cele.classList.remove('hidden');
    const card = this.cele.querySelector('.cele-card'); card.style.animation = 'none'; void card.offsetWidth; card.style.animation = '';
    let done = false;
    const go = (e) => { if (done) return; done = true; e?.stopPropagation(); this.cele.classList.add('hidden'); this.cele.onclick = null; onNext(); };
    $('celeNext').onclick = go;
    setTimeout(() => { if (!done) this.cele.onclick = go; }, 350);
  }
}
