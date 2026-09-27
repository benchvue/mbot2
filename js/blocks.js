/* Draws mBlock-style blocks and highlights the block each script is running. */
(function (G) {
  'use strict';

  /* "(v)" input slot, "[v]" dropdown, "[#hex|v]" color dropdown, "{cat|...}" reporter */
  function renderText(str, into) {
    let i = 0, buf = '';
    const flush = () => { if (buf) { into.appendChild(document.createTextNode(buf)); buf = ''; } };
    while (i < str.length) {
      const ch = str[i];
      if (ch === '(') {
        const j = str.indexOf(')', i);
        flush();
        const s = document.createElement('span');
        s.className = 'slot'; s.textContent = str.slice(i + 1, j);
        into.appendChild(s); i = j + 1;
      } else if (ch === '[') {
        const j = str.indexOf(']', i);
        flush();
        let inner = str.slice(i + 1, j);
        const s = document.createElement('span');
        s.className = 'drop';
        if (inner.startsWith('#') && inner.includes('|')) {
          const [hex, lab] = inner.split('|');
          const dot = document.createElement('i');
          dot.className = 'dot'; dot.style.background = hex;
          s.appendChild(dot); inner = lab;
        }
        s.appendChild(document.createTextNode(inner));
        into.appendChild(s); i = j + 1;
      } else if (ch === '{') {
        let depth = 1, j = i + 1;
        while (j < str.length && depth) { if (str[j] === '{') depth++; if (str[j] === '}') depth--; j++; }
        flush();
        const inner = str.slice(i + 1, j - 1), bar = inner.indexOf('|');
        const s = document.createElement('span');
        s.className = 'pill cat-' + inner.slice(0, bar);
        renderText(inner.slice(bar + 1), s);
        into.appendChild(s); i = j;
      } else { buf += ch; i++; }
    }
    flush();
  }

  class BlockView {
    constructor(container) {
      this.container = container;
      this.map = new Map();
      this.active = new Map(); // lane -> element
      this.seq = 0;
    }

    render(demo) {
      this.container.innerHTML = '';
      this.map.clear();
      this.active.clear();
      this.seq = 0;
      demo.scripts.forEach((script) => {
        const st = this.renderStack(script);
        st.classList.add('script');
        this.container.appendChild(st);
      });
    }

    renderStack(list) {
      const st = document.createElement('div');
      st.className = 'stack';
      for (const b of list) st.appendChild(this.renderBlock(b));
      return st;
    }

    renderBlock(b) {
      b.id = 'b' + (++this.seq);
      if (['forever', 'repeat', 'repeat_until', 'if'].includes(b.op)) return this.renderC(b);
      const el = document.createElement('div');
      el.className = `blk cat-${b.cat}` + (b.op === 'when_start' || b.op === 'define' ? ' hat' : '');
      renderText(b.text, el);
      this.map.set(b.id, { el });
      return el;
    }

    renderC(b) {
      const wrap = document.createElement('div');
      wrap.className = `cblk cat-${b.cat}`;
      const head = document.createElement('div');
      head.className = `blk cat-${b.cat}`;
      const entry = { el: head };

      if (b.cond) {
        const [pre, post] = b.text.split('%c');
        head.appendChild(document.createTextNode(pre));
        const hex = document.createElement('span');
        hex.className = 'hex cat-' + b.cond.cat;
        renderText(b.cond.text, hex);
        head.appendChild(hex);
        if (post) head.appendChild(document.createTextNode(post));
        const badge = document.createElement('span');
        badge.className = 'cond-badge';
        head.appendChild(badge);
        entry.badge = badge;
      } else {
        renderText(b.text, head);
        if (b.op === 'repeat') {
          const lc = document.createElement('span');
          lc.className = 'loop-count';
          head.appendChild(lc);
          entry.loop = lc;
        }
      }
      wrap.appendChild(head);
      const body = this.renderStack(b.body || []);
      body.classList.add('c-body');
      wrap.appendChild(body);
      if (b.else) {
        const mid = document.createElement('div');
        mid.className = 'c-mid';
        mid.textContent = 'else';
        wrap.appendChild(mid);
        const eb = this.renderStack(b.else);
        eb.classList.add('c-body');
        wrap.appendChild(eb);
      }
      const foot = document.createElement('div');
      foot.className = 'c-foot' + (b.op !== 'if' ? ' loop' : '');
      wrap.appendChild(foot);
      this.map.set(b.id, entry);
      return wrap;
    }

    highlight(id, lane) {
      if (lane === 'all') {
        for (const el of this.active.values()) el.classList.remove('active');
        this.active.clear();
        return;
      }
      const prev = this.active.get(lane);
      if (prev) prev.classList.remove('active');
      this.active.delete(lane);
      const e = id && this.map.get(id);
      if (!e) return;
      e.el.classList.add('active');
      this.active.set(lane, e.el);
      if (lane === 0) this.scrollIntoViewIfNeeded(e.el);
    }

    scrollIntoViewIfNeeded(el) {
      const ws = this.container.closest('.workspace');
      if (!ws) return;
      const a = el.getBoundingClientRect(), w = ws.getBoundingClientRect();
      if (a.top < w.top + 10 || a.bottom > w.bottom - 10) ws.scrollTop += a.top - w.top - w.height / 3;
      if (a.left < w.left || a.right > w.right) ws.scrollLeft += a.left - w.left - 40;
    }

    condResult(id, ok) {
      const e = this.map.get(id);
      if (!e || !e.badge) return;
      e.badge.className = 'cond-badge ' + (ok ? 'yes' : 'no');
      e.badge.textContent = ok ? '✓' : '✗';
      clearTimeout(e.t);
      e.t = setTimeout(() => { e.badge.className = 'cond-badge'; }, 700);
    }

    loopCount(id, i, n) {
      const e = this.map.get(id);
      if (!e || !e.loop) return;
      e.loop.textContent = `${i}/${n}`;
      e.loop.classList.add('on');
    }

    clearMarks() {
      this.highlight(null, 'all');
      for (const e of this.map.values()) {
        if (e.badge) e.badge.className = 'cond-badge';
        if (e.loop) e.loop.classList.remove('on');
      }
    }
  }

  G.BlockView = BlockView;
})(window);
